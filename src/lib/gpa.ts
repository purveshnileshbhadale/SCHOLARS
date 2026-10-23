/**
 * GPA / WAM engine — deterministic Australian grading scales.
 * Marks map to bands per the chosen scale; GPA is credit-weighted.
 * The 7→4 point conversion is indicative (universities differ).
 */

export interface GradeBand {
  letter: string;
  label: string;
  /** Inclusive lower bound (%). */
  min: number;
  /** Exclusive upper bound (%), null = open-ended. */
  max: number | null;
  points7: number;
  /** Representative % when the student enters a letter instead of a mark. */
  typical: number;
}

export type ScaleKey = "standard" | "h1h3" | "melbourne";

export const SCALES: Record<ScaleKey, { label: string; blurb: string; bands: GradeBand[] }> = {
  standard: {
    label: "HD / D / C / P (RMIT, Deakin, Monash-style)",
    blurb: "The most common Australian band set for international transcripts.",
    bands: [
      { letter: "HD", label: "High Distinction", min: 80, max: null, points7: 7, typical: 85 },
      { letter: "D", label: "Distinction", min: 70, max: 80, points7: 6, typical: 75 },
      { letter: "C", label: "Credit", min: 60, max: 70, points7: 5, typical: 65 },
      { letter: "P", label: "Pass", min: 50, max: 60, points7: 4, typical: 55 },
      { letter: "F", label: "Fail", min: 0, max: 50, points7: 0, typical: 30 },
    ],
  },
  h1h3: {
    label: "H1 / H2 / H3 (UTS-style honours bands)",
    blurb: "Higher bands start later — an 84% is H2 here, not H1.",
    bands: [
      { letter: "H1", label: "High Distinction", min: 85, max: null, points7: 7, typical: 90 },
      { letter: "H2", label: "Distinction", min: 75, max: 85, points7: 6, typical: 80 },
      { letter: "H3", label: "Credit", min: 65, max: 75, points7: 5, typical: 70 },
      { letter: "P", label: "Pass", min: 50, max: 65, points7: 4, typical: 57 },
      { letter: "F", label: "Fail", min: 0, max: 50, points7: 0, typical: 30 },
    ],
  },
  melbourne: {
    label: "H1 / H2A / H2B / H3 (Melbourne-style)",
    blurb: "Split distinction band — H2A and H2B count differently on the 7-point scale.",
    bands: [
      { letter: "H1", label: "High Distinction", min: 80, max: null, points7: 7, typical: 85 },
      { letter: "H2A", label: "Distinction (A)", min: 75, max: 80, points7: 6, typical: 77 },
      { letter: "H2B", label: "Distinction (B)", min: 70, max: 75, points7: 5, typical: 72 },
      { letter: "H3", label: "Credit", min: 65, max: 70, points7: 4, typical: 67 },
      { letter: "P", label: "Pass", min: 50, max: 65, points7: 3, typical: 55 },
      { letter: "N", label: "Fail", min: 0, max: 50, points7: 0, typical: 30 },
    ],
  },
};

export interface GpaUnit {
  id: string;
  name: string;
  /** Percentage 0–100, or null if only a letter was entered. */
  mark: number | null;
  /** Letter override — used when mark is null. */
  letter: string | null;
  /** Credit / weighting points. */
  credits: number;
}

/** Common 7-point → US-style 4-point conversion (indicative). */
const SEVEN_TO_FOUR: Record<number, number> = { 7: 4.0, 6: 3.3, 5: 2.3, 4: 1.5, 3: 1.0, 2: 0.7, 1: 0.3, 0: 0 };

export function bandFor(scale: ScaleKey, mark: number): GradeBand | null {
  const bands = SCALES[scale].bands;
  return bands.find((b) => mark >= b.min && (b.max == null || mark < b.max)) ?? null;
}

export function bandForLetter(scale: ScaleKey, letter: string): GradeBand | null {
  const l = letter.trim().toUpperCase();
  return SCALES[scale].bands.find((b) => b.letter === l) ?? null;
}

export interface GpaResult {
  units: number;
  totalCredits: number;
  /** Credit-weighted percentage average. */
  wam: number | null;
  /** Credit-weighted 7-point GPA. */
  gpa7: number | null;
  /** Indicative 4-point conversion of gpa7. */
  gpa4: number | null;
  bandCounts: Record<string, number>;
  graded: number;
}

export function computeGpa(units: GpaUnit[], scale: ScaleKey): GpaResult {
  const empty: GpaResult = { units: units.length, totalCredits: 0, wam: null, gpa7: null, gpa4: null, bandCounts: {}, graded: 0 };
  let credits = 0;
  let markSum = 0;
  let pointSum = 0;
  let graded = 0;
  const bandCounts: Record<string, number> = {};

  for (const u of units) {
    const c = Math.max(0, u.credits || 0);
    let mark: number | null = u.mark;
    if (mark == null && u.letter) {
      const b = bandForLetter(scale, u.letter);
      mark = b ? b.typical : null;
    }
    if (mark == null || c === 0) continue;
    const m = Math.min(100, Math.max(0, mark));
    const band = bandFor(scale, m);
    if (!band) continue;
    credits += c;
    markSum += m * c;
    pointSum += band.points7 * c;
    graded++;
    bandCounts[band.letter] = (bandCounts[band.letter] ?? 0) + 1;
  }

  if (credits <= 0) return empty;
  const wam = markSum / credits;
  const gpa7 = pointSum / credits;
  const lower = Math.floor(gpa7);
  const upper = Math.min(7, lower + 1);
  const frac = gpa7 - lower;
  const gpa4 = (SEVEN_TO_FOUR[lower] ?? 0) + frac * ((SEVEN_TO_FOUR[upper] ?? 0) - (SEVEN_TO_FOUR[lower] ?? 0));

  return { units: units.length, totalCredits: credits, wam, gpa7, gpa4, bandCounts, graded };
}

export interface GpaClass {
  label: string;
  note: string;
  tone: string;
}

/** What a 7-point GPA roughly means for admissions. */
export function gpaClass(gpa7: number | null): GpaClass {
  if (gpa7 == null) return { label: "—", note: "Add graded units to see where you stand.", tone: "text-slate-400" };
  if (gpa7 >= 6.5) return { label: "First-class equivalent", note: "Competitive for merit scholarships and most master's cut-offs.", tone: "text-emerald-700" };
  if (gpa7 >= 5.5) return { label: "Upper second-class equivalent", note: "Meets the standard 5.5–6.0 entry for most Australian master's programmes.", tone: "text-emerald-600" };
  if (gpa7 >= 4.5) return { label: "Second-class equivalent", note: "Admissible for many programmes — pair with work experience or a strong SOP.", tone: "text-amber-600" };
  if (gpa7 >= 3.5) return { label: "Pass range", note: "Look for pathway/graduate-entry options or programs without a hard GPA cut-off.", tone: "text-amber-600" };
  return { label: "Below pass average", note: "Consider a pathway (Graduate Certificate/Diploma) or bolster with experience.", tone: "text-rose-600" };
}

/** Indian percentage → indicative Australian band (common rule-of-thumb bands). */
export function indianToAustralianBand(pct: number): { letter: string; note: string } {
  if (pct >= 85) return { letter: "HD", note: "≈ First class / H1 territory" };
  if (pct >= 75) return { letter: "D", note: "≈ First class (lower) / Distinction" };
  if (pct >= 65) return { letter: "C", note: "≈ Upper second class / Credit" };
  if (pct >= 55) return { letter: "P", note: "≈ Second class / Pass" };
  if (pct >= 50) return { letter: "P", note: "Borderline pass — many unis want 55%+ for master's entry" };
  return { letter: "F", note: "Below most Australian pass thresholds" };
}

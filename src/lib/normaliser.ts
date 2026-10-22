// ============================================================
// Engine 1 — Profile Normaliser
// Turns raw marks, scores and activities into comparable
// numbers on one scale, so a CBSE 92% and an IB 38 sit together.
// Deterministic rules only — no LLM.
// ============================================================

export type GradingSystem = "cbse" | "icse" | "state" | "ib" | "gpa" | "ap" | "other";

/** Convert a raw grade on any known scale to a 0-100 percentage. */
export function toPercentage(raw: number, system: string): number {
  const s = (system || "cbse").toLowerCase();
  if (s === "cbse" || s === "icse" || s === "state") return clamp(raw, 0, 100);
  if (s === "ib") {
    // IB Diploma points 24-45 → approximate percentage.
    // 24 ≈ 53 %, 32 ≈ 71 %, 38 ≈ 84 %, 42 ≈ 93 %, 45 ≈ 99 %.
    return clamp(53 + ((raw - 24) / 21) * 46, 0, 100);
  }
  if (s === "gpa" || s === "usgpa") {
    // US GPA 0-4.0 → percentage (common WES-style mapping).
    return clamp(raw * 25, 0, 100);
  }
  if (s === "ap") {
    // AP exams 1-5 → percentage (1≈50, 5≈95).
    return clamp(50 + (raw - 1) * 11.25, 0, 100);
  }
  return clamp(raw, 0, 100);
}

/** Academic index 0-100 from class 10 + class 12 (class 12 weighted higher). */
export function academicIndex(
  class10: number | null,
  class12: number | null,
  system: string,
): number {
  const p10 = class10 != null ? toPercentage(class10, system) : null;
  const p12 = class12 != null ? toPercentage(class12, system) : null;
  if (p10 != null && p12 != null) return Math.round(p10 * 0.35 + p12 * 0.65);
  if (p12 != null) return Math.round(p12);
  if (p10 != null) return Math.round(p10);
  return 0;
}

/** Pillar rating against a target tier (Emerging / Developing / Competitive / Outstanding). */
export type PillarRating = "emerging" | "developing" | "competitive" | "outstanding";

export function rateIndex(value: number, targetTier: "safety" | "target" | "reach" = "target"): PillarRating {
  // Benchmarks shift by ambition: a "reach" student needs higher bars.
  const shift = targetTier === "reach" ? 8 : targetTier === "safety" ? -8 : 0;
  if (value >= 90 + shift) return "outstanding";
  if (value >= 78 + shift) return "competitive";
  if (value >= 60 + shift) return "developing";
  return "emerging";
}

export const PILLAR_LABEL: Record<PillarRating, string> = {
  emerging: "Emerging",
  developing: "Developing",
  competitive: "Competitive",
  outstanding: "Outstanding",
};

export const PILLAR_TONE: Record<PillarRating, string> = {
  emerging: "bg-rose-50 text-rose-700 border-rose-200",
  developing: "bg-amber-50 text-amber-700 border-amber-200",
  competitive: "bg-sky-50 text-sky-700 border-sky-200",
  outstanding: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ------------------------------------------------------------
// Test concordance — IELTS ↔ TOEFL iBT ↔ PTE Academic ↔ CEFR
// Sources: British Council, ETS, Pearson published concordances.
// ------------------------------------------------------------

interface ConcordanceRow {
  cefr: string;
  ielts: number;
  toefl: number;
  pte: number;
}

const CONCORDANCE: ConcordanceRow[] = [
  { cefr: "A1", ielts: 3.5, toefl: 0, pte: 30 },
  { cefr: "A2", ielts: 4.0, toefl: 31, pte: 36 },
  { cefr: "A2+", ielts: 4.5, toefl: 34, pte: 42 },
  { cefr: "B1", ielts: 5.0, toefl: 46, pte: 47 },
  { cefr: "B1+", ielts: 5.5, toefl: 60, pte: 54 },
  { cefr: "B2", ielts: 6.0, toefl: 78, pte: 62 },
  { cefr: "B2+", ielts: 6.5, toefl: 93, pte: 70 },
  { cefr: "C1", ielts: 7.0, toefl: 101, pte: 79 },
  { cefr: "C1+", ielts: 7.5, toefl: 109, pte: 85 },
  { cefr: "C2", ielts: 8.0, toefl: 115, pte: 90 },
  { cefr: "C2+", ielts: 8.5, toefl: 118, pte: 95 },
  { cefr: "C2+", ielts: 9.0, toefl: 120, pte: 99 },
];

export interface EnglishLevel {
  bestTest: "IELTS" | "TOEFL" | "PTE" | null;
  bestScore: number | null;
  cefr: string | null;
  equivalents: { ielts: number | null; toefl: number | null; pte: number | null };
  /** 0-100 normalised for scoring. */
  index: number;
}

/** Pick the student's strongest English test and produce CEFR + equivalents. */
export function englishLevel(
  ielts: number | null,
  toefl: number | null,
  pte: number | null,
): EnglishLevel {
  const candidates: { test: "IELTS" | "TOEFL" | "PTE"; score: number; row: ConcordanceRow }[] = [];
  if (ielts != null && ielts > 0) {
    const row = nearestRow((r) => r.ielts, ielts);
    if (row) candidates.push({ test: "IELTS", score: ielts, row });
  }
  if (toefl != null && toefl > 0) {
    const row = nearestRow((r) => r.toefl, toefl);
    if (row) candidates.push({ test: "TOEFL", score: toefl, row });
  }
  if (pte != null && pte > 0) {
    const row = nearestRow((r) => r.pte, pte);
    if (row) candidates.push({ test: "PTE", score: pte, row });
  }
  if (!candidates.length) {
    return { bestTest: null, bestScore: null, cefr: null, equivalents: { ielts: null, toefl: null, pte: null }, index: 0 };
  }
  // Pick the highest CEFR (by IELTS equivalent as the tiebreaker scale).
  candidates.sort((a, b) => b.row.ielts - a.row.ielts);
  const best = candidates[0];
  // Normalise to 0-100: IELTS 4→0, 9→100.
  const index = Math.round(clamp(((best.row.ielts - 4) / 5) * 100, 0, 100));
  return {
    bestTest: best.test,
    bestScore: best.score,
    cefr: best.row.cefr,
    equivalents: { ielts: best.row.ielts, toefl: best.row.toefl, pte: best.row.pte },
    index,
  };
}

function nearestRow(get: (r: ConcordanceRow) => number, value: number): ConcordanceRow | null {
  let best: ConcordanceRow | null = null;
  let bestDist = Infinity;
  for (const r of CONCORDANCE) {
    const d = Math.abs(get(r) - value);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return best;
}

// ------------------------------------------------------------
// SAT ↔ ACT concordance (College Board / ACT published table).
// ------------------------------------------------------------

const SAT_ACT: { sat: number; act: number }[] = [
  { sat: 1600, act: 36 }, { sat: 1560, act: 35 }, { sat: 1530, act: 34 }, { sat: 1490, act: 33 },
  { sat: 1450, act: 32 }, { sat: 1420, act: 31 }, { sat: 1380, act: 30 }, { sat: 1340, act: 29 },
  { sat: 1300, act: 28 }, { sat: 1260, act: 27 }, { sat: 1210, act: 26 }, { sat: 1170, act: 25 },
  { sat: 1130, act: 24 }, { sat: 1090, act: 23 }, { sat: 1050, act: 22 }, { sat: 1010, act: 21 },
  { sat: 970, act: 20 }, { sat: 930, act: 19 }, { sat: 900, act: 18 }, { sat: 860, act: 17 },
  { sat: 820, act: 16 }, { sat: 780, act: 15 }, { sat: 740, act: 14 }, { sat: 700, act: 13 },
  { sat: 670, act: 12 }, { sat: 630, act: 11 }, { sat: 590, act: 10 }, { sat: 550, act: 9 },
];

/** SAT (400-1600) → ACT (1-36) concordance. */
export function satToAct(sat: number): number {
  if (sat >= 1600) return 36;
  if (sat <= 400) return 1;
  for (let i = 0; i < SAT_ACT.length - 1; i++) {
    const hi = SAT_ACT[i];
    const lo = SAT_ACT[i + 1];
    if (sat <= hi.sat && sat >= lo.sat) {
      const t = (hi.sat - sat) / (hi.sat - lo.sat);
      return Math.round(hi.act + t * (lo.act - hi.act));
    }
  }
  return 1;
}

/** ACT (1-36) → SAT (400-1600) concordance. */
export function actToSat(act: number): number {
  if (act >= 36) return 1600;
  if (act <= 1) return 400;
  for (let i = 0; i < SAT_ACT.length - 1; i++) {
    const hi = SAT_ACT[i];
    const lo = SAT_ACT[i + 1];
    if (act <= hi.act && act >= lo.act) {
      const t = (hi.act - act) / (hi.act - lo.act);
      return Math.round((hi.act === lo.act ? hi.sat : hi.sat + t * (lo.sat - hi.sat)) / 10) * 10;
    }
  }
  return 400;
}

/** SAT score → 0-100 index for pillar scoring. */
export function satIndex(sat: number | null): number {
  if (sat == null || sat <= 0) return 0;
  return Math.round(clamp(((sat - 400) / 1200) * 100, 0, 100));
}

// ------------------------------------------------------------
// Full profile snapshot — six pillars.
// ------------------------------------------------------------

export interface ProfileSnapshot {
  academics: { index: number; rating: PillarRating; detail: string };
  tests: { index: number; rating: PillarRating; detail: string };
  english: EnglishLevel;
  budgetFit: { index: number; rating: PillarRating; detail: string };
  overallIndex: number;
}

export interface SnapshotInput {
  class10: number | null;
  class12: number | null;
  gradingSystem: string;
  ielts: number | null;
  toefl: number | null;
  pte: number | null;
  sat: number | null;
  budgetAudPerYear: number | null;
  needsScholarship: boolean;
  targetTier?: "safety" | "target" | "reach";
}

/** Build the six-pillar snapshot the Dashboard and engines share. */
export function profileSnapshot(input: SnapshotInput): ProfileSnapshot {
  const tier = input.targetTier ?? "target";
  const aIndex = academicIndex(input.class10, input.class12, input.gradingSystem);
  const aRating = rateIndex(aIndex, tier);

  const eng = englishLevel(input.ielts, input.toefl, input.pte);
  const tIndex = Math.max(eng.index, satIndex(input.sat));
  const tRating = rateIndex(tIndex, tier);

  // Budget fit: ₹0-50L band maps 0-100 (higher budget = more options).
  const budget = input.budgetAudPerYear ?? 0;
  const bIndex = Math.round(clamp((budget / 60000) * 100, 0, 100));
  const bRating: PillarRating =
    budget >= 45000 ? "outstanding" : budget >= 30000 ? "competitive" : budget >= 15000 ? "developing" : "emerging";

  const overall = Math.round(aIndex * 0.35 + tIndex * 0.25 + bIndex * 0.2 + (eng.index * 0.2 || 0));

  return {
    academics: {
      index: aIndex,
      rating: aRating,
      detail: `${input.gradingSystem?.toUpperCase() ?? "Board"} · Class 10 ${input.class10 ?? "—"} · Class 12 ${input.class12 ?? "—"}`,
    },
    tests: {
      index: tIndex,
      rating: tRating,
      detail: eng.bestTest
        ? `${eng.bestTest} ${eng.bestScore} (≈ ${eng.cefr})${input.sat ? ` · SAT ${input.sat}` : ""}`
        : input.sat
          ? `SAT ${input.sat}`
          : "No test scores yet",
    },
    english: eng,
    budgetFit: {
      index: bIndex,
      rating: bRating,
      detail: budget > 0 ? `A$${Math.round(budget).toLocaleString("en-AU")}/yr${input.needsScholarship ? " · needs scholarship" : ""}` : "Not set",
    },
    overallIndex: overall,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

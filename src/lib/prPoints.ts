/**
 * PR points engine — Australian points-tested skilled migration.
 *
 * Rules source: Department of Home Affairs "Points test" for subclasses
 * 189 (Skilled Independent), 190 (Skilled Nominated), 491 (Skilled Work
 * Regional — Provisional). Minimum to be invited is 65, but competitive
 * occupations routinely clear 80–90.
 *
 * Everything here is deterministic table lookups — the LLM never computes
 * points. The pathway narrative at the bottom is presentation only.
 */

export type EnglishLevel = "none" | "competent" | "proficient" | "superior";
export type EducationLevel = "none" | "certificate" | "bachelor" | "masters" | "phd";
export type VisaSubclass = "189" | "190" | "491";

export interface ProfileInput {
  age: number; // years
  english: EnglishLevel;
  // Overseas skilled employment in your nominated occupation, last 10 years.
  overseasYears: number;
  // Australian skilled employment.
  australianYears: number;
  education: EducationLevel;
  australianStudy: boolean; // 2+ years in a regional/low-pop area or any Australian study
  regionalStudy: boolean;
  specialistEducation: boolean; // research masters/PhD in STEM
  partnerEnglish: "none" | "competent" | "proficient" | "superior" | "single";
  communityLanguage: boolean; // NAATI credentialed
  subclass: VisaSubclass;
}

export interface Breakdown {
  label: string;
  points: number;
  detail?: string;
}

export interface PointsResult {
  total: number;
  breakdown: Breakdown[];
  meetsMinimum: boolean; // ≥ 65
  competitive: boolean; // ≥ 80 — typical invitation threshold
  subclass: VisaSubclass;
  nominationBonus: number;
}

const AGE_TABLE: { min: number; max: number; points: number }[] = [
  { min: 18, max: 24, points: 30 },
  { min: 25, max: 32, points: 30 },
  { min: 33, max: 39, points: 25 },
  { min: 40, max: 44, points: 15 },
  { min: 45, max: 49, points: 0 },
];

const ENGLISH_TABLE: Record<EnglishLevel, { points: number; label: string; hint: string }> = {
  none: { points: 0, label: "Below Competent", hint: "Doesn't meet the base visa English requirement." },
  competent: { points: 0, label: "Competent (IELTS 6.0 each)", hint: "Minimum to be eligible — but adds no points." },
  proficient: { points: 10, label: "Proficient (IELTS 7.0 each)", hint: "Most invited applicants sit here." },
  superior: { points: 20, label: "Superior (IELTS 8.0 each)", hint: "Top English band — 10 points over Proficient." },
};

const OVERSEAS_TABLE: { min: number; points: number; label: string }[] = [
  { min: 8, points: 20, label: "8+ years (last 10)" },
  { min: 5, points: 15, label: "5–7 years (last 10)" },
  { min: 3, points: 10, label: "3–4 years (last 10)" },
  { min: 1, points: 5, label: "1–2 years (last 10)" },
  { min: 0, points: 0, label: "None" },
];

const AU_TABLE: { min: number; points: number; label: string }[] = [
  { min: 8, points: 20, label: "8+ years" },
  { min: 5, points: 15, label: "5–7 years" },
  { min: 3, points: 10, label: "3–4 years" },
  { min: 1, points: 5, label: "1–2 years" },
  { min: 0, points: 0, label: "None" },
];

const EDU_TABLE: Record<EducationLevel, { points: number; label: string }> = {
  none: { points: 0, label: "No qualification" },
  certificate: { points: 10, label: "Diploma / Trade (AQF)" },
  bachelor: { points: 15, label: "Bachelor (AQF 7/8)" },
  masters: { points: 15, label: "Masters (AQF 9)" },
  phd: { points: 20, label: "Doctorate (AQF 10)" },
};

export const NOMINATION_BONUS: Record<VisaSubclass, { points: number; label: string }> = {
  "189": { points: 0, label: "No nomination — independent" },
  "190": { points: 5, label: "State/territory nomination (+5)" },
  "491": { points: 15, label: "Regional sponsorship (+15)" },
};

function lookupAge(age: number): number {
  if (age < 18 || age > 49) return 0;
  return AGE_TABLE.find((r) => age >= r.min && age <= r.max)?.points ?? 0;
}

function lookupRange(table: { min: number; points: number }[], years: number): number {
  const v = Math.max(0, Math.floor(years));
  return table.find((r) => v >= r.min)?.points ?? 0;
}

/** Pure function — same input always produces the same breakdown. */
export function computePoints(p: ProfileInput): PointsResult {
  const breakdown: Breakdown[] = [];

  breakdown.push({ label: "Age", points: lookupAge(p.age), detail: `${p.age} years` });

  const en = ENGLISH_TABLE[p.english];
  breakdown.push({ label: "English", points: en.points, detail: en.label });

  const os = lookupRange(OVERSEAS_TABLE, p.overseasYears);
  const osLabel = OVERSEAS_TABLE.find((r) => p.overseasYears >= r.min)?.label ?? "None";
  breakdown.push({ label: "Overseas experience", points: os, detail: osLabel });

  const au = lookupRange(AU_TABLE, p.australianYears);
  const auLabel = AU_TABLE.find((r) => p.australianYears >= r.min)?.label ?? "None";
  breakdown.push({ label: "Australian experience", points: au, detail: auLabel });

  const edu = EDU_TABLE[p.education];
  breakdown.push({ label: "Qualifications", points: edu.points, detail: edu.label });

  breakdown.push({ label: "Australian study", points: p.australianStudy ? 5 : 0, detail: p.australianStudy ? "2+ years in Australia" : "—" });
  breakdown.push({ label: "Regional study", points: p.regionalStudy ? 5 : 0, detail: p.regionalStudy ? "Regional campus" : "—" });
  breakdown.push({ label: "Specialist education", points: p.specialistEducation ? 10 : 0, detail: p.specialistEducation ? "STEM research degree" : "—" });

  const partnerPts = p.partnerEnglish === "single" ? 0 : p.partnerEnglish === "superior" || p.partnerEnglish === "proficient" ? 10 : p.partnerEnglish === "competent" ? 5 : 0;
  breakdown.push({
    label: "Partner skills",
    points: partnerPts,
    detail: p.partnerEnglish === "single" ? "Single / no partner claimed" : partnerPts === 10 ? "Skilled partner, Proficient+ English" : partnerPts === 5 ? "Skilled partner, Competent English" : "No points",
  });

  breakdown.push({ label: "Community language", points: p.communityLanguage ? 5 : 0, detail: p.communityLanguage ? "NAATI credentialed" : "—" });

  const nom = NOMINATION_BONUS[p.subclass];
  breakdown.push({ label: "Nomination", points: nom.points, detail: nom.label });

  const total = breakdown.reduce((s, b) => s + b.points, 0);
  return {
    total,
    breakdown,
    meetsMinimum: total >= 65,
    competitive: total >= 80,
    subclass: p.subclass,
    nominationBonus: nom.points,
  };
}

export interface PathwayStep {
  phase: string;
  title: string;
  detail: string;
  required: boolean;
}

/** 485 → 189/190/491 narrative — presentational, no computation. */
export function pathwaySteps(subclass: VisaSubclass): PathwayStep[] {
  const base: PathwayStep[] = [
    {
      phase: "Before graduation",
      title: "Skills assessment",
      detail: "Get a positive skills assessment from the relevant assessing authority (ACS, Engineers Australia, VETASSESS etc.). Takes 4–12 weeks and is required for both 485 and points-tested visas.",
      required: true,
    },
    {
      phase: "Before graduation",
      title: "Provisional PTE / IELTS",
      detail: "Book a test that gives Proficient (7.0 each IELTS) or Superior (8.0 each). Scores are valid 3 years for the points test.",
      required: true,
    },
    {
      phase: "Post-study",
      title: "485 Temporary Graduate visa",
      detail: "2–3 years of full work rights (degree-level). This is where you clock Australian skilled employment points. Apply within 6 months of your CoE completion date.",
      required: true,
    },
    {
      phase: "During 485",
      title: "Lock in state nomination if targeting 190/491",
      detail: "Each state has its own occupation list, residence requirement and invitation threshold. NSW and Victoria are the most competitive; regional states are far more forgiving.",
      required: subclass !== "189",
    },
    {
      phase: "Before 485 expires",
      title: "Submit EOI on SkillSelect",
      detail: "Declare points, subclass and preferred states. You can be invited for 189, 190 and 491 simultaneously from one EOI.",
      required: true,
    },
    {
      phase: "After invitation",
      title: "Lodge visa within 60 days",
      detail: "Invitation expires in 60 days. Have police checks, medicals, skills assessment and English test ready before you're invited, not after.",
      required: true,
    },
  ];

  if (subclass === "189") {
    base.push({
      phase: "Target",
      title: "189 Skilled Independent",
      detail: "No sponsorship needed — live and work anywhere in Australia permanently. The hardest to get: recent invitations for popular occupations cleared 85–95 points.",
      required: false,
    });
  } else if (subclass === "190") {
    base.push({
      phase: "Target",
      title: "190 Skilled Nominated",
      detail: "State nomination adds +5 points and a pathway to permanent residency. Must live in the nominating state for at least 2 years after grant.",
      required: false,
    });
  } else {
    base.push({
      phase: "Target",
      title: "491 Skilled Work Regional",
      detail: "Provisional visa (5 years) with +15 points — the biggest single points boost available. Requires regional living/working, then pathway to 191 permanent residency after 3 years with a minimum income threshold.",
      required: false,
    });
  }

  return base;
}

export const POINTS_THRESHOLDS = { minimum: 65, competitive: 80 } as const;

// ============================================================
// Engine 4 — Gap analyser
// Compares the student with admitted-student benchmarks across
// the shortlist, ranks each gap by Impact × Fixability × Urgency.
// Deterministic — the LLM only writes the "why this matters".
// ============================================================

import { academicIndex, englishLevel, satIndex, rateIndex, type PillarRating } from "./normaliser";
import type { Tier } from "./chance";

// ------------------------------------------------------------
// Fix library — typical durations from the blueprint.
// ------------------------------------------------------------

export interface FixTemplate {
  key: string;
  gapType: string;
  fix: string;
  /** Typical duration in months. */
  durationMonths: number;
  hoursPerWeek: number;
  dependencies: string[];
  proofOfCompletion: string;
}

export const FIX_LIBRARY: FixTemplate[] = [
  {
    key: "sat_prep",
    gapType: "Standardised test (SAT/ACT)",
    fix: "Prepare for and sit the SAT, with a retake window.",
    durationMonths: 5,
    hoursPerWeek: 6,
    dependencies: [],
    proofOfCompletion: "Official score report",
  },
  {
    key: "english_test",
    gapType: "English proficiency",
    fix: "Prepare for and sit IELTS / TOEFL / PTE.",
    durationMonths: 2.5,
    hoursPerWeek: 5,
    dependencies: [],
    proofOfCompletion: "Test score report",
  },
  {
    key: "portfolio_project",
    gapType: "Subject depth / portfolio",
    fix: "Build a portfolio project (app, research paper, design piece).",
    durationMonths: 4,
    hoursPerWeek: 5,
    dependencies: [],
    proofOfCompletion: "GitHub / portfolio link",
  },
  {
    key: "leadership",
    gapType: "Activity depth / leadership",
    fix: "Take a leadership role in a club or start an initiative with measurable impact.",
    durationMonths: 15,
    hoursPerWeek: 4,
    dependencies: [],
    proofOfCompletion: "Certificate, reference letter or impact metrics",
  },
  {
    key: "competition",
    gapType: "Awards & recognition",
    fix: "Compete at state / national level in an olympiad, hackathon or MUN.",
    durationMonths: 8,
    hoursPerWeek: 5,
    dependencies: [],
    proofOfCompletion: "Award certificate or result letter",
  },
  {
    key: "summer_programme",
    gapType: "Academic enrichment",
    fix: "Attend a selective summer programme or online course from a recognised provider.",
    durationMonths: 3,
    hoursPerWeek: 8,
    dependencies: [],
    proofOfCompletion: "Completion certificate",
  },
  {
    key: "essay_prep",
    gapType: "Application readiness",
    fix: "Draft, revise and polish personal statements / SOPs.",
    durationMonths: 3,
    hoursPerWeek: 3,
    dependencies: [],
    proofOfCompletion: "Final essay documents",
  },
  {
    key: "recommendations",
    gapType: "Recommendations",
    fix: "Secure strong recommendation letters from teachers / mentors.",
    durationMonths: 2,
    hoursPerWeek: 1,
    dependencies: [],
    proofOfCompletion: "Submitted letters",
  },
  {
    key: "grades_improve",
    gapType: "Academics (future terms only)",
    fix: "Improve grades in remaining terms — past marks cannot change.",
    durationMonths: 6,
    hoursPerWeek: 10,
    dependencies: [],
    proofOfCompletion: "Updated transcript",
  },
];

// ------------------------------------------------------------
// Pillar definitions & benchmarks.
// ------------------------------------------------------------

export type GapPillarKey =
  | "academics"
  | "standardised_tests"
  | "english"
  | "activities"
  | "awards"
  | "subject_depth"
  | "application_readiness"
  | "budget";

export interface PillarBenchmark {
  key: GapPillarKey;
  label: string;
  /** Student's current value (0-100 normalised). */
  studentValue: number;
  /** Admitted benchmark (median or 75th for Reach). */
  benchmarkValue: number;
  /** Can this change? Past marks cannot. */
  changeable: boolean;
  rating: PillarRating;
  detail: string;
  /** Weight used in impact calculation. */
  importance: number;
}

export interface RankedGap {
  pillar: GapPillarKey;
  label: string;
  gapSize: number;
  impact: number;
  fixability: number;
  urgency: number;
  priority: number;
  changeable: boolean;
  fix: FixTemplate | null;
  detail: string;
  /** Shortest months needed to address. */
  monthsToFix: number;
}

export interface GapReport {
  pillars: PillarBenchmark[];
  gaps: RankedGap[];
  strongest: { pillar: GapPillarKey; label: string; detail: string } | null;
  summary: string;
}

// ------------------------------------------------------------
// Analysis.
// ------------------------------------------------------------

export interface GapInput {
  class10: number | null;
  class12: number | null;
  gradingSystem: string;
  ielts: number | null;
  toefl: number | null;
  pte: number | null;
  sat: number | null;
  budgetAudPerYear: number | null;
  needsScholarship: boolean;
  /** Shortlist tiers — used for Reach-weighted benchmarks. */
  shortlistTiers: Tier[];
  /** Months until the earliest deadline (drives urgency). */
  monthsToDeadline: number;
  /** Optional: whether the student has activities / awards data. */
  hasActivities?: boolean;
  hasAwards?: boolean;
  hasPortfolio?: boolean;
  hasEssays?: boolean;
  hasRecommendations?: boolean;
}

/** Run the gap analysis. Returns pillars + top-ranked gaps. */
export function analyseGaps(input: GapInput): GapReport {
  const hasReach = input.shortlistTiers.includes("reach");
  // For Reach-heavy lists, benchmarks shift to the 75th percentile (higher).
  const benchShift = hasReach ? 8 : 0;

  const acadIndex = academicIndex(input.class10, input.class12, input.gradingSystem);
  const eng = englishLevel(input.ielts, input.toefl, input.pte);
  const satIdx = satIndex(input.sat);
  const testIdx = Math.max(eng.index, satIdx);

  const pillars: PillarBenchmark[] = [
    {
      key: "academics",
      label: "Academics",
      studentValue: acadIndex,
      benchmarkValue: Math.min(95, 72 + benchShift),
      changeable: false,
      rating: rateIndex(acadIndex),
      detail: `Index ${acadIndex}/100 · past marks are fixed; focus on remaining terms`,
      importance: 0.22,
    },
    {
      key: "standardised_tests",
      label: "Standardised tests",
      studentValue: testIdx,
      benchmarkValue: Math.min(95, 65 + benchShift),
      changeable: testIdx < 50,
      rating: rateIndex(testIdx),
      detail: input.sat != null && input.sat > 0
        ? `SAT ${input.sat} (≈ ACT ${Math.round(((input.sat - 400) / 1200) * 35 + 1)})`
        : "No SAT/ACT score yet",
      importance: 0.2,
    },
    {
      key: "english",
      label: "English proficiency",
      studentValue: eng.index,
      benchmarkValue: Math.min(95, 55),
      changeable: eng.index < 50,
      rating: rateIndex(eng.index),
      detail: eng.bestTest ? `${eng.bestTest} ${eng.bestScore} (≈ ${eng.cefr})` : "No English test yet",
      importance: 0.12,
    },
    {
      key: "activities",
      label: "Activities & leadership",
      studentValue: input.hasActivities ? 55 : 20,
      benchmarkValue: Math.min(95, 60 + benchShift),
      changeable: true,
      rating: rateIndex(input.hasActivities ? 55 : 20),
      detail: input.hasActivities ? "Activities recorded — deepen impact" : "No activities recorded yet",
      importance: 0.15,
    },
    {
      key: "awards",
      label: "Awards & recognition",
      studentValue: input.hasAwards ? 50 : 15,
      benchmarkValue: Math.min(95, 55 + benchShift),
      changeable: true,
      rating: rateIndex(input.hasAwards ? 50 : 15),
      detail: input.hasAwards ? "Awards on file — aim for higher-level recognition" : "No awards recorded yet",
      importance: 0.1,
    },
    {
      key: "subject_depth",
      label: "Subject depth & portfolio",
      studentValue: input.hasPortfolio ? 60 : 15,
      benchmarkValue: Math.min(95, 58 + benchShift),
      changeable: true,
      rating: rateIndex(input.hasPortfolio ? 60 : 15),
      detail: input.hasPortfolio ? "Portfolio evidence exists — keep building" : "No portfolio or project work yet",
      importance: 0.12,
    },
    {
      key: "application_readiness",
      label: "Application readiness",
      studentValue: (input.hasEssays ? 30 : 0) + (input.hasRecommendations ? 25 : 0) + (input.hasActivities ? 20 : 5),
      benchmarkValue: 70,
      changeable: true,
      rating: rateIndex((input.hasEssays ? 30 : 0) + (input.hasRecommendations ? 25 : 0) + (input.hasActivities ? 20 : 5)),
      detail: [input.hasEssays ? "essays drafted" : "no essays", input.hasRecommendations ? "recommendations secured" : "no recommendations"].join(" · "),
      importance: 0.09,
    },
  ];

  // Budget is tracked but not "gapped" the same way — it's a constraint.
  const budgetIdx = Math.round(Math.min(100, ((input.budgetAudPerYear ?? 0) / 60000) * 100));
  pillars.push({
    key: "budget",
    label: "Budget capacity",
    studentValue: budgetIdx,
    benchmarkValue: 60,
    changeable: false,
    rating: budgetIdx >= 75 ? "outstanding" : budgetIdx >= 50 ? "competitive" : budgetIdx >= 25 ? "developing" : "emerging",
    detail: input.needsScholarship
      ? `A$${Math.round(input.budgetAudPerYear ?? 0).toLocaleString("en-AU")}/yr — scholarship needed`
      : `A$${Math.round(input.budgetAudPerYear ?? 0).toLocaleString("en-AU")}/yr`,
    importance: 0.0,
  });

  // ---- Rank gaps ----
  const gaps: RankedGap[] = pillars
    .filter((p) => p.importance > 0 && p.studentValue < p.benchmarkValue)
    .map((p) => {
      const gapSize = p.benchmarkValue - p.studentValue;
      const impact = gapSize * p.importance * Math.max(0.3, input.shortlistTiers.length / 10);
      const fix = findFix(p.key);
      const monthsToFix = fix?.durationMonths ?? 6;
      // Fixability: shorter fixes score higher (capped).
      const fixability = Math.max(0.2, Math.min(1, 12 / Math.max(3, monthsToFix)));
      // Urgency: must start now if the fix takes longer than the time left.
      const urgency =
        monthsToFix >= input.monthsToDeadline ? 1.0
        : monthsToFix >= input.monthsToDeadline * 0.6 ? 0.8
        : monthsToFix >= input.monthsToDeadline * 0.3 ? 0.5
        : 0.3;
      // Changeable gaps get a boost; fixed ones can't be helped.
      const changeBoost = p.changeable ? 1 : 0.15;
      const priority = impact * fixability * urgency * changeBoost;

      return {
        pillar: p.key,
        label: p.label,
        gapSize: Math.round(gapSize),
        impact: Math.round(impact * 100) / 100,
        fixability: Math.round(fixability * 100) / 100,
        urgency: Math.round(urgency * 100) / 100,
        priority: Math.round(priority * 1000) / 1000,
        changeable: p.changeable,
        fix,
        detail: p.detail,
        monthsToFix,
      };
    })
    .sort((a, b) => b.priority - a.priority);

  // Strongest area.
  const sortedByValue = [...pillars].filter((p) => p.importance > 0).sort((a, b) => b.studentValue - a.studentValue);
  const strongest = sortedByValue[0]
    ? { pillar: sortedByValue[0].key, label: sortedByValue[0].label, detail: sortedByValue[0].detail }
    : null;

  const top3 = gaps.filter((g) => g.changeable).slice(0, 3);
  const summary = top3.length
    ? `Your top ${top3.length} gap${top3.length > 1 ? "s" : ""}: ${top3.map((g) => g.label.toLowerCase()).join(", ")}. Each links to concrete tasks in your roadmap.`
    : gaps.length
      ? `Gaps found but none are changeable right now — past marks are fixed. Focus on strengthening what you can control.`
      : `You meet or exceed the benchmarks across all pillars. Keep the momentum going.`;

  return { pillars, gaps, strongest, summary };
}

function findFix(pillar: GapPillarKey): FixTemplate | null {
  const map: Record<GapPillarKey, string> = {
    academics: "grades_improve",
    standardised_tests: "sat_prep",
    english: "english_test",
    activities: "leadership",
    awards: "competition",
    subject_depth: "portfolio_project",
    application_readiness: "essay_prep",
    budget: "",
  };
  const key = map[pillar];
  return FIX_LIBRARY.find((f) => f.key === key) ?? null;
}

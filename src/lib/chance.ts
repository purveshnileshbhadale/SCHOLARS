// ============================================================
// Engine 3 — Admission-chance model (Phase A: benchmark rules)
// Deterministic Reach / Target / Safety bands computed from
// rules, not the LLM. The LLM only writes the explanation.
//
// Hard rules protect credibility:
//  · A programme with QS rank < 30 is always Reach.
//  · Safety requires clearing every published minimum comfortably.
//  · Below any hard minimum → excluded (not banded).
// ============================================================

import { academicIndex, englishLevel, satIndex, toPercentage } from "./normaliser";

export type Tier = "reach" | "target" | "safety";

export interface ChanceInput {
  // Student
  class10: number | null;
  class12: number | null;
  gradingSystem: string;
  ielts: number | null;
  toefl: number | null;
  pte: number | null;
  sat: number | null;
  budgetAudPerYear: number | null;
  needsScholarship: boolean;

  // University
  qsRank: number | null;
  tuitionAud: number | null;
  livingCostAud: number | null;
  ieltsMin: number | null;
  toeflMin: number | null;
  pteMin: number | null;
  minAcademicRequirement: string | null;
}

export interface ChanceResult {
  tier: Tier;
  /** 0-100 composite fit score. */
  fitScore: number;
  /** Plain-language meaning shown to the student. */
  plainMeaning: string;
  /** Confidence flag — drops when data is thin. */
  confidence: "high" | "medium" | "low";
  /** Factor breakdown for the "why" explanation. */
  factors: {
    academic: { score: number; label: string };
    english: { score: number; label: string };
    budget: { score: number; label: string };
    selectivity: { score: number; label: string };
  };
  /** Hard-rule notes (e.g. "always Reach — QS rank < 30"). */
  hardRules: string[];
  /** True when a published minimum is not met. */
  ineligible: boolean;
  ineligibleReason?: string;
}

/** Parse the first percentage-like number out of a free-text requirement. */
function parseMinPercent(text: string | null): number | null {
  if (!text) return null;
  // Look for patterns: "60%", "60 percent", "60 per cent", "minimum 60".
  const m = text.match(/(\d{2,3}(?:\.\d+)?)\s*%/) ?? text.match(/(\d{2,3}(?:\.\d+)?)\s*(?:percent|per cent)/i);
  if (m) {
    const v = Number(m[1]);
    if (Number.isFinite(v) && v > 0 && v <= 100) return v;
  }
  // GPA patterns: "3.0 GPA", "GPA of 3.0"
  const g = text.match(/(\d\.\d)\s*gpa/i) ?? text.match(/gpa\s*(?:of\s*)?(\d\.\d)/i);
  if (g) return Number(g[1]) * 25;
  // IB points: "32 points", "IB 32"
  const ib = text.match(/(\d{2})\s*points/i) ?? text.match(/ib\s*(\d{2})/i);
  if (ib) return toPercentage(Number(ib[1]), "ib");
  return null;
}

/**
 * Compute the deterministic chance band for one student × one university.
 * Pure function — same inputs always produce the same output.
 */
export function chanceBand(input: ChanceInput): ChanceResult {
  const hardRules: string[] = [];

  // ---- Academic fit ----
  const acadIndex = academicIndex(input.class10, input.class12, input.gradingSystem);
  const minPercent = parseMinPercent(input.minAcademicRequirement);

  // English fit — student's best test vs the university's minimum for that test.
  const eng = englishLevel(input.ielts, input.toefl, input.pte);
  let englishScore = 0;
  let englishLabel = "No English score";
  let englishMet = true;

  if (input.ieltsMin != null || input.toeflMin != null || input.pteMin != null) {
    // Check each test the uni accepts; the student passes if ANY accepted test meets the bar.
    const checks: { met: boolean; label: string }[] = [];
    if (input.ieltsMin != null && input.ielts != null) {
      checks.push({ met: input.ielts >= input.ieltsMin, label: `IELTS ${input.ielts}/${input.ieltsMin}` });
    }
    if (input.toeflMin != null && input.toefl != null) {
      checks.push({ met: input.toefl >= input.toeflMin, label: `TOEFL ${input.toefl}/${input.toeflMin}` });
    }
    if (input.pteMin != null && input.pte != null) {
      checks.push({ met: input.pte >= input.pteMin, label: `PTE ${input.pte}/${input.pteMin}` });
    }
    if (checks.length) {
      const anyMet = checks.some((c) => c.met);
      englishMet = anyMet;
      const best = checks.reduce((a, b) => (a.met && !b.met ? a : b));
      englishLabel = best.label;
      if (anyMet) {
        // Headroom: how far above the minimum (normalised).
        const pass = checks.find((c) => c.met)!;
        const [have, need] = pass.label.match(/\d+/g)!.map(Number);
        const headroom = need > 0 ? (have - need) / need : 0;
        englishScore = Math.round(Math.min(100, 60 + headroom * 200));
      } else {
        englishScore = Math.max(0, 30 - 30);
        englishLabel = checks.map((c) => c.label).join(" · ") + " (below minimum)";
      }
    } else {
      // Uni has minimums but student has no matching test — can't verify.
      englishMet = false;
      englishScore = 20;
      englishLabel = "No matching English test";
    }
  } else {
    // No English minimum published — don't penalise.
    englishScore = eng.index || 60;
    englishLabel = eng.bestTest ? `${eng.bestTest} ${eng.bestScore}` : "No requirement published";
  }

  // ---- Budget fit ----
  const totalCost = (input.tuitionAud ?? 0) + (input.livingCostAud ?? 0);
  const budget = input.budgetAudPerYear ?? 0;
  let budgetScore: number;
  let budgetLabel: string;
  if (budget <= 0) {
    budgetScore = 50;
    budgetLabel = "Budget not set";
  } else if (totalCost <= 0) {
    budgetScore = 70;
    budgetLabel = "Cost data pending";
  } else {
    const ratio = totalCost / budget;
    if (ratio <= 0.7) {
      budgetScore = 95;
      budgetLabel = "Well within budget";
    } else if (ratio <= 0.95) {
      budgetScore = 80;
      budgetLabel = "Within budget";
    } else if (ratio <= 1.15) {
      budgetScore = 60;
      budgetLabel = "Slightly over budget";
    } else if (ratio <= 1.5) {
      budgetScore = 35;
      budgetLabel = "Over budget";
    } else {
      budgetScore = 10;
      budgetLabel = "Well over budget";
    }
  }

  // ---- Selectivity (QS rank as proxy when admit rate is unknown) ----
  let selectivityScore: number;
  let selectivityLabel: string;
  if (input.qsRank == null) {
    selectivityScore = 50;
    selectivityLabel = "Rank unknown";
  } else if (input.qsRank <= 30) {
    selectivityScore = 15;
    selectivityLabel = `Very selective (QS #${input.qsRank})`;
  } else if (input.qsRank <= 100) {
    selectivityScore = 35;
    selectivityLabel = `Selective (QS #${input.qsRank})`;
  } else if (input.qsRank <= 250) {
    selectivityScore = 55;
    selectivityLabel = `Moderately selective (QS #${input.qsRank})`;
  } else if (input.qsRank <= 500) {
    selectivityScore = 72;
    selectivityLabel = `Accessible (QS #${input.qsRank})`;
  } else {
    selectivityScore = 85;
    selectivityLabel = `Less selective (QS #${input.qsRank})`;
  }

  // ---- Academic score ----
  let academicScore: number;
  let academicLabel: string;
  if (minPercent != null) {
    const headroom = acadIndex - minPercent;
    if (headroom >= 15) {
      academicScore = 95;
      academicLabel = `Comfortably above minimum (${acadIndex}% vs ${minPercent}%)`;
    } else if (headroom >= 5) {
      academicScore = 80;
      academicLabel = `Above minimum (${acadIndex}% vs ${minPercent}%)`;
    } else if (headroom >= 0) {
      academicScore = 60;
      academicLabel = `Meets minimum (${acadIndex}% vs ${minPercent}%)`;
    } else if (headroom >= -5) {
      academicScore = 30;
      academicLabel = `Slightly below minimum (${acadIndex}% vs ${minPercent}%)`;
    } else {
      academicScore = 5;
      academicLabel = `Below minimum (${acadIndex}% vs ${minPercent}%)`;
    }
  } else {
    // No published minimum — use the index directly.
    academicScore = acadIndex;
    academicLabel = `Academic index ${acadIndex}/100`;
  }

  // ---- Ineligibility checks ----
  let ineligible = false;
  let ineligibleReason: string | undefined;

  if (minPercent != null && acadIndex < minPercent - 5) {
    ineligible = true;
    ineligibleReason = `Academic requirement not met (need ~${minPercent}%, have ${acadIndex}%)`;
  }
  if (!englishMet) {
    ineligible = true;
    ineligibleReason = ineligibleReason ?? `English requirement not met (${englishLabel})`;
  }

  // ---- Composite weighted score ----
  // Weights: academic 30 %, english 20 %, budget 25 %, selectivity 25 %.
  const composite = Math.round(
    academicScore * 0.3 + englishScore * 0.2 + budgetScore * 0.25 + selectivityScore * 0.25,
  );

  // ---- Hard rules ----
  if (input.qsRank != null && input.qsRank <= 30) {
    hardRules.push("Always Reach — QS rank under 30");
  }
  if (input.needsScholarship && budgetScore < 40) {
    hardRules.push("Needs scholarship but cost is well over budget");
  }

  // ---- Band assignment ----
  let tier: Tier;
  if (ineligible) {
    tier = "reach"; // shouldn't reach the shortlist, but keep a value
  } else if (input.qsRank != null && input.qsRank <= 30) {
    tier = "reach";
  } else if (composite >= 72 && academicScore >= 60 && englishScore >= 55 && budgetScore >= 50) {
    tier = "safety";
  } else if (composite >= 48) {
    tier = "target";
  } else {
    tier = "reach";
  }

  // Safety requires clearing every published minimum comfortably.
  if (tier === "safety" && (minPercent != null && acadIndex < minPercent + 10)) {
    tier = "target";
    hardRules.push("Safety blocked — academic headroom under 10 points");
  }
  if (tier === "safety" && !englishMet) {
    tier = "target";
  }

  // ---- Confidence ----
  const knownFactors = [minPercent != null, input.qsRank != null, totalCost > 0, eng.bestTest != null].filter(Boolean).length;
  const confidence: ChanceResult["confidence"] = knownFactors >= 4 ? "high" : knownFactors >= 2 ? "medium" : "low";

  // ---- Plain meaning ----
  const plainMeaning =
    tier === "safety" ? "Likely — you clear the bar comfortably"
    : tier === "target" ? "Possible — you're in the running"
    : "A long shot — worth trying alongside stronger options";

  return {
    tier,
    fitScore: composite,
    plainMeaning,
    confidence,
    factors: {
      academic: { score: academicScore, label: academicLabel },
      english: { score: englishScore, label: englishLabel },
      budget: { score: budgetScore, label: budgetLabel },
      selectivity: { score: selectivityScore, label: selectivityLabel },
    },
    hardRules,
    ineligible,
    ineligibleReason,
  };
}

/** Batch helper: band a list of universities against one student profile. */
export function bandMany(
  student: Omit<ChanceInput, keyof UniFields>,
  unis: (UniFields & { id: string; name: string })[],
): ({ id: string; name: string } & ChanceResult)[] {
  return unis.map((u) => {
    const { id, name, ...rest } = u;
    return { id, name, ...chanceBand({ ...student, ...rest }) };
  });
}

export interface UniFields {
  qsRank: number | null;
  tuitionAud: number | null;
  livingCostAud: number | null;
  ieltsMin: number | null;
  toeflMin: number | null;
  pteMin: number | null;
  minAcademicRequirement: string | null;
}

/** Build ChanceInput student fields from a Supabase student_profiles row. */
export function studentChanceFields(sp: {
  class_10_marks: number | null;
  class_12_marks: number | null;
  grading_system: string | null;
  ielts: number | null;
  toefl: number | null;
  pte: number | null;
  sat: number | null;
  budget_aud_per_year: number | null;
  needs_scholarship: boolean;
}): Omit<ChanceInput, keyof UniFields> {
  return {
    class10: sp.class_10_marks,
    class12: sp.class_12_marks,
    gradingSystem: sp.grading_system ?? "cbse",
    ielts: sp.ielts,
    toefl: sp.toefl,
    pte: sp.pte,
    sat: sp.sat,
    budgetAudPerYear: sp.budget_aud_per_year,
    needsScholarship: sp.needs_scholarship,
  };
}

/** Build UniFields from a Supabase universities row. */
export function uniChanceFields(u: {
  qs_rank: number | null;
  tuition_aud: number | null;
  living_cost_aud: number | null;
  ielts_min: number | null;
  toefl_min: number | null;
  pte_min: number | null;
  min_academic_requirement: string | null;
}): UniFields {
  return {
    qsRank: u.qs_rank,
    tuitionAud: u.tuition_aud,
    livingCostAud: u.living_cost_aud,
    ieltsMin: u.ielts_min,
    toeflMin: u.toefl_min,
    pteMin: u.pte_min,
    minAcademicRequirement: u.min_academic_requirement,
  };
}

export { satIndex };

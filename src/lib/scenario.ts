// ============================================================
// Scenario Lab — "what if I raise IELTS to 7.0?"
// Pure rules: every number here comes from the same engines the
// dashboard and PR calculator use, so a scenario can never drift
// from the advice the rest of the app gives.
// ============================================================

import { chanceBand, type ChanceResult, type UniFields } from "./chance";
import { computePoints, type EducationLevel, type EnglishLevel, type PointsResult, type VisaSubclass } from "./prPoints";
import type { StudentProfile } from "./types";

/** The editable part of a student profile. */
export interface ScenarioInput {
  class10: number | null;
  class12: number | null;
  gradingSystem: string;
  ielts: number | null;
  toefl: number | null;
  pte: number | null;
  sat: number | null;
  budgetAudPerYear: number | null;
  needsScholarship: boolean;
}

export function scenarioFromProfile(sp: StudentProfile): ScenarioInput {
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

export interface ScenarioUni {
  id: string;
  name: string;
  qsRank: number | null;
  fields: UniFields;
}

export interface UniMove {
  id: string;
  name: string;
  qsRank: number | null;
  before: ChanceResult;
  after: ChanceResult;
  direction: "up" | "down" | "same";
  fitDelta: number;
}

const TIER_RANK: Record<ChanceResult["tier"], number> = { reach: 0, target: 1, safety: 2 };

/** Band every shortlisted university before and after a scenario. */
export function compareBands(before: ScenarioInput, after: ScenarioInput, unis: ScenarioUni[]): UniMove[] {
  return unis.map((u) => {
    const b = chanceBand({ ...before, ...u.fields });
    const a = chanceBand({ ...after, ...u.fields });
    const diff = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    return {
      id: u.id,
      name: u.name,
      qsRank: u.qsRank,
      before: b,
      after: a,
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "same",
      fitDelta: a.fitScore - b.fitScore,
    };
  });
}

export interface ScenarioSummary {
  total: number;
  up: number;
  down: number;
  unchanged: number;
  /** Universities the student could not apply to before but can now. */
  unlocked: number;
  /** Universities that would become ineligible. */
  locked: number;
}

export function summarise(moves: UniMove[]): ScenarioSummary {
  return {
    total: moves.length,
    up: moves.filter((m) => m.direction === "up").length,
    down: moves.filter((m) => m.direction === "down").length,
    unchanged: moves.filter((m) => m.direction === "same").length,
    unlocked: moves.filter((m) => m.before.ineligible && !m.after.ineligible).length,
    locked: moves.filter((m) => !m.before.ineligible && m.after.ineligible).length,
  };
}

/** IELTS score → the PR points English band (official thresholds). */
export function englishBandFromIelts(ielts: number | null): EnglishLevel {
  if (ielts == null) return "none";
  if (ielts >= 8) return "superior";
  if (ielts >= 7) return "proficient";
  if (ielts >= 6) return "competent";
  return "none";
}

export interface PrScenario {
  age: number;
  ielts: number | null;
  education: EducationLevel;
  regionalStudy: boolean;
  australianStudy: boolean;
  subclass: VisaSubclass;
}

/**
 * Points for the scenario. Everything the scenario does not model is held at
 * zero rather than guessed, so the result is a floor, not a fantasy.
 */
export function pointsFor(s: PrScenario): PointsResult {
  return computePoints({
    age: s.age,
    english: englishBandFromIelts(s.ielts),
    overseasYears: 0,
    australianYears: 0,
    education: s.education,
    australianStudy: s.australianStudy,
    regionalStudy: s.regionalStudy,
    specialistEducation: false,
    partnerEnglish: "single",
    communityLanguage: false,
    subclass: s.subclass,
  });
}

/** Which single change bought the most? Used for the "insight" line. */
export function biggestLever(moves: UniMove[]): { label: string; detail: string } {
  if (!moves.length) return { label: "No universities", detail: "Generate a shortlist first." };
  const up = moves.filter((m) => m.direction === "up");
  if (up.length) {
    return {
      label: `${up.length} band${up.length === 1 ? "" : "s"} upgraded`,
      detail: up.map((m) => m.name).slice(0, 3).join(", ") + (up.length > 3 ? " and more" : ""),
    };
  }
  const bestFit = moves.reduce((a, b) => (b.fitDelta > a.fitDelta ? b : a));
  if (bestFit.fitDelta > 0) {
    return {
      label: `Best fit gain +${bestFit.fitDelta}`,
      detail: `${bestFit.name} — still ${bestFit.after.tier}, but a stronger case.`,
    };
  }
  return { label: "No material change", detail: "Try a bigger English or budget step." };
}

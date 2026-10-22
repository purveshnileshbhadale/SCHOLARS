// ============================================================
// Engine 5 — Roadmap planner
// Layer 1 (scheduler): rules that get dates right — works
//   backwards from deadlines, respects blocked periods and
//   weekly-hour capacity.
// Layer 2 (writer): the LLM turns the schedule into plain
//   language. This module produces the structured data the
//   writer and UI consume.
// ============================================================

import type { FixTemplate } from "./gaps";
import { FIX_LIBRARY } from "./gaps";

export type Intensity = "light" | "standard" | "intensive";

export const INTENSITY_HOURS: Record<Intensity, number> = {
  light: 5,
  standard: 10,
  intensive: 16,
};

export const INTENSITY_LABEL: Record<Intensity, string> = {
  light: "Light",
  standard: "Standard",
  intensive: "Intensive",
};

export interface RoadmapTask {
  key: string;
  title: string;
  description: string;
  category: TaskCategory;
  /** ISO date the task should start. */
  startDate: string;
  /** ISO date the task is due. */
  dueDate: string;
  hoursPerWeek: number;
  /** Weeks of effort. */
  durationWeeks: number;
  /** Milestone checkpoints inside the task. */
  milestones: string[];
  /** Which fix/gap this addresses. */
  gapKey?: string;
  /** Hard deadline this must finish before. */
  anchorDeadline?: string;
}

export type TaskCategory =
  | "test_prep"
  | "english"
  | "portfolio"
  | "leadership"
  | "competition"
  | "summer"
  | "essays"
  | "recommendations"
  | "applications"
  | "finance"
  | "admin";

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  test_prep: "Test prep",
  english: "English test",
  portfolio: "Portfolio",
  leadership: "Leadership",
  competition: "Competition",
  summer: "Summer programme",
  essays: "Essays",
  recommendations: "Recommendations",
  applications: "Applications",
  finance: "Finance & funds",
  admin: "Admin & documents",
};

export const CATEGORY_TONE: Record<TaskCategory, string> = {
  test_prep: "bg-violet-50 text-violet-700 border-violet-200",
  english: "bg-sky-50 text-sky-700 border-sky-200",
  portfolio: "bg-cyan-50 text-cyan-700 border-cyan-200",
  leadership: "bg-emerald-50 text-emerald-700 border-emerald-200",
  competition: "bg-amber-50 text-amber-700 border-amber-200",
  summer: "bg-orange-50 text-orange-700 border-orange-200",
  essays: "bg-rose-50 text-rose-700 border-rose-200",
  recommendations: "bg-indigo-50 text-indigo-700 border-indigo-200",
  applications: "bg-emerald-50 text-emerald-800 border-emerald-200",
  finance: "bg-amber-50 text-amber-800 border-amber-200",
  admin: "bg-slate-50 text-slate-700 border-slate-200",
};

export interface RoadmapInput {
  /** Months until the earliest application deadline. */
  monthsToDeadline: number;
  /** The student's shortlist tiers (drives what prep is needed). */
  needsSat: boolean;
  needsEnglish: boolean;
  needsPortfolio: boolean;
  needsLeadership: boolean;
  needsEssays: boolean;
  /** Earliest hard deadline (ISO date). */
  earliestDeadline: string | null;
  /** Intensity the student chose. */
  intensity: Intensity;
  /** Blocked periods (e.g. board exams) as { label, start, end }. */
  blockedPeriods?: { label: string; start: string; end: string }[];
}

/** Generate a backwards-planned roadmap from the student's situation. */
export function planRoadmap(input: RoadmapInput): RoadmapTask[] {
  const tasks: RoadmapTask[] = [];
  const weeklyHours = INTENSITY_HOURS[input.intensity];
  const now = new Date();
  const deadline = input.earliestDeadline ? new Date(input.earliestDeadline) : addMonths(now, Math.max(3, input.monthsToDeadline));
  const monthsLeft = Math.max(1, monthsBetween(now, deadline));

  let slot = 0; // ordering key — tasks later in the pipeline get higher slots

  const push = (t: Omit<RoadmapTask, "key"> & { key?: string }) => {
    tasks.push({ key: t.key ?? `task_${slot}`, ...t, hoursPerWeek: Math.min(t.hoursPerWeek, weeklyHours) });
    slot++;
  };

  // ---- Admin & documents (always first, short) ----
  push({
    title: "Confirm shortlist & deadlines",
    description: "Review your Reach / Target / Safety list, note every deadline, and set calendar reminders.",
    category: "admin",
    startDate: iso(now),
    dueDate: iso(addWeeks(now, 1)),
    hoursPerWeek: 2,
    durationWeeks: 1,
    milestones: ["Shortlist reviewed", "Deadlines on calendar"],
  });

  // ---- English test ----
  if (input.needsEnglish && monthsLeft >= 3) {
    const fix = FIX_LIBRARY.find((f) => f.key === "english_test")!;
    const start = addWeeks(now, 1);
    const due = addWeeks(start, Math.min(fix.durationMonths * 4.3, monthsLeft * 4.3 * 0.5));
    push({
      title: "Prepare & sit English test",
      description: `${fix.fix} Typical prep: ${fix.durationMonths} months at ${fix.hoursPerWeek} hrs/week.`,
      category: "english",
      startDate: iso(start),
      dueDate: iso(due),
      hoursPerWeek: fix.hoursPerWeek,
      durationWeeks: weeksBetween(start, due),
      milestones: ["Diagnostic test", "8-week prep block", "Sit the test", "Retake window if needed"],
      gapKey: "english_test",
    });
  }

  // ---- SAT / ACT ----
  if (input.needsSat && monthsLeft >= 5) {
    const fix = FIX_LIBRARY.find((f) => f.key === "sat_prep")!;
    const start = addWeeks(now, 2);
    const due = addWeeks(start, Math.min(fix.durationMonths * 4.3, monthsLeft * 4.3 * 0.6));
    push({
      title: "Prepare & sit SAT / ACT",
      description: `${fix.fix} Plan a first attempt and a retake window.`,
      category: "test_prep",
      startDate: iso(start),
      dueDate: iso(due),
      hoursPerWeek: fix.hoursPerWeek,
      durationWeeks: weeksBetween(start, due),
      milestones: ["Diagnostic practice test", "12-week prep block", "First sitting", "Retake if needed"],
      gapKey: "sat_prep",
    });
  }

  // ---- Portfolio / subject depth ----
  if (input.needsPortfolio && monthsLeft >= 4) {
    const fix = FIX_LIBRARY.find((f) => f.key === "portfolio_project")!;
    const start = addWeeks(now, 2);
    const due = addWeeks(start, Math.min(fix.durationMonths * 4.3, monthsLeft * 4.3 * 0.7));
    push({
      title: "Build a portfolio project",
      description: `${fix.fix} Selective universities reward depth over a long list of small activities.`,
      category: "portfolio",
      startDate: iso(start),
      dueDate: iso(due),
      hoursPerWeek: fix.hoursPerWeek,
      durationWeeks: weeksBetween(start, due),
      milestones: ["Pick a project idea", "MVP / first draft", "Polish & document", "Publish / showcase"],
      gapKey: "portfolio_project",
    });
  }

  // ---- Leadership / activities ----
  if (input.needsLeadership && monthsLeft >= 8) {
    const fix = FIX_LIBRARY.find((f) => f.key === "leadership")!;
    const start = addWeeks(now, 4);
    const due = addWeeks(now, Math.min(fix.durationMonths * 4.3, monthsLeft * 4.3));
    push({
      title: "Deepen activities with leadership",
      description: `${fix.fix} Depth beats breadth — one sustained role with impact.`,
      category: "leadership",
      startDate: iso(start),
      dueDate: iso(due),
      hoursPerWeek: fix.hoursPerWeek,
      durationWeeks: weeksBetween(start, due),
      milestones: ["Secure a leadership role", "Run an initiative", "Measure impact", "Collect proof"],
      gapKey: "leadership",
    });
  }

  // ---- Competition / award ----
  if (input.needsLeadership && monthsLeft >= 6) {
    push({
      title: "Target a competition or recognition",
      description: "Enter a hackathon, olympiad, MUN or national competition related to your field.",
      category: "competition",
      startDate: iso(addWeeks(now, 8)),
      dueDate: iso(addWeeks(now, Math.min(26, monthsLeft * 4.3))),
      hoursPerWeek: 4,
      durationWeeks: Math.min(20, monthsLeft * 4),
      milestones: ["Find competitions", "Register & prepare", "Participate", "Record result"],
    });
  }

  // ---- Essays ----
  if (input.needsEssays && monthsLeft >= 4) {
    const fix = FIX_LIBRARY.find((f) => f.key === "essay_prep")!;
    const start = addMonths(deadline, -4); // start 4 months before deadline
    const safeStart = start > now ? start : addWeeks(now, 4);
    push({
      title: "Draft & polish application essays",
      description: `${fix.fix} Start with a brain-dump, then iterate with feedback.`,
      category: "essays",
      startDate: iso(safeStart),
      dueDate: iso(addWeeks(safeStart, Math.min(12, weeksBetween(safeStart, deadline) - 2))),
      hoursPerWeek: fix.hoursPerWeek,
      durationWeeks: Math.min(12, Math.max(4, weeksBetween(safeStart, deadline) - 2)),
      milestones: ["Brain-dump stories", "First full draft", "Feedback round", "Final polish"],
      gapKey: "essay_prep",
      anchorDeadline: input.earliestDeadline ?? undefined,
    });
  }

  // ---- Recommendations ----
  if (input.needsEssays) {
    const start = addMonths(deadline, -3);
    const safeStart = start > now ? start : addWeeks(now, 6);
    push({
      title: "Secure recommendation letters",
      description: "Ask teachers / mentors early, share your resume and brag sheet, and follow up politely.",
      category: "recommendations",
      startDate: iso(safeStart),
      dueDate: iso(addWeeks(safeStart, 4)),
      hoursPerWeek: 1,
      durationWeeks: 4,
      milestones: ["Choose recommenders", "Send requests with context", "Follow up", "Confirm submission"],
    });
  }

  // ---- Applications submission window ----
  {
    const start = addMonths(deadline, -1.5);
    const safeStart = start > now ? start : addWeeks(now, 2);
    push({
      title: "Submit applications",
      description: "Final review, upload documents, pay fees, and submit well before the deadline.",
      category: "applications",
      startDate: iso(safeStart),
      dueDate: iso(addDays(deadline, -7)),
      hoursPerWeek: 4,
      durationWeeks: Math.max(2, weeksBetween(safeStart, addDays(deadline, -7))),
      milestones: ["Final document check", "Portal dry-run", "Submit", "Confirmation receipts saved"],
      anchorDeadline: input.earliestDeadline ?? undefined,
    });
  }

  // ---- Finance ----
  if (monthsLeft >= 3) {
    const start = addMonths(deadline, -2);
    const safeStart = start > now ? start : addWeeks(now, 4);
    push({
      title: "Prepare finances & fund proof",
      description: "Tuition deposit, education loan pre-approval, sponsor letters and bank statements.",
      category: "finance",
      startDate: iso(safeStart),
      dueDate: iso(addDays(deadline, -14)),
      hoursPerWeek: 2,
      durationWeeks: 4,
      milestones: ["Cost comparison finalised", "Loan / funds arranged", "Documents ready"],
    });
  }

  // ---- Sort by start date ----
  tasks.sort((a, b) => a.startDate.localeCompare(b.startDate));

  // ---- Capacity check: flag over-capacity weeks ----
  // (UI shows a warning if the same week has more than weeklyHours across tasks.)
  return tasks;
}

/** Group tasks by month for the UI timeline. */
export function groupByMonth(tasks: RoadmapTask[]): { month: string; label: string; tasks: RoadmapTask[] }[] {
  const map = new Map<string, RoadmapTask[]>();
  for (const t of tasks) {
    const d = new Date(t.dueDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ts]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        month: key,
        label: new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
        tasks: ts,
      };
    });
}

/** Check if any single week is over the chosen hour capacity. */
export function overCapacity(tasks: RoadmapTask[], intensity: Intensity): boolean {
  const cap = INTENSITY_HOURS[intensity];
  const byWeek = new Map<string, number>();
  for (const t of tasks) {
    const start = new Date(t.startDate);
    const end = new Date(t.dueDate);
    const weeks = Math.max(1, Math.round(weeksBetween(start, end)));
    const perWeek = t.hoursPerWeek;
    for (let w = 0; w < weeks; w++) {
      const d = addWeeks(start, w);
      const key = isoWeekKey(d);
      byWeek.set(key, (byWeek.get(key) ?? 0) + perWeek);
    }
  }
  for (const total of byWeek.values()) {
    if (total > cap + 2) return true; // small tolerance
  }
  return false;
}

// ---- Date helpers ----

function addWeeks(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n * 7);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function weeksBetween(a: Date, b: Date): number {
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / (7 * 86_400_000)));
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isoWeekKey(d: Date): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon = 0
  x.setDate(x.getDate() - day);
  return iso(x);
}

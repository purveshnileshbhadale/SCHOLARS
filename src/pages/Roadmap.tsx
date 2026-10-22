import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Shortlist, Tier } from "../lib/types";
import { analyseGaps } from "../lib/gaps";
import {
  CATEGORY_LABEL,
  CATEGORY_TONE,
  INTENSITY_HOURS,
  INTENSITY_LABEL,
  groupByMonth,
  overCapacity,
  planRoadmap,
  type Intensity,
  type RoadmapTask,
} from "../lib/roadmap";
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Toast } from "../components/ui";
import { cx } from "../lib/utils";

const INTENSITY_HINT: Record<Intensity, string> = {
  light: "~5 hrs/week — fits around school and exams",
  standard: "~10 hrs/week — the recommended pace",
  intensive: "~16 hrs/week — for students with time to spare",
};

export default function RoadmapPage() {
  const { session, studentProfile } = useAuth();
  const [shortlist, setShortlist] = useState<Shortlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [intensity, setIntensity] = useState<Intensity>(() => {
    return (localStorage.getItem("sa_intensity") as Intensity) || "standard";
  });
  const [tasks, setTasks] = useState<RoadmapTask[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Statuses keyed by task key (synced with DB when available). */
  const [statuses, setStatuses] = useState<Record<string, "pending" | "in_progress" | "done" | "skipped">>({});

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("shortlists")
      .select("*")
      .eq("student_id", session.user.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setShortlist((data as Shortlist) ?? null);
  }, [session]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Persist intensity choice.
  useEffect(() => {
    localStorage.setItem("sa_intensity", intensity);
  }, [intensity]);

  // Load saved statuses from roadmap_tasks.
  useEffect(() => {
    if (!session) return;
    supabase
      .from("roadmap_tasks")
      .select("title, status")
      .eq("student_id", session.user.id)
      .then(({ data }) => {
        if (!data?.length) return;
        const map: Record<string, "pending" | "in_progress" | "done" | "skipped"> = {};
        for (const row of data) map[row.title] = row.status;
        setStatuses(map);
      });
  }, [session]);

  const planned = useMemo<RoadmapTask[]>(() => {
    if (!studentProfile?.is_complete) return [];
    const tiers = (shortlist?.result?.items ?? []).map((i) => i.tier as Tier);
    const report = analyseGaps({
      class10: studentProfile.class_10_marks,
      class12: studentProfile.class_12_marks,
      gradingSystem: studentProfile.grading_system ?? "cbse",
      ielts: studentProfile.ielts,
      toefl: studentProfile.toefl,
      pte: studentProfile.pte,
      sat: studentProfile.sat,
      budgetAudPerYear: studentProfile.budget_aud_per_year,
      needsScholarship: studentProfile.needs_scholarship,
      shortlistTiers: tiers,
      monthsToDeadline: 18,
    });
    const changeable = new Set(report.gaps.filter((g) => g.changeable).map((g) => g.pillar));
    return planRoadmap({
      monthsToDeadline: 18,
      needsSat: changeable.has("standardised_tests"),
      needsEnglish: changeable.has("english"),
      needsPortfolio: changeable.has("subject_depth"),
      needsLeadership: changeable.has("activities") || changeable.has("awards"),
      needsEssays: changeable.has("application_readiness") || true,
      earliestDeadline: null,
      intensity,
    });
  }, [studentProfile, shortlist, intensity]);

  // Merge planned tasks with saved statuses.
  const merged = useMemo(
    () => planned.map((t) => ({ ...t, status: statuses[t.key] ?? ("pending" as const) })),
    [planned, statuses],
  );

  const months = useMemo(() => groupByMonth(merged), [merged]);
  const overCap = useMemo(() => overCapacity(planned, intensity), [planned, intensity]);

  const doneCount = merged.filter((t) => t.status === "done").length;
  const total = merged.length;
  const progressPct = total ? Math.round((doneCount / total) * 100) : 0;

  async function setStatus(taskKey: string, status: "pending" | "in_progress" | "done" | "skipped") {
    setStatuses((prev) => ({ ...prev, [taskKey]: status }));
    if (!session) return;
    // Upsert into roadmap_tasks so it persists.
    try {
      const task = merged.find((t) => t.key === taskKey);
      if (!task) return;
      const { error } = await supabase.from("roadmap_tasks").upsert(
        {
          student_id: session.user.id,
          title: task.title,
          description: task.description,
          category: task.category,
          due_date: task.dueDate,
          start_date: task.startDate,
          hours_per_week: task.hoursPerWeek,
          status,
          completed_at: status === "done" ? new Date().toISOString() : null,
          intensity,
          sort_order: planned.findIndex((t2) => t2.key === taskKey),
        },
        { onConflict: "student_id,title" },
      );
      if (error) console.warn("roadmap save", error);
      if (status === "done") setToast("Task marked done");
    } catch {
      /* non-critical */
    }
  }

  async function savePlan() {
    if (!session || !planned.length) return;
    setBusy(true);
    setErr(null);
    try {
      const rows = planned.map((t, i) => ({
        student_id: session.user.id,
        title: t.title,
        description: t.description,
        category: t.category,
        due_date: t.dueDate,
        start_date: t.startDate,
        hours_per_week: t.hoursPerWeek,
        status: statuses[t.title] ?? "pending",
        intensity,
        sort_order: i,
        gap_id: t.gapKey ?? null,
      }));
      const { error } = await supabase.from("roadmap_tasks").upsert(rows, { onConflict: "student_id,title" });
      if (error) throw error;
      setToast("Roadmap saved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save roadmap");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );

  if (!studentProfile?.is_complete)
    return (
      <Empty
        title="Complete your profile first"
        body="The roadmap planner needs your profile and shortlist to schedule tasks backwards from your deadlines."
        action={
          <Link to="/onboarding">
            <Button>Go to onboarding</Button>
          </Link>
        }
      />
    );

  return (
    <div>
      <PageHeader
        title="Your roadmap"
        subtitle="A month-by-month plan built backwards from your deadlines. Tick tasks, upload proof, and the engines re-plan as you progress."
        right={
          <Button onClick={savePlan} disabled={busy}>
            {busy ? "Saving…" : "Save roadmap"}
          </Button>
        }
      />

      <ErrorNote>{err}</ErrorNote>
      <Toast message={toast} />

      {/* Intensity picker */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-slate-800">Intensity</span>
          <div className="flex gap-1.5">
            {(["light", "standard", "intensive"] as Intensity[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setIntensity(lvl)}
                className={cx(
                  "rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-all",
                  intensity === lvl
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_6px_16px_-8px_rgba(16,185,129,0.8)]"
                    : "border border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-400",
                )}
              >
                {INTENSITY_LABEL[lvl]}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">{INTENSITY_HINT[intensity]}</span>
        </div>
        {overCap ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            Some weeks exceed your {INTENSITY_HOURS[intensity]} hr/week capacity. Consider Light intensity or spreading tasks.
          </p>
        ) : null}
      </Card>

      {/* Progress summary */}
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <div className="relative size-16 shrink-0">
            <svg viewBox="0 0 36 36" className="size-16 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-100" />
              <circle
                cx="18" cy="18" r="15.9" fill="none" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${progressPct} ${100 - progressPct}`}
                className="text-emerald-500 transition-all duration-500"
                stroke="currentColor"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-800">
              {progressPct}%
            </span>
          </div>
          <div>
            <p className="font-bold text-slate-900">
              {doneCount} of {total} tasks done
            </p>
            <p className="text-sm text-slate-500">Keep ticking tasks — your chances and plan update as you go.</p>
          </div>
        </div>
      </Card>

      {/* Month-by-month timeline */}
      {months.length === 0 ? (
        <Empty title="No tasks yet" body="Complete your profile and generate a shortlist to build your roadmap." />
      ) : (
        <div className="space-y-8">
          {months.map((m) => (
            <section key={m.month}>
              <h2 className="mb-3 flex items-baseline gap-2 text-lg font-bold text-slate-900">
                {m.label}
                <span className="text-xs font-medium text-slate-400">{m.tasks.length} task{m.tasks.length === 1 ? "" : "s"}</span>
              </h2>
              <div className="space-y-2.5">
                {m.tasks.map((t) => {
                  const status = statuses[t.key] ?? "pending";
                  return (
                    <Card
                      key={t.key}
                      className={cx(
                        "flex flex-col gap-3 transition-all sm:flex-row sm:items-start",
                        status === "done" && "opacity-70",
                      )}
                    >
                      {/* Status checkbox */}
                      <button
                        onClick={() => setStatus(t.key, status === "done" ? "pending" : "done")}
                        aria-label={status === "done" ? "Mark as pending" : "Mark as done"}
                        className={cx(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg border-2 transition-all",
                          status === "done"
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 bg-white text-transparent hover:border-emerald-400",
                        )}
                      >
                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>

                      <div className="min-w-0 grow">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cx("font-bold text-slate-900", status === "done" && "line-through")}>{t.title}</span>
                          <Badge className={CATEGORY_TONE[t.category] ?? CATEGORY_TONE.admin}>{CATEGORY_LABEL[t.category] ?? t.category}</Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600">{t.description}</p>
                        {t.milestones.length ? (
                          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                            {t.milestones.map((ms, i) => (
                              <li key={i} className="flex items-center gap-1">
                                <span className="size-1 rounded-full bg-slate-300" />
                                {ms}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-right text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">{formatRange(t.startDate, t.dueDate)}</p>
                        <p>{t.hoursPerWeek} hrs/wk</p>
                        {t.anchorDeadline ? <p className="text-amber-600">Before deadline</p> : null}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* CTA → counsellor */}
      <Card className="mt-8 border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Want a human to review this?</h3>
            <p className="mt-0.5 text-sm text-slate-600">A Scholars Abroad counsellor can override the plan and add context.</p>
          </div>
          <Link to="/counsellors">
            <Button>Review with a counsellor →</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return `${fmt(s)} – ${fmt(e)}`;
}

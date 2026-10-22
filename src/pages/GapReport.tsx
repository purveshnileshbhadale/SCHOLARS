import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Shortlist, Tier } from "../lib/types";
import { analyseGaps, type GapReport } from "../lib/gaps";
import { PILLAR_LABEL, PILLAR_TONE, rateIndex } from "../lib/normaliser";
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner } from "../components/ui";

function monthsUntilEarliestDeadline(shortlist: Shortlist | null): number {
  // Without per-university deadlines in the shortlist payload, assume a
  // standard intake window: ~18 months for the next autumn intake.
  // Once applications exist we refine; for now use a sensible default.
  if (!shortlist) return 18;
  return 18;
}

export default function GapReportPage() {
  const { session, studentProfile } = useAuth();
  const [shortlist, setShortlist] = useState<Shortlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const report = useMemo<GapReport | null>(() => {
    if (!studentProfile) return null;
    const tiers = (shortlist?.result?.items ?? []).map((i) => i.tier as Tier);
    return analyseGaps({
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
      monthsToDeadline: monthsUntilEarliestDeadline(shortlist),
    });
  }, [studentProfile, shortlist]);

  async function saveSnapshot() {
    if (!session || !report) return;
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.from("gap_reports").insert({
        student_id: session.user.id,
        report: report as unknown as Record<string, unknown>,
      });
      if (error) throw error;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save report");
    } finally {
      setSaving(false);
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
        body="The gap analyser compares you with admitted-student benchmarks. Finish onboarding to unlock it."
        action={
          <Link to="/onboarding">
            <Button>Go to onboarding</Button>
          </Link>
        }
      />
    );

  if (!report)
    return <Empty title="Could not analyse gaps" body="Try refreshing the page." />;

  const changeableGaps = report.gaps.filter((g) => g.changeable);
  const fixedGaps = report.gaps.filter((g) => !g.changeable);

  return (
    <div>
      <PageHeader
        title="Gap report"
        subtitle="Where you stand against admitted-student benchmarks — ranked by impact, fixability and urgency."
        right={
          <Button variant="ghost" onClick={saveSnapshot} disabled={saving}>
            {saving ? "Saving…" : "Save snapshot"}
          </Button>
        }
      />

      <ErrorNote>{err}</ErrorNote>

      {/* Summary */}
      <Card className="mb-6">
        <p className="text-sm leading-relaxed text-slate-700">{report.summary}</p>
        {report.strongest ? (
          <p className="mt-2 text-sm text-emerald-700">
            <span className="font-bold">Strongest area:</span> {report.strongest.label} — {report.strongest.detail}
          </p>
        ) : null}
      </Card>

      {/* Pillars */}
      <h2 className="mb-3 text-lg font-bold text-slate-900">Your six pillars</h2>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {report.pillars
          .filter((p) => p.key !== "budget")
          .map((p) => {
            const rating = rateIndex(p.studentValue);
            const pct = Math.min(100, p.studentValue);
            const benchPct = Math.min(100, p.benchmarkValue);
            return (
              <Card key={p.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{p.label}</span>
                  <Badge className={PILLAR_TONE[rating]}>{PILLAR_LABEL[rating]}</Badge>
                </div>
                {/* Progress vs benchmark bar */}
                <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                  {/* Benchmark marker */}
                  <div
                    className="absolute inset-y-0 w-0.5 bg-slate-400"
                    style={{ left: `${benchPct}%` }}
                    title={`Benchmark: ${benchPct}`}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>You: {p.studentValue}</span>
                  <span>Benchmark: {benchPct}</span>
                </div>
                <p className="text-xs text-slate-500">{p.detail}</p>
                {!p.changeable && (
                  <p className="text-[11px] font-medium text-slate-400">Past marks — cannot change</p>
                )}
              </Card>
            );
          })}
      </div>

      {/* Top changeable gaps */}
      <h2 className="mb-1 text-lg font-bold text-slate-900">Top gaps to fix</h2>
      <p className="mb-3 text-sm text-slate-500">Ranked by Impact × Fixability × Urgency.</p>
      {changeableGaps.length === 0 ? (
        <Card className="mb-8 border-dashed">
          <p className="text-sm text-slate-500">No changeable gaps — you meet or exceed the benchmarks. Keep going.</p>
        </Card>
      ) : (
        <div className="mb-8 space-y-3">
          {changeableGaps.slice(0, 5).map((g, i) => (
            <Card key={g.pillar} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 font-display text-sm font-bold text-white">
                {i + 1}
              </div>
              <div className="min-w-0 grow">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900">{g.label}</span>
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700">Gap {g.gapSize}</Badge>
                  {g.fix ? (
                    <Badge className="border-slate-200 bg-slate-50 text-slate-600">~{g.monthsToFix} mo</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-slate-600">{g.detail}</p>
                {g.fix ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    <span className="font-semibold">Fix:</span> {g.fix.fix} ({g.fix.hoursPerWeek} hrs/week)
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-4 text-center text-xs text-slate-500">
                <div>
                  <p className="font-bold text-slate-800">{g.impact.toFixed(2)}</p>
                  <p>Impact</p>
                </div>
                <div>
                  <p className="font-bold text-slate-800">{g.fixability.toFixed(2)}</p>
                  <p>Fixability</p>
                </div>
                <div>
                  <p className="font-bold text-emerald-700">{g.priority.toFixed(3)}</p>
                  <p>Priority</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Fixed (unchangeable) gaps — stated honestly */}
      {fixedGaps.length > 0 ? (
        <>
          <h2 className="mb-1 text-lg font-bold text-slate-900">Cannot change</h2>
          <p className="mb-3 text-sm text-slate-500">Stated honestly — these are fixed. Only future terms can move them.</p>
          <div className="mb-8 space-y-2">
            {fixedGaps.map((g) => (
              <div key={g.pillar} className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">{g.label}</span>
                <span className="ml-2 text-xs text-slate-500">{g.detail}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* CTA → Roadmap */}
      <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Turn gaps into a plan</h3>
            <p className="mt-0.5 text-sm text-slate-600">Your roadmap schedules each fix backwards from your deadlines.</p>
          </div>
          <Link to="/roadmap">
            <Button>Open roadmap →</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Shortlist, University } from "../lib/types";
import { uniChanceFields } from "../lib/chance";
import { englishEquivalents, englishLevel } from "../lib/normaliser";
import { type EducationLevel, type VisaSubclass } from "../lib/prPoints";
import {
  biggestLever,
  compareBands,
  pointsFor,
  scenarioFromProfile,
  summarise,
  type ScenarioInput,
} from "../lib/scenario";
import { Badge, Button, Card, Empty, PageHeader, Spinner } from "../components/ui";
import { cx } from "../lib/utils";

const TIER_META: Record<"reach" | "target" | "safety", { label: string; cls: string }> = {
  reach: { label: "Reach", cls: "border-rose-200 bg-rose-50 text-rose-700" },
  target: { label: "Target", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  safety: { label: "Safety", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="font-display text-sm font-bold text-emerald-800">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-emerald-600"
      />
      {hint ? <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

function TierPill({ tier }: { tier: "reach" | "target" | "safety" }) {
  const meta = TIER_META[tier];
  return <Badge className={meta.cls}>{meta.label}</Badge>;
}

/** "What if" sandbox: re-runs the admission and PR engines against a hypothetical profile. */
export default function WhatIf() {
  const { session, studentProfile } = useAuth();
  const [shortlist, setShortlist] = useState<Shortlist | null>(null);
  const [unis, setUnis] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);

  const [scenario, setScenario] = useState<ScenarioInput | null>(null);
  const [age, setAge] = useState(21);
  const [education, setEducation] = useState<EducationLevel>("bachelor");
  const [regionalStudy, setRegionalStudy] = useState(false);
  const [australianStudy, setAustralianStudy] = useState(true);
  const [subclass, setSubclass] = useState<VisaSubclass>("189");

  useEffect(() => {
    if (studentProfile && !scenario) setScenario(scenarioFromProfile(studentProfile));
  }, [studentProfile, scenario]);

  useEffect(() => {
    if (!session) return;
    let live = true;
    (async () => {
      const { data } = await supabase
        .from("shortlists")
        .select("*")
        .eq("student_id", session.user.id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sl = (data as Shortlist) ?? null;
      if (!live) return;
      setShortlist(sl);

      const ids = (sl?.result?.items ?? []).map((i) => i.university_id);
      if (ids.length) {
        const { data: rows } = await supabase.from("universities").select("*").in("id", ids);
        if (!live) return;
        setUnis((rows as University[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [session]);

  const base = useMemo<ScenarioInput | null>(
    () => (studentProfile ? scenarioFromProfile(studentProfile) : null),
    [studentProfile],
  );

  const rows = useMemo(
    () =>
      unis.map((u) => ({
        id: u.id,
        name: u.name,
        qsRank: u.qs_rank,
        fields: uniChanceFields(u),
      })),
    [unis],
  );

  const moves = useMemo(() => {
    if (!base || !scenario) return [];
    return compareBands(base, scenario, rows);
  }, [base, scenario, rows]);

  const summary = useMemo(() => summarise(moves), [moves]);
  const lever = useMemo(() => biggestLever(moves), [moves]);

  const prBefore = useMemo(
    () =>
      pointsFor({
        age,
        ielts: base?.ielts ?? null,
        education,
        regionalStudy,
        australianStudy,
        subclass,
      }),
    [age, base, education, regionalStudy, australianStudy, subclass],
  );

  const prAfter = useMemo(
    () =>
      pointsFor({
        age,
        ielts: scenario?.ielts ?? null,
        education,
        regionalStudy,
        australianStudy,
        subclass,
      }),
    [age, scenario, education, regionalStudy, australianStudy, subclass],
  );

  const currentEnglish = useMemo(
    () => englishLevel(scenario?.ielts ?? null, scenario?.toefl ?? null, scenario?.pte ?? null),
    [scenario],
  );

  const equivalents = useMemo(
    () => (scenario?.ielts != null ? englishEquivalents("IELTS", scenario.ielts) : null),
    [scenario],
  );

  function patch(next: Partial<ScenarioInput>) {
    setScenario((s) => (s ? { ...s, ...next } : s));
  }

  /** Keep IELTS, TOEFL and PTE in step so a university that only lists PTE still moves. */
  function setIelts(value: number) {
    const eq = englishEquivalents("IELTS", value);
    patch({ ielts: value, toefl: eq.toefl, pte: eq.pte });
  }

  function reset() {
    if (studentProfile) setScenario(scenarioFromProfile(studentProfile));
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  if (!studentProfile?.is_complete)
    return (
      <Empty
        title="Complete your profile first"
        body="The scenario lab needs your academics, English scores and budget so it can re-run the admission model against a hypothetical profile."
        action={
          <Link to="/onboarding">
            <Button>Go to onboarding</Button>
          </Link>
        }
      />
    );

  if (!scenario || !base) return <Empty title="Could not load your profile" body="Try refreshing the page." />;

  if (!moves.length)
    return (
      <Empty
        title="Generate a shortlist first"
        body="Scenarios are compared against your shortlisted universities. Build your shortlist, then come back to model changes."
        action={
          <Link to="/dashboard">
            <Button>Go to shortlist</Button>
          </Link>
        }
      />
    );

  const ieltsValue = scenario.ielts ?? 6;
  const class12Value = scenario.class12 ?? 75;
  const budgetValue = scenario.budgetAudPerYear ?? 45000;
  const satValue = scenario.sat ?? 1200;

  return (
    <div>
      <PageHeader
        title="Scenario lab"
        subtitle="Change one thing and watch every number move — admission bands, fit scores and PR points, all recomputed by the same rules engines."
        right={
          <Button variant="ghost" onClick={reset}>
            Reset to my profile
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Scenario controls */}
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Your levers</h2>
            <div className="space-y-4">
              <Slider
                label="IELTS"
                hint="Sets your TOEFL and PTE equivalents automatically."
                value={ieltsValue}
                min={4}
                max={9}
                step={0.5}
                display={ieltsValue.toFixed(1)}
                onChange={setIelts}
              />
              <Slider
                label="Class 12 / academic %"
                hint="Final board percentage after conversion."
                value={class12Value}
                min={40}
                max={100}
                step={1}
                display={`${class12Value}%`}
                onChange={(v) => patch({ class12: v })}
              />
              <Slider
                label="Budget"
                hint="Tuition + living per year, in AUD."
                value={budgetValue}
                min={20000}
                max={120000}
                step={2500}
                display={`A$${budgetValue.toLocaleString("en-AU")}`}
                onChange={(v) => patch({ budgetAudPerYear: v })}
              />
              <Slider
                label="SAT"
                hint="Only universities that ask for SAT use this."
                value={satValue}
                min={400}
                max={1600}
                step={10}
                display={String(satValue)}
                onChange={(v) => patch({ sat: v })}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {[
                { label: "IELTS 6.5", run: () => setIelts(6.5) },
                { label: "IELTS 7.0", run: () => setIelts(7.0) },
                { label: "IELTS 7.5", run: () => setIelts(7.5) },
                { label: "IELTS 8.0", run: () => setIelts(8.0) },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={p.run}
                  className={cx(
                    "rounded-full border px-2.5 py-1 text-[11px] font-bold transition",
                    Math.abs(ieltsValue - Number(p.label.split(" ")[1])) < 0.01
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-300",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">English right now</h2>
            <p className="mb-2 text-xs text-slate-500">
              {currentEnglish.bestTest
                ? `${currentEnglish.bestTest} ${currentEnglish.bestScore} · ${currentEnglish.cefr ?? "—"}`
                : "No English score set"}
            </p>
            {equivalents ? (
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  { k: "IELTS", v: equivalents.ielts?.toFixed(1) },
                  { k: "TOEFL", v: equivalents.toefl != null ? String(equivalents.toefl) : "—" },
                  { k: "PTE", v: equivalents.pte != null ? String(equivalents.pte) : "—" },
                ].map((x) => (
                  <div key={x.k} className="rounded-xl border border-slate-200/70 bg-slate-50/60 py-2">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{x.k}</dt>
                    <dd className="font-display text-lg font-extrabold text-slate-900">{x.v ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">PR assumptions</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Age at application</span>
                <input
                  type="number"
                  min={18}
                  max={49}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Qualification</span>
                <select
                  value={education}
                  onChange={(e) => setEducation(e.target.value as EducationLevel)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-sm"
                >
                  <option value="certificate">Certificate / diploma</option>
                  <option value="bachelor">Bachelor degree</option>
                  <option value="masters">Masters</option>
                  <option value="phd">PhD</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Visa stream</span>
                <select
                  value={subclass}
                  onChange={(e) => setSubclass(e.target.value as VisaSubclass)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-sm"
                >
                  <option value="189">189 — Skilled Independent</option>
                  <option value="190">190 — State nominated</option>
                  <option value="491">491 — Regional provisional</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAustralianStudy((v) => !v)}
                  className={cx(
                    "rounded-full border px-3 py-1 text-[11px] font-bold transition",
                    australianStudy ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white/70 text-slate-600",
                  )}
                >
                  Australian study
                </button>
                <button
                  onClick={() => setRegionalStudy((v) => !v)}
                  className={cx(
                    "rounded-full border px-3 py-1 text-[11px] font-bold transition",
                    regionalStudy ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white/70 text-slate-600",
                  )}
                >
                  Regional study
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Work-experience points are left at zero here, so this is a floor — see{" "}
                <Link to="/pr-pathway" className="font-semibold text-emerald-700 hover:underline">
                  PR pathway
                </Link>{" "}
                for the full calculator.
              </p>
            </div>
          </Card>
        </div>

        {/* Results */}
        <div className="space-y-4">
          <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/60">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{lever.label}</p>
                <p className="mt-0.5 text-sm text-slate-700">{lever.detail}</p>
              </div>
              <div className="flex gap-2">
                <div className="rounded-xl bg-white/80 px-3 py-1.5 text-center">
                  <p className="text-lg font-extrabold text-emerald-700">{summary.up}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-500">up</p>
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-1.5 text-center">
                  <p className="text-lg font-extrabold text-slate-700">{summary.unchanged}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-500">same</p>
                </div>
                <div className="rounded-xl bg-white/80 px-3 py-1.5 text-center">
                  <p className="text-lg font-extrabold text-rose-600">{summary.down}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-500">down</p>
                </div>
              </div>
            </div>
            {summary.unlocked > 0 || summary.locked > 0 ? (
              <p className="mt-2 text-xs font-medium text-slate-600">
                {summary.unlocked > 0 ? `${summary.unlocked} university(ies) become eligible. ` : ""}
                {summary.locked > 0 ? `${summary.locked} would drop below the published minimum.` : ""}
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Shortlist impact</h2>
            <div className="space-y-2">
              {moves.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{m.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {m.qsRank ? `QS #${m.qsRank}` : "Rank unknown"}
                      {m.after.ineligible ? ` · ${m.after.ineligibleReason}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TierPill tier={m.before.tier} />
                    <span className={cx("text-xs font-bold", m.direction === "up" ? "text-emerald-600" : m.direction === "down" ? "text-rose-600" : "text-slate-400")}>
                      {m.direction === "up" ? "→" : m.direction === "down" ? "→" : "="}
                    </span>
                    <TierPill tier={m.after.tier} />
                    <span
                      className={cx(
                        "w-12 text-right text-xs font-bold",
                        m.fitDelta > 0 ? "text-emerald-700" : m.fitDelta < 0 ? "text-rose-600" : "text-slate-400",
                      )}
                    >
                      {m.fitDelta > 0 ? `+${m.fitDelta}` : m.fitDelta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              The last number is the change in fit score (0–100). Bands use the same hard rules as your dashboard: QS top-30
              is always a reach, and safety needs headroom over every published minimum.
            </p>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">PR points</h2>
              <Badge className="border-slate-200 bg-slate-50 text-slate-600">{subclass}</Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs font-bold uppercase text-slate-400">Now</p>
                <p className="font-display text-3xl font-extrabold text-slate-700">{prBefore.total}</p>
              </div>
              <div className={cx("text-2xl font-bold", prAfter.total > prBefore.total ? "text-emerald-600" : prAfter.total < prBefore.total ? "text-rose-500" : "text-slate-300")}>
                {prAfter.total > prBefore.total ? "→" : prAfter.total < prBefore.total ? "→" : "="}
              </div>
              <div className="text-center">
                <p className="text-xs font-bold uppercase text-slate-400">Scenario</p>
                <p className="font-display text-3xl font-extrabold text-emerald-700">{prAfter.total}</p>
              </div>
              <div className="ml-auto text-right text-xs text-slate-500">
                <p>{prAfter.meetsMinimum ? "Meets the 65-point floor" : "Below the 65-point floor"}</p>
                <p>{prAfter.competitive ? "Competitive at invitation rounds" : "Usually needs more to be invited"}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {prAfter.breakdown
                .filter((b) => b.points !== 0)
                .map((b) => (
                  <div key={b.label} className="flex items-center justify-between rounded-lg bg-slate-50/80 px-2.5 py-1.5 text-xs">
                    <span className="text-slate-600">{b.label}</span>
                    <span className="font-bold text-slate-800">+{b.points}</span>
                  </div>
                ))}
            </div>
          </Card>

          <Card className="border-dashed">
            <p className="text-xs leading-relaxed text-slate-500">
              Scenarios are computed live in your browser from the rules engines — nothing is saved to your profile. When a
              change is worth chasing, set it as a goal on your{" "}
              <Link to="/roadmap" className="font-semibold text-emerald-700 hover:underline">
                roadmap
              </Link>
              .
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Scholarship, Shortlist, ShortlistItem, StudentProfile, Tier, University } from "../lib/types";
import { money, tierBadge } from "../lib/utils";
import { waShareUrl } from "../lib/config";
import { profileSnapshot, PILLAR_LABEL, PILLAR_TONE } from "../lib/normaliser";
import { chanceBand, studentChanceFields, uniChanceFields } from "../lib/chance";
import EmailAssist from "../components/EmailAssist";
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner } from "../components/ui";

const TIER_LABEL: Record<Tier, string> = { reach: "Reach", target: "Target", safety: "Safety" };

/** Profile completion breakdown (LinkedIn is a bonus item, not required for shortlists). */
function completionInfo(p: StudentProfile) {
  const checks: { label: string; ok: boolean; required: boolean }[] = [
    { label: "Intended course", ok: !!p.intended_major, required: true },
    { label: "Career goal", ok: !!p.career_goal?.trim(), required: true },
    { label: "Class 10 & 12 marks", ok: p.class_10_marks != null && p.class_12_marks != null, required: true },
    { label: "Grading system", ok: !!p.grading_system, required: true },
    { label: "English test score", ok: p.ielts != null || p.toefl != null || p.pte != null, required: true },
    { label: "Budget", ok: (p.budget_aud_per_year ?? 0) > 0, required: true },
    { label: "Preferred cities", ok: p.preferred_cities.length >= 1, required: true },
    { label: "Priorities", ok: p.priorities_ranked.length >= 1, required: true },
    { label: "Resume", ok: !!p.resume_url, required: true },
    { label: "LinkedIn profile", ok: !!p.linkedin_url, required: false },
  ];
  const required = checks.filter((c) => c.required);
  const done = required.filter((c) => c.ok).length;
  return { checks, pct: Math.round((done / required.length) * 100), missing: checks.filter((c) => !c.ok) };
}

/**
 * Profile strength = required items (2 pts each) + engagement extras
 * (LinkedIn, community, profile-share consent, generated shortlist; 1 pt each).
 * Required items are all in once the profile is "complete", so the extras are
 * what separate a B+ from an A.
 */
function strengthInfo(p: StudentProfile, checks: { label: string; ok: boolean; required: boolean }[], hasShortlist: boolean) {
  const reqTotal = checks.filter((c) => c.required).length;
  const reqDone = checks.filter((c) => c.required && c.ok).length;
  const extras = [!!p.linkedin_url, !!p.community_joined_at, !!p.share_consent, hasShortlist].filter(Boolean).length;
  const pct = Math.round(((reqDone * 2 + extras) / (reqTotal * 2 + 4)) * 100);
  if (pct >= 93) return { pct, letter: "A", label: "Excellent", tone: "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-300" };
  if (pct >= 87) return { pct, letter: "A-", label: "Nearly there", tone: "bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200" };
  if (pct >= 80) return { pct, letter: "B+", label: "Strong", tone: "bg-sky-50 text-sky-800 ring-2 ring-sky-200" };
  if (pct >= 70) return { pct, letter: "B", label: "Good", tone: "bg-sky-50 text-sky-800 ring-2 ring-sky-200" };
  if (pct >= 55) return { pct, letter: "C", label: "Getting there", tone: "bg-amber-50 text-amber-800 ring-2 ring-amber-200" };
  return { pct, letter: "D", label: "Needs work", tone: "bg-rose-50 text-rose-800 ring-2 ring-rose-200" };
}

export default function Dashboard() {
  const { session, studentProfile, refresh } = useAuth();
  const [shortlist, setShortlist] = useState<Shortlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoRan = useRef(false);
  const [assistUni, setAssistUni] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
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

  async function generate() {
    setErr(null);
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("shortlist", { method: "POST" });
      if (error) {
        const body = (error as { context?: Response }).context ? await (error as { context: Response }).context.json().catch(() => null) : null;
        throw new Error(body?.error ?? error.message ?? "Could not generate shortlist");
      }
      await refresh();
      await loadLatest();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not generate shortlist");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    (async () => {
      await loadLatest();
      setLoading(false);
      if (studentProfile?.is_complete && !autoRan.current) {
        autoRan.current = true;
        const { data } = await supabase
          .from("shortlists")
          .select("id")
          .eq("student_id", session!.user.id)
          .limit(1);
        if (!data?.length) generate();
      }
    })();
  }, [session, studentProfile, loadLatest]);

  const [unis, setUnis] = useState<University[]>([]);
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);

  // Load supporting data for the latest shortlist (runs once per shortlist).
  useEffect(() => {
    if (!shortlist?.result?.items?.length) return;
    const ids = shortlist.result.items.map((i) => i.university_id);
    supabase
      .from("universities")
      .select("*")
      .in("id", ids)
      .then(({ data }) => setUnis((data as University[]) ?? []));
    supabase
      .from("scholarships")
      .select("*")
      .in("university_id", ids)
      .then(({ data }) => setScholarships((data as Scholarship[]) ?? []));
  }, [shortlist?.id]);

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  if (!studentProfile?.is_complete) {
    if (!studentProfile)
      return (
        <Empty
          title="Finish your profile to unlock your shortlist"
          body="Your free Australian university shortlist is generated automatically once your academics, test scores, budget, preferences and resume are in."
          action={
            <Link to="/onboarding">
              <Button>Go to onboarding</Button>
            </Link>
          }
        />
      );
    const m = completionInfo(studentProfile);
    const g = strengthInfo(studentProfile, m.checks, !!shortlist);
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Finish your profile" subtitle="Your free shortlist unlocks the moment every required item is in." />
        <Card className="space-y-5">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-700">Profile completion</span>
              <span className="text-2xl font-extrabold text-emerald-700">
                {m.pct}%
                <span className={`ml-2 rounded-lg px-2 py-0.5 align-middle text-sm font-bold ring-1 ${g.tone}`}>
                  {g.letter}
                </span>
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${m.pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {m.checks.filter((c) => c.ok).length}/{m.checks.length} items added
            </p>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            {m.checks.map((c) => (
              <li
                key={c.label}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  c.ok ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <span className="font-bold">{c.ok ? "✓" : "○"}</span>
                {c.label}
                {!c.required ? <span className="ml-auto text-[10px] font-semibold text-slate-400">OPTIONAL</span> : null}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3">
            <Link to="/onboarding">
              <Button>{m.pct > 0 ? "Continue onboarding" : "Start my profile"}</Button>
            </Link>
            <Link to="/community">
              <Button variant="ghost">Add LinkedIn in the community</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const byTier = (t: Tier) => (shortlist?.result.items ?? []).filter((i) => i.tier === t);

  // Profile snapshot (Engine 1) — six pillars for the Dashboard.
  const snapshot = useMemo(() => {
    if (!studentProfile) return null;
    return profileSnapshot({
      class10: studentProfile.class_10_marks,
      class12: studentProfile.class_12_marks,
      gradingSystem: studentProfile.grading_system ?? "cbse",
      ielts: studentProfile.ielts,
      toefl: studentProfile.toefl,
      pte: studentProfile.pte,
      sat: studentProfile.sat,
      budgetAudPerYear: studentProfile.budget_aud_per_year,
      needsScholarship: studentProfile.needs_scholarship,
    });
  }, [studentProfile]);

  // Rules-based chance fields for each shortlisted uni (Engine 3).
  const chanceByUni = useMemo(() => {
    if (!studentProfile) return new Map<string, ReturnType<typeof chanceBand>>();
    const sFields = studentChanceFields(studentProfile);
    const map = new Map<string, ReturnType<typeof chanceBand>>();
    for (const item of shortlist?.result.items ?? []) {
      const uni = unis.find((u) => u.id === item.university_id);
      if (!uni) continue;
      map.set(item.university_id, chanceBand({ ...sFields, ...uniChanceFields(uni) }));
    }
    return map;
  }, [studentProfile, shortlist, unis]);

  function shareShortlist() {
    if (!shortlist) return;
    const lines = ["My Scholars Abroad shortlist:", ""];
    shortlist.result.items
      .slice()
      .sort((a, b) => b.fit_score - a.fit_score)
      .forEach((i, idx) => lines.push(`${idx + 1}. ${i.name} (${i.tier}, fit ${i.fit_score})`));
    lines.push("", "Made with Scholars Abroad — free shortlist with rules-based chance bands.");
    window.open(waShareUrl(lines.join("\n")), "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <PageHeader
        title="Your shortlist"
        subtitle={
          shortlist
            ? `Generated ${new Date(shortlist.generated_at).toLocaleString("en-AU")}${shortlist.model_version ? ` · ${shortlist.model_version}` : ""} · rules-based chance bands`
            : "Free · automatic · rules-based chance bands with plain meanings"
        }
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={generate} disabled={generating}>
              {generating ? <Spinner className="size-4" /> : null}
              Regenerate
            </Button>
            {shortlist ? (
              <Button variant="ghost" onClick={shareShortlist}>
                Share
              </Button>
            ) : null}
            <Link to="/counsellors">
              <Button>Talk to a counsellor</Button>
            </Link>
          </div>
        }
      />

      <ErrorNote>{err}</ErrorNote>

      {/* Profile strength grade (feature 48) */}
      {(() => {
        const m = completionInfo(studentProfile);
        const g = strengthInfo(studentProfile, m.checks, !!shortlist);
        return (
          <Card className="mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ring-2 ${g.tone}`}>
                {g.letter}
              </span>
              <div className="min-w-48 grow">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-slate-700">Profile strength</span>
                  <span className="font-bold text-slate-900">{g.pct}% · {g.label}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${g.pct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Required items: all in.{" "}
                  {!studentProfile.linkedin_url || !studentProfile.community_joined_at || !studentProfile.share_consent
                    ? "Boost your grade with LinkedIn, the community and profile sharing."
                    : "Top grade — everything is filled in."}
                </p>
              </div>
              <Link to="/onboarding">
                <Button variant="ghost" className="px-3">
                  Improve
                </Button>
              </Link>
            </div>
          </Card>
        );
      })()}

      <DailyPlanCard />

      {/* Engine 1 — six-pillar profile snapshot */}
      {snapshot ? (
        <Card className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-900">Profile snapshot</h2>
              <p className="text-xs text-slate-500">Six pillars normalised across boards and tests.</p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              Overall {snapshot.overallIndex}/100
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Academics", ...snapshot.academics },
              { label: "Tests", ...snapshot.tests },
              { label: "English", rating: snapshot.english.index >= 70 ? "outstanding" as const : snapshot.english.index >= 50 ? "competitive" as const : snapshot.english.index >= 30 ? "developing" as const : "emerging" as const, detail: snapshot.english.bestTest ? `${snapshot.english.bestTest} ${snapshot.english.bestScore} (≈ ${snapshot.english.cefr})` : "No test yet", index: snapshot.english.index },
              { label: "Budget", ...snapshot.budgetFit },
            ].map((p) => (
              <div key={p.label} className="rounded-xl border border-slate-200/60 bg-slate-50/60 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{p.label}</span>
                  <Badge className={PILLAR_TONE[p.rating]}>{PILLAR_LABEL[p.rating]}</Badge>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    style={{ width: `${Math.min(100, p.index)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{p.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/gaps">
              <Button variant="ghost" className="px-3 py-1.5 text-xs">See gap report →</Button>
            </Link>
            <Link to="/roadmap">
              <Button variant="ghost" className="px-3 py-1.5 text-xs">Open roadmap →</Button>
            </Link>
          </div>
        </Card>
      ) : null}

      {generating && !shortlist ? (
        <Card className="py-16 text-center">
          <Spinner className="size-8" />
          <p className="mt-4 font-semibold text-slate-900">Building your shortlist…</p>
          <p className="mt-1 text-sm text-slate-500">Screening Australian universities against your profile.</p>
        </Card>
      ) : null}

      {!shortlist && !generating ? (
        <Empty
          title="No shortlist yet"
          body="Click generate and our AI will screen Australian universities against your profile."
          action={<Button onClick={generate}>Generate my shortlist</Button>}
        />
      ) : null}

      {shortlist ? (
        <>
          {shortlist.result.summary ? (
            <Card className="mb-6 border-emerald-200 bg-emerald-50/60">
              <p className="text-sm leading-relaxed text-slate-800">{shortlist.result.summary}</p>
            </Card>
          ) : null}

          {(["reach", "target", "safety"] as Tier[]).map((t) => (
            <section key={t} className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
                {TIER_LABEL[t]}
                <Badge className={tierBadge(t)}>{byTier(t).length}</Badge>
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {byTier(t).map((item) => (
                  <UniCard
                    key={item.university_id}
                    item={item}
                    uni={unis.find((u) => u.id === item.university_id) ?? null}
                    chance={chanceByUni.get(item.university_id) ?? null}
                    scholarships={scholarships.filter((s) => (item.scholarship_ids ?? []).includes(s.id))}
                    onAssist={() => setAssistUni(item.name)}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Ruled out and why */}
          {shortlist.result.ruled_out?.length ? (
            <RuledOutList ruledOut={shortlist.result.ruled_out} />
          ) : null}

          <Card className="flex flex-wrap items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-900">Next: turn your shortlist into a plan</h3>
              <p className="mt-1 text-sm text-slate-500">
                See your gaps, build a roadmap, then complete your SOP and share with a counsellor.
              </p>
            </div>
            <div className="grow" />
            <div className="flex flex-wrap gap-2">
              <Link to="/gaps">
                <Button variant="ghost">Gap report</Button>
              </Link>
              <Link to="/roadmap">
                <Button variant="ghost">Roadmap</Button>
              </Link>
              <Link to="/sop">
                <Button variant="ghost">SOP</Button>
              </Link>
              <Link to="/applications">
                <Button>Applications →</Button>
              </Link>
            </div>
          </Card>
        </>
      ) : null}

      {/* Feature 61: per-uni email assistance (Gmail hand-off). */}
      {assistUni ? (
        <EmailAssist
          uniName={assistUni}
          course={studentProfile?.intended_major ?? ""}
          onClose={() => setAssistUni(null)}
        />
      ) : null}
    </div>
  );
}

function UniCard({
  item,
  uni,
  chance,
  scholarships,
  onAssist,
}: {
  item: ShortlistItem;
  uni: University | null;
  chance: ReturnType<typeof chanceBand> | null;
  scholarships: Scholarship[];
  onAssist: () => void;
}) {
  // Feature: net tuition after the largest known scholarship award.
  const tuition = item.tuition_aud ?? uni?.tuition_aud ?? null;
  const bestAward = scholarships.reduce<number | null>(
    (max, s) => (s.amount_aud != null && (max == null || s.amount_aud > max) ? s.amount_aud : max),
    null,
  );
  const netTuition = tuition != null && bestAward != null ? Math.max(0, tuition - bestAward) : null;
  return (
    <Card className={`overflow-hidden ${uni?.image_url ? "p-0" : ""}`}>
      {uni?.image_url ? (
        <div className="relative -mx-5 -mt-5 mb-4 h-36 overflow-hidden bg-slate-100">
          <img
            src={uni.image_url}
            alt={`Campus of ${item.name}`}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute right-3 top-3">
            <Badge className={tierBadge(item.tier)}>{TIER_LABEL[item.tier]}</Badge>
          </div>
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">{item.name}</h3>
          <p className="text-xs text-slate-500">
            {[uni?.city, uni?.state, uni?.country].filter(Boolean).join(", ")}
            {uni?.qs_rank ? ` · QS #${uni.qs_rank}` : ""}
          </p>
        </div>
        <div className="text-right">
          {uni?.image_url ? null : <Badge className={tierBadge(item.tier)}>{TIER_LABEL[item.tier]}</Badge>}
          <div className="mt-1 text-lg font-extrabold text-emerald-800">{item.fit_score}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">fit score</div>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{item.reasoning}</p>
      {/* Engine 3 — deterministic chance band */}
      {chance ? (
        <div className="mt-2 rounded-lg border border-slate-200/60 bg-slate-50/60 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-slate-700">Rules-based:</span>
            <Badge className={tierBadge(chance.tier)}>{TIER_LABEL[chance.tier]}</Badge>
            <span className="text-slate-600">{chance.plainMeaning}</span>
            <span className="ml-auto text-slate-400">confidence: {chance.confidence}</span>
          </div>
          {chance.hardRules.length ? (
            <p className="mt-1 text-[11px] text-amber-700">{chance.hardRules.join(" · ")}</p>
          ) : null}
        </div>
      ) : null}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Fact label="Tuition/yr" value={money(item.tuition_aud ?? uni?.tuition_aud)} />
        <Fact label="Living/yr" value={money(item.living_cost_aud ?? uni?.living_cost_aud)} />
        <Fact label="PSW" value={item.post_study_work_years != null ? `${item.post_study_work_years} yrs` : "—"} />
        <Fact label="Intakes" value={(item.intakes ?? uni?.intakes ?? []).join(", ") || "—"} />
      </dl>
      {uni?.ielts_min ? (
        <p className="mt-2 text-xs text-slate-500">
          IELTS min {uni.ielts_min}
          {uni.toefl_min ? ` · TOEFL min ${uni.toefl_min}` : ""}
          {uni.pte_min ? ` · PTE min ${uni.pte_min}` : ""}
        </p>
      ) : null}
      {scholarships.length ? (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {scholarships.map((s) => (
            <li key={s.id} className="text-xs text-emerald-900">
              <span className="font-semibold">{s.name}</span>
              {s.amount ? ` — ${s.amount}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {netTuition != null ? (
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
          Net tuition after best scholarship: <strong>{money(netTuition)}/yr</strong>
          {tuition != null ? ` (down from ${money(tuition)})` : ""} — awards depend on eligibility; confirm on the
          official page.
        </p>
      ) : null}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <Button variant="ghost" className="w-full" onClick={onAssist}>
          Email assist — course or professor
        </Button>
      </div>
    </Card>
  );
}

function RuledOutList({ ruledOut }: { ruledOut: { name: string; reason: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="mb-6 border-slate-200/60">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <div>
          <h3 className="font-bold text-slate-900">Ruled out and why</h3>
          <p className="text-xs text-slate-500">{ruledOut.length} universities excluded by eligibility or budget filters.</p>
        </div>
        <svg
          viewBox="0 0 24 24"
          className={`size-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
          {ruledOut.map((r, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-2 rounded-lg bg-slate-50/60 px-3 py-2 text-sm">
              <span className="font-semibold text-slate-800">{r.name}</span>
              <span className="text-xs text-slate-500">{r.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

// ---------------- Feature 56: daily plan + streak ----------------

const PLAN_TASKS = [
  { key: "profile", label: "Tidy one profile field", to: "/onboarding" },
  { key: "shortlist", label: "Review one shortlisted university", to: "/dashboard" },
  { key: "gap", label: "Check your gap report", to: "/gaps" },
  { key: "roadmap", label: "Tick one roadmap task", to: "/roadmap" },
  { key: "sop", label: "Answer one SOP question", to: "/sop" },
  { key: "deadline", label: "Check your deadlines", to: "/deadlines" },
  { key: "app", label: "Update one application", to: "/applications" },
  { key: "doc", label: "Verify one document", to: "/documents" },
  { key: "mentor", label: "Ask ScholarAI one question", to: "/mentor" },
  { key: "community", label: "Post or reply in Community", to: "/community" },
];

function localDay(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function todayTasks(dayStr: string) {
  const dayNum = Math.floor(new Date(`${dayStr}T00:00:00`).getTime() / 86400000);
  const start = ((dayNum % PLAN_TASKS.length) + PLAN_TASKS.length) % PLAN_TASKS.length;
  return Array.from({ length: 4 }, (_, i) => PLAN_TASKS[(start + i) % PLAN_TASKS.length]);
}

function streakFrom(days: Set<string>): number {
  let streak = 0;
  const d = new Date();
  if (!days.has(localDay(d))) d.setDate(d.getDate() - 1);
  while (days.has(localDay(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function DailyPlanCard() {
  const { session } = useAuth();
  const today = localDay();
  const tasks = todayTasks(today);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("daily_checks")
        .select("day, task_key")
        .eq("user_id", session.user.id)
        .gte("day", since);
      const rows = (data ?? []) as { day: string; task_key: string }[];
      const days = new Set(rows.map((r) => r.day));
      setStreak(streakFrom(days));
      setChecked(new Set(rows.filter((r) => r.day === today).map((r) => r.task_key)));
    })();
  }, [session, today]);

  async function toggle(key: string, on: boolean) {
    if (!session) return;
    setChecked((cur) => {
      const next = new Set(cur);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    if (on) {
      const { error } = await supabase
        .from("daily_checks")
        .upsert({ user_id: session.user.id, day: today, task_key: key }, { onConflict: "user_id,day,task_key" });
      if (error) return;
      setStreak((s) => Math.max(s, 1));
    } else {
      await supabase.from("daily_checks").delete().eq("user_id", session.user.id).eq("day", today).eq("task_key", key);
    }
    // refresh streak from server truth
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
    const { data } = await supabase
      .from("daily_checks")
      .select("day")
      .eq("user_id", session.user.id)
      .gte("day", since);
    setStreak(streakFrom(new Set(((data ?? []) as { day: string }[]).map((r) => r.day))));
  }

  const doneCount = tasks.filter((t) => checked.has(t.key)).length;

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-slate-900">Today's plan</h2>
          <p className="text-xs text-slate-500">
            Four small moves, fresh every day. Check them off as you go — done {doneCount}/{tasks.length}.
          </p>
        </div>
        {streak > 0 ? (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            {streak}-day streak
          </span>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
            Start a streak today
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-1.5">
        {tasks.map((t) => (
          <li key={t.key}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 text-emerald-600"
                checked={checked.has(t.key)}
                onChange={(e) => toggle(t.key, e.target.checked)}
              />
              <span className={`text-sm ${checked.has(t.key) ? "text-slate-400 line-through" : "text-slate-700"}`}>{t.label}</span>
              <Link to={t.to} className="ml-auto text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                Open →
              </Link>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-slate-400">
        A streak day = any task checked. Consistency beats cramming the week before a deadline.
      </p>
    </Card>
  );
}

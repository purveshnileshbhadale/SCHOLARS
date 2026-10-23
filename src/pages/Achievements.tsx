import { useEffect, useState } from "react";
import { Card, Empty, ErrorNote, PageHeader, Spinner, Badge } from "../components/ui";
import { cx } from "../lib/utils";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  EMPTY_SIGNALS,
  badgeStates,
  streakFrom,
  unlockedCount,
  type BadgeCategory,
  type Signals,
} from "../lib/achievements";

const CATEGORY_ORDER: BadgeCategory[] = ["Getting started", "Applications", "Planning", "Community", "Life in AU"];

const SUBMITTED_STATUSES = ["Application Submitted", "Awaiting Decision", "Offer Received", "Waitlisted", "Rejected"];
const OFFER_STATUSES = ["Offer Received"];

function localCounts() {
  const read = <T,>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const budget = read<unknown[]>("sa_expenses_v1", []);
  const work = read<unknown[]>("sa_work_log_v1", []);
  const predep = read<Record<string, boolean>>("sa_predeparture_v1", {});
  const vocab = read<Record<string, number>>("sa_vocab_mastered_v1", {});
  const writing = read<unknown[]>("sa_writing_log_v1", []);
  let speaking = 0;
  try {
    speaking = Number(localStorage.getItem("sa_speaking_log_v1") ?? "0") || 0;
  } catch {}
  return {
    budgetEntries: Array.isArray(budget) ? budget.length : 0,
    workEntries: Array.isArray(work) ? work.length : 0,
    predepartureChecked: Object.values(predep).filter(Boolean).length,
    vocabMastered: Object.values(vocab).filter((v) => v > 0).length,
    writingAttempts: Array.isArray(writing) ? writing.length : 0,
    speakingPractised: speaking,
  };
}

/**
 * Achievement badges — every rule is deterministic (count thresholds and
 * booleans), computed from existing activity. Unlocked badges glow; locked
 * ones show a progress bar so you know exactly what's missing.
 */
export default function Achievements() {
  const { session } = useAuth();
  const [signals, setSignals] = useState<Signals | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (!session) return;
    const uid = session.user.id;

    (async () => {
      try {
        const [sp, sl, apps, docs, sop, bks, posts, road, gaps, sch, out, checks] = await Promise.all([
          supabase.from("student_profiles").select("is_complete, resume_url, share_consent, shortlist_reviewed_at").eq("user_id", uid).maybeSingle(),
          supabase.from("shortlists").select("id").eq("student_id", uid),
          supabase.from("applications").select("status").eq("student_id", uid),
          supabase.from("student_documents").select("id").eq("student_id", uid),
          supabase.from("sop_responses").select("answers").eq("student_id", uid).maybeSingle(),
          supabase.from("bookings").select("status").eq("student_id", uid),
          supabase.from("community_posts").select("id").eq("author_id", uid),
          supabase.from("roadmap_tasks").select("status").eq("student_id", uid),
          supabase.from("gap_reports").select("id").eq("student_id", uid),
          supabase.from("scholarship_applications").select("status").eq("student_id", uid),
          supabase.from("outreach_contacts").select("status").eq("student_id", uid),
          supabase.from("daily_checks").select("day").eq("user_id", uid),
        ]);
        if (!live) return;

        const profile = sp.data;
        const appRows = (apps.data ?? []) as { status: string }[];
        const sopAnswers = sop.data?.answers as Record<string, string> | null;
        const bookingRows = (bks.data ?? []) as { status: string }[];
        const roadRows = (road.data ?? []) as { status: string }[];
        const schRows = (sch.data ?? []) as { status: string }[];
        const outRows = (out.data ?? []) as { status: string }[];
        const daySet = new Set(((checks.data ?? []) as { day: string }[]).map((r) => r.day));

        setSignals({
          ...EMPTY_SIGNALS,
          profileComplete: !!profile?.is_complete,
          hasResume: !!profile?.resume_url,
          shareConsent: !!profile?.share_consent,
          shortlistCount: (sl.data ?? []).length,
          shortlistReviewed: !!profile?.shortlist_reviewed_at,
          applications: appRows.length,
          submitted: appRows.filter((a) => SUBMITTED_STATUSES.includes(a.status)).length,
          offers: appRows.filter((a) => OFFER_STATUSES.includes(a.status)).length,
          documents: (docs.data ?? []).length,
          sopAnswers: sopAnswers ? Object.values(sopAnswers).filter((v) => typeof v === "string" && v.trim()).length : 0,
          bookings: bookingRows.filter((b) => ["paid", "scheduled", "completed"].includes(b.status)).length,
          posts: (posts.data ?? []).length,
          roadmapDone: roadRows.filter((r) => r.status === "done").length,
          gapReports: (gaps.data ?? []).length,
          scholarshipSubmitted: schRows.filter((s) => !["saved", "drafting"].includes(s.status)).length,
          scholarshipAwarded: schRows.filter((s) => s.status === "awarded").length,
          outreachSent: outRows.filter((o) => ["sent", "replied", "meeting_booked", "closed"].includes(o.status)).length,
          outreachReplied: outRows.filter((o) => ["replied", "meeting_booked", "closed"].includes(o.status)).length,
          streak: streakFrom(daySet),
          ...localCounts(),
        });
      } catch (e) {
        if (live) setErr(e instanceof Error ? e.message : "Could not load achievements.");
      }
    })();
    return () => {
      live = false;
    };
  }, [session]);

  if (!signals) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Achievements" subtitle="Badges for every milestone — from first shortlist to departure-ready." />
        {err ? <ErrorNote>{err}</ErrorNote> : <Spinner className="mx-auto mt-16 size-8" />}
      </div>
    );
  }

  const states = badgeStates(signals);
  const unlocked = unlockedCount(states);
  const pctAll = Math.round((unlocked / states.length) * 100);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Achievements"
        subtitle="Badges for every milestone — from first shortlist to departure-ready. Progress counts real activity, not taps."
        right={<Badge className="bg-violet-50 text-violet-700 ring-violet-200">{unlocked}/{states.length}</Badge>}
      />
      <ErrorNote>{err}</ErrorNote>

      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Overall</p>
            <p className="text-3xl font-extrabold text-slate-900">
              {pctAll}
              <span className="text-base font-semibold text-slate-400">%</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-emerald-700">{unlocked} unlocked</p>
            <p className="text-xs text-slate-500">{states.length - unlocked} to go</p>
          </div>
        </div>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700" style={{ width: `${pctAll}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>Daily streak: <strong className="text-slate-800">{signals.streak} days</strong></span>
          <span>Applications: <strong className="text-slate-800">{signals.applications}</strong></span>
          <span>Docs: <strong className="text-slate-800">{signals.documents}</strong></span>
          <span>Words: <strong className="text-slate-800">{signals.vocabMastered}</strong></span>
        </div>
      </Card>

      {CATEGORY_ORDER.map((cat) => {
        const rows = states.filter((b) => b.category === cat);
        if (!rows.length) return null;
        return (
          <section key={cat} className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">{cat}</h2>
              <span className="text-xs font-semibold text-slate-400">
                {rows.filter((r) => r.unlocked).length}/{rows.length}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((b) => (
                <Card key={b.id} className={cx("relative overflow-hidden", b.unlocked ? "" : "opacity-90")}>
                  <div className="flex items-start gap-3">
                    <span
                      className={cx(
                        "flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1",
                        b.unlocked ? b.tone : "bg-slate-50 text-slate-300 ring-slate-200",
                      )}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5">
                        <path d={b.icon} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cx("text-sm font-bold", b.unlocked ? "text-slate-900" : "text-slate-700")}>{b.title}</p>
                        {b.unlocked ? (
                          <span className="text-[11px] font-extrabold uppercase text-emerald-600">Unlocked</span>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-400">
                            {b.current}/{b.target}
                            {b.unit ? ` ${b.unit}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{b.desc}</p>
                      {!b.unlocked && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${b.pct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  {b.unlocked && (
                    <span className="pointer-events-none absolute -right-6 -top-6 size-16 rounded-full bg-emerald-400/10" aria-hidden />
                  )}
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      {unlocked === states.length && <Empty title="All badges unlocked" body="You've done everything this board tracks. Time to celebrate — then book the flight." />}
    </div>
  );
}

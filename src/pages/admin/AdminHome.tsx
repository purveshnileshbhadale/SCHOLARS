import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Booking, Profile } from "../../lib/types";
import { Badge, Card, PageHeader, Spinner } from "../../components/ui";

interface Stats {
  students: number;
  completeProfiles: number;
  counsellors: number;
  shortlists: number;
  appStudents: number;
  bookedStudents: number;
  communityJoined: number;
  referrals: number;
  posts: number;
  reviews: number;
  revenueInr: number;
  bookingsByStatus: Record<string, number>;
  recent: Profile[];
}

interface Stage {
  label: string;
  n: number;
  hint: string;
}

export default function AdminHome() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [students, complete, counsellors, shortlists, posts, reviews, bookings, recent, apps, community, referrals] =
        await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
          supabase.from("student_profiles").select("user_id", { count: "exact", head: true }).eq("is_complete", true),
          supabase.from("counsellors").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("shortlists").select("student_id"),
          supabase.from("community_posts").select("id", { count: "exact", head: true }),
          supabase.from("university_reviews").select("id", { count: "exact", head: true }),
          supabase.from("bookings").select("status, amount_inr, student_id"),
          supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(6),
          supabase.from("applications").select("student_id"),
          supabase
            .from("student_profiles")
            .select("user_id", { count: "exact", head: true })
            .not("community_joined_at", "is", null),
          supabase.from("referrals").select("id", { count: "exact", head: true }),
        ]);
      const bk = (bookings.data as Pick<Booking, "status" | "amount_inr" | "student_id">[]) ?? [];
      const byStatus: Record<string, number> = {};
      let revenue = 0;
      for (const b of bk) {
        byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
        if (["paid", "scheduled", "completed"].includes(b.status)) revenue += Number(b.amount_inr) || 0;
      }
      const distinct = (rows: { student_id?: string | null }[] | null) =>
        new Set((rows ?? []).map((r) => r.student_id).filter(Boolean)).size;
      setS({
        students: students.count ?? 0,
        completeProfiles: complete.count ?? 0,
        counsellors: counsellors.count ?? 0,
        shortlists: distinct(shortlists.data as { student_id: string | null }[] | null),
        appStudents: distinct(apps.data as { student_id: string | null }[] | null),
        bookedStudents: distinct(bk as { student_id: string }[]),
        communityJoined: community.count ?? 0,
        referrals: referrals.count ?? 0,
        posts: posts.count ?? 0,
        reviews: reviews.count ?? 0,
        revenueInr: revenue,
        bookingsByStatus: byStatus,
        recent: (recent.data as Profile[]) ?? [],
      });
    })();
  }, []);

  if (!s)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  const stages: Stage[] = [
    { label: "Signed up", n: s.students, hint: "all student accounts" },
    { label: "Profile completed", n: s.completeProfiles, hint: "onboarding finished" },
    { label: "AI shortlist generated", n: s.shortlists, hint: "students with a shortlist" },
    { label: "Application tracked", n: s.appStudents, hint: "students with an application" },
    { label: "Session booked", n: s.bookedStudents, hint: "students with any booking" },
    { label: "Community joined", n: s.communityJoined, hint: "posted or browsed the feed" },
  ];
  const base = s.students || 1;

  return (
    <div>
      <PageHeader title="Overview" subtitle="Platform activity at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students" value={String(s.students)} sub={`${s.completeProfiles} complete profiles`} />
        <Stat label="AI shortlists" value={String(s.shortlists)} sub="students with a shortlist" />
        <Stat label="Active counsellors" value={String(s.counsellors)} />
        <Stat
          label="Revenue (paid bookings)"
          value={`₹${s.revenueInr.toLocaleString("en-IN")}`}
          sub={Object.entries(s.bookingsByStatus).map(([k, v]) => `${k} ${v}`).join(" · ") || "no bookings"}
        />
        <Stat label="Applications tracked" value={String(s.appStudents)} sub="students with an application" />
        <Stat label="Community posts" value={String(s.posts)} />
        <Stat label="University reviews" value={String(s.reviews)} />
        <Stat label="Referrals" value={String(s.referrals)} sub="signups via invite link" />
      </div>

      <Card className="mt-6">
        <h2 className="font-bold text-slate-900">Conversion funnel</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Student journey from first signup to active use. Bar width is the share of all signups; the right column shows
          the step conversion from the previous stage.
        </p>
        <ol className="mt-4 space-y-4">
          {stages.map((st, i) => {
            const pct = Math.min(st.n / base, 1);
            const step = i > 0 && stages[i - 1].n > 0 ? Math.round((st.n / stages[i - 1].n) * 100) : null;
            return (
              <li key={st.label}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-700">
                    {st.label}
                    <span className="ml-2 font-normal text-slate-400">{st.hint}</span>
                  </span>
                  <span className="whitespace-nowrap text-slate-500">
                    <span className="font-bold text-slate-800">{st.n}</span>
                    {" · "}
                    {Math.round(pct * 100)}% of signups
                    {step !== null ? <span className="ml-1 text-slate-400">(step {step}%)</span> : null}
                  </span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                    style={{ width: `${st.n > 0 ? Math.max(pct * 100, 2) : 0}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        {s.students > 0 ? (
          <p className="mt-4 text-xs text-slate-400">
            {Math.round((s.completeProfiles / base) * 100)}% activation ·{" "}
            {Math.round((s.appStudents / base) * 100)}% reach applications ·{" "}
            {Math.round((s.bookedStudents / base) * 100)}% book a session.
          </p>
        ) : null}
      </Card>

      <Card className="mt-6">
        <h2 className="font-bold text-slate-900">Recent signups</h2>
        {s.recent.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No users yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {s.recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-semibold text-slate-800">{p.name ?? "—"}</span>
                  <span className="ml-2 text-xs text-slate-500">{p.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={p.role === "admin" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}>
                    {p.role}
                  </Badge>
                  <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString("en-AU")}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-6 text-xs text-slate-400">Revenue counts bookings marked paid, scheduled or completed.</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </Card>
  );
}

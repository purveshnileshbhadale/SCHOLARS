import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { daysLeft } from "../lib/deadlines";

interface BellItem {
  to: string;
  title: string;
  sub?: string;
}

type AppRow = {
  id: string;
  admission_deadline: string | null;
  status: string;
  program: string | null;
  universities: { name: string } | null;
};

type BookingRow = {
  id: string;
  status: string;
  scheduled_at: string | null;
  counsellors: { display_name: string | null } | null;
};

type RemRow = { target_id: string | null; title: string; due_at: string };
type SchRow = { id: string; name: string; deadline: string | null };
type DocExpiryRow = { id: string; label: string; expires_on: string | null };

/** Derived "what to do next" list — computed live from the student's data. */
export default function ActionBell() {
  const { session, profile } = useAuth();
  const [items, setItems] = useState<BellItem[]>([]);
  const [open, setOpen] = useState(false);
  const isStudent = profile?.role === "student";

  useEffect(() => {
    if (!session || !isStudent) return;
    let cancelled = false;
    (async () => {
      const uid = session.user.id;
      const [spR, slR, sopR, apR, bkR, vcR, svR, remR, docR] = await Promise.all([
        supabase.from("student_profiles").select("is_complete").eq("user_id", uid).maybeSingle(),
        supabase.from("shortlists").select("result").eq("student_id", uid).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("sop_responses").select("student_id").limit(1),
        supabase
          .from("applications")
          .select("id, admission_deadline, status, program, universities(name)")
          .order("admission_deadline", { ascending: true, nullsFirst: false })
          .limit(50),
        supabase
          .from("bookings")
          .select("id, status, scheduled_at, counsellors(display_name)")
          .in("status", ["pending", "scheduled"])
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("student_checklist_items").select("id").limit(1),
        supabase.from("saved_universities").select("university_id").limit(500),
        supabase
          .from("reminders")
          .select("id, target_id, title, due_at")
          .eq("user_id", uid)
          .eq("is_done", false)
          .gte("due_at", new Date(Date.now() - 86_400_000).toISOString())
          .lte("due_at", new Date(Date.now() + 7 * 86_400_000).toISOString())
          .order("due_at", { ascending: true })
          .limit(3),
        supabase
          .from("student_documents")
          .select("id, label, expires_on")
          .not("expires_on", "is", null)
          .lte("expires_on", new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10))
          .order("expires_on", { ascending: true })
          .limit(5),
      ]);
      if (cancelled) return;

      // Reminders set on the Deadline Hub come first — the student asked for them.
      const reminderItems: BellItem[] = ((remR.data ?? []) as unknown as RemRow[]).map((r) => ({
        to: "/deadlines",
        title: `Reminder — ${r.title}`,
        sub: new Date(r.due_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
      }));

      const deadlines: BellItem[] = [];
      const now = Date.now();
      for (const a of ((apR.data ?? []) as unknown as AppRow[]).slice(0, 10)) {
        if (["Rejected", "Withdrawn"].includes(a.status) || !a.admission_deadline) continue;
        const days = Math.ceil((new Date(a.admission_deadline).getTime() - now) / 86400000);
        if (days < 0 || days > 30) continue;
        const who = a.universities?.name ?? a.program ?? "Application";
        deadlines.push({
          to: "/applications",
          title: days === 0 ? `Deadline today — ${who}` : `Deadline in ${days}d — ${who}`,
          sub: new Date(a.admission_deadline).toLocaleDateString("en-AU"),
        });
        if (deadlines.length >= 3) break;
      }

      const bookings = (bkR.data ?? []) as unknown as BookingRow[];
      const pending = bookings.find((b) => b.status === "pending");
      const upcoming = bookings.find((b) => b.status === "scheduled" && b.scheduled_at && new Date(b.scheduled_at).getTime() > now);
      const hasShortlist = !!slR.data;
      const other: BellItem[] = [];
      if (pending) other.push({ to: "/bookings", title: "Complete payment for your session" });
      if (!hasShortlist) other.push({ to: "/dashboard", title: "Generate your free shortlist" });
      if (!(sopR.data ?? []).length) other.push({ to: "/sop", title: "Draft your SOP with AI" });
      if (!(vcR.data ?? []).length) other.push({ to: "/applications", title: "Build your visa checklist" });
      if (spR.data && !(spR.data as { is_complete: boolean }).is_complete)
        other.push({ to: "/onboarding", title: "Finish your profile" });
      if (upcoming)
        other.push({
          to: "/bookings",
          title: "Upcoming counsellor session",
          sub: `${upcoming.counsellors?.display_name ?? "Counsellor"} · ${new Date(upcoming.scheduled_at!).toLocaleString("en-AU", {
            dateStyle: "medium",
            timeStyle: "short",
          })}`,
        });

      // Scholarship deadlines at shortlisted/saved universities closing within 30 days.
      const slIds = (
        ((slR.data ?? null) as { result?: { items?: { university_id: string }[] } } | null)?.result?.items ?? []
      ).map((i) => i.university_id);
      const uniIds = [...new Set([...slIds, ...(svR.data ?? []).map((r) => r.university_id as string)])];
      const scholarshipItems: BellItem[] = [];
      if (uniIds.length) {
        const { data: sc } = await supabase
          .from("scholarships")
          .select("id, name, deadline")
          .in("university_id", uniIds)
          .not("deadline", "is", null)
          .limit(100);
        if (cancelled) return;
        for (const s of ((sc ?? []) as unknown as SchRow[])) {
          const d = daysLeft(s.deadline);
          if (d === null || d < 0 || d > 30) continue;
          scholarshipItems.push({
            to: "/scholarships",
            title: d === 0 ? `Scholarship closes today — ${s.name}` : `Scholarship closes in ${d}d — ${s.name}`,
            sub: s.deadline ? String(s.deadline) : undefined,
          });
          if (scholarshipItems.length >= 3) break;
        }
      }

      // Documents expiring (or already expired) — passport, English tests, etc.
      const expiryItems: BellItem[] = [];
      for (const d of ((docR.data ?? []) as unknown as DocExpiryRow[])) {
        if (!d.expires_on) continue;
        const days = daysLeft(d.expires_on);
        if (days === null || days > 30) continue;
        expiryItems.push({
          to: "/documents",
          title: days < 0 ? `${d.label} has expired` : `${d.label} expires in ${days}d`,
          sub: new Date(d.expires_on).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }),
        });
      }

      setItems([...reminderItems, ...deadlines, ...scholarshipItems, ...expiryItems, ...other].slice(0, 8));
    })();
    return () => {
      cancelled = true;
    };
  }, [session, isStudent]);

  if (!isStudent) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={`What to do next (${items.length})`}
        title="What to do next"
        className="relative rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:border-emerald-600 hover:text-emerald-800"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {items.length ? (
          <span className="absolute -right-2 -top-2 rounded-full bg-rose-600 px-1.5 py-px text-[10px] font-bold leading-4 text-white">
            {items.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            <p className="px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-400">What to do next</p>
            {items.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-500">You're all caught up.</p>
            ) : (
              items.map((it, i) => (
                <Link
                  key={i}
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-2 py-2 hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-800">{it.title}</p>
                  {it.sub ? <p className="text-xs text-slate-500">{it.sub}</p> : null}
                </Link>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

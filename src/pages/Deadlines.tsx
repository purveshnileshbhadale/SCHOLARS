import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  daysLeft,
  downloadDeadlineIcs,
  downloadMilestonesIcs,
  formatDate,
  intakeMilestones,
  localIso,
} from "../lib/deadlines";
import { cx } from "../lib/utils";
import { Button, Card, DeadlineChip, Empty, PageHeader, Select, Spinner } from "../components/ui";

type HubType = "application" | "scholarship" | "booking" | "intake";

interface HubItem {
  id: string;
  type: HubType;
  title: string;
  sub?: string;
  date: string; // YYYY-MM-DD
  href?: string;
  url?: string;
}

interface RemRow {
  id: string;
  target_id: string | null;
  title: string;
  due_at: string;
}

const TYPE_STYLE: Record<HubType, { icon: React.ReactNode; cls: string }> = {
  application: {
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M9 3h6l4 4v14H5V3zM14 3v5h5M8.5 13h7M8.5 17h5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    cls: "bg-violet-50 text-violet-700 ring-violet-200/60",
  },
  scholarship: {
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 16.5 7.1 18.2l.9-5.5-4-3.9L9.5 8z" strokeLinejoin="round" />
      </svg>
    ),
    cls: "bg-amber-50 text-amber-700 ring-amber-200/60",
  },
  booking: {
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M8 3v3M16 3v3M4 9h16M5 6h14v15H5zM9 14h2M13 14h2" strokeLinecap="round" />
      </svg>
    ),
    cls: "bg-sky-50 text-sky-700 ring-sky-200/60",
  },
  intake: {
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" strokeLinejoin="round" />
      </svg>
    ),
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  },
};

function intakeOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string; y: number; m: number }[] = [];
  const now = new Date();
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // Common Australian intakes: Feb, May, Jul, Sep
  for (let y = now.getFullYear(); y <= now.getFullYear() + 1; y++) {
    for (const m of [1, 4, 6, 8]) {
      if (y === now.getFullYear() && m <= now.getMonth() + 1) continue;
      out.push({ value: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${names[m]} ${y}`, y, m });
    }
  }
  return out.map(({ value, label }) => ({ value, label }));
}

/** "2027-02" → [monthIndex, year] for intakeMilestones(). */
function intakeParts(v: string): [number, number] {
  const [y, m] = v.split("-").map(Number);
  return [m - 1, y];
}

export default function Deadlines() {
  const { session } = useAuth();
  const [apps, setApps] = useState<
    { id: string; program: string | null; admission_deadline: string | null; scholarship_deadline: string | null; offer_accept_by: string | null; status: string; universities: { name: string | null } | null }[]
  >([]);
  const [bookings, setBookings] = useState<{ id: string; status: string; scheduled_at: string | null; counsellors: { display_name: string | null } | null }[]>([]);
  const [schs, setSchs] = useState<{ id: string; name: string; deadline: string | null; url: string | null; universities: { name: string | null } | null }[]>([]);
  const [reminders, setReminders] = useState<RemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassed, setShowPassed] = useState(false);
  const [intake, setIntake] = useState<string>("");
  const [perm, setPerm] = useState<string>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const uid = session.user.id;
      const [{ data: ap }, { data: bk }, { data: sl }, { data: sv }, { data: rm }] = await Promise.all([
        supabase
          .from("applications")
          .select("id, program, admission_deadline, scholarship_deadline, offer_accept_by, status, universities(name)")
          .order("admission_deadline", { ascending: true, nullsFirst: false }),
        supabase
          .from("bookings")
          .select("id, status, scheduled_at, counsellors(display_name)")
          .in("status", ["pending", "scheduled"]),
        supabase.from("shortlists").select("result").eq("student_id", uid).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("saved_universities").select("university_id"),
        supabase.from("reminders").select("id, target_id, title, due_at").eq("user_id", uid).eq("is_done", false),
      ]);
      if (cancelled) return;
      const shortlistIds = new Set<string>(
        (((sl ?? {}) as { result?: { items?: { university_id: string }[] } })?.result?.items ?? []).map((i) => i.university_id),
      );
      const savedIds = new Set((sv ?? []).map((r) => r.university_id as string));
      const uniIds = [...new Set([...shortlistIds, ...savedIds])];
      let scholarshipRows: typeof schs = [];
      if (uniIds.length) {
        const { data: sc } = await supabase
          .from("scholarships")
          .select("id, name, deadline, url, universities(name)")
          .in("university_id", uniIds)
          .not("deadline", "is", null);
        scholarshipRows = (sc as unknown as typeof schs) ?? [];
      }
      if (cancelled) return;
      setApps((ap as unknown as typeof apps) ?? []);
      setBookings((bk as unknown as typeof bookings) ?? []);
      setSchs(scholarshipRows);
      setReminders((rm as RemRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Persisted intake selection powers the backwards-planner milestones.
  useEffect(() => {
    setIntake(localStorage.getItem("sa_intake") ?? "");
  }, []);

  const items = useMemo<HubItem[]>(() => {
    const out: HubItem[] = [];
    for (const a of apps) {
      if (["Rejected", "Withdrawn"].includes(a.status)) continue;
      const who = a.universities?.name ?? a.program ?? "Application";
      if (a.admission_deadline)
        out.push({
          id: `application:${a.id}:adm`,
          type: "application",
          title: `Application deadline — ${who}`,
          sub: a.program ?? undefined,
          date: a.admission_deadline.slice(0, 10),
          href: "/applications",
        });
      if (a.scholarship_deadline)
        out.push({
          id: `application:${a.id}:sch`,
          type: "application",
          title: `Scholarship deadline — ${who}`,
          sub: a.program ?? undefined,
          date: a.scholarship_deadline.slice(0, 10),
          href: "/applications",
        });
      if (a.offer_accept_by)
        out.push({
          id: `application:${a.id}:offer`,
          type: "application",
          title: `Offer accept-by — ${who}`,
          sub: a.program ?? undefined,
          date: a.offer_accept_by.slice(0, 10),
          href: "/applications",
        });
    }
    for (const b of bookings) {
      if (!b.scheduled_at) continue;
      const d = new Date(b.scheduled_at);
      out.push({
        id: `booking:${b.id}`,
        type: "booking",
        title: b.status === "pending" ? "Payment due for counselling session" : "Counselling session",
        sub: b.counsellors?.display_name ?? undefined,
        date: localIso(d),
        href: "/bookings",
      });
    }
    for (const s of schs) {
      if (!s.deadline) continue;
      out.push({
        id: `scholarship:${s.id}`,
        type: "scholarship",
        title: s.name,
        sub: s.universities?.name ?? undefined,
        date: s.deadline.slice(0, 10),
        href: "/scholarships",
        url: s.url ?? undefined,
      });
    }
    if (intake) {
      const [y, m] = intake.split("-").map(Number);
      for (const ms of intakeMilestones(m - 1, y)) {
        out.push({
          id: `intake:${intake}:${ms.key}`,
          type: "intake",
          title: ms.label,
          sub: ms.note,
          date: localIso(ms.date),
          href: "/deadlines",
        });
      }
    }
    return out;
  }, [apps, bookings, schs, intake]);

  const todayStr = localIso(new Date());
  const upcoming = useMemo(
    () => items.filter((i) => i.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)),
    [items, todayStr],
  );
  const passed = useMemo(
    () => items.filter((i) => i.date < todayStr).sort((a, b) => b.date.localeCompare(a.date)),
    [items, todayStr],
  );

  const remindedIds = useMemo(() => new Set(reminders.map((r) => r.target_id).filter(Boolean)), [reminders]);

  // Browser notifications (feature 4) — only if the user granted permission,
  // at most once per day, for items due within 7 days.
  useEffect(() => {
    if (perm !== "granted" || upcoming.length === 0) return;
    const today = localIso(new Date());
    if (localStorage.getItem("sa_notif_day") === today) return;
    const soon = upcoming.filter((i) => {
      const d = daysLeft(i.date);
      return d !== null && d >= 0 && d <= 7;
    }).slice(0, 3);
    if (!soon.length) return;
    localStorage.setItem("sa_notif_day", today);
    for (const i of soon) {
      const d = daysLeft(i.date);
      try {
        new Notification("Scholars Abroad deadline", {
          body: `${d === 0 ? "Today" : `${d} day${d === 1 ? "" : "s"} left`} — ${i.title}`,
          icon: "/logo.png",
        });
      } catch {
        /* notification blocked */
      }
    }
  }, [perm, upcoming]);

  async function toggleRemind(it: HubItem) {
    if (!session) return;
    const existing = reminders.find((r) => r.target_id === it.id);
    if (existing) {
      setReminders((rs) => rs.filter((r) => r.id !== existing.id));
      await supabase.from("reminders").delete().eq("id", existing.id);
      return;
    }
    const dueAt = new Date(`${it.date}T23:59:59`).toISOString();
    const { data, error } = await supabase
      .from("reminders")
      .insert({
        user_id: session.user.id,
        target_type: it.type,
        target_id: it.id,
        title: it.title,
        due_at: dueAt,
      })
      .select("id, target_id, title, due_at")
      .single();
    if (!error && data) setReminders((rs) => [...rs, data as RemRow]);
  }

  async function askPermission() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPerm(p);
  }

  function exportPlan() {
    if (!intake) return;
    const ms = intakeMilestones(...intakeParts(intake));
    downloadMilestonesIcs(
      `intake-plan-${intake}.ics`,
      ms.map((m) => ({ uid: `intake-${intake}-${m.key}`, title: `${m.label} (intake ${intake})`, description: m.note, date: m.date })),
    );
  }

  function row(it: HubItem) {
    const st = TYPE_STYLE[it.type];
    const on = remindedIds.has(it.id);
    return (
      <div key={it.id} className="flex gap-3 rounded-2xl border border-slate-200/70 bg-white/85 p-3.5 glow-soft backdrop-blur-sm transition hover:border-emerald-300/70">
        <div className={cx("flex size-9 shrink-0 items-center justify-center rounded-xl ring-1", st.cls)}>{st.icon}</div>
        <div className="min-w-0 grow">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-900">{it.title}</p>
            <DeadlineChip date={it.date} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatDate(it.date)}
            {it.sub ? ` · ${it.sub}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              variant={on ? "primary" : "ghost"}
              className="min-h-8 px-2.5 py-1 text-xs"
              onClick={() => toggleRemind(it)}
              title={on ? "Remove reminder" : "Get an in-app reminder"}
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {on ? "Reminder on" : "Remind me"}
            </Button>
            <Button
              variant="ghost"
              className="min-h-8 px-2.5 py-1 text-xs"
              onClick={() =>
                downloadDeadlineIcs({
                  uid: it.id.replace(/[^a-zA-Z0-9:-]/g, "_"),
                  title: it.title,
                  description: [it.sub, "Scholars Abroad deadline"].filter(Boolean).join(" — "),
                  dateStr: it.date,
                  alarmDays: 2,
                })
              }
            >
              Add to calendar
            </Button>
            {it.href ? (
              <Link to={it.href} className="inline-flex min-h-8 items-center rounded-xl border border-slate-300/70 bg-white/80 px-2.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700">
                Open
              </Link>
            ) : null}
            {it.url ? (
              <a href={it.url} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center rounded-xl border border-slate-300/70 bg-white/80 px-2.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700">
                Official page →
              </a>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  return (
    <div className="pb-16">
      <PageHeader
        title="Deadlines & reminders"
        subtitle="Every admission, scholarship, session and intake milestone in one timeline — with reminders, countdowns and calendar export."
        right={
          perm === "granted" ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              🔔 Browser reminders on
            </span>
          ) : perm === "default" && "Notification" in window ? (
            <Button variant="ghost" onClick={askPermission}>
              Enable browser reminders
            </Button>
          ) : null
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Upcoming · {upcoming.length}
            </h2>
            {passed.length ? (
              <button className="text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={() => setShowPassed(!showPassed)}>
                {showPassed ? "Hide" : "Show"} passed ({passed.length})
              </button>
            ) : null}
          </div>

          {upcoming.length === 0 && passed.length === 0 ? (
            <Empty
              title="No deadlines yet"
              body="Add applications on the Applications page, save universities, or pick your intake below — everything shows up here."
              action={
                <Link to="/applications">
                  <Button>Track an application</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {upcoming.map(row)}
              {showPassed ? passed.map(row) : null}
            </div>
          )}
        </div>

        {/* intake planner */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <Card>
            <h3 className="font-bold text-slate-900">Intake planner</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Pick your intake and work backwards: applications, offers, CoE, visa and funds — each with its own
              countdown, reminder and calendar export.
            </p>
            <div className="mt-3 space-y-2">
              <Select value={intake} onChange={(e) => { setIntake(e.target.value); localStorage.setItem("sa_intake", e.target.value); }} aria-label="Target intake">
                <option value="">Select your intake…</option>
                {intakeOptions().map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {intake ? (
                <>
                  <div className="max-h-72 space-y-2 overflow-auto pr-1">
                    {intakeMilestones(...intakeParts(intake)).map((m) => {
                        const dateStr = localIso(m.date);
                        return (
                          <div key={m.key} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-slate-800">{m.label}</p>
                              <DeadlineChip date={dateStr} />
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(dateStr)} · {m.note}</p>
                          </div>
                        );
                      })}
                  </div>
                  <Button variant="ghost" className="w-full" onClick={exportPlan}>
                    Export plan as .ics
                  </Button>
                </>
              ) : null}
            </div>
          </Card>

          <Card className="border-sky-200/70 bg-gradient-to-br from-sky-50/70 via-white to-white">
            <h3 className="font-bold text-slate-900">Never miss a date</h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600">
              <li>• <strong>Remind me</strong> — in-app bell reminders, surfaced in the header.</li>
              <li>• <strong>Add to calendar</strong> — Google/Outlook .ics with a 2-day alarm.</li>
              {perm === "granted" ? <li>• <strong>Browser notifications</strong> — daily nudges for items due within 7 days.</li> : null}
            </ul>
            {perm === "default" && "Notification" in window ? (
              <Button className="mt-3 w-full" onClick={askPermission}>
                Turn on browser notifications
              </Button>
            ) : null}
            {perm === "denied" ? (
              <p className="mt-2 text-[11px] text-slate-400">
                Notifications are blocked — allow them in your browser's site settings to get pop-ups.
              </p>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

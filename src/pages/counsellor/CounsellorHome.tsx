import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { Booking } from "../../lib/types";
import { Badge, Card, Empty, PageHeader, Spinner } from "../../components/ui";

const ACTIVE = ["paid", "scheduled", "completed"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const UPCOMING_SHOWN = 5;

type BookingRow = Booking & {
  profiles?: { id: string; name: string | null; email: string | null; phone: string | null } | null;
};

export default function CounsellorHome() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: me } = await supabase
        .from("counsellors")
        .select("id")
        .eq("user_id", profile!.id)
        .maybeSingle();
      if (!me) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("bookings")
        .select("*, profiles(id, name, email, phone)")
        .eq("counsellor_id", me.id)
        .order("created_at", { ascending: false });
      setRows((data as unknown as BookingRow[]) ?? []);
      setLoading(false);
    })();
  }, [profile]);

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  const active = rows.filter((b) => ACTIVE.includes(b.status));
  const studentCount = new Set(active.map((b) => b.student_id)).size;
  const completed = rows.filter((b) => b.status === "completed").length;
  const revenueInr = active.reduce((sum, b) => sum + (Number(b.amount_inr) || 0), 0);
  const requests = rows.filter((b) => b.student_request && ["paid", "scheduled"].includes(b.status));
  const now = Date.now();
  const upcoming = rows
    .filter((b) => b.status === "scheduled" && b.scheduled_at && new Date(b.scheduled_at).getTime() >= now)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  const soonCount = upcoming.filter((b) => new Date(b.scheduled_at!).getTime() - now <= WEEK_MS).length;

  return (
    <div>
      <PageHeader title="My students" subtitle="Students with a paid booking assigned to you." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active students" value={String(studentCount)} sub={`${active.length} active bookings`} />
        <Stat
          label="Upcoming sessions"
          value={String(upcoming.length)}
          sub={soonCount > 0 ? `${soonCount} in the next 7 days` : "nothing booked this week"}
        />
        <Stat label="Completed sessions" value={String(completed)} />
        <Stat
          label="Value handled"
          value={`₹${revenueInr.toLocaleString("en-IN")}`}
          sub="paid + scheduled + completed"
        />
      </div>

      {requests.length > 0 ? (
        <Card className="mt-6 border-amber-400">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Needs your attention</h2>
              <p className="text-xs text-slate-500">
                {requests.length} reschedule/cancel request{requests.length === 1 ? "" : "s"} waiting for a response.
              </p>
            </div>
            <Link
              to="/counsellor/bookings"
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Review requests
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {requests.slice(0, 3).map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <span className="font-semibold text-slate-800">{b.profiles?.name ?? "Student"}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    wants to {b.student_request === "cancel" ? "cancel" : "reschedule"}
                    {b.student_request_note ? ` — “${b.student_request_note}”` : ""}
                  </span>
                </div>
                <Badge className="border-amber-300 bg-amber-50 text-amber-800">
                  {b.student_requested_at ? new Date(b.student_requested_at).toLocaleDateString("en-AU") : "pending"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {upcoming.length > 0 ? (
        <Card className="mt-6">
          <h2 className="font-bold text-slate-900">Upcoming sessions</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {upcoming.slice(0, UPCOMING_SHOWN).map((b) => {
              const start = new Date(b.scheduled_at!);
              const isSoon = start.getTime() - now <= WEEK_MS;
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <Link
                      to={`/counsellor/student/${b.student_id}`}
                      className="font-semibold text-slate-800 hover:text-emerald-800"
                    >
                      {b.profiles?.name ?? "Student"}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {start.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <Badge className={isSoon ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}>
                    {isSoon ? "this week" : "scheduled"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <h2 className="mt-8 font-bold text-slate-900">Students</h2>
      {active.length === 0 ? (
        <Empty title="No students yet" body="When a student books a session with you, they'll appear here." />
      ) : (
        <div className="mt-3 space-y-3">
          {active.map((b) => (
            <Link key={b.id} to={`/counsellor/student/${b.student_id}`} className="block">
              <Card className="flex items-center gap-3 transition hover:border-emerald-400">
                <div className="grow">
                  <h3 className="font-bold text-slate-900">{b.profiles?.name ?? "Student"}</h3>
                  <p className="text-xs text-slate-500">
                    {b.profiles?.email}
                    {b.profiles?.phone ? ` · ${b.profiles.phone}` : ""}
                  </p>
                </div>
                <Badge
                  className={
                    b.status === "completed"
                      ? "border-slate-200 bg-slate-100 text-slate-700"
                      : b.status === "scheduled"
                        ? "border-sky-200 bg-sky-50 text-sky-800"
                        : "border-emerald-200 bg-emerald-50 text-emerald-800"
                  }
                >
                  {b.status}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
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

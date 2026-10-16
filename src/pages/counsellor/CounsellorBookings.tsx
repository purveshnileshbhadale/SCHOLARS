import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { Booking } from "../../lib/types";
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner } from "../../components/ui";

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
  scheduled: "border-sky-200 bg-sky-50 text-sky-800",
  completed: "border-slate-200 bg-slate-100 text-slate-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

type BookingRow = Booking & { profiles?: { id: string; name: string | null; email: string | null; phone: string | null } | null };

export default function CounsellorBookings() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [times, setTimes] = useState<Record<string, string>>({});

  async function load() {
    if (!profile) return;
    const { data: me } = await supabase.from("counsellors").select("id").eq("user_id", profile.id).maybeSingle();
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
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function schedule(b: BookingRow) {
    const t = times[b.id];
    if (!t) return;
    setBusy(b.id);
    setErr(null);
    const { error } = await supabase
      .from("bookings")
      .update({ scheduled_at: new Date(t).toISOString(), status: "scheduled" })
      .eq("id", b.id);
    if (error) setErr(error.message);
    await load();
    setBusy(null);
  }

  async function markCompleted(b: BookingRow) {
    setBusy(b.id);
    setErr(null);
    const { error } = await supabase.from("bookings").update({ status: "completed" }).eq("id", b.id);
    if (error) setErr(error.message);
    await load();
    setBusy(null);
  }

  // Accept (cancel → cancel the booking; reschedule → apply the picked time) or
  // decline a student's request; both clear the request fields either way.
  async function respond(b: BookingRow, accept: boolean) {
    setBusy(b.id);
    setErr(null);
    const clear = { student_request: null, student_request_note: null, student_requested_at: null };
    let patch: Record<string, unknown> = clear;
    if (accept && b.student_request === "cancel") {
      patch = { ...clear, status: "cancelled" };
    } else if (accept && b.student_request === "reschedule") {
      const t = times[b.id];
      if (!t) {
        setErr("Pick the new session time first.");
        setBusy(null);
        return;
      }
      patch = { ...clear, scheduled_at: new Date(t).toISOString(), status: "scheduled" };
    }
    const { error } = await supabase.from("bookings").update(patch).eq("id", b.id);
    if (error) setErr(error.message);
    await load();
    setBusy(null);
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="My bookings"
        subtitle="Schedule sessions for paid bookings and mark them completed."
      />
      <ErrorNote>{err}</ErrorNote>
      {rows.length === 0 ? (
        <Empty title="No bookings yet" body="When a student books a paid session with you, it appears here." />
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <Card key={b.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/counsellor/student/${b.student_id}`} className="font-bold text-slate-900 hover:text-emerald-800">
                      {b.profiles?.name ?? "Student"}
                    </Link>
                    <Badge className={STATUS_STYLE[b.status] ?? ""}>{b.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {b.profiles?.email}
                    {b.profiles?.phone ? ` · ${b.profiles.phone}` : ""} · ₹{Number(b.amount_inr).toLocaleString("en-IN")} · booked{" "}
                    {new Date(b.created_at).toLocaleDateString("en-AU")}
                  </p>
                  {b.scheduled_at ? (
                    <p className="mt-0.5 text-xs font-semibold text-sky-700">
                      Scheduled: {new Date(b.scheduled_at).toLocaleString("en-AU")}
                    </p>
                  ) : null}
                </div>
              </div>

              {b.student_request ? (
                <div className="rounded-xl border border-amber-400 bg-amber-500/10 p-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {b.profiles?.name ?? "Student"} asked to {b.student_request === "cancel" ? "cancel" : "reschedule"}
                    {b.student_requested_at
                      ? ` · requested ${new Date(b.student_requested_at).toLocaleString("en-AU")}`
                      : ""}
                  </p>
                  {b.student_request_note ? (
                    <p className="mt-0.5 text-xs text-slate-500">“{b.student_request_note}”</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    {b.student_request === "reschedule" ? (
                      <label className="text-xs font-semibold text-slate-600">
                        New time
                        <input
                          type="datetime-local"
                          className="ml-2 rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
                          value={times[b.id] ?? ""}
                          onChange={(e) => setTimes({ ...times, [b.id]: e.target.value })}
                        />
                      </label>
                    ) : null}
                    <Button
                      className="px-3"
                      disabled={busy === b.id || (b.student_request === "reschedule" && !times[b.id])}
                      onClick={() => respond(b, true)}
                    >
                      {busy === b.id
                        ? "Saving…"
                        : b.student_request === "cancel"
                          ? "Approve cancellation"
                          : "Approve reschedule"}
                    </Button>
                    <Button variant="ghost" className="px-3" disabled={busy === b.id} onClick={() => respond(b, false)}>
                      Decline
                    </Button>
                  </div>
                </div>
              ) : null}

              {b.status === "pending" ? (
                <p className="text-xs text-slate-400">Waiting for payment — scheduling unlocks after payment.</p>
              ) : null}

              {b.status === "paid" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Session time
                    <input
                      type="datetime-local"
                      className="ml-2 rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
                      value={times[b.id] ?? ""}
                      onChange={(e) => setTimes({ ...times, [b.id]: e.target.value })}
                    />
                  </label>
                  <Button className="px-3" disabled={!times[b.id] || busy === b.id} onClick={() => schedule(b)}>
                    {busy === b.id ? "Saving…" : "Schedule session"}
                  </Button>
                </div>
              ) : null}

              {b.status === "scheduled" ? (
                <Button variant="ghost" className="px-3" disabled={busy === b.id} onClick={() => markCompleted(b)}>
                  {busy === b.id ? "Saving…" : "Mark completed"}
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

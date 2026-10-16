import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Booking, BookingStatus } from "../../lib/types";
import { Badge, Card, ErrorNote, PageHeader, Select, Spinner } from "../../components/ui";

const STATUSES: BookingStatus[] = ["pending", "paid", "scheduled", "completed", "cancelled"];

const STYLE: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
  scheduled: "border-sky-200 bg-sky-50 text-sky-800",
  completed: "border-slate-200 bg-slate-100 text-slate-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function AdminBookings() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [times, setTimes] = useState<Record<string, string>>({});

  async function load() {
    const { data } = await supabase
      .from("bookings")
      .select("*, profiles(id, name, email), counsellors(id, profiles(name))")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as unknown as Booking[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: BookingStatus) {
    setErr(null);
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) setErr(error.message);
    load();
  }

  async function saveTime(b: Booking) {
    const t = times[b.id];
    if (!t) return;
    setErr(null);
    const { error } = await supabase.from("bookings").update({ scheduled_at: new Date(t).toISOString() }).eq("id", b.id);
    if (error) setErr(error.message);
    load();
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  return (
    <div>
      <PageHeader title="Bookings" subtitle="All counselling bookings. Mark offline payments as paid manually." />
      <ErrorNote>{err}</ErrorNote>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Counsellor</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Session time</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-slate-900">{b.profiles?.name ?? "—"}</p>
                  <p className="text-xs text-slate-500">{b.profiles?.email}</p>
                </td>
                <td className="px-4 py-2.5">
                  {(b.counsellors as unknown as { profiles?: { name?: string } })?.profiles?.name ?? "—"}
                </td>
                <td className="px-4 py-2.5">₹{Number(b.amount_inr).toLocaleString("en-IN")}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {b.payment_id ?? "—"}
                  {b.razorpay_order_id ? (
                    <span className="block max-w-40 truncate">order {b.razorpay_order_id}</span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{new Date(b.created_at).toLocaleDateString("en-AU")}</td>
                <td className="px-4 py-2.5">
                  <input
                    type="datetime-local"
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    value={
                      times[b.id] ??
                      (b.scheduled_at
                        ? new Date(new Date(b.scheduled_at).getTime() - new Date(b.scheduled_at).getTimezoneOffset() * 60000)
                            .toISOString()
                            .slice(0, 16)
                        : "")
                    }
                    onChange={(e) => setTimes({ ...times, [b.id]: e.target.value })}
                    onBlur={() => saveTime(b)}
                    disabled={["cancelled", "completed"].includes(b.status)}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Badge className={STYLE[b.status] ?? ""}>{b.status}</Badge>
                    <Select className="w-32 py-1" value={b.status} onChange={(e) => setStatus(b.id, e.target.value as BookingStatus)}>
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Select>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No bookings yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

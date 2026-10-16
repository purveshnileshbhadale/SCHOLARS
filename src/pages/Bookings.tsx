import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { downloadEventIcs } from "../lib/deadlines";
import type { Booking } from "../lib/types";
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner } from "../components/ui";

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-800",
  scheduled: "border-sky-200 bg-sky-50 text-sky-800",
  completed: "border-slate-200 bg-slate-100 text-slate-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

/** Opens a printable receipt for a paid/settled booking (browser print → PDF). */
function printReceipt(b: Booking, counsellorName: string, studentEmail: string) {
  const w = window.open("", "_blank", "width=680,height=820");
  if (!w) return; // popup blocked
  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const amount = Number(b.amount_inr).toLocaleString("en-IN");
  const issued = b.created_at ? new Date(b.created_at).toLocaleDateString("en-AU") : new Date().toLocaleDateString("en-AU");
  w.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt — ${esc(b.id.slice(0, 8))}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;margin:0;padding:40px;background:#fff}
  .card{max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;padding:32px}
  h1{font-size:20px;margin:0} .muted{color:#64748b;font-size:13px}
  .row{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px dashed #e2e8f0;font-size:14px}
  .row:last-child{border-bottom:none}
  .total{font-size:18px;font-weight:800;color:#047857}
  .pill{display:inline-block;border:1px solid #a7f3d0;background:#ecfdf5;color:#047857;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700}
  .foot{margin-top:24px;font-size:11px;color:#94a3b8;line-height:1.6}
  @media print{body{padding:12px}}
</style></head>
<body><div class="card">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
    <div><h1>Scholars Abroad</h1><p class="muted" style="margin:4px 0 0">Payment receipt</p></div>
    <span class="pill">${esc(b.status)}</span>
  </div>
  <div style="margin-top:20px">
    <div class="row"><span>Receipt no.</span><strong>${esc(b.id)}</strong></div>
    <div class="row"><span>Issued</span><span>${esc(issued)}</span></div>
    <div class="row"><span>Billed to</span><span>${esc(studentEmail)}</span></div>
    <div class="row"><span>Service</span><span>Counselling session — ${esc(counsellorName)}</span></div>
    <div class="row"><span>Session</span><span>${b.scheduled_at ? esc(new Date(b.scheduled_at).toLocaleString("en-AU")) : "To be scheduled"}</span></div>
    <div class="row"><span>Payment reference</span><span>${b.payment_id ? esc(b.payment_id) : "—"}</span></div>
    <div class="row"><span>Amount</span><span class="total">₹${amount}</span></div>
  </div>
  <p class="foot">Computer-generated receipt for a Scholars Abroad booking. Amounts in INR. Retain for your records.
  Refunds and cancellations are governed by Scholars Abroad's terms; contact support with the receipt no. above.</p>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
</body></html>`);
  w.document.close();
}

/** Downloads the booking as a .ics calendar event with a 24h pre-session alarm. */
function downloadIcs(b: Booking, counsellorName: string) {
  if (!b.scheduled_at) return;
  downloadEventIcs({
    uid: b.id,
    title: `Scholars Abroad counselling session (${counsellorName})`,
    description: `Paid counselling session. Amount INR ${b.amount_inr}. Booking ID ${b.id}.`,
    start: new Date(b.scheduled_at),
    alarmHours: 24,
  });
}

export default function Bookings() {
  const { session } = useAuth();
  const [list, setList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!session) return;
    const { data } = await supabase
      .from("bookings")
      .select("*, counsellors(id, specialisation, price_inr, display_name)")
      .eq("student_id", session.user.id)
      .order("created_at", { ascending: false });
    setList((data as unknown as Booking[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000); // picks up webhook-confirmed payments
    return () => clearInterval(t);
  }, [session]);

  async function cancel(id: string) {
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    load();
  }

  // Feature: student-side change request, flagged for the counsellor to resolve.
  // Goes through the file_booking_request RPC: the raw update is blocked by RLS
  // on paid/scheduled rows, and it can only touch the request columns.
  async function requestChange(b: Booking, kind: "cancel" | "reschedule") {
    const note = prompt(
      kind === "cancel" ? "Reason for cancelling (shared with your counsellor)" : "What dates suit you? (shared with your counsellor)",
      "",
    );
    if (note == null) return;
    setErr(null);
    const { error } = await supabase.rpc("file_booking_request", {
      p_booking: b.id,
      p_kind: kind,
      p_note: note.trim() || null,
    });
    if (error) setErr(error.message);
    load();
  }

  async function withdrawRequest(b: Booking) {
    setErr(null);
    const { error } = await supabase.rpc("file_booking_request", {
      p_booking: b.id,
      p_kind: null,
      p_note: null,
    });
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
      <PageHeader title="My bookings" subtitle="Counselling sessions you've booked." />
      <ErrorNote>{err}</ErrorNote>
      {list.length === 0 ? (
        <Empty
          title="No bookings yet"
          body="Once you've reviewed your shortlist, book a counsellor for applications, SOP and visa support."
          action={
            <Link to="/counsellors">
              <Button>Browse counsellors</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center gap-3">
              <div className="grow">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900">
                    {(b.counsellors as unknown as { display_name?: string | null })?.display_name || "Scholars Abroad counsellor"}
                  </h3>
                  <Badge className={STATUS_STYLE[b.status] ?? ""}>{b.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  ₹{Number(b.amount_inr).toLocaleString("en-IN")}
                  {b.scheduled_at ? ` · ${new Date(b.scheduled_at).toLocaleString("en-AU")}` : ""}
                  {b.payment_id ? ` · payment ${b.payment_id}` : ""}
                </p>
                {b.student_request ? (
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                      {b.student_request === "cancel" ? "Cancellation" : "Reschedule"} requested
                      {b.student_requested_at ? ` · ${new Date(b.student_requested_at).toLocaleDateString("en-AU")}` : ""}
                    </Badge>
                    <span className="text-slate-500">awaiting counsellor{b.student_request_note ? ` — "${b.student_request_note}"` : ""}</span>
                    <button className="font-semibold text-slate-400 hover:text-slate-600" onClick={() => withdrawRequest(b)}>
                      withdraw
                    </button>
                  </p>
                ) : null}
              </div>
              {b.scheduled_at && b.status !== "cancelled" ? (
                <Button variant="ghost" onClick={() => downloadIcs(b, (b.counsellors as unknown as { display_name?: string | null })?.display_name || "counsellor")}>
                  Add to calendar
                </Button>
              ) : null}
              {["paid", "scheduled", "completed"].includes(b.status) ? (
                <Button
                  variant="ghost"
                  onClick={() =>
                    printReceipt(
                      b,
                      (b.counsellors as unknown as { display_name?: string | null })?.display_name || "counsellor",
                      session?.user.email ?? "",
                    )
                  }
                >
                  Receipt
                </Button>
              ) : null}
              {["pending", "paid", "scheduled"].includes(b.status) && !b.student_request ? (
                <>
                  <Button variant="ghost" onClick={() => requestChange(b, "reschedule")}>
                    Request reschedule
                  </Button>
                  <Button variant="ghost" onClick={() => requestChange(b, "cancel")}>
                    Request cancel
                  </Button>
                </>
              ) : null}
              {b.status === "pending" ? (
                <Button variant="ghost" onClick={() => cancel(b.id)}>
                  Cancel
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

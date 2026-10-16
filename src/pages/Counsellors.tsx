import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Counsellor } from "../lib/types";
import { openCheckout } from "../lib/razorpay";
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner } from "../components/ui";
import { COUNSELLOR_WHATSAPP_INTRO, counsellorPhoneDisplay, waMeUrl } from "../lib/config";

export default function Counsellors() {
  const { session, studentProfile } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState<Counsellor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("counsellors")
      .select("*")
      .eq("is_active", true)
      .order("price_inr", { ascending: true })
      .then(({ data }) => {
        setList((data as unknown as Counsellor[]) ?? []);
        setLoading(false);
      });
  }, []);

  async function book(c: Counsellor) {
    if (!session) return nav("/login");
    if (!studentProfile?.is_complete) {
      setErr("Complete your profile before booking a counsellor.");
      return;
    }
    setErr(null);
    setNote(null);
    setBusyId(c.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-order", {
        method: "POST",
        body: { counsellor_id: c.id },
      });
      if (error) {
        const body = error.context ? await error.context.json().catch(() => null) : null;
        throw new Error(body?.error ?? "Could not start payment.");
      }

      // Razorpay handler runs inside the checkout modal; use a ref object so
      // we can read the signature after the await (closures aren't narrowed).
      const paid: { resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string } | null } = {
        resp: null,
      };

      await openCheckout({
        orderId: data.order_id,
        amountInr: data.amount_inr,
        name: c.display_name || "Counsellor",
        prefill: {
          name: session.user.user_metadata?.name ?? undefined,
          email: session.user.email ?? undefined,
        },
        onSuccess: (resp) => {
          paid.resp = resp;
        },
        onDismiss: () => {},
      });

      // Poll briefly for checkout handler completion (Razorpay modal may close after handler runs).
      for (let i = 0; i < 20 && !paid.resp; i++) await new Promise((r) => setTimeout(r, 250));

      if (!paid.resp) {
        setNote("Payment window closed. If you completed payment, your booking will update automatically — check Bookings.");
        return;
      }

      const verify = await supabase.functions.invoke("verify-payment", {
        method: "POST",
        body: {
          booking_id: data.booking_id,
          razorpay_order_id: paid.resp.razorpay_order_id,
          razorpay_payment_id: paid.resp.razorpay_payment_id,
          razorpay_signature: paid.resp.razorpay_signature,
        },
      });
      if (verify.error) throw new Error("Payment made but verification failed — it will be confirmed by webhook shortly.");
      setNote("Payment successful — your booking is confirmed.");
      setTimeout(() => nav("/bookings"), 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusyId(null);
    }
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
        title="Talk to a counsellor"
        subtitle="Quick questions are free on WhatsApp. Booked counselling — applications, SOP/LOR, visa — is a paid, one-to-one service."
      />
      <ErrorNote>{err}</ErrorNote>
      {note ? <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{note}</div> : null}

      <Card className="mb-6 border-emerald-200 bg-emerald-50/60">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
            <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.02 4.54-3.68 8.24-8.22 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z" />
            </svg>
          </div>
          <div className="grow">
            <h3 className="font-bold text-slate-900">Free — message our counsellor directly</h3>
            <p className="text-sm text-slate-600">
              Questions about courses, fees, deadlines or visas? Chat on WhatsApp at{" "}
              <span className="font-bold text-slate-900">{counsellorPhoneDisplay()}</span> — no booking needed.
            </p>
          </div>
          <Button
            variant="wa"
            onClick={() => window.open(waMeUrl(COUNSELLOR_WHATSAPP_INTRO), "_blank", "noopener")}
          >
            Chat on WhatsApp
          </Button>
        </div>
      </Card>

      <h2 className="mb-3 text-lg font-bold text-slate-900">Book a paid session</h2>
      {list.length === 0 ? (
        <Empty
          title="No bookable counsellors right now"
          body="WhatsApp is always open — or check back soon, new counsellors are added regularly."
          action={
            <Button
              variant="wa"
              onClick={() => window.open(waMeUrl(COUNSELLOR_WHATSAPP_INTRO), "_blank", "noopener")}
            >
              Chat on WhatsApp
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{c.display_name || "Scholars Abroad counsellor"}</h3>
                  {c.specialisation ? <Badge className="mt-1 border-emerald-200 bg-emerald-50 text-emerald-900">{c.specialisation}</Badge> : null}
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-slate-900">₹{Number(c.price_inr).toLocaleString("en-IN")}</div>
                  <div className="text-xs text-slate-500">one-time</div>
                </div>
              </div>
              {c.bio ? <p className="mt-3 grow text-sm text-slate-600">{c.bio}</p> : null}
              <Button className="mt-4 w-full" disabled={!!busyId} onClick={() => book(c)}>
                {busyId === c.id ? <Spinner className="size-4" /> : null}
                {busyId === c.id ? "Opening payment…" : "Book & pay with Razorpay"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

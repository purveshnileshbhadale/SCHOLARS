// Razorpay webhook — the authoritative payment confirmation.
// Configure the endpoint in the Razorpay dashboard:
//   https://<project-ref>.supabase.co/functions/v1/razorpay-webhook
// with the same secret as the RAZORPAY_WEBHOOK_SECRET function secret.
// verify_jwt is false (config.toml) because Razorpay cannot send a Supabase JWT.
import { createClient } from "npm:@supabase/supabase-js@2";
import { json } from "../_shared/cors.ts";

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !serviceKey) return json({ error: "Webhook not configured." }, 503);

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = await hmacHex(secret, raw);
  if (expected !== signature) {
    console.error("[webhook] bad signature");
    return json({ error: "Invalid signature" }, 400);
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } }; order?: { entity?: { id?: string; receipt?: string } } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // payment.captured is the event that unlocks access.
  if (event.event === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;
    if (orderId && paymentId) {
      const { data: booking } = await admin
        .from("bookings")
        .select("id, status")
        .eq("razorpay_order_id", orderId)
        .maybeSingle();
      if (booking && booking.status !== "paid") {
        await admin
          .from("bookings")
          .update({ status: "paid", payment_id: paymentId })
          .eq("id", booking.id);
        console.log(`[webhook] booking ${booking.id} marked paid (payment ${paymentId})`);
      }
    }
  }

  return json({ ok: true });
});

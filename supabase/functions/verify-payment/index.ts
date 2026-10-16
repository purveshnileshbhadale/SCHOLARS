// Client-side fallback verification after Razorpay checkout closes.
// Body: { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Signature = HMAC_SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET).
// The webhook (razorpay-webhook) is the primary path; this keeps local
// development and delayed webhooks from leaving bookings stuck on "pending".
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const rzpSecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!rzpSecret) return json({ error: "Payments are not configured." }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ error: "Missing payment verification fields." }, 400);
  }

  const expected = await hmacHex(rzpSecret, `${razorpay_order_id}|${razorpay_payment_id}`);
  if (expected !== String(razorpay_signature)) {
    return json({ error: "Invalid payment signature." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: booking } = await admin
    .from("bookings")
    .select("id, student_id, razorpay_order_id, status")
    .eq("id", booking_id)
    .maybeSingle();

  if (!booking || booking.student_id !== user.id) return json({ error: "Booking not found." }, 404);
  if (booking.razorpay_order_id && booking.razorpay_order_id !== razorpay_order_id) {
    return json({ error: "Order mismatch." }, 400);
  }

  // Idempotent: webhook may have already marked it paid.
  if (booking.status !== "paid") {
    const { error } = await admin
      .from("bookings")
      .update({ status: "paid", payment_id: String(razorpay_payment_id), razorpay_order_id: String(razorpay_order_id) })
      .eq("id", booking_id);
    if (error) return json({ error: error.message }, 500);
  }

  return json({ ok: true, status: "paid" });
});

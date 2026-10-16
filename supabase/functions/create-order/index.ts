// Creates a Razorpay order for a counselling booking.
// Body: { counsellor_id }
// Returns: { booking_id, order_id, amount_inr, key_id }
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const rzpId = Deno.env.get("RAZORPAY_KEY_ID");
  const rzpSecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!rzpId || !rzpSecret) return json({ error: "Payments are not configured on this server." }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const counsellorId = typeof body.counsellor_id === "string" ? body.counsellor_id : "";
  if (!counsellorId) return json({ error: "counsellor_id is required" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: counsellor } = await admin
    .from("counsellors")
    .select("id, price_inr, is_active")
    .eq("id", counsellorId)
    .maybeSingle();
  if (!counsellor || !counsellor.is_active) return json({ error: "Counsellor not available." }, 404);

  const amountInr = Number(counsellor.price_inr);
  if (!Number.isFinite(amountInr) || amountInr <= 0) return json({ error: "Invalid counsellor price." }, 400);

  // One live (pending/paid/scheduled) booking per student+counsellor at a time.
  const { data: existing } = await admin
    .from("bookings")
    .select("id, status")
    .eq("student_id", user.id)
    .eq("counsellor_id", counsellorId)
    .in("status", ["pending", "paid", "scheduled"])
    .maybeSingle();
  if (existing) return json({ error: "You already have a booking with this counsellor.", booking_id: existing.id }, 409);

  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .insert({
      student_id: user.id,
      counsellor_id: counsellorId,
      status: "pending",
      amount_inr: amountInr,
    })
    .select("id")
    .single();
  if (bErr) return json({ error: bErr.message }, 500);

  // Create Razorpay order (amount in paise).
  const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${rzpId}:${rzpSecret}`),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(amountInr * 100),
      currency: "INR",
      receipt: booking.id,
      notes: { booking_id: booking.id, student_id: user.id },
    }),
  });
  const order = await rzpRes.json().catch(() => ({}));
  if (!rzpRes.ok) {
    console.error("[create-order] razorpay error", rzpRes.status, JSON.stringify(order).slice(0, 400));
    await admin.from("bookings").delete().eq("id", booking.id);
    return json({ error: "Could not create payment order." }, 502);
  }

  await admin.from("bookings").update({ razorpay_order_id: order.id }).eq("id", booking.id);

  return json({
    booking_id: booking.id,
    order_id: order.id,
    amount_inr: amountInr,
    key_id: rzpId,
  });
});

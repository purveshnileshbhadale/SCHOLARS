// Manages revocable profile-sharing tokens for a student.
// Body: { action: "create" | "regenerate" | "revoke" }
// Consent (student_profiles.share_consent) is required for create/regenerate.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  if (!["create", "regenerate", "revoke"].includes(action)) return json({ error: "Invalid action" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  if (action === "revoke") {
    await admin
      .from("profile_shares")
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq("student_id", user.id)
      .eq("is_active", true);
    return json({ ok: true, token: null });
  }

  // create / regenerate require recorded consent.
  const { data: sp } = await admin
    .from("student_profiles")
    .select("share_consent, is_complete")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!sp?.share_consent) return json({ error: "Consent is required before sharing your profile." }, 400);
  if (!sp?.is_complete) return json({ error: "Complete your profile before sharing." }, 400);

  // One active token at a time — invalidate the old one on regenerate.
  await admin
    .from("profile_shares")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("student_id", user.id)
    .eq("is_active", true);

  const token = newToken();
  const { data: row, error } = await admin
    .from("profile_shares")
    .insert({ student_id: user.id, token, is_active: true })
    .select("token, created_at")
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, token: row.token });
});

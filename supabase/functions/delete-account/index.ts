// Permanently deletes an account. Every owned table cascades from
// auth.users, so a single delete wipes the profile, shortlist,
// applications, documents, community content and referrals.
//
// Two callers:
//  1. A user deleting their own account (normal JWT).
//  2. An admin deleting any account (admin JWT + target_user_id in body).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

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
  const targetId = typeof body.target_user_id === "string" && body.target_user_id ? body.target_user_id : user.id;

  // If deleting someone else, verify the caller is an admin.
  if (targetId !== user.id) {
    const { data: callerProfile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (callerProfile?.role !== "admin") {
      return json({ error: "Only admins can delete other accounts." }, 403);
    }
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, deleted: targetId });
});

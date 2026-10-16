// Admin-only: change a user's role (student ↔ counsellor ↔ admin).
// Body: { user_id, role }
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

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return json({ error: "Admin only" }, 403);

  const body = await req.json().catch(() => ({}));
  const { user_id, role } = body;
  if (!user_id || !["student", "counsellor", "admin"].includes(role)) {
    return json({ error: "user_id and a valid role are required" }, 400);
  }

  const { data, error } = await admin.from("profiles").update({ role }).eq("id", user_id).select("id, role").single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, profile: data });
});

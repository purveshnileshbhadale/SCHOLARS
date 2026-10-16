// Public, token-authorized student profile (counsellor handoff).
// GET /public-profile?token=...
// Returns ONLY consented, non-sensitive fields. Never exposes emails,
// auth data, payment data, notes, or raw document contents.
// Resume is exposed as a short-lived signed URL when consent is on.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "GET only" }, 405);

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  if (!token || token.length < 16 || token.length > 128) return json({ error: "Invalid token" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: share } = await admin
    .from("profile_shares")
    .select("student_id, is_active, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!share || !share.is_active || share.revoked_at) return json({ error: "This profile link is no longer active." }, 404);

  const studentId: string = share.student_id;

  const [{ data: profile }, { data: sp }, { data: shortlist }, { data: sop }] = await Promise.all([
    admin.from("profiles").select("name, phone, created_at").eq("id", studentId).maybeSingle(),
    admin.from("student_profiles").select("*").eq("user_id", studentId).maybeSingle(),
    admin
      .from("shortlists")
      .select("generated_at, result")
      .eq("student_id", studentId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("sop_responses").select("answers").eq("student_id", studentId).maybeSingle(),
  ]);

  // Defence in depth: never serve a profile without live consent + completeness.
  if (!sp?.share_consent || !sp?.is_complete) return json({ error: "Sharing is not enabled for this profile." }, 404);

  // Signed resume URL (10 minutes) — the raw path is never exposed.
  let resumeUrl: string | null = null;
  if (sp.resume_url) {
    const { data: signed } = await admin.storage.from("resumes").createSignedUrl(sp.resume_url, 600);
    resumeUrl = signed?.signedUrl ?? null;
  }

  const shortlistItems = Array.isArray(shortlist?.result?.items)
    ? (shortlist.result.items as {
        name: string;
        tier: string;
        fit_score: number;
        reasoning?: string;
        tuition_aud?: number | null;
      }[]).map((i) => ({
        name: i.name,
        tier: i.tier,
        fit_score: i.fit_score,
        reasoning: i.reasoning ?? "",
        tuition_aud: i.tuition_aud ?? null,
      }))
    : [];

  const answers: Record<string, string> =
    sop?.answers && typeof sop.answers === "object" ? (sop.answers as Record<string, string>) : {};
  const sopAnswered = Object.values(answers).filter((a) => typeof a === "string" && a.trim().length > 0).length;

  return json({
    name: profile?.name ?? null,
    phone: profile?.phone ?? null,
    intended_major: sp.intended_major,
    career_goal: sp.career_goal,
    linkedin_url: sp.linkedin_url,
    class_10_marks: sp.class_10_marks,
    class_12_marks: sp.class_12_marks,
    grading_system: sp.grading_system,
    ielts: sp.ielts,
    toefl: sp.toefl,
    pte: sp.pte,
    sat: sp.sat,
    budget_aud_per_year: sp.budget_aud_per_year,
    needs_scholarship: sp.needs_scholarship,
    preferred_cities: sp.preferred_cities,
    priorities_ranked: sp.priorities_ranked,
    resume_url: resumeUrl,
    shortlist_generated_at: shortlist?.generated_at ?? null,
    shortlist: shortlistItems,
    sop_answers_count: sopAnswered,
    served_at: new Date().toISOString(),
  });
});

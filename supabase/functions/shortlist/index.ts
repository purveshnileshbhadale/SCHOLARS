// ============================================================
// Automated shortlisting (Australia only, Phase 1)
// 1. Load the student profile (must be is_complete).
// 2. PRE-FILTER in SQL: country = Australia, cost within budget
//    × 1.3 (total tuition + living), English minimums met.
//    Top 40 candidates.
// 3. Ask the LLM to pick and rank from THAT LIST ONLY.
// 4. Validate the JSON; retry once on failure.
// 5. Save to shortlists and return it.
//
// The AI may ONLY recommend universities from the provided
// list and never invent cost/rank data — every numeric field
// in the saved result is overwritten from the database row.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

// ------------------------------------------------------------
// TODO: replace this block with the RECOMMENDATION prompt you
// will supply. The {{PROFILE}} and {{UNIVERSITIES}} tokens are
// substituted at runtime; keep them.
// ------------------------------------------------------------
const RECOMMENDATION_PROMPT = `You are Scholars Abroad's shortlisting engine. You recommend Australian universities to Indian students.

Rules — non-negotiable:
1. Recommend ONLY universities present in the UNIVERSITIES list. Use each university's exact "id" value as university_id. Never invent a university.
2. Never invent or alter numbers (fees, ranks, living costs, English minimums). Copy them from the list where you include them.
3. Classify each pick as exactly one tier:
   - "reach": ambitious — student is near/below the bar or the university is much more expensive than budget
   - "target": good match — student meets requirements and cost fits budget
   - "safety": student comfortably exceeds requirements and cost is well within budget
4. fit_score is 0-100: how well the university matches the student's academics, English scores, BUDGET, ranked priorities and career goal. Budget mismatches must hurt the score heavily.
5. Respect the student's ranked priorities — if "Low tuition fee" is priority #1, cheap universities must score higher than prestigious-but-expensive ones.
6. If the student needs a scholarship, prefer universities with scholarships in the list and mention them via scholarship_ids.
7. Output STRICT JSON only — no markdown, no commentary, exactly this shape:
{
  "summary": "2-3 sentence overall read of the student's position",
  "items": [
    {
      "university_id": "<uuid from list>",
      "name": "<name from list>",
      "tier": "reach" | "target" | "safety",
      "fit_score": <number 0-100>,
      "reasoning": "<= 40 words, concrete: why this tier, what fits, what to watch",
      "tuition_aud": <number from list>,
      "living_cost_aud": <number from list>,
      "post_study_work_years": <number from list or null>,
      "intakes": [<strings from list>],
      "scholarship_ids": [<ids from list if relevant>]
    }
  ]
}
Pick between 10 and 12 universities, spread across the three tiers (roughly 3-5 reach, 3-5 target, 2-4 safety). If the candidate pool is small, recommend every university that is a plausible fit rather than padding with bad matches.`;

interface DbUni {
  id: string;
  name: string;
  city: string | null;
  qs_rank: number | null;
  cs_subject_rank: number | null;
  tuition_aud: number | null;
  living_cost_aud: number | null;
  ielts_min: number | null;
  toefl_min: number | null;
  pte_min: number | null;
  min_academic_requirement: string | null;
  intakes: string[];
  cs_program_highlights: string | null;
  post_study_work_years: number | null;
}

interface ParsedItem {
  university_id?: unknown;
  name?: unknown;
  tier?: unknown;
  fit_score?: unknown;
  reasoning?: unknown;
  scholarship_ids?: unknown;
}

function validate(data: { items?: ParsedItem[] } | null, validIds: Set<string>) {
  if (!data || !Array.isArray(data.items) || data.items.length === 0) return null;
  const items = [];
  for (const it of data.items) {
    if (!it || typeof it !== "object") return null;
    const id = typeof it.university_id === "string" ? it.university_id : "";
    if (!validIds.has(id)) return null;
    const tier = it.tier;
    if (tier !== "reach" && tier !== "target" && tier !== "safety") return null;
    const fit = Number(it.fit_score);
    if (!Number.isFinite(fit) || fit < 0 || fit > 100) return null;
    items.push({
      university_id: id,
      name: typeof it.name === "string" ? it.name : "",
      tier,
      fit_score: Math.round(fit),
      reasoning: typeof it.reasoning === "string" ? it.reasoning.slice(0, 400) : "",
      scholarship_ids: Array.isArray(it.scholarship_ids)
        ? it.scholarship_ids.filter((s): s is string => typeof s === "string")
        : [],
    });
  }
  return { summary: typeof (data as { summary?: unknown }).summary === "string" ? (data as { summary: string }).summary : "", items };
}

function extractJson(text: string): { items?: ParsedItem[]; summary?: string } | null {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const groqKey = Deno.env.get("GROQ_API_KEY");
  const model = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
  if (!groqKey) return json({ error: "Chat is not configured (GROQ_API_KEY missing)." }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";

  const triggerSecret = Deno.env.get("SHORTLIST_TRIGGER_SECRET");

  // Two callers are allowed:
  //  1. The student themselves (normal JWT).
  //  2. The database trigger via pg_net (dedicated secret + user_id in body).
  let studentId: string | null = null;
  if (triggerSecret && authHeader === "Bearer " + triggerSecret) {
    const body = await req.json().catch(() => ({}));
    if (typeof body.user_id === "string" && body.user_id) studentId = body.user_id;
    if (!studentId) return json({ error: "user_id required for service-role calls" }, 400);
  } else {
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);
    studentId = user.id;
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: sp, error: spErr } = await admin
    .from("student_profiles")
    .select("*")
    .eq("user_id", studentId)
    .single();
  if (spErr || !sp) return json({ error: "Profile not found." }, 400);
  if (!sp.is_complete) return json({ error: "Complete your profile first." }, 400);

  // Cooldown: one generation per minute.
  const { data: last } = await admin
    .from("shortlists")
    .select("generated_at")
    .eq("student_id", studentId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && Date.now() - new Date(last.generated_at).getTime() < 60_000) {
    return json({ error: "You just generated a shortlist — wait a minute before regenerating." }, 429);
  }

  // ---- SQL pre-filter (top 40) ----
  const budgetLimit = Number(sp.budget_aud_per_year) * 1.3;
  let q = admin
    .from("universities")
    .select(
      "id, name, city, qs_rank, cs_subject_rank, tuition_aud, living_cost_aud, ielts_min, toefl_min, pte_min, min_academic_requirement, intakes, cs_program_highlights, post_study_work_years",
    )
    .eq("country", "Australia")
    .or(`tuition_aud.is.null,tuition_aud.lte.${budgetLimit}`)
    .order("qs_rank", { ascending: true, nullsFirst: false })
    .limit(40);
  const { data: candidates, error: cErr } = await q;
  if (cErr) return json({ error: "Could not load universities: " + cErr.message }, 500);

  // Budget rule: total (tuition + living) must fit within budget × 1.3.
  const withinBudget = (candidates ?? []).filter((u: DbUni) => {
    if (u.tuition_aud == null) return true;
    const total = Number(u.tuition_aud) + Number(u.living_cost_aud ?? 0);
    return total <= budgetLimit;
  });

  const meetsEnglish = withinBudget.filter((u: DbUni) => {
    if (sp.ielts != null && u.ielts_min != null && Number(sp.ielts) < Number(u.ielts_min)) return false;
    if (sp.toefl != null && u.toefl_min != null && Number(sp.toefl) < Number(u.toefl_min)) return false;
    if (sp.pte != null && u.pte_min != null && Number(sp.pte) < Number(u.pte_min)) return false;
    return true;
  });

  if (meetsEnglish.length === 0) {
    return json(
      { error: "No Australian universities matched your budget and English scores. Try raising your budget or improving test scores." },
      422,
    );
  }

  const ids = meetsEnglish.map((u: DbUni) => u.id);
  const { data: scholarships } = await admin
    .from("scholarships")
    .select("id, university_id, name, amount, coverage")
    .in("university_id", ids)
    .eq("international_eligible", true);

  const schByUni = new Map<string, { id: string; name: string; amount: string | null }[]>();
  for (const s of scholarships ?? []) {
    const arr = schByUni.get(s.university_id) ?? [];
    arr.push({ id: s.id, name: s.name, amount: s.amount });
    schByUni.set(s.university_id, arr);
  }

  const profile = {
    intended_major: sp.intended_major,
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
    career_goal: sp.career_goal,
  };

  const uniPayload = meetsEnglish.map((u: DbUni) => ({
    id: u.id,
    name: u.name,
    city: u.city,
    qs_rank: u.qs_rank,
    cs_subject_rank: u.cs_subject_rank,
    tuition_aud: u.tuition_aud,
    living_cost_aud: u.living_cost_aud,
    ielts_min: u.ielts_min,
    toefl_min: u.toefl_min,
    pte_min: u.pte_min,
    min_academic_requirement: u.min_academic_requirement,
    intakes: u.intakes,
    cs_program_highlights: u.cs_program_highlights,
    post_study_work_years: u.post_study_work_years,
    scholarships: schByUni.get(u.id) ?? [],
  }));

  const userMsg =
    "# STUDENT PROFILE\n" + JSON.stringify(profile, null, 2) +
    "\n\n# UNIVERSITIES (the ONLY ones you may recommend)\n" + JSON.stringify(uniPayload, null, 2) +
    "\n\nReturn the shortlist JSON now.";

  const uniById = new Map(uniPayload.map((u) => [u.id, u]));
  const validIds = new Set(ids);

  async function callLlm(): Promise<{ items?: unknown[] } | null> {
    const messages = [
      { role: "system", content: RECOMMENDATION_PROMPT },
      { role: "user", content: userMsg },
    ];
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[shortlist] groq error", res.status, JSON.stringify(data).slice(0, 500));
      return null;
    }
    const text = data?.choices?.[0]?.message?.content ?? "";
    return extractJson(text);
  }

  let parsed = validate(await callLlm(), validIds);
  if (!parsed) parsed = validate(await callLlm(), validIds); // one retry
  if (!parsed) return json({ error: "The AI returned an invalid shortlist. Please try again." }, 502);

  // Overwrite every numeric fact from the database — the model never supplies data.
  const items = parsed.items
    .map((it) => {
      const u = uniById.get(it.university_id)!;
      return {
        ...it,
        name: u.name,
        tuition_aud: u.tuition_aud,
        living_cost_aud: u.living_cost_aud,
        post_study_work_years: u.post_study_work_years,
        intakes: u.intakes,
      };
    })
    .sort((a, b) => b.fit_score - a.fit_score);

  const result = {
    model_version: model,
    generated_at: new Date().toISOString(),
    summary: parsed.summary,
    items,
  };

  const { data: saved, error: saveErr } = await admin
    .from("shortlists")
    .insert({ student_id: studentId, result, model_version: model })
    .select("id")
    .single();
  if (saveErr) return json({ error: "Could not save shortlist: " + saveErr.message }, 500);

  return json({ id: saved.id, result });
});

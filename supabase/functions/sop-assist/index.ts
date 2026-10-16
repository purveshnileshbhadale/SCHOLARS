// ============================================================
// SOP Copilot (Groq) — two modes, both called with the student's JWT:
//
//   { mode: "review" }
//     Scores the questionnaire answers against the counsellor rubric,
//     flags weak/missing answers, returns structured feedback.
//     Saved to sop_responses.ai_review.
//
//   { mode: "draft" }
//     Writes a first-draft Statement of Purpose using ONLY the student's
//     answers. Gaps are marked [MISSING: ...] — nothing is invented.
//     Saved to sop_responses.ai_draft. A counsellor refines it.
//
// Resume/document contents are never sent here and can never alter
// these instructions — the answers themselves are the only input.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const REVIEW_PROMPT = `You are a Scholars Abroad senior counsellor reviewing an undergraduate SOP questionnaire.
Score the student's answers honestly. The rubric per section:
- Specificity (concrete incidents, names, numbers beat adjectives)
- Reflection (what they learned, not just what happened)
- Course motivation (real modules, real reasons — not generic praise)
- Coherence (answers that connect to each other and to the intended course)
- Voice (sounds like the student, not a thesaurus or an AI)

Rules:
- Judge ONLY what is written. Never reward imagination that is not in the answers.
- "don't know yet" or a blank answer scores 0 for that question and must appear in top_fixes.
- Be direct and kind. No flattery padding.
- Output STRICT JSON only, no markdown, exactly this shape:
{
  "overall_score": <0-100>,
  "verdict": "<= 30 words — where this application stands today>",
  "sections": [
    {
      "section_id": "<s1..s10>",
      "score": <0-100>,
      "strengths": ["<= 2 short items"],
      "improvements": ["<= 3 concrete, actionable items"]
    }
  ],
  "top_fixes": ["<= 5 highest-leverage fixes across the whole questionnaire"]
}`;

const DRAFT_PROMPT = `You are a Scholars Abroad SOP writer producing a FIRST DRAFT for an undergraduate overseas application (Australia).
You will be given the student's raw questionnaire answers.

Non-negotiable rules:
1. Use ONLY facts present in the answers. Never invent a grade, module, employer, award, date or plan.
2. If a section of the essay depends on an answer that is thin or missing, insert exactly: [MISSING: <question id>] — do not paper over gaps.
3. Write in the first person, in the student's own register. Short sentences. No "since childhood", no "I am passionate about", no thesaurus words, no bullet-point corporate tone.
4. Structure: Intro → Academics → Beyond the classroom → Why this course → Why this university → Why this country → Why not India → After the course → Closing.
5. 900–1200 words. Australia-focused. No markdown headings — plain paragraphs with one blank line between them.
6. End with a line: DRAFT — review with your counsellor before submitting anywhere.`;

interface Answer {
  [qid: string]: string;
}

function extractJson(text: string): Record<string, unknown> | null {
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

function validateReview(data: Record<string, unknown> | null) {
  if (!data) return null;
  const score = Number(data.overall_score);
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  if (!Array.isArray(data.sections) || data.sections.length === 0) return null;
  const sections = (data.sections as Record<string, unknown>[])
    .filter((s) => typeof s?.section_id === "string")
    .map((s) => ({
      section_id: String(s.section_id),
      score: Math.max(0, Math.min(100, Math.round(Number(s.score) || 0))),
      strengths: Array.isArray(s.strengths) ? s.strengths.slice(0, 2).map(String) : [],
      improvements: Array.isArray(s.improvements) ? s.improvements.slice(0, 3).map(String) : [],
    }));
  return {
    overall_score: Math.round(score),
    verdict: typeof data.verdict === "string" ? data.verdict.slice(0, 300) : "",
    sections,
    top_fixes: Array.isArray(data.top_fixes) ? data.top_fixes.slice(0, 5).map(String) : [],
  };
}

async function callGroq(groqKey: string, model: string, system: string, user: string, jsonMode: boolean): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: jsonMode ? 0.2 : 0.6,
      max_tokens: jsonMode ? 2500 : 2500,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(75_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[sop-assist] groq error", res.status, JSON.stringify(data).slice(0, 400));
    throw new Error("AI service error");
  }
  return data?.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const groqKey = Deno.env.get("GROQ_API_KEY");
  const model = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
  if (!groqKey) return json({ error: "AI is not configured on this server." }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const mode = body.mode as string;
  if (mode !== "review" && mode !== "draft") return json({ error: "mode must be review or draft" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  const [{ data: sop }, { data: sp }, { data: profile }] = await Promise.all([
    admin.from("sop_responses").select("answers").eq("student_id", user.id).maybeSingle(),
    admin.from("student_profiles").select("intended_major, career_goal, class_12_marks, grading_system").eq("user_id", user.id).maybeSingle(),
    admin.from("profiles").select("name").eq("id", user.id).maybeSingle(),
  ]);

  const answers: Answer = (sop?.answers as Answer) ?? {};
  const answeredCount = Object.values(answers).filter((a) => typeof a === "string" && a.trim().length > 0).length;
  if (answeredCount === 0) return json({ error: "Answer the questionnaire first — the AI works only from your answers." }, 400);

  const context =
    "# STUDENT\n" +
    JSON.stringify(
      {
        name: profile?.name ?? null,
        intended_major: sp?.intended_major ?? null,
        career_goal: sp?.career_goal ?? null,
        class_12_marks: sp?.class_12_marks ?? null,
        grading_system: sp?.grading_system ?? null,
      },
      null,
      2,
    ) +
    "\n\n# ANSWERS (question id → student's answer)\n" +
    JSON.stringify(answers, null, 2);

  if (mode === "review") {
    let parsed = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      try {
        const text = await callGroq(groqKey, model, REVIEW_PROMPT, context + "\n\nReturn the review JSON now.", true);
        parsed = validateReview(extractJson(text));
      } catch {
        parsed = null;
      }
    }
    if (!parsed) return json({ error: "The AI could not review right now. Try again in a minute." }, 502);

    const review = { ...parsed, model_version: model, reviewed_at: new Date().toISOString() };
    await admin
      .from("sop_responses")
      .upsert({ student_id: user.id, answers, ai_review: review, ai_reviewed_at: new Date().toISOString() });
    return json({ mode: "review", review });
  }

  // draft
  let draft = "";
  for (let attempt = 0; attempt < 2 && !draft; attempt++) {
    try {
      const text = await callGroq(groqKey, model, DRAFT_PROMPT, context + "\n\nWrite the SOP draft now.", false);
      const cleaned = text.replace(/^```(?:text)?/i, "").replace(/```$/, "").trim();
      if (cleaned.length > 400) draft = cleaned.slice(0, 8000);
    } catch {
      draft = "";
    }
  }
  if (!draft) return json({ error: "The AI could not draft right now. Try again in a minute." }, 502);

  await admin
    .from("sop_responses")
    .upsert({ student_id: user.id, answers, ai_draft: draft, ai_draft_at: new Date().toISOString() });
  return json({ mode: "draft", draft, model_version: model });
});

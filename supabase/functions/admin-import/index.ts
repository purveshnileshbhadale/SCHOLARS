// Admin-only bulk university import from pre-parsed Excel rows.
// Body: { file_name?, rows: UniversityRow[] }
// Validates every row, upserts by (name, country), logs the import.
// The .xlsx is parsed in the browser (SheetJS) — this function only
// receives structured rows, never a file blob.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

interface RowIn {
  name?: unknown;
  country?: unknown;
  city?: unknown;
  state?: unknown;
  cricos_code?: unknown;
  qs_rank?: unknown;
  the_rank?: unknown;
  cs_subject_rank?: unknown;
  tuition_aud?: unknown;
  living_cost_aud?: unknown;
  ielts_min?: unknown;
  toefl_min?: unknown;
  pte_min?: unknown;
  min_academic_requirement?: unknown;
  intakes?: unknown;
  cs_program_highlights?: unknown;
  post_study_work_years?: unknown;
  data_year?: unknown;
  confidence?: unknown;
  source_url?: unknown;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN; // NaN signals "present but not a number"
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function intakesOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = str(v);
  if (!s) return [];
  return s.split(/[,;/|]/).map((x) => x.trim()).filter(Boolean);
}

function validate(row: RowIn, idx: number) {
  const errors: string[] = [];
  for (const f of ["name", "country", "city"] as const) {
    if (str(row[f]) === null) errors.push(`${f}: required`);
  }
  for (const f of ["tuition_aud", "living_cost_aud"] as const) {
    const n = num(row[f]);
    if (n === null || Number.isNaN(n)) errors.push(`${f}: required number`);
  }
  for (const f of ["qs_rank", "the_rank", "cs_subject_rank", "tuition_aud", "living_cost_aud", "ielts_min", "toefl_min", "pte_min", "post_study_work_years", "data_year"] as const) {
    const n = num(row[f]);
    if (Number.isNaN(n)) errors.push(`${f}: not a number ("${row[f]}")`);
  }
  const url = str(row.source_url);
  if (url && !/^https?:\/\//i.test(url)) errors.push("source_url: must start with http(s)://");
  const conf = str(row.confidence);
  if (conf && !["sample", "low", "medium", "high"].includes(conf)) errors.push("confidence: must be sample|low|medium|high");

  const name = str(row.name);
  const country = str(row.country) ?? "Australia";
  if (errors.length) return { ok: false as const, idx, name, errors };

  const rec = {
    name: name!,
    country,
    city: str(row.city),
    state: str(row.state),
    cricos_code: str(row.cricos_code),
    qs_rank: num(row.qs_rank),
    the_rank: num(row.the_rank),
    cs_subject_rank: num(row.cs_subject_rank),
    tuition_aud: num(row.tuition_aud),
    living_cost_aud: num(row.living_cost_aud),
    ielts_min: num(row.ielts_min),
    toefl_min: num(row.toefl_min),
    pte_min: num(row.pte_min),
    min_academic_requirement: str(row.min_academic_requirement),
    intakes: intakesOf(row.intakes),
    cs_program_highlights: str(row.cs_program_highlights),
    post_study_work_years: num(row.post_study_work_years),
    data_year: num(row.data_year),
    confidence: conf ?? "medium",
    sources: url ? [{ url, label: "excel import" }] : [],
    updated_at: new Date().toISOString(),
  };
  return { ok: true as const, idx, name, rec };
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

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return json({ error: "Admin only" }, 403);

  const body = await req.json().catch(() => ({}));
  const rows: RowIn[] = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return json({ error: "No rows provided" }, 400);
  if (rows.length > 2000) return json({ error: "Too many rows (max 2000 per import)" }, 400);

  const valid: ReturnType<typeof validate>[] = [];
  const rejected: { idx: number; name: string | null; errors: string[] }[] = [];
  rows.forEach((r, i) => {
    const v = validate(r, i);
    (v.ok ? valid : rejected).push(v as never);
  });

  const recs = valid.filter((v) => v.ok).map((v) => (v as { rec: Record<string, unknown> }).rec);

  let added = 0;
  let updated = 0;
  if (recs.length) {
    const { error: upErr } = await admin.from("universities").upsert(recs, { onConflict: "name,country" });
    if (upErr) return json({ error: "Upsert failed: " + upErr.message }, 500);
    // Count added vs updated by checking which (name,country) existed before — approximate via re-check:
    const keys = recs.map((r) => `${r.name}|${r.country}`);
    const { count } = await admin
      .from("universities")
      .select("name, country", { count: "exact", head: true })
      .in("name", recs.map((r) => r.name as string));
    updated = Math.min(count ?? 0, recs.length);
    added = recs.length - updated;
  }

  const summary = {
    rows_total: rows.length,
    rows_added: added,
    rows_updated: updated,
    rows_rejected: rejected.length,
    errors: rejected.slice(0, 100),
  };

  await admin.from("import_logs").insert({
    admin_id: user.id,
    file_name: str(body.file_name) ?? "upload.xlsx",
    ...summary,
  });

  return json(summary);
});

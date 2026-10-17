// ============================================================
// daily-digest — scheduled by pg_cron via pg_net (no user JWT).
// Auth: x-internal-secret must match the cron_secret stored in
// public.app_secrets (generated in-DB at migration time, never
// committed to the repo). The function reads it with the service
// role and rejects anything else.
//
// Collects deadlines due in the next 7 days (applications), scholarships
// for unis the student shortlisted/saved, sessions and reminders due in the
// next 24h, groups them per student, and emails a digest — ONLY if
// RESEND_API_KEY is set. Without the key it returns a graceful "skipped".
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  // 1) authenticate the cron caller
  const { data: sec } = await admin.from("app_secrets").select("value").eq("key", "cron_secret").maybeSingle();
  const provided = req.headers.get("x-internal-secret") ?? "";
  if (!sec?.value || provided !== String(sec.value)) return json({ error: "unauthorized" }, 401);

  // 2) gather what is due
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const in24 = new Date(Date.now() + 86_400_000).toISOString();

  const [{ data: apps }, { data: books }, { data: rems }, { data: sls }, { data: savs }, { data: schs }] = await Promise.all([
    admin
      .from("applications")
      .select("student_id, admission_deadline, status, program, universities(name)")
      .not("admission_deadline", "is", null)
      .gte("admission_deadline", today)
      .lte("admission_deadline", in7)
      .not("status", "in", '("Rejected","Withdrawn")')
      .limit(500),
    admin
      .from("bookings")
      .select("student_id, scheduled_at, counsellors(display_name)")
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date().toISOString())
      .lte("scheduled_at", in24)
      .limit(100),
    admin
      .from("reminders")
      .select("user_id, title, due_at")
      .eq("is_done", false)
      .gte("due_at", new Date().toISOString())
      .lte("due_at", in24)
      .limit(200),
    // Feature 60: scholarship deadlines for unis the student actually follows.
    admin
      .from("shortlists")
      .select("student_id, result")
      .order("generated_at", { ascending: false })
      .limit(100),
    admin.from("saved_universities").select("student_id, university_id").limit(2000),
    admin
      .from("scholarships")
      .select("name, deadline, university_id")
      .not("deadline", "is", null)
      .gte("deadline", today)
      .lte("deadline", in7)
      .limit(200),
  ]);

  const byUser = new Map<string, string[]>();
  const push = (uid: string | undefined, line: string) => {
    if (!uid) return;
    const arr = byUser.get(uid) ?? [];
    arr.push(line);
    byUser.set(uid, arr);
  };

  for (const a of (apps ?? []) as { student_id: string; admission_deadline: string; program: string | null; universities?: { name?: string } | { name?: string }[] }[]) {
    const uni = Array.isArray(a.universities) ? a.universities[0]?.name : a.universities?.name;
    push(a.student_id, `Application deadline ${a.admission_deadline} — ${uni ?? a.program ?? "Application"}`);
  }
  for (const b of (books ?? []) as { student_id: string; scheduled_at: string; counsellors?: { display_name?: string } | { display_name?: string }[] }[]) {
    const c = Array.isArray(b.counsellors) ? b.counsellors[0]?.display_name : b.counsellors?.display_name;
    push(b.student_id, `Counselling session ${new Date(b.scheduled_at).toLocaleString("en-AU")} with ${c ?? "your counsellor"}`);
  }
  for (const r of (rems ?? []) as { user_id: string; title: string }[]) {
    push(r.user_id, `Reminder — ${r.title}`);
  }

  // Feature 60: reverse map uni → students who shortlisted or saved it.
  const uniStudents = new Map<string, Set<string>>();
  const follow = (uid: string, uniId: string) => {
    let s = uniStudents.get(uniId);
    if (!s) {
      s = new Set<string>();
      uniStudents.set(uniId, s);
    }
    s.add(uid);
  };
  for (const s of (sls ?? []) as { student_id: string; result?: { items?: { university_id?: string }[] } }[]) {
    for (const it of s.result?.items ?? []) if (it.university_id) follow(s.student_id, it.university_id);
  }
  for (const s of (savs ?? []) as { student_id: string; university_id: string }[]) follow(s.student_id, s.university_id);
  for (const sc of (schs ?? []) as { name: string; deadline: string; university_id?: string | null }[]) {
    if (!sc.university_id) continue;
    const followers = uniStudents.get(sc.university_id);
    if (!followers) continue;
    for (const sid of followers) push(sid, `Scholarship deadline ${sc.deadline} — ${sc.name}`);
  }

  let dueUsers = [...byUser.keys()];
  if (dueUsers.length === 0) return json({ ok: true, due_users: 0, emailed: 0, note: "nothing due" });

  // Feature 55: honour the per-student digest opt-out (Settings → Notifications).
  const { data: prefs } = await admin
    .from("profiles")
    .select("id, email_digest_enabled")
    .in("id", dueUsers);
  const optedOut = new Set(
    ((prefs ?? []) as { id: string; email_digest_enabled: boolean | null }[])
      .filter((p) => p.email_digest_enabled === false)
      .map((p) => p.id),
  );
  dueUsers = dueUsers.filter((uid) => !optedOut.has(uid));
  if (dueUsers.length === 0)
    return json({ ok: true, due_users: 0, emailed: 0, note: "all due users opted out of the digest" });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return json({ ok: true, due_users: dueUsers.length, emailed: 0, note: "skipped: no RESEND_API_KEY configured" });
  }

  // 3) uid → email map (auth.users via service role)
  const emails = new Map<string, string>();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    for (const u of data.users) if (u.email) emails.set(u.id, u.email);
    if (data.users.length < 200) break;
  }

  const subject = `Scholars Abroad — deadlines in the next 7 days`;
  let emailed = 0;
  for (const uid of dueUsers.slice(0, 50)) {
    const to = emails.get(uid);
    if (!to) continue;
    const items = byUser.get(uid) ?? [];
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a">
      <div style="max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#047857;margin:0 0 4px">Scholars Abroad</h2>
        <p style="margin:0 0 16px;color:#475569">Here's what's coming up for you:</p>
        <ul style="padding-left:18px;line-height:1.7">
          ${items.map((i) => `<li>${esc(i)}</li>`).join("")}
        </ul>
        <p style="margin-top:18px;color:#64748b;font-size:13px">
          Open the app for countdowns, reminders and calendar export.
        </p>
      </div></body></html>`;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Deno.env.get("DIGEST_FROM") ?? "Scholars Abroad <onboarding@resend.dev>",
          to: [to],
          subject,
          html,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (r.ok) emailed++;
    } catch {
      /* one failed address shouldn't kill the digest */
    }
  }

  return json({ ok: true, due_users: dueUsers.length, emailed });
});

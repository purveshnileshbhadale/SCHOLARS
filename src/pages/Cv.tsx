import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Profile, StudentProfile } from "../lib/types";
import { Button, Card, Empty, PageHeader, Spinner } from "../components/ui";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function row(label: string, value: string | null | undefined) {
  if (value == null || value === "") return "";
  return `<div class="row"><span class="muted">${esc(label)}</span><span>${esc(value)}</span></div>`;
}

/** Opens a print-ready one-page CV built from the saved profile (browser print → PDF). */
function printCv(p: Profile, sp: StudentProfile | null) {
  const w = window.open("", "_blank", "width=760,height=1000");
  if (!w) return;
  const scores = [
    sp?.ielts ? `IELTS ${sp.ielts}` : null,
    sp?.toefl ? `TOEFL iBT ${sp.toefl}` : null,
    sp?.pte ? `PTE ${sp.pte}` : null,
    sp?.sat ? `SAT ${sp.sat}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const priorities = sp?.priorities_ranked?.length ? sp.priorities_ranked.join(" → ") : null;
  const cities = sp?.preferred_cities?.length ? sp.preferred_cities.join(", ") : null;
  const contact = [
    p.email,
    p.phone,
    sp?.linkedin_url,
  ]
    .filter(Boolean)
    .map((x) => esc(x))
    .join(" &nbsp;|&nbsp; ");

  w.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>CV — ${esc(p.name ?? "Student")}</title>
<style>
  @page { margin: 18mm 16mm; }
  body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;margin:0;background:#fff}
  .wrap{max-width:680px;margin:0 auto;padding:36px}
  h1{font-size:26px;margin:0;letter-spacing:-0.02em}
  .contact{margin:6px 0 0;color:#475569;font-size:13px}
  h2{font-size:12px;text-transform:uppercase;letter-spacing:0.09em;color:#047857;margin:26px 0 8px;border-bottom:1px solid #d1fae5;padding-bottom:4px}
  .row{display:flex;justify-content:space-between;gap:16px;font-size:13.5px;padding:4px 0;border-bottom:1px dashed #e2e8f0}
  .row:last-child{border-bottom:none}
  .muted{color:#64748b}
  .goal{font-size:13.5px;line-height:1.6;margin:0}
  .foot{margin-top:28px;color:#94a3b8;font-size:11px;line-height:1.5}
  .actions{max-width:680px;margin:0 auto;padding:12px 36px 0;display:flex;gap:8px;justify-content:flex-end}
  .actions button{font:inherit;font-size:13px;font-weight:700;border:0;border-radius:10px;padding:8px 16px;cursor:pointer;background:#047857;color:#fff}
  @media print{.actions{display:none}.wrap{padding:0}}
</style></head>
<body>
<div class="actions"><button onclick="window.print()">Print / save as PDF</button></div>
<div class="wrap">
  <h1>${esc(p.name ?? "Your name")}</h1>
  <p class="contact">${contact || "Add your email and LinkedIn in Settings / Onboarding"}</p>

  <h2>Objective</h2>
  <p class="goal">${esc(sp?.career_goal ?? "Add your career goal in Onboarding to strengthen this section.")}</p>

  <h2>Education & academics</h2>
  ${row("Intended programme", sp?.intended_major)}
  ${row("Class 10", sp?.class_10_marks != null ? `${sp.class_10_marks}% (${sp.grading_system ?? "marks"})` : null)}
  ${row("Class 12", sp?.class_12_marks != null ? `${sp.class_12_marks}% (${sp.grading_system ?? "marks"})` : null)}

  <h2>Test scores</h2>
  ${scores ? `<p class="goal">${scores}</p>` : `<p class="goal muted">No test scores saved yet — add IELTS/TOEFL/PTE in Onboarding.</p>`}

  <h2>Preferences</h2>
  ${row("Budget (per year, AUD)", sp?.budget_aud_per_year ? `AU$${Number(sp.budget_aud_per_year).toLocaleString("en-IN")}` : null)}
  ${row("Scholarship needed", sp?.needs_scholarship ? "Yes" : sp ? "No" : null)}
  ${row("Preferred cities", cities)}
  ${row("Priorities", priorities)}

  <p class="foot">Generated from Scholars Abroad on ${new Date().toLocaleDateString("en-AU", { dateStyle: "long" })}.
  Keep this one page; add roles, projects and achievements on a second page in your own editor.</p>
</div>
</body></html>`);
  w.document.close();
  w.focus();
}

export default function Cv() {
  const { session, profile } = useAuth();
  const [sp, setSp] = useState<StudentProfile | null>(null);
  const [full, setFull] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
        supabase.from("student_profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
      ]);
      setFull((p as Profile) ?? (profile as Profile) ?? null);
      setSp((s as StudentProfile) ?? null);
      setLoading(false);
    })();
  }, [session, profile]);

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  if (!full)
    return (
      <div className="mx-auto max-w-3xl">
        <Empty title="Profile not found" body="Sign in again to build your CV." />
      </div>
    );

  const empty = !sp?.intended_major && !sp?.career_goal && !sp?.class_12_marks && !sp?.ielts;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Your CV"
        subtitle="A clean one-page CV built from your saved profile. Open the print view and choose 'Save as PDF' to download it."
        right={
          <Button onClick={() => printCv(full, sp)} disabled={empty}>
            Open printable CV
          </Button>
        }
      />
      {empty ? (
        <Card>
          <p className="text-sm text-slate-600">
            Your profile is still empty — fill in Onboarding (intended programme, marks, test scores, goal) and this CV
            fills itself automatically.
          </p>
        </Card>
      ) : (
        <Card>
          <h2 className="text-2xl font-extrabold text-slate-900">{full.name ?? "Your name"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {[full.email, full.phone, sp?.linkedin_url].filter(Boolean).join(" · ") || "No contact details yet"}
          </p>
          {sp?.career_goal ? <p className="mt-4 text-sm leading-relaxed text-slate-700">{sp.career_goal}</p> : null}
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Programme</dt>
              <dd className="text-slate-800">{sp?.intended_major ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Class 12</dt>
              <dd className="text-slate-800">{sp?.class_12_marks != null ? `${sp.class_12_marks}%` : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">English test</dt>
              <dd className="text-slate-800">
                {sp?.ielts
                  ? `IELTS ${sp.ielts}`
                  : sp?.toefl
                    ? `TOEFL ${sp.toefl}`
                    : sp?.pte
                      ? `PTE ${sp.pte}`
                      : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Budget / year</dt>
              <dd className="text-slate-800">
                {sp?.budget_aud_per_year ? `AU$${Number(sp.budget_aud_per_year).toLocaleString("en-IN")}` : "—"}
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-xs text-slate-400">
            Activities, work experience and projects live outside the current profile form — add them on a second page
            in your own editor. This page stays to one print sheet.
          </p>
        </Card>
      )}
    </div>
  );
}

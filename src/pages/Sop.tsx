import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { SOP_SECTIONS, sopStats } from "../lib/sopQuestions";
import { Badge, Button, Card, ErrorNote, PageHeader, Spinner, Textarea } from "../components/ui";

interface AiReview {
  overall_score: number;
  verdict: string;
  sections: { section_id: string; score: number; strengths: string[]; improvements: string[] }[];
  top_fixes: string[];
  model_version?: string;
}

export default function Sop() {
  const { session } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<"review" | "draft" | null>(null);
  const [showDraft, setShowDraft] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadAi() {
    if (!session) return;
    const { data } = await supabase
      .from("sop_responses")
      .select("ai_review, ai_draft")
      .eq("student_id", session.user.id)
      .maybeSingle();
    setAiReview((data?.ai_review as AiReview) ?? null);
    setAiDraft(data?.ai_draft ?? null);
  }

  useEffect(() => {
    if (!session) return;
    supabase
      .from("sop_responses")
      .select("answers, updated_at, ai_review, ai_draft")
      .eq("student_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.answers) setAnswers(data.answers as Record<string, string>);
        if (data?.updated_at) setSavedAt(data.updated_at);
        setAiReview((data?.ai_review as AiReview) ?? null);
        setAiDraft(data?.ai_draft ?? null);
        setLoading(false);
      });
  }, [session]);

  async function save(): Promise<boolean> {
    if (!session) return false;
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("sop_responses")
      .upsert({ student_id: session.user.id, answers, updated_at: new Date().toISOString() });
    if (error) {
      setErr(error.message);
      setSaving(false);
      return false;
    }
    setSavedAt(new Date().toISOString());
    setSaving(false);
    return true;
  }

  async function runAi(mode: "review" | "draft") {
    if (!(await save())) return;
    setErr(null);
    setAiBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("sop-assist", { method: "POST", body: { mode } });
      if (error) {
        const body = error.context ? await error.context.json().catch(() => null) : null;
        throw new Error(body?.error ?? "AI request failed");
      }
      if (mode === "review") {
        setAiReview(data.review as AiReview);
      } else {
        setAiDraft(data.draft as string);
        setShowDraft(true);
      }
      await loadAi();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setAiBusy(null);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  const stats = sopStats(answers);
  const pct = Math.round((stats.coreAnswered / stats.coreTotal) * 100);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="SOP questionnaire"
        subtitle="The raw material your counsellor uses to draft your Statement of Purpose. Write the way you speak — three or four honest sentences per question. 'Don't know yet' is a valid answer."
        right={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => runAi("review")} disabled={!!aiBusy}>
              {aiBusy === "review" ? <Spinner className="size-4" /> : null}
              AI review
            </Button>
            <Button variant="ghost" onClick={() => runAi("draft")} disabled={!!aiBusy}>
              {aiBusy === "draft" ? <Spinner className="size-4" /> : null}
              AI draft SOP
            </Button>
            <Button onClick={() => save()} disabled={saving}>
              {saving ? <Spinner className="size-4" /> : null}
              Save answers
            </Button>
          </div>
        }
      />
      <ErrorNote>{err}</ErrorNote>

      {aiReview ? (
        <Card className="mb-6 border-sky-200 bg-sky-50/60">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sky-900">AI review</h2>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-sky-900">{aiReview.overall_score}<span className="text-sm font-normal">/100</span></div>
              <div className="text-[10px] uppercase tracking-wide text-sky-600">overall</div>
            </div>
          </div>
          <p className="mt-2 text-sm text-sky-950">{aiReview.verdict}</p>
          {aiReview.top_fixes.length ? (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Top fixes</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-sky-950">
                {aiReview.top_fixes.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {aiReview.sections.map((s) => (
              <div key={s.section_id} className="rounded-xl border border-sky-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-sky-900">{SOP_SECTIONS.find((x) => x.id === s.section_id)?.title ?? s.section_id}</span>
                  <span className="text-sky-700">{s.score}</span>
                </div>
                {s.strengths.length ? (
                  <p className="mt-1 text-xs text-emerald-700">+ {s.strengths.join(" · ")}</p>
                ) : null}
                {s.improvements.length ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                    {s.improvements.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-sky-600">
            Generated by {aiReview.model_version ?? "AI"}. This is guidance — your counsellor makes the final call.
          </p>
        </Card>
      ) : null}

      {aiDraft && showDraft ? (
        <Card className="mb-6 border-emerald-200 bg-emerald-50/60">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-emerald-900">AI first-draft SOP</h2>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(aiDraft);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="ghost" onClick={() => setShowDraft(false)}>
                Hide
              </Button>
            </div>
          </div>
          <div className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-800">{aiDraft}</div>
          <p className="mt-3 text-xs text-emerald-700">
            Written only from your answers — nothing invented. Review with your counsellor before using it anywhere.
          </p>
        </Card>
      ) : aiDraft ? (
        <Card className="mb-6">
          <Button variant="ghost" onClick={() => setShowDraft(true)}>
            Show previous AI draft
          </Button>
        </Card>
      ) : null}

      <Card className="mb-6">
        <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
          <span>Application readiness (core sections 01–08)</span>
          <span className={stats.ready ? "text-emerald-700" : "text-amber-700"}>
            {stats.coreAnswered}/{stats.coreTotal} · {pct}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Funding (09) and Anything else (10) are optional — a parent or sponsor can fill funding later.
          {savedAt ? ` Last saved ${new Date(savedAt).toLocaleString("en-AU")}.` : ""}
        </p>
        {stats.ready ? (
          <p className="mt-2 text-sm font-semibold text-emerald-800">
            Application readiness: complete.{" "}
            <Link to="/applications" className="underline">
              Continue to your application journey →
            </Link>
          </p>
        ) : null}
      </Card>

      <div className="space-y-8">
        {SOP_SECTIONS.map((sec) => (
          <section key={sec.id}>
            <h2 className="text-lg font-bold text-slate-900">{sec.title}</h2>
            {sec.intro ? <p className="mt-1 text-sm italic text-slate-500">{sec.intro}</p> : null}
            <div className="mt-4 space-y-5">
              {sec.questions.map((q) => (
                <div key={q.id}>
                  <label className="block text-sm font-semibold text-slate-800">
                    {q.q}
                    {q.core ? null : <span className="ml-2 text-xs font-normal text-slate-400">optional</span>}
                  </label>
                  {q.hint ? <p className="mt-0.5 text-xs text-slate-500">{q.hint}</p> : null}
                  <Textarea
                    className="mt-1.5"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Write in your own words…"
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-4 mt-8 flex justify-end">
        <Button onClick={() => save()} disabled={saving} className="shadow-lg">
          {saving ? <Spinner className="size-4" /> : null}
          Save answers
        </Button>
      </div>
    </div>
  );
}

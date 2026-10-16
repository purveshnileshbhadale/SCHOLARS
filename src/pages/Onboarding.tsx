import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { AU_CITIES, GRADING_OPTIONS, MAJOR_OPTIONS, PRIORITY_OPTIONS, cx } from "../lib/utils";
import { normalizeLinkedInUrl } from "../lib/config";
import { Button, Card, ErrorNote, Field, Input, Select, Spinner } from "../components/ui";

const STEPS = ["About you", "Academics", "English tests", "Budget & preferences", "Resume", "Review"];

export default function Onboarding() {
  const { session, studentProfile, refresh } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState({
    intended_major: "",
    career_goal: "",
    linkedin_url: "",
    class_10_marks: "",
    class_12_marks: "",
    grading_system: "cbse",
    ielts: "",
    toefl: "",
    pte: "",
    sat: "",
    budget_aud_per_year: "",
    needs_scholarship: false,
    preferred_cities: [] as string[],
    priorities_ranked: [] as string[],
    resume_url: "" as string | null,
    resume_label: "",
  });

  useEffect(() => {
    if (studentProfile) {
      const p = studentProfile;
      setF({
        intended_major: p.intended_major ?? "",
        career_goal: p.career_goal ?? "",
        linkedin_url: p.linkedin_url ?? "",
        class_10_marks: p.class_10_marks?.toString() ?? "",
        class_12_marks: p.class_12_marks?.toString() ?? "",
        grading_system: p.grading_system ?? "cbse",
        ielts: p.ielts?.toString() ?? "",
        toefl: p.toefl?.toString() ?? "",
        pte: p.pte?.toString() ?? "",
        sat: p.sat?.toString() ?? "",
        budget_aud_per_year: p.budget_aud_per_year?.toString() ?? "",
        needs_scholarship: p.needs_scholarship ?? false,
        preferred_cities: p.preferred_cities ?? [],
        priorities_ranked: p.priorities_ranked ?? [],
        resume_url: p.resume_url,
        resume_label: p.resume_url ? p.resume_url.split("/").pop() ?? "" : "",
      });
      if (p.is_complete) nav("/dashboard", { replace: true });
    }
  }, [studentProfile, nav]);

  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const valid = useMemo(() => {
    const hasTest = f.ielts !== "" || f.toefl !== "" || f.pte !== "";
    return (
      f.intended_major !== "" &&
      f.career_goal.trim() !== "" &&
      f.class_10_marks !== "" &&
      f.class_12_marks !== "" &&
      hasTest &&
      f.budget_aud_per_year !== "" &&
      Number(f.budget_aud_per_year) > 0 &&
      f.preferred_cities.length >= 1 &&
      f.priorities_ranked.length >= 1 &&
      !!f.resume_url
    );
  }, [f]);

  async function save(): Promise<void> {
    if (!session) return;
    const { error } = await supabase.from("student_profiles").upsert({
      user_id: session.user.id,
      intended_major: f.intended_major || null,
      career_goal: f.career_goal.trim() || null,
      linkedin_url: normalizeLinkedInUrl(f.linkedin_url) || null,
      class_10_marks: num(f.class_10_marks),
      class_12_marks: num(f.class_12_marks),
      grading_system: f.grading_system,
      ielts: num(f.ielts),
      toefl: num(f.toefl),
      pte: num(f.pte),
      sat: num(f.sat),
      budget_aud_per_year: num(f.budget_aud_per_year),
      needs_scholarship: f.needs_scholarship,
      preferred_cities: f.preferred_cities,
      priorities_ranked: f.priorities_ranked,
      resume_url: f.resume_url,
    });
    if (error) throw error;
    await refresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function next(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await save();
      if (step === STEPS.length - 1) nav("/dashboard");
      else setStep(step + 1);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function uploadResume(file: File) {
    if (!session) return;
    setErr(null);
    if (file.size > 5 * 1024 * 1024) return setErr("Resume must be under 5 MB.");
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${session.user.id}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("resumes").upload(path, file, { contentType: file.type });
    if (error) return setErr(error.message);
    setF((s) => ({ ...s, resume_url: path, resume_label: file.name }));
  }

  function toggleCity(c: string) {
    setF((s) => ({
      ...s,
      preferred_cities: s.preferred_cities.includes(c)
        ? s.preferred_cities.filter((x) => x !== c)
        : [...s.preferred_cities, c],
    }));
  }

  function togglePriority(p: string) {
    setF((s) => ({
      ...s,
      priorities_ranked: s.priorities_ranked.includes(p)
        ? s.priorities_ranked.filter((x) => x !== p)
        : [...s.priorities_ranked, p],
    }));
  }

  function movePriority(idx: number, dir: -1 | 1) {
    setF((s) => {
      const arr = [...s.priorities_ranked];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return s;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...s, priorities_ranked: arr };
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tell us about you</h1>
        <p className="mt-1 text-sm text-slate-500">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-emerald-600" : "bg-slate-200")} />
          ))}
        </div>
      </div>

      <form onSubmit={next}>
        <Card className="space-y-5">
          {step === 0 ? (
            <>
              <Field label="Intended major / course">
                <Select value={f.intended_major} onChange={(e) => setF({ ...f, intended_major: e.target.value })} required>
                  <option value="">Choose a course…</option>
                  {MAJOR_OPTIONS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Career goal" hint="one or two lines — where do you want to be in 5 years?">
                <Input
                  value={f.career_goal}
                  onChange={(e) => setF({ ...f, career_goal: e.target.value })}
                  required
                  placeholder="e.g. ML engineer at an Australian tech firm after MS in AI"
                />
              </Field>
              <Field label="LinkedIn profile" hint="optional — shown to your counsellor and the student community">
                <Input
                  type="url"
                  value={f.linkedin_url}
                  onChange={(e) => setF({ ...f, linkedin_url: e.target.value })}
                  placeholder="https://www.linkedin.com/in/your-profile"
                />
              </Field>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Field label="Grading system">
                <Select value={f.grading_system} onChange={(e) => setF({ ...f, grading_system: e.target.value })}>
                  {GRADING_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Class 10 marks" hint="percentage or GPA">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={f.class_10_marks}
                    onChange={(e) => setF({ ...f, class_10_marks: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Class 12 marks" hint="percentage or GPA">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={f.class_12_marks}
                    onChange={(e) => setF({ ...f, class_12_marks: e.target.value })}
                    required
                  />
                </Field>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className="text-sm text-slate-600">Add at least one English test score.</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="IELTS" hint="0–9">
                  <Input type="number" step="0.5" min="0" max="9" value={f.ielts} onChange={(e) => setF({ ...f, ielts: e.target.value })} placeholder="6.5" />
                </Field>
                <Field label="TOEFL iBT" hint="0–120">
                  <Input type="number" min="0" max="120" value={f.toefl} onChange={(e) => setF({ ...f, toefl: e.target.value })} placeholder="79" />
                </Field>
                <Field label="PTE Academic" hint="10–90">
                  <Input type="number" min="10" max="90" value={f.pte} onChange={(e) => setF({ ...f, pte: e.target.value })} placeholder="58" />
                </Field>
              </div>
              <Field label="SAT (optional)">
                <Input type="number" min="400" max="1600" value={f.sat} onChange={(e) => setF({ ...f, sat: e.target.value })} placeholder="1350" />
              </Field>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Field label="Budget (AUD per year, incl. living)" hint="tuition + living you can afford">
                <Input
                  type="number"
                  min="1000"
                  step="500"
                  value={f.budget_aud_per_year}
                  onChange={(e) => setF({ ...f, budget_aud_per_year: e.target.value })}
                  required
                  placeholder="60000"
                />
              </Field>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input
                  type="checkbox"
                  checked={f.needs_scholarship}
                  onChange={(e) => setF({ ...f, needs_scholarship: e.target.checked })}
                  className="size-4 accent-emerald-700"
                />
                I need scholarship support
              </label>
              <div>
                <span className="text-sm font-semibold text-slate-800">Preferred cities (pick at least one)</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AU_CITIES.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => toggleCity(c)}
                      className={cx(
                        "rounded-full border px-3 py-1.5 text-sm font-semibold",
                        f.preferred_cities.includes(c)
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : "border-slate-300 bg-white text-slate-700",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-800">
                  Priorities — pick, then rank them (1 = most important)
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRIORITY_OPTIONS.map((p) => {
                    const idx = f.priorities_ranked.indexOf(p);
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => togglePriority(p)}
                        className={cx(
                          "rounded-full border px-3 py-1.5 text-sm font-semibold",
                          idx >= 0
                            ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                            : "border-slate-300 bg-white text-slate-700",
                        )}
                      >
                        {idx >= 0 ? `${idx + 1}. ` : ""}
                        {p}
                      </button>
                    );
                  })}
                </div>
                {f.priorities_ranked.length > 0 ? (
                  <ol className="mt-3 space-y-1.5">
                    {f.priorities_ranked.map((p, i) => (
                      <li key={p} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        <span className="font-bold text-emerald-800">{i + 1}</span>
                        <span className="grow">{p}</span>
                        <button type="button" aria-label="Up" onClick={() => movePriority(i, -1)} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100">↑</button>
                        <button type="button" aria-label="Down" onClick={() => movePriority(i, 1)} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100">↓</button>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <p className="text-sm text-slate-600">
                Upload your resume (PDF or DOCX, max 5 MB). It's stored privately and shared only with a counsellor you
                book. We never use its contents to change AI instructions.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadResume(file);
                }}
              />
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                {f.resume_url ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-emerald-800">Uploaded: {f.resume_label}</p>
                    <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()}>
                      Replace file
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()}>
                    Choose resume file
                  </Button>
                )}
              </div>
            </>
          ) : null}

          {step === 5 ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Course", f.intended_major],
                ["Career goal", f.career_goal],
                ["Class 10 / 12", `${f.class_10_marks} / ${f.class_12_marks}`],
                ["English", [f.ielts && `IELTS ${f.ielts}`, f.toefl && `TOEFL ${f.toefl}`, f.pte && `PTE ${f.pte}`].filter(Boolean).join(", ")],
                ["Budget", `A$${Number(f.budget_aud_per_year || 0).toLocaleString()}/yr${f.needs_scholarship ? " · needs scholarship" : ""}`],
                ["Cities", f.preferred_cities.join(", ")],
                ["Priorities", f.priorities_ranked.join(" → ")],
                ["Resume", f.resume_label || "—"],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
                  <dd className="mt-0.5 text-slate-900">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <ErrorNote>{err}</ErrorNote>
        </Card>

        <div className="mt-5 flex items-center gap-3">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : null}
          <div className="grow" />
          {saved ? <span className="text-xs font-semibold text-emerald-700">Saved</span> : null}
          <Button type="submit" disabled={busy || (step === STEPS.length - 1 && !valid)}>
            {busy ? <Spinner className="size-4" /> : null}
            {step === STEPS.length - 1 ? "Finish — show my shortlist" : "Save & continue"}
          </Button>
        </div>
        {step === STEPS.length - 1 && !valid ? (
          <p className="mt-2 text-right text-xs text-rose-600">Complete every section to finish.</p>
        ) : null}
      </form>
    </div>
  );
}

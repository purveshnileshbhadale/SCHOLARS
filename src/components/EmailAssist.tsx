import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Button, ErrorNote, Field, Input, Select, Spinner, Textarea } from "./ui";

const COURSE_PURPOSES = [
  "Entry requirements and deadlines",
  "Scholarships and fees",
  "Intake dates and CoE process",
  "Course content and credit transfer",
  "Placements, internships and post-study work",
];
const PROF_PURPOSES = [
  "MS/PhD supervision",
  "Research internship or assistantship",
  "A question about the lab or course",
];

/**
 * Feature 61: per-shortlisted-university email assistance.
 * Drafts with the existing ScholarAI mentor (emaildraft module), lets the
 * student edit, then hands off to Gmail compose. The To: field is left empty
 * on purpose — we never guess official addresses.
 */
export default function EmailAssist({
  uniName,
  course,
  onClose,
}: {
  uniName: string;
  course: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"course" | "professor">("course");
  const [courseVal, setCourseVal] = useState(course);
  const [professor, setProfessor] = useState("");
  const [purpose, setPurpose] = useState(COURSE_PURPOSES[0]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function switchMode(m: "course" | "professor") {
    setMode(m);
    setPurpose(m === "course" ? COURSE_PURPOSES[0] : PROF_PURPOSES[0]);
    setErr(null);
  }

  async function generate() {
    setErr(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("mentor", {
        body: {
          module: "emaildraft",
          payload: {
            university: uniName,
            recipient_type: mode === "course" ? "Course team (admissions)" : "Professor",
            course: courseVal.trim(),
            professor_name: mode === "professor" ? professor.trim() : "",
            purpose,
          },
        },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const bodyJson = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(bodyJson?.error ?? error.message ?? "ScholarAI is unavailable right now.");
      }
      const out = String((data?.output as string) ?? "");
      const sub = out.match(/^\s*SUBJECT:\s*(.+)$/m)?.[1]?.trim() ?? "";
      const bd = out.match(/^\s*BODY:\s*\n?([\s\S]+)$/i)?.[1]?.trim() ?? "";
      setSubject(sub);
      setBody(bd || out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not draft the email.");
    } finally {
      setBusy(false);
    }
  }

  function openGmail() {
    const url =
      `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable (http/non-secure context) */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Email assist — {uniName}</h2>
            <p className="mt-1 text-xs text-slate-500">
              AI drafts it, you own it: edit anything before you send. Nothing is sent from here.
            </p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Button variant={mode === "course" ? "primary" : "ghost"} className="px-4" onClick={() => switchMode("course")}>
              Course team
            </Button>
            <Button variant={mode === "professor" ? "primary" : "ghost"} className="px-4" onClick={() => switchMode("professor")}>
              Professor
            </Button>
          </div>

          <Field label="Course or program">
            <Input value={courseVal} onChange={(e) => setCourseVal(e.target.value)} placeholder="e.g. Master of Computer Science" />
          </Field>

          {mode === "professor" ? (
            <Field label="Professor's name" hint="Confirm the exact spelling on the department page before sending.">
              <Input value={professor} onChange={(e) => setProfessor(e.target.value)} placeholder="e.g. Prof. Alan Nguyen" />
            </Field>
          ) : null}

          <Field label="Purpose">
            <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {(mode === "course" ? COURSE_PURPOSES : PROF_PURPOSES).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>

          <ErrorNote>{err}</ErrorNote>

          <Button onClick={generate} disabled={busy || !courseVal.trim() || (mode === "professor" && !professor.trim())}>
            {busy ? <Spinner className="size-4" /> : null}
            {busy ? "Drafting…" : subject ? "Redraft" : "Draft email"}
          </Button>

          {subject || body ? (
            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              <Field label="Subject">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
              <Field label="Body">
                <Textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={openGmail} disabled={!body.trim()}>
                  Open in Gmail ↗
                </Button>
                <Button variant="ghost" onClick={copyDraft} disabled={!body.trim()}>
                  {copied ? "Copied ✓" : "Copy draft"}
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                Gmail opens with an empty <strong>To:</strong> field — paste the official contact address from the
                university's website. We never guess email addresses.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

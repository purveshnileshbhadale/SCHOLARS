import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { daysLeft, formatDate } from "../lib/deadlines";
import type { DocCategory, LorRequest, LorStatus, StudentDocument } from "../lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Input, PageHeader, Select, Spinner, Textarea } from "../components/ui";

const CATEGORIES: DocCategory[] = ["Passport", "Academic", "English test", "Financial", "Offer letter", "LOR", "Identity", "Other"];
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.zip,image/*,application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;

const LOR_STATUSES: LorStatus[] = ["draft", "requested", "agreed", "submitted", "declined"];
const LOR_STATUS_STYLE: Record<LorStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  requested: "border-sky-200 bg-sky-50 text-sky-800",
  agreed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  submitted: "border-violet-200 bg-violet-50 text-violet-800",
  declined: "border-rose-200 bg-rose-50 text-rose-700",
};

/** Expiry tone: expired / ≤30d red, ≤90d amber, else neutral. */
function expiryTone(expiresOn: string): "expired" | "red" | "amber" | "ok" {
  const d = daysLeft(expiresOn);
  if (d == null) return "ok";
  if (d < 0) return "expired";
  if (d <= 30) return "red";
  if (d <= 90) return "amber";
  return "ok";
}

const TONE_BADGE: Record<string, string> = {
  expired: "border-rose-300 bg-rose-100 text-rose-800",
  red: "border-rose-200 bg-rose-50 text-rose-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  ok: "border-slate-200 bg-slate-50 text-slate-600",
};

function plusYears(dateStr: string, years: number): string | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export default function Documents() {
  const { session, profile } = useAuth();
  const [docs, setDocs] = useState<StudentDocument[]>([]);
  const [lors, setLors] = useState<LorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Upload form
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<DocCategory>("Academic");
  const [docDate, setDocDate] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  // LOR form
  const [showLor, setShowLor] = useState(false);
  const [lor, setLor] = useState({ recommender_name: "", recommender_email: "", relationship: "", due_date: "", notes: "" });

  useEffect(() => {
    (async () => {
      if (!session) return;
      const [{ data: dl }, { data: ll }] = await Promise.all([
        supabase.from("student_documents").select("*").order("created_at", { ascending: false }),
        supabase.from("lor_requests").select("*").order("due_date", { ascending: true, nullsFirst: false }),
      ]);
      setDocs((dl as StudentDocument[]) ?? []);
      setLors((ll as LorRequest[]) ?? []);
      setLoading(false);
    })();
  }, [session]);

  // Auto-fill validity for English tests (~2 yrs) when a test date is chosen.
  useEffect(() => {
    if (category === "English test" && docDate && !expiresOn) setExpiresOn(plusYears(docDate, 2) ?? "");
  }, [category, docDate, expiresOn]);

  const expiring = useMemo(
    () =>
      docs
        .filter((d) => d.expires_on)
        .sort((a, b) => (a.expires_on! < b.expires_on! ? -1 : 1))
        .slice(0, 6),
    [docs],
  );

  function pickFile(f: File | null) {
    setErr(null);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setErr("That file is over the 10 MB limit — compress it or upload a smaller copy.");
      setFile(null);
      return;
    }
    setFile(f);
    if (!label) setLabel(f.name.replace(/\.[a-z0-9]+$/i, ""));
  }

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!session || !file) return;
    setErr(null);
    setBusy("upload");
    setUploadPct(0);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${session.user.id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (upErr) throw new Error(upErr.message);
      setUploadPct(70);
      const { error: insErr } = await supabase.from("student_documents").insert({
        student_id: session.user.id,
        category,
        label: (label || file.name).slice(0, 160),
        file_path: path,
        file_type: file.type || null,
        file_size: file.size,
        doc_date: docDate || null,
        expires_on: expiresOn || null,
      });
      if (insErr) {
        await supabase.storage.from("documents").remove([path]);
        throw new Error(insErr.message);
      }
      setUploadPct(100);
      setFile(null);
      setLabel("");
      setDocDate("");
      setExpiresOn("");
      const inp = document.getElementById("doc-file-input") as HTMLInputElement | null;
      if (inp) inp.value = "";
      const { data } = await supabase.from("student_documents").select("*").order("created_at", { ascending: false });
      setDocs((data as StudentDocument[]) ?? []);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Upload failed");
    } finally {
      setBusy(null);
      setUploadPct(null);
    }
  }

  async function signed(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error) {
      setErr(error.message);
      return null;
    }
    return data.signedUrl;
  }

  async function viewDoc(d: StudentDocument) {
    const url = await signed(d.file_path);
    if (url) window.open(url, "_blank", "noopener");
  }

  async function downloadDoc(d: StudentDocument) {
    const url = await signed(d.file_path);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = d.label;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function deleteDoc(d: StudentDocument) {
    if (!confirm(`Delete "${d.label}"? This removes the file permanently.`)) return;
    setBusy(d.id);
    const { error } = await supabase.storage.from("documents").remove([d.file_path]);
    if (error) setErr(error.message);
    const { error: delErr } = await supabase.from("student_documents").delete().eq("id", d.id);
    if (delErr) setErr(delErr.message);
    else setDocs((cur) => cur.filter((x) => x.id !== d.id));
    setBusy(null);
  }

  async function addLor(e: FormEvent) {
    e.preventDefault();
    if (!session || !lor.recommender_name.trim()) return;
    setBusy("lor");
    setErr(null);
    const { error } = await supabase.from("lor_requests").insert({
      student_id: session.user.id,
      recommender_name: lor.recommender_name.trim(),
      recommender_email: lor.recommender_email.trim() || null,
      relationship: lor.relationship.trim() || null,
      due_date: lor.due_date || null,
      notes: lor.notes.trim() || null,
      status: "draft",
    });
    if (error) setErr(error.message);
    else setLor({ recommender_name: "", recommender_email: "", relationship: "", due_date: "", notes: "" });
    const { data } = await supabase.from("lor_requests").select("*").order("due_date", { ascending: true, nullsFirst: false });
    setLors((data as LorRequest[]) ?? []);
    setBusy(null);
  }

  async function setLorStatus(r: LorRequest, status: LorStatus) {
    setLors((cur) => cur.map((x) => (x.id === r.id ? { ...x, status } : x)));
    const { error } = await supabase.from("lor_requests").update({ status }).eq("id", r.id);
    if (error) setErr(error.message);
  }

  async function deleteLor(r: LorRequest) {
    if (!confirm(`Remove the LOR request for ${r.recommender_name}?`)) return;
    const { error } = await supabase.from("lor_requests").delete().eq("id", r.id);
    if (error) setErr(error.message);
    else setLors((cur) => cur.filter((x) => x.id !== r.id));
  }

  function askEmail(r: LorRequest) {
    const subject = `Letter of recommendation request — ${profile?.name ?? "my"} Australia application`;
    const body = [
      `Dear ${r.recommender_name},`,
      "",
      `I'm applying to Australian universities for my chosen program and would be grateful if you could write a letter of recommendation for me.`,
      "",
      `Relationship: ${r.relationship ?? "(as discussed)"}`,
      r.due_date ? `Needed by: ${formatDate(r.due_date)} (or earlier if possible)` : "",
      "",
      "I'm happy to share my CV, transcripts, statement of purpose and the list of programs I'm applying to.",
      "",
      `Thank you,`,
      profile?.name ?? "A Scholars Abroad student",
    ]
      .filter((l) => l !== "")
      .join("\n");
    const to = r.recommender_email ?? "";
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Document vault & letters"
        subtitle="Upload transcripts, passport and offer letters, track expiry dates, and manage recommendation requests — private to you."
      />
      <ErrorNote>{err}</ErrorNote>

      {/* Feature 16 — expiry tracker */}
      <Card>
        <h2 className="font-bold text-slate-900">Expiry tracker</h2>
        <p className="mt-1 text-sm text-slate-500">
          Passports typically need 6+ months' validity; English test scores are usually considered ~2 years old — confirm
          what your universities accept.
        </p>
        {expiring.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {expiring.map((d) => {
              const tone = expiryTone(d.expires_on!);
              const dl = daysLeft(d.expires_on!);
              return (
                <li key={d.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{d.label}</p>
                      <p className="text-xs text-slate-500">
                        {d.category} · expires {formatDate(d.expires_on!)}
                      </p>
                    </div>
                    <Badge className={TONE_BADGE[tone]}>
                      {tone === "expired" ? "Expired" : `${dl}d`}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No expiry dates yet — add an expiry when uploading a passport or English test report below.
          </p>
        )}
      </Card>

      {/* Feature 15 — document vault */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Your documents</h2>
            <p className="mt-0.5 text-xs text-slate-500">Stored privately in Supabase Storage · 10 MB per file · view links last 1 hour.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{docs.length} file{docs.length === 1 ? "" : "s"}</span>
        </div>

        <form onSubmit={upload} className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-500">
            File
            <input
              id="doc-file-input"
              type="file"
              accept={ACCEPT}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-emerald-800"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Label
            <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Class 12 transcript" />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Category
            <Select className="mt-1" value={category} onChange={(e) => setCategory(e.target.value as DocCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-500">
              Issued / test date
              <Input className="mt-1" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Expires on
              <Input className="mt-1" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
            </label>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={!file || busy === "upload"}>
              {busy === "upload" ? <Spinner className="size-4" /> : null}
              {uploadPct != null ? `Uploading ${uploadPct}%` : "Upload document"}
            </Button>
            {file ? <span className="truncate text-xs text-slate-500">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span> : null}
          </div>
        </form>

        {docs.length === 0 ? (
          <Empty title="No documents yet" body="Upload your passport, transcripts, English test report or offer letters to keep everything in one place." />
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
                <div className="min-w-0 grow">
                  <p className="truncate text-sm font-semibold text-slate-800">{d.label}</p>
                  <p className="text-xs text-slate-500">
                    {d.category} · {d.file_size ? `${(d.file_size / 1024 / 1024).toFixed(1)} MB` : "—"} · added {formatDate(d.created_at)}
                    {d.expires_on ? ` · expires ${formatDate(d.expires_on)}` : ""}
                  </p>
                </div>
                {d.expires_on ? (
                  <Badge className={TONE_BADGE[expiryTone(d.expires_on)]}>
                    {expiryTone(d.expires_on) === "expired" ? "Expired" : `${daysLeft(d.expires_on)}d left`}
                  </Badge>
                ) : null}
                <span className="flex gap-2">
                  <Button variant="ghost" onClick={() => viewDoc(d)} disabled={busy === d.id}>
                    View
                  </Button>
                  <Button variant="ghost" onClick={() => downloadDoc(d)}>
                    Download
                  </Button>
                  <button className="text-xs font-semibold text-rose-600 hover:text-rose-800" onClick={() => deleteDoc(d)}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Feature 17 — LOR tracker */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Letters of recommendation</h2>
            <p className="mt-0.5 text-xs text-slate-500">Track who you asked, when it's due, and what they promised.</p>
          </div>
          <Button onClick={() => setShowLor(!showLor)}>{showLor ? "Close" : "Add recommender"}</Button>
        </div>

        {showLor ? (
          <form onSubmit={addLor} className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <Input
              value={lor.recommender_name}
              onChange={(e) => setLor({ ...lor, recommender_name: e.target.value })}
              placeholder="Recommender name *"
              required
            />
            <Input
              type="email"
              value={lor.recommender_email}
              onChange={(e) => setLor({ ...lor, recommender_email: e.target.value })}
              placeholder="Their email (for the ask draft)"
            />
            <Input
              value={lor.relationship}
              onChange={(e) => setLor({ ...lor, relationship: e.target.value })}
              placeholder="Relationship — e.g. Professor, Manager"
            />
            <Input type="date" value={lor.due_date} onChange={(e) => setLor({ ...lor, due_date: e.target.value })} aria-label="Due date" />
            <div className="sm:col-span-2">
              <Textarea
                value={lor.notes}
                onChange={(e) => setLor({ ...lor, notes: e.target.value })}
                placeholder="Notes: which programs, what they agreed to highlight…"
              />
            </div>
            <div>
              <Button type="submit" disabled={busy === "lor"}>
                {busy === "lor" ? <Spinner className="size-4" /> : null} Save recommender
              </Button>
            </div>
          </form>
        ) : null}

        {lors.length === 0 ? (
          <Empty title="No recommenders yet" body="Add a teacher or manager who can vouch for you — then track their letter through to submission." />
        ) : (
          <ul className="mt-4 space-y-2.5">
            {lors.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200 p-3.5 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{r.recommender_name}</p>
                    <p className="text-xs text-slate-500">
                      {r.relationship ?? "Relationship not set"}
                      {r.recommender_email ? ` · ${r.recommender_email}` : ""}
                    </p>
                    {r.due_date ? (
                      <Badge
                        className={
                          (daysLeft(r.due_date) ?? 999) <= 7
                            ? "mt-1 border-rose-200 bg-rose-50 text-rose-700"
                            : "mt-1 border-slate-200 bg-slate-50 text-slate-600"
                        }
                      >
                        Due {formatDate(r.due_date)} · {daysLeft(r.due_date)}d
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      className="w-32 py-1.5 text-xs"
                      value={r.status}
                      onChange={(e) => setLorStatus(r, e.target.value as LorStatus)}
                      aria-label="LOR status"
                    >
                      {LOR_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Select>
                    <Badge className={LOR_STATUS_STYLE[r.status]}>{r.status}</Badge>
                  </div>
                </div>
                {r.notes ? <p className="mt-2 text-xs text-slate-600">{r.notes}</p> : null}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => askEmail(r)}>
                    ✉ Draft ask email
                  </Button>
                  <button className="text-xs font-semibold text-rose-600" onClick={() => deleteLor(r)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

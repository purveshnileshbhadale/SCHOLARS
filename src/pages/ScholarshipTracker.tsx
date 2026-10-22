import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { ScholarshipApplication, ScholarshipAppStatus } from "../lib/types";
import { money } from "../lib/utils";
import { Badge, Button, Card, DeadlineChip, Empty, ErrorNote, Input, PageHeader, Select, Spinner, Textarea, Toast } from "../components/ui";
import { cx } from "../lib/utils";

const STATUSES: ScholarshipAppStatus[] = ["saved", "drafting", "submitted", "shortlisted", "awarded", "rejected", "expired"];

const STATUS_META: Record<ScholarshipAppStatus, { label: string; cls: string }> = {
  saved: { label: "Saved", cls: "border-slate-200 bg-slate-50 text-slate-700" },
  drafting: { label: "Drafting", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  submitted: { label: "Submitted", cls: "border-sky-200 bg-sky-50 text-sky-800" },
  shortlisted: { label: "Shortlisted", cls: "border-violet-200 bg-violet-50 text-violet-800" },
  awarded: { label: "Awarded", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  rejected: { label: "Rejected", cls: "border-rose-200 bg-rose-50 text-rose-800" },
  expired: { label: "Expired", cls: "border-slate-300 bg-slate-100 text-slate-500" },
};

const PIPELINE: ScholarshipAppStatus[] = ["saved", "drafting", "submitted", "shortlisted"];

interface NewApp {
  scholarship_name: string;
  provider: string;
  amount_aud: string;
  deadline: string;
  notes: string;
}

const EMPTY_NEW: NewApp = { scholarship_name: "", provider: "", amount_aud: "", deadline: "", notes: "" };

/** Workflow tracker for scholarship applications: saved → drafting → submitted → outcome. */
export default function ScholarshipTracker() {
  const { session, studentProfile } = useAuth();
  const [rows, setRows] = useState<ScholarshipApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<NewApp>(EMPTY_NEW);
  const [filter, setFilter] = useState<ScholarshipAppStatus | "all">("all");

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from("scholarship_applications")
      .select("*")
      .eq("student_id", session.user.id)
      .order("deadline", { ascending: true, nullsFirst: false })
      .order("sort_order");
    if (error) setErr(error.message);
    setRows((data as ScholarshipApplication[]) ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.scholarship_name.trim()) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase
      .from("scholarship_applications")
      .insert({
        student_id: session!.user.id,
        scholarship_name: form.scholarship_name.trim(),
        provider: form.provider.trim() || null,
        amount_aud: form.amount_aud ? Number(form.amount_aud) : null,
        deadline: form.deadline || null,
        notes: form.notes.trim() || null,
        status: "saved",
      })
      .select()
      .single();
    if (error) setErr(error.message);
    else {
      setRows((r) => [...r, data as ScholarshipApplication]);
      setForm(EMPTY_NEW);
      setShowAdd(false);
      setToast("Scholarship added");
    }
    setBusy(false);
  }

  async function setStatus(id: string, status: ScholarshipAppStatus) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    const patch: Record<string, unknown> = { status };
    if (status === "submitted") patch.submitted_at = new Date().toISOString();
    if (status === "awarded" || status === "rejected") patch.outcome_at = new Date().toISOString();
    const { error } = await supabase.from("scholarship_applications").update(patch).eq("id", id);
    if (error) setErr(error.message);
  }

  async function remove(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    const { error } = await supabase.from("scholarship_applications").delete().eq("id", id);
    if (error) setErr(error.message);
  }

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = rows.filter((r) => r.status === s).length;
    return acc;
  }, {});

  const awardedTotal = rows.filter((r) => r.status === "awarded").reduce((sum, r) => sum + (r.amount_aud ?? 0), 0);

  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Scholarship tracker"
        subtitle="Track every scholarship from saved to awarded — deadlines, submissions and outcomes in one pipeline."
        right={
          <Button onClick={() => setShowAdd((v) => !v)} className="text-xs">
            {showAdd ? "Close" : "+ Add scholarship"}
          </Button>
        }
      />
      <ErrorNote>{err}</ErrorNote>
      <Toast message={toast} />

      {/* Pipeline summary */}
      {rows.length > 0 ? (
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PIPELINE.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? "all" : s)}
              className={cx(
                "rounded-2xl border px-3 py-2.5 text-left transition",
                filter === s ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200" : "border-slate-200/70 bg-white/85 hover:border-emerald-300",
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{STATUS_META[s].label}</p>
              <p className="text-2xl font-extrabold text-slate-900">{counts[s] ?? 0}</p>
            </button>
          ))}
        </div>
      ) : null}

      {awardedTotal > 0 ? (
        <Card className="mb-6 border-emerald-200/70 bg-gradient-to-r from-emerald-50 to-teal-50/60">
          <p className="text-sm font-semibold text-emerald-900">
            Total awarded: <span className="text-2xl font-extrabold">{money(awardedTotal)}</span>
            <span className="text-sm font-normal"> /yr across {rows.filter((r) => r.status === "awarded").length} scholarship(s)</span>
          </p>
        </Card>
      ) : null}

      {/* Add form */}
      {showAdd ? (
        <Card className="mb-6">
          <h3 className="mb-3 font-bold text-slate-900">Add a scholarship</h3>
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Scholarship name *</span>
              <Input
                value={form.scholarship_name}
                onChange={(e) => setForm({ ...form, scholarship_name: e.target.value })}
                placeholder="e.g. Vice-Chancellor's Merit Scholarship"
                required
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Provider / university</span>
              <Input
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                placeholder="e.g. University of Melbourne"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Amount (AUD/yr)</span>
              <Input
                type="number"
                min={0}
                value={form.amount_aud}
                onChange={(e) => setForm({ ...form, amount_aud: e.target.value })}
                placeholder="e.g. 10000"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Deadline</span>
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="mt-1" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Notes</span>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Eligibility criteria, documents needed, essay prompts…"
                className="mt-1 min-h-20"
              />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy || !form.scholarship_name.trim()}>
                {busy ? "Adding…" : "Add to tracker"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {/* Filter chips */}
      {rows.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={cx(
              "rounded-full border px-3 py-1 text-xs font-bold transition",
              filter === "all" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white/70 text-slate-600",
            )}
          >
            All ({rows.length})
          </button>
          {STATUSES.filter((s) => (counts[s] ?? 0) > 0).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? "all" : s)}
              className={cx(
                "rounded-full border px-3 py-1 text-xs font-bold transition",
                filter === s ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white/70 text-slate-600",
              )}
            >
              {STATUS_META[s].label} ({counts[s]})
            </button>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Empty
          title="No scholarships tracked yet"
          body="Add every scholarship you plan to apply for. The tracker keeps deadlines, submission status and outcomes in one place."
          action={
            <>
              <Button onClick={() => setShowAdd(true)}>Add your first scholarship</Button>
              <Link to="/scholarships" className="ml-2">
                <Button variant="ghost">Browse scholarships</Button>
              </Link>
            </>
          }
        />
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-slate-900">{r.scholarship_name}</h3>
                  <Badge className={STATUS_META[r.status].cls}>{STATUS_META[r.status].label}</Badge>
                  {r.deadline ? <DeadlineChip date={r.deadline} /> : null}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {r.provider ?? "—"}
                  {r.amount_aud ? ` · ${money(r.amount_aud)}/yr` : ""}
                  {r.submitted_at ? ` · submitted ${new Date(r.submitted_at).toLocaleDateString("en-AU")}` : ""}
                  {r.outcome_at ? ` · outcome ${new Date(r.outcome_at).toLocaleDateString("en-AU")}` : ""}
                </p>
                {r.notes ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-slate-600">{r.notes}</p> : null}
                {r.doc_url ? (
                  <a
                    href={r.doc_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Supporting document ↗
                  </a>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Select
                  className="w-36 text-xs"
                  value={r.status}
                  onChange={(e) => setStatus(r.id, e.target.value as ScholarshipAppStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </Select>
                <button
                  onClick={() => remove(r.id)}
                  title="Remove"
                  className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-500 transition hover:border-rose-400 hover:text-rose-700"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Tip: cross-check deadlines on the <Link to="/deadlines" className="font-semibold text-emerald-700 hover:underline">Deadlines</Link> page — it
        pulls from applications, bookings and scholarships together.
        {studentProfile?.intended_major ? ` You're tracking for ${studentProfile.intended_major}.` : null}
      </p>
    </div>
  );
}

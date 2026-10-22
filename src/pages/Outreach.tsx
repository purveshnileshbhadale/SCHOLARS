import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { OutreachContact, OutreachStatus } from "../lib/types";
import { Badge, Button, Card, DeadlineChip, Empty, ErrorNote, Input, PageHeader, Select, Spinner, Textarea, Toast } from "../components/ui";
import { cx } from "../lib/utils";

const STATUSES: OutreachStatus[] = ["to_contact", "drafted", "sent", "replied", "meeting_booked", "closed"];

const STATUS_META: Record<OutreachStatus, { label: string; cls: string }> = {
  to_contact: { label: "To contact", cls: "border-slate-200 bg-slate-50 text-slate-700" },
  drafted: { label: "Drafted", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  sent: { label: "Sent", cls: "border-sky-200 bg-sky-50 text-sky-800" },
  replied: { label: "Replied", cls: "border-violet-200 bg-violet-50 text-violet-800" },
  meeting_booked: { label: "Meeting booked", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  closed: { label: "Closed", cls: "border-slate-300 bg-slate-100 text-slate-500" },
};

const PIPELINE: OutreachStatus[] = ["to_contact", "drafted", "sent", "replied", "meeting_booked"];

interface NewContact {
  name: string;
  institution: string;
  department: string;
  email: string;
  research_area: string;
  follow_up_at: string;
  notes: string;
}

const EMPTY: NewContact = { name: "", institution: "", department: "", email: "", research_area: "", follow_up_at: "", notes: "" };

/** Cold-email pipeline for professors, researchers and alumni. */
export default function Outreach() {
  const { session } = useAuth();
  const [rows, setRows] = useState<OutreachContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<NewContact>(EMPTY);
  const [filter, setFilter] = useState<OutreachStatus | "all">("all");
  const [notesId, setNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from("outreach_contacts")
      .select("*")
      .eq("student_id", session.user.id)
      .order("follow_up_at", { ascending: true, nullsFirst: false })
      .order("sort_order");
    if (error) setErr(error.message);
    setRows((data as OutreachContact[]) ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase
      .from("outreach_contacts")
      .insert({
        student_id: session!.user.id,
        name: form.name.trim(),
        institution: form.institution.trim() || null,
        department: form.department.trim() || null,
        email: form.email.trim() || null,
        research_area: form.research_area.trim() || null,
        follow_up_at: form.follow_up_at || null,
        notes: form.notes.trim() || null,
        status: "to_contact",
      })
      .select()
      .single();
    if (error) setErr(error.message);
    else {
      setRows((r) => [...r, data as OutreachContact]);
      setForm(EMPTY);
      setShowAdd(false);
      setToast("Contact added");
    }
    setBusy(false);
  }

  async function setStatus(id: string, status: OutreachStatus) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    const patch: Record<string, unknown> = { status };
    if (status === "sent") patch.last_contacted_at = new Date().toISOString();
    const { error } = await supabase.from("outreach_contacts").update(patch).eq("id", id);
    if (error) setErr(error.message);
  }

  async function saveNotes(id: string) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, notes: notesDraft } : x)));
    const { error } = await supabase.from("outreach_contacts").update({ notes: notesDraft }).eq("id", id);
    if (error) setErr(error.message);
    else setToast("Notes saved");
    setNotesId(null);
  }

  async function remove(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    const { error } = await supabase.from("outreach_contacts").delete().eq("id", id);
    if (error) setErr(error.message);
  }

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = rows.filter((r) => r.status === s).length;
    return acc;
  }, {});

  const replyRate = counts.sent ? Math.round(((counts.replied ?? 0) + (counts.meeting_booked ?? 0)) / (counts.sent + (counts.replied ?? 0) + (counts.meeting_booked ?? 0)) * 100) : 0;

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
        title="Outreach tracker"
        subtitle="Pipeline for cold-emailing professors, researchers and alumni — from drafted to meeting booked."
        right={
          <Button onClick={() => setShowAdd((v) => !v)} className="text-xs">
            {showAdd ? "Close" : "+ Add contact"}
          </Button>
        }
      />
      <ErrorNote>{err}</ErrorNote>
      <Toast message={toast} />

      {/* Pipeline summary */}
      {rows.length > 0 ? (
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
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

      {counts.sent ? (
        <Card className="mb-6 border-sky-200/70 bg-gradient-to-r from-sky-50 to-cyan-50/60">
          <p className="text-sm text-slate-700">
            Reply rate: <span className="text-xl font-extrabold text-sky-900">{replyRate}%</span> —{" "}
            {counts.sent} sent, {counts.replied ?? 0} replied, {counts.meeting_booked ?? 0} meetings booked. Follow up after 7–10 days if no reply.
          </p>
        </Card>
      ) : null}

      {/* Add form */}
      {showAdd ? (
        <Card className="mb-6">
          <h3 className="mb-3 font-bold text-slate-900">Add a contact</h3>
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Name *</span>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dr. Jane Smith" required className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Institution</span>
              <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="e.g. UNSW Sydney" className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Department</span>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Computer Science & Engineering" className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Email</span>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane.smith@unsw.edu.au" className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Research area</span>
              <Input value={form.research_area} onChange={(e) => setForm({ ...form, research_area: e.target.value })} placeholder="e.g. edge AI, federated learning" className="mt-1" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Follow-up date</span>
              <Input type="date" value={form.follow_up_at} onChange={(e) => setForm({ ...form, follow_up_at: e.target.value })} className="mt-1" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Notes</span>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Why you're reaching out, paper you read, mutual connection…" className="mt-1 min-h-20" />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy || !form.name.trim()}>
                {busy ? "Adding…" : "Add contact"}
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
          title="No outreach contacts yet"
          body="Track every professor, researcher or alumni you email. Set a follow-up date and never lose a thread."
          action={
            <>
              <Button onClick={() => setShowAdd(true)}>Add a contact</Button>
              <Link to="/mentor" className="ml-2">
                <Button variant="ghost">Draft an email with ScholarAI</Button>
              </Link>
            </>
          }
        />
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const overdue = r.follow_up_at && r.status !== "closed" && r.status !== "meeting_booked" && new Date(r.follow_up_at) < new Date();
            return (
              <Card key={r.id} className={cx(overdue && "border-amber-300 ring-1 ring-amber-200")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">{r.name}</h3>
                      <Badge className={STATUS_META[r.status].cls}>{STATUS_META[r.status].label}</Badge>
                      {r.follow_up_at ? <DeadlineChip date={r.follow_up_at} /> : null}
                      {overdue ? <Badge className="border-amber-300 bg-amber-50 text-amber-800">Follow-up overdue</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[r.institution, r.department].filter(Boolean).join(" · ") || "—"}
                      {r.email ? ` · ${r.email}` : ""}
                    </p>
                    {r.research_area ? (
                      <p className="mt-1 text-xs text-slate-600">
                        <span className="font-semibold">Research:</span> {r.research_area}
                      </p>
                    ) : null}
                    {r.last_contacted_at ? (
                      <p className="mt-0.5 text-[11px] text-slate-400">Last contacted {new Date(r.last_contacted_at).toLocaleDateString("en-AU")}</p>
                    ) : null}
                    {r.notes ? <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{r.notes}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select className="w-36 text-xs" value={r.status} onChange={(e) => setStatus(r.id, e.target.value as OutreachStatus)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </Select>
                    <button
                      onClick={() => {
                        setNotesId(notesId === r.id ? null : r.id);
                        setNotesDraft(r.notes ?? "");
                      }}
                      title="Edit notes"
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-emerald-400 hover:text-emerald-700"
                    >
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
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
                </div>

                {notesId === r.id ? (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <Textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} className="min-h-20 text-sm" placeholder="Meeting notes, paper discussed, next step…" />
                    <div className="mt-2 flex gap-2">
                      <Button className="text-xs" onClick={() => saveNotes(r.id)}>
                        Save notes
                      </Button>
                      <Button variant="ghost" className="text-xs" onClick={() => setNotesId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {r.email && r.status === "to_contact" ? (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <a
                      href={`mailto:${r.email}?subject=${encodeURIComponent(`Prospective student enquiry — ${r.research_area ?? "research opportunity"}`)}`}
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      Draft email in mail client ↗
                    </a>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Tip: use <Link to="/mentor" className="font-semibold text-emerald-700 hover:underline">ScholarAI</Link> to draft the professor email, then log the contact here
        with a follow-up date 7–10 days out. Consistency beats volume — 10 well-researched emails beat 100 generic ones.
      </p>
    </div>
  );
}

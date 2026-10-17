import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Scholarship, University } from "../../lib/types";
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner } from "../../components/ui";

type Row = Scholarship & { universities?: { name?: string } | null };

const EMPTY: Partial<Scholarship> = {
  name: "",
  university_id: "",
  amount: "",
  amount_aud: null,
  coverage: "",
  eligibility: "",
  deadline: "",
  url: "",
  study_level: "both",
  category: "both",
  international_eligible: true,
};

/** Admin power: create, edit and delete scholarships from the UI. */
export default function AdminScholarships() {
  const [rows, setRows] = useState<Row[]>([]);
  const [unis, setUnis] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<Scholarship> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: sc }, { data: u }] = await Promise.all([
      supabase.from("scholarships").select("*, universities(name)").order("name"),
      supabase.from("universities").select("id, name").order("name"),
    ]);
    setRows((sc as Row[]) ?? []);
    setUnis((u as University[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!editing?.name?.trim()) return;
    setBusy(true);
    setErr(null);
    const payload = {
      name: editing.name.trim(),
      university_id: editing.university_id || null,
      amount: editing.amount?.trim() || null,
      amount_aud: editing.amount_aud ?? null,
      coverage: editing.coverage?.trim() || null,
      eligibility: editing.eligibility?.trim() || null,
      deadline: editing.deadline?.trim() || null,
      url: editing.url?.trim() || null,
      study_level: editing.study_level ?? "both",
      category: editing.category ?? "both",
      international_eligible: editing.international_eligible ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("scholarships").update(payload).eq("id", editing.id)
      : await supabase.from("scholarships").insert(payload);
    if (error) setErr(error.message);
    else {
      setEditing(null);
      await load();
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this scholarship?")) return;
    setErr(null);
    const { error } = await supabase.from("scholarships").delete().eq("id", id);
    if (error) setErr(error.message);
    else await load();
  }

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          (r.universities?.name ?? "").toLowerCase().includes(needle) ||
          (r.eligibility ?? "").toLowerCase().includes(needle),
      )
    : rows;

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Scholarships"
        subtitle="Add, edit or remove scholarship records — students see changes immediately."
        right={
          <Button
            onClick={() => {
              setErr(null);
              setEditing({ ...EMPTY });
            }}
          >
            New scholarship
          </Button>
        }
      />
      <ErrorNote>{err}</ErrorNote>

      {editing ? (
        <Card className="mb-6">
          <h2 className="font-bold text-slate-900">{editing.id ? "Edit" : "New"} scholarship</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Vice-Chancellor's Merit Award" />
            </Field>
            <Field label="University">
              <Select value={editing.university_id ?? ""} onChange={(e) => setEditing({ ...editing, university_id: e.target.value })}>
                <option value="">— none / open —</option>
                {unis.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount (text)">
              <Input value={editing.amount ?? ""} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} placeholder="AUD 10,000/yr" />
            </Field>
            <Field label="Amount (AUD number)">
              <Input
                inputMode="numeric"
                value={editing.amount_aud ?? ""}
                onChange={(e) => setEditing({ ...editing, amount_aud: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="10000"
              />
            </Field>
            <Field label="Coverage">
              <Input value={editing.coverage ?? ""} onChange={(e) => setEditing({ ...editing, coverage: e.target.value })} placeholder="Tuition partial" />
            </Field>
            <Field label="Deadline">
              <Input value={editing.deadline ?? ""} onChange={(e) => setEditing({ ...editing, deadline: e.target.value })} placeholder="2026-03-31" />
            </Field>
            <Field label="Study level">
              <Select value={editing.study_level ?? "both"} onChange={(e) => setEditing({ ...editing, study_level: e.target.value as Scholarship["study_level"] })}>
                <option value="ug">Undergraduate</option>
                <option value="pg">Postgraduate</option>
                <option value="both">Both</option>
              </Select>
            </Field>
            <Field label="Category">
              <Select value={editing.category ?? "both"} onChange={(e) => setEditing({ ...editing, category: e.target.value as Scholarship["category"] })}>
                <option value="merit">Merit</option>
                <option value="need">Need</option>
                <option value="both">Both</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Eligibility notes">
                <Input value={editing.eligibility ?? ""} onChange={(e) => setEditing({ ...editing, eligibility: e.target.value })} placeholder="International students, 85%+ average…" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Official URL">
                <Input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://…" />
              </Field>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 text-emerald-600"
                checked={editing.international_eligible ?? true}
                onChange={(e) => setEditing({ ...editing, international_eligible: e.target.checked })}
              />
              Open to international students
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={busy || !editing.name?.trim()}>
              {busy ? "Saving…" : "Save scholarship"}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <Input className="mb-4 max-w-72" placeholder="Search scholarships…" value={q} onChange={(e) => setQ(e.target.value)} />

      <Card>
        {shown.length === 0 ? (
          <p className="text-sm text-slate-500">No scholarships{needle ? " match" : " yet"}.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{r.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.universities?.name ?? "Open"}
                    {r.amount ? ` · ${r.amount}` : r.amount_aud != null ? ` · AUD ${r.amount_aud}` : ""}
                    {r.deadline ? ` · deadline ${r.deadline}` : ""}
                    {!r.international_eligible ? " · domestic only" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" onClick={() => { setErr(null); setEditing(r); }}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => remove(r.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

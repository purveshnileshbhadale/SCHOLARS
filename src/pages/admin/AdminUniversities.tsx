import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { University } from "../../lib/types";
import { money } from "../../lib/utils";
import { Button, Card, ErrorNote, Field, Input, PageHeader, Spinner } from "../../components/ui";

export default function AdminUniversities() {
  const [rows, setRows] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<University> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(search = "") {
    setLoading(true);
    let query = supabase.from("universities").select("*").order("qs_rank", { ascending: true, nullsFirst: false }).limit(200);
    if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);
    const { data } = await query;
    setRows((data as University[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function search(e: React.FormEvent) {
    e.preventDefault();
    load(q);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    const rec = { ...editing, updated_at: new Date().toISOString() };
    const { error } = editing.id
      ? await supabase.from("universities").update(rec).eq("id", editing.id)
      : await supabase.from("universities").insert(rec);
    if (error) setErr(error.message);
    else {
      setEditing(null);
      load(q);
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this university?")) return;
    const { error } = await supabase.from("universities").delete().eq("id", id);
    if (error) setErr(error.message);
    else load(q);
  }

  const total = useMemo(() => rows.length, [rows]);

  return (
    <div>
      <PageHeader
        title="Universities"
        subtitle={`${total} shown (max 200). Australia-only data — country column ready for future markets.`}
        right={<Button onClick={() => setEditing({ country: "Australia", confidence: "medium", intakes: [] })}>Add university</Button>}
      />
      <form onSubmit={search} className="mb-4 flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or city…" className="max-w-sm" />
        <Button variant="ghost" type="submit">
          Search
        </Button>
      </form>
      <ErrorNote>{err}</ErrorNote>

      {editing ? (
        <Card className="mb-6">
          <h2 className="font-bold text-slate-900">{editing.id ? "Edit" : "New"} university</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name">
              <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Country">
              <Input value={editing.country ?? "Australia"} onChange={(e) => setEditing({ ...editing, country: e.target.value })} />
            </Field>
            <Field label="City">
              <Input value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Input value={editing.state ?? ""} onChange={(e) => setEditing({ ...editing, state: e.target.value })} />
            </Field>
            <Field label="QS rank">
              <Input type="number" value={editing.qs_rank ?? ""} onChange={(e) => setEditing({ ...editing, qs_rank: Number(e.target.value) })} />
            </Field>
            <Field label="THE rank">
              <Input type="number" value={editing.the_rank ?? ""} onChange={(e) => setEditing({ ...editing, the_rank: Number(e.target.value) })} />
            </Field>
            <Field label="CS subject rank">
              <Input type="number" value={editing.cs_subject_rank ?? ""} onChange={(e) => setEditing({ ...editing, cs_subject_rank: Number(e.target.value) })} />
            </Field>
            <Field label="Tuition (AUD/yr)">
              <Input type="number" value={editing.tuition_aud ?? ""} onChange={(e) => setEditing({ ...editing, tuition_aud: Number(e.target.value) })} />
            </Field>
            <Field label="Living cost (AUD/yr)">
              <Input type="number" value={editing.living_cost_aud ?? ""} onChange={(e) => setEditing({ ...editing, living_cost_aud: Number(e.target.value) })} />
            </Field>
            <Field label="IELTS min">
              <Input type="number" step="0.5" value={editing.ielts_min ?? ""} onChange={(e) => setEditing({ ...editing, ielts_min: Number(e.target.value) })} />
            </Field>
            <Field label="TOEFL min">
              <Input type="number" value={editing.toefl_min ?? ""} onChange={(e) => setEditing({ ...editing, toefl_min: Number(e.target.value) })} />
            </Field>
            <Field label="PTE min">
              <Input type="number" value={editing.pte_min ?? ""} onChange={(e) => setEditing({ ...editing, pte_min: Number(e.target.value) })} />
            </Field>
            <Field label="Intakes" hint="comma-separated: Feb,Jul">
              <Input
                value={(editing.intakes ?? []).join(",")}
                onChange={(e) => setEditing({ ...editing, intakes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            </Field>
            <Field label="PSW years">
              <Input type="number" step="0.5" value={editing.post_study_work_years ?? ""} onChange={(e) => setEditing({ ...editing, post_study_work_years: Number(e.target.value) })} />
            </Field>
            <Field label="Confidence">
              <Input value={editing.confidence ?? "medium"} onChange={(e) => setEditing({ ...editing, confidence: e.target.value })} />
            </Field>
            <Field label="Min academic requirement">
              <Input value={editing.min_academic_requirement ?? ""} onChange={(e) => setEditing({ ...editing, min_academic_requirement: e.target.value })} />
            </Field>
            <Field label="CS highlights">
              <Input value={editing.cs_program_highlights ?? ""} onChange={(e) => setEditing({ ...editing, cs_program_highlights: e.target.value })} />
            </Field>
            <Field label="Data year">
              <Input type="number" value={editing.data_year ?? ""} onChange={(e) => setEditing({ ...editing, data_year: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={busy || !editing.name || !editing.city}>
              {busy ? <Spinner className="size-4" /> : null}Save
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">QS</th>
              <th className="px-4 py-3">Tuition</th>
              <th className="px-4 py-3">IELTS</th>
              <th className="px-4 py-3">Conf.</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <Spinner />
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{u.name}</td>
                  <td className="px-4 py-2.5">{u.city}</td>
                  <td className="px-4 py-2.5">{u.qs_rank ?? "—"}</td>
                  <td className="px-4 py-2.5">{money(u.tuition_aud)}</td>
                  <td className="px-4 py-2.5">{u.ielts_min ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{u.confidence}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button className="mr-3 font-semibold text-emerald-800" onClick={() => setEditing(u)}>
                      Edit
                    </button>
                    <button className="font-semibold text-rose-600" onClick={() => remove(u.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

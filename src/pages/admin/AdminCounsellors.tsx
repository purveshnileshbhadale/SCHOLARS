import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import type { Counsellor, Profile } from "../../lib/types";
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner, Textarea } from "../../components/ui";

export default function AdminCounsellors() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [counsellors, setCounsellors] = useState<Counsellor[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ user_id: "", display_name: "", bio: "", specialisation: "", price_inr: "9999" });

  async function load() {
    const [{ data: u }, { data: c }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("counsellors").select("*, profiles(id, name, email)"),
    ]);
    setUsers((u as Profile[]) ?? []);
    setCounsellors((c as unknown as Counsellor[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setRole(userId: string, role: string) {
    setErr(null);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
    if (error) {
      setErr(error.message);
      return;
    }
    // Promoting to counsellor also creates the bookable row (otherwise the
    // student search page stays empty after a role change).
    if (role === "counsellor" && !counsellors.some((c) => c.user_id === userId)) {
      const u = users.find((x) => x.id === userId);
      const { error: insErr } = await supabase.from("counsellors").insert({
        user_id: userId,
        display_name: u?.name || u?.email?.split("@")[0] || null,
        price_inr: 9999,
        is_active: true,
      });
      if (insErr) setErr(insErr.message);
    }
    load();
  }

  async function addCounsellor(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { error: roleErr } = await supabase.from("profiles").update({ role: "counsellor" }).eq("id", form.user_id);
      if (roleErr) throw roleErr;
      const { error } = await supabase.from("counsellors").insert({
        user_id: form.user_id,
        display_name: form.display_name || null,
        bio: form.bio || null,
        specialisation: form.specialisation || null,
        price_inr: Number(form.price_inr) || 0,
      });
      if (error) throw error;
      setForm({ user_id: "", display_name: "", bio: "", specialisation: "", price_inr: "9999" });
      load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateCounsellor(c: Counsellor, patch: Partial<Counsellor>) {
    const { error } = await supabase.from("counsellors").update(patch).eq("id", c.id);
    if (error) setErr(error.message);
    load();
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  const withoutProfile = users.filter(
    (u) => u.role === "counsellor" && !counsellors.some((c) => c.user_id === u.id),
  );

  return (
    <div>
      <PageHeader title="Counsellors" subtitle="Promote users to counsellor, manage bio, specialisation and pricing." />
      <ErrorNote>{err}</ErrorNote>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold text-slate-900">Active counsellors</h2>
          <ul className="mt-3 space-y-3">
            {counsellors.map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{c.profiles?.name ?? c.user_id}</p>
                    <p className="text-xs text-slate-500">{c.profiles?.email}</p>
                  </div>
                  <Badge className={c.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-600"}>
                    {c.is_active ? "active" : "inactive"}
                  </Badge>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Input
                    value={c.display_name ?? ""}
                    placeholder="Display name (shown to students)"
                    onChange={(e) => setCounsellors(counsellors.map((x) => (x.id === c.id ? { ...x, display_name: e.target.value } : x)))}
                    onBlur={() => updateCounsellor(c, { display_name: c.display_name })}
                  />
                  <Input
                    value={c.specialisation ?? ""}
                    placeholder="Specialisation"
                    onChange={(e) => setCounsellors(counsellors.map((x) => (x.id === c.id ? { ...x, specialisation: e.target.value } : x)))}
                    onBlur={() => updateCounsellor(c, { specialisation: c.specialisation })}
                  />
                  <Input
                    type="number"
                    value={c.price_inr}
                    placeholder="Price INR"
                    onChange={(e) => setCounsellors(counsellors.map((x) => (x.id === c.id ? { ...x, price_inr: Number(e.target.value) } : x)))}
                    onBlur={() => updateCounsellor(c, { price_inr: c.price_inr })}
                  />
                </div>
                <Textarea
                  className="mt-2"
                  value={c.bio ?? ""}
                  placeholder="Bio"
                  onChange={(e) => setCounsellors(counsellors.map((x) => (x.id === c.id ? { ...x, bio: e.target.value } : x)))}
                  onBlur={() => updateCounsellor(c, { bio: c.bio })}
                />
                <Button variant="ghost" className="mt-2" onClick={() => updateCounsellor(c, { is_active: !c.is_active })}>
                  {c.is_active ? "Deactivate" : "Activate"}
                </Button>
              </li>
            ))}
            {counsellors.length === 0 ? <p className="text-sm text-slate-500">No counsellors yet.</p> : null}
          </ul>

          {withoutProfile.length ? (
            <form onSubmit={addCounsellor} className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="font-bold text-slate-900">Create counsellor profile</h3>
              <div className="mt-3 space-y-3">
                <Field label="User">
                  <Select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} required>
                    <option value="">Choose a counsellor-role user…</option>
                    {withoutProfile.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name ?? u.email}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Display name">
                  <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Shown to students (defaults to profile name)" />
                </Field>
                <Field label="Specialisation">
                  <Input value={form.specialisation} onChange={(e) => setForm({ ...form, specialisation: e.target.value })} placeholder="e.g. MS CS & Australia admissions" />
                </Field>
                <Field label="Price (INR)">
                  <Input type="number" value={form.price_inr} onChange={(e) => setForm({ ...form, price_inr: e.target.value })} />
                </Field>
                <Field label="Bio">
                  <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
                </Field>
                <Button type="submit" disabled={busy}>
                  {busy ? <Spinner className="size-4" /> : null}Create
                </Button>
              </div>
            </form>
          ) : null}
        </Card>

        <Card>
          <h2 className="font-bold text-slate-900">All users</h2>
          <p className="mt-1 text-sm text-slate-500">Set role changes here. New signups are students by default.</p>
          <ul className="mt-3 max-h-[600px] space-y-2 overflow-y-auto">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <div className="grow">
                  <p className="font-semibold text-slate-900">{u.name ?? "—"}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <Select
                  className="w-32 py-1.5"
                  value={u.role}
                  onChange={(e) => setRole(u.id, e.target.value)}
                >
                  <option value="student">student</option>
                  <option value="counsellor">counsellor</option>
                  <option value="admin">admin</option>
                </Select>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

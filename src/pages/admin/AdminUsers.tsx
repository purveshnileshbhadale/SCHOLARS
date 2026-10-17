import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { Profile, Role } from "../../lib/types";
import { Card, ErrorNote, Input, PageHeader, Select, Spinner } from "../../components/ui";

const ROLES: Role[] = ["student", "counsellor", "admin"];

/** Admin power: full user list with instant role switching (student/counsellor/admin). */
export default function AdminUsers() {
  const { profile: me } = useAuth();
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, role, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) setErr(error.message);
      setRows((data as Profile[]) ?? []);
      setLoading(false);
    })();
  }, []);

  async function setRole(id: string, role: Role) {
    setBusyId(id);
    setErr(null);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) setErr(error.message);
    else setRows((rs) => rs.map((r) => (r.id === id ? { ...r, role } : r)));
    setBusyId(null);
  }

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter(
        (r) => (r.name ?? "").toLowerCase().includes(needle) || (r.email ?? "").toLowerCase().includes(needle),
      )
    : rows;
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.role] = (acc[r.role] ?? 0) + 1;
    return acc;
  }, {});

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Users"
        subtitle="Search anyone, promote to counsellor or admin, or drop someone back to student."
        right={
          <div className="flex gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1">{rows.length} total</span>
            <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1">
              {counts.counsellor ?? 0} counsellors
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
              {counts.admin ?? 0} admins
            </span>
          </div>
        }
      />
      <ErrorNote>{err}</ErrorNote>

      <Input
        className="mb-4 max-w-72"
        placeholder="Search name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <Card>
        {shown.length === 0 ? (
          <p className="text-sm text-slate-500">No users match “{q.trim()}”.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((r) => {
              const own = r.id === me?.id;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">
                      {r.name ?? "—"}
                      {own ? <span className="ml-2 text-xs font-normal text-slate-400">(you)</span> : null}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {r.email}
                      <span className="ml-2 text-slate-400">joined {new Date(r.created_at).toLocaleDateString("en-AU")}</span>
                    </p>
                  </div>
                  <Select
                    className="w-36"
                    value={r.role}
                    disabled={own || busyId === r.id}
                    title={own ? "You can't change your own role here." : undefined}
                    onChange={(e) => setRole(r.id, e.target.value as Role)}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Select>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-4 text-xs text-slate-400">
        Role changes apply on the user's next page load. New signups start as students.
      </p>
    </div>
  );
}

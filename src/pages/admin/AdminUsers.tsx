import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { Profile, Role } from "../../lib/types";
import { Button, Card, ErrorNote, Input, PageHeader, Select, Spinner, Toast } from "../../components/ui";

const ROLES: Role[] = ["student", "counsellor", "admin"];

/** Admin power: full user list with instant role switching and account deletion. */
export default function AdminUsers() {
  const { profile: me } = useAuth();
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string; email: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function deleteAccount() {
    if (!confirmDelete) return;
    setDeleting(true);
    setErr(null);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { target_user_id: confirmDelete.id },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const body = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(body?.error ?? error.message ?? "Could not delete account");
      }
      setRows((rs) => rs.filter((r) => r.id !== confirmDelete.id));
      setToast(`Deleted ${confirmDelete.email}`);
      setConfirmDelete(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete account");
    } finally {
      setDeleting(false);
    }
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
        subtitle="Search anyone, promote to counsellor or admin, or delete an account permanently."
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
      <Toast message={toast} />

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
                  <div className="flex items-center gap-2">
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
                    {!own ? (
                      <button
                        onClick={() => setConfirmDelete({ id: r.id, name: r.name ?? "", email: r.email ?? "" })}
                        disabled={busyId === r.id}
                        title="Delete this account permanently"
                        className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-500 transition hover:border-rose-400 hover:bg-rose-100 hover:text-rose-700 disabled:opacity-40"
                      >
                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-4 text-xs text-slate-400">
        Role changes apply on the user's next page load. Deletion is permanent — all data cascades and cannot be recovered.
      </p>

      {/* Delete confirmation modal */}
      {confirmDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm"
          onClick={() => !deleting && setConfirmDelete(null)}
          role="presentation"
        >
          <Card className="w-full max-w-md">
            <h2 className="text-lg font-bold text-slate-900">Delete account?</h2>
            <p className="mt-2 text-sm text-slate-600">
              This permanently deletes <strong>{confirmDelete.email}</strong> and all their data — profile,
              shortlist, applications, documents, bookings and community posts. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={deleteAccount} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete permanently"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

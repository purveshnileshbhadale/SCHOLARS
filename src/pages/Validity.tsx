import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, PageHeader, Select, Spinner, Toast } from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

/** Critical dates that aren't files (visa expiry, CoE end, licence…). */
interface CriticalDate {
  id: string;
  label: string;
  /** YYYY-MM-DD */
  date: string;
  kind: string;
}

const KINDS = ["Visa", "CoE / course end", "OSHC", "Passport", "Licence", "Other"] as const;

const LS_KEY = "sa_critical_dates_v1";

function loadDates(): CriticalDate[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as CriticalDate[];
    return Array.isArray(raw) ? raw.filter((d) => d && d.label && d.date) : [];
  } catch {
    return [];
  }
}

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

type Urgency = "expired" | "critical" | "soon" | "plan" | "ok";

function urgency(days: number | null): Urgency {
  if (days == null) return "ok";
  if (days < 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "soon";
  if (days <= 365) return "plan";
  return "ok";
}

const URGENCY_META: Record<Urgency, { label: string; cls: string }> = {
  expired: { label: "Expired", cls: "bg-rose-600 text-white" },
  critical: { label: "≤ 30 days", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  soon: { label: "≤ 90 days", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  plan: { label: "This year", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  ok: { label: "OK", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

interface DocRow {
  id: string;
  label: string;
  category: string;
  expires_on: string | null;
}

/**
 * Expiry radar — passport, English scores, OSHC, visas and any date you
 * track, sorted by how soon they bite. Documents come from the vault;
 * custom dates stay in localStorage.
 */
export default function Validity() {
  const { session } = useAuth();
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dates, setDates] = useState<CriticalDate[]>(loadDates);
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState<string>("Visa");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(dates));
    } catch {}
  }, [dates]);

  useEffect(() => {
    let live = true;
    if (!session) return;
    supabase
      .from("student_documents")
      .select("id, label, category, expires_on")
      .eq("student_id", session.user.id)
      .order("expires_on", { ascending: true, nullsFirst: true })
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setErr(error.message);
        setDocs(((data ?? []) as DocRow[]).filter((d) => d.expires_on));
      });
    return () => {
      live = false;
    };
  }, [session]);

  interface Item {
    key: string;
    label: string;
    source: string;
    date: string;
    days: number | null;
  }

  const items = useMemo<Item[]>(() => {
    const fromDocs: Item[] = (docs ?? []).map((d) => ({
      key: `d-${d.id}`,
      label: d.label,
      source: d.category,
      date: d.expires_on!,
      days: daysUntil(d.expires_on!),
    }));
    const custom: Item[] = dates.map((d) => ({
      key: `c-${d.id}`,
      label: d.label,
      source: d.kind,
      date: d.date,
      days: daysUntil(d.date),
    }));
    return [...fromDocs, ...custom].sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  }, [docs, dates]);

  const criticalCount = items.filter((i) => i.days != null && i.days <= 30).length;

  function add(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !date) {
      setErr("Add a label and a date.");
      return;
    }
    setErr(null);
    setDates((cur) => [...cur, { id: Math.random().toString(36).slice(2, 9), label: label.trim(), date, kind }]);
    setLabel("");
    setDate("");
    setToast("Date added to your radar");
  }

  function remove(id: string) {
    setDates((cur) => cur.filter((d) => d.id !== id));
    setToast("Removed");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Expiry radar"
        subtitle="Passport, English scores, OSHC, visa and anything with a use-by date — sorted by how soon it bites."
        right={
          <Badge className={criticalCount ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}>
            {criticalCount ? `${criticalCount} critical` : "All clear"}
          </Badge>
        }
      />
      <ErrorNote>{err}</ErrorNote>
      <Toast message={toast} />

      {/* Rules of thumb */}
      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-slate-900">Rules of thumb</h2>
        <ul className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <li className="rounded-xl bg-slate-50 px-3 py-2">
            <strong className="text-slate-800">Passport:</strong> renew if under 6 months' validity at travel date — airlines and immigration check this.
          </li>
          <li className="rounded-xl bg-slate-50 px-3 py-2">
            <strong className="text-slate-800">IELTS / PTE / TOEFL:</strong> most institutions count scores from the last 2 years.
          </li>
          <li className="rounded-xl bg-slate-50 px-3 py-2">
            <strong className="text-slate-800">OSHC:</strong> must cover your course length plus one extra month — renew before it lapses.
          </li>
          <li className="rounded-xl bg-slate-50 px-3 py-2">
            <strong className="text-slate-800">Student visa:</strong> track the expiry and any conditions — extend before it ends, never after.
          </li>
        </ul>
      </Card>

      {/* List */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Your dates</h2>
        {docs === null ? (
          <Spinner className="mx-auto my-6 size-6" />
        ) : items.length === 0 ? (
          <Empty
            title="Nothing on the radar yet"
            body="Documents with an expiry date appear here automatically. Add visas, CoE end dates and licences below."
            action={
              <Button onClick={() => document.getElementById("add-date")?.scrollIntoView({ behavior: "smooth" })}>
                Add a date
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => {
              const u = urgency(it.days);
              const meta = URGENCY_META[u];
              return (
                <li key={it.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{it.label}</p>
                    <p className="text-xs text-slate-400">
                      {it.source} · {new Date(`${it.date}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      {it.days != null && it.days >= 0 ? ` · ${it.days} days left` : it.days != null ? ` · ${Math.abs(it.days)} days ago` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={meta.cls}>{meta.label}</Badge>
                    {it.key.startsWith("c-") && (
                      <button
                        onClick={() => remove(it.key.slice(2))}
                        aria-label="Remove date"
                        className="rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                          <path d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Add */}
      <Card id="add-date">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Add a critical date</h2>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Field label="What is it?">
              <Input placeholder="Student visa expires" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
          </div>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-4">
            <Button type="submit">Add to radar</Button>
          </div>
        </form>
        <p className="mt-3 text-[11px] text-slate-400">
          Documents already in your <Link to="/documents" className="font-semibold text-emerald-700 hover:underline">vault</Link> with an expiry date are
          included automatically.
        </p>
      </Card>
    </div>
  );
}

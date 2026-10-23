import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, PageHeader, Select, Textarea, Toast } from "../components/ui";
import {
  BUDGET_CATEGORIES,
  CATEGORY_META,
  benchmarkFor,
  benchmarkTotal,
  currentMonth,
  daysInMonth,
  loadExpenses,
  loadSettings,
  monthLabel,
  projection,
  recentMonths,
  saveExpenses,
  saveSettings,
  summarize,
  type BudgetCategory,
  type BudgetSettings,
  type Expense,
} from "../lib/budget";
import { CITY_COSTS } from "../lib/costOfLiving";
import { cx, money } from "../lib/utils";

/**
 * Monthly budget + expense tracker. Everything is stored locally (no
 * migration) and benchmarked against the shared CITY_COSTS estimates.
 */
export default function Budget() {
  const [settings, setSettings] = useState<BudgetSettings>(loadSettings);
  const [expenses, setExpenses] = useState<Expense[]>(loadExpenses);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<BudgetCategory>("groceries");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLimits, setShowLimits] = useState(false);

  useEffect(() => {
    try {
      saveExpenses(expenses);
    } catch {
      setErr("Could not save — local storage is blocked in this browser.");
    }
  }, [expenses]);

  const month = currentMonth();
  const summary = useMemo(() => summarize(expenses, month), [expenses, month]);
  const days = daysInMonth(month);
  const today = new Date().getDate();
  const proj = useMemo(() => projection(summary.spent, today, days), [summary.spent, today, days]);
  const bench = useMemo(() => benchmarkFor(settings.city), [settings.city]);

  const remaining = settings.total - summary.spent;
  const pct = settings.total > 0 ? Math.min(100, (summary.spent / settings.total) * 100) : 0;
  const overBudget = remaining < 0;
  const willOverspend = proj.projected > settings.total;

  function add(e: FormEvent) {
    e.preventDefault();
    const n = Number.parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter an amount greater than zero.");
      return;
    }
    if (!date) {
      setErr("Pick a date.");
      return;
    }
    setErr(null);
    setExpenses((cur) => [{ date, amount: Math.round(n * 100) / 100, category, note: note.trim() || undefined }, ...cur]);
    setAmount("");
    setNote("");
    setToast(`${money(n)} logged under ${CATEGORY_META[category].label}`);
  }

  function remove(i: number) {
    setExpenses((cur) => cur.filter((_, idx) => idx !== i));
    setToast("Entry removed");
  }

  function updateSettings(patch: Partial<BudgetSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      saveSettings(next);
    } catch {}
  }

  const months = useMemo(() => recentMonths(expenses), [expenses]);
  const monthStats = useMemo(() => months.map((k) => summarize(expenses, k)), [months, expenses]);
  const peak = Math.max(settings.total, ...monthStats.map((m) => m.spent), 1);

  const recent = useMemo(() => expenses.slice(0, 30), [expenses]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Budget"
        subtitle="Track everyday spending against a monthly budget, with a city benchmark so you know what 'normal' looks like."
        right={
          <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
            {monthLabel(month)}
          </Badge>
        }
      />
      <ErrorNote>{err}</ErrorNote>
      <Toast message={toast} />

      {/* Overview */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Spent this month</p>
            <p className={cx("text-3xl font-extrabold", overBudget ? "text-rose-600" : "text-slate-900")}>
              {money(summary.spent)}
              <span className="text-base font-semibold text-slate-400"> / {money(settings.total)}</span>
            </p>
            <p className="text-sm font-medium text-slate-500">
              {overBudget ? `${money(Math.abs(remaining))} over budget` : `${money(remaining)} left · ${days - today} days to go`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Projected month-end</p>
            <p className={cx("text-2xl font-extrabold", willOverspend ? "text-rose-600" : "text-emerald-700")}>{money(proj.projected)}</p>
            <p className="text-xs text-slate-500">{money(proj.dailyAvg)}/day average</p>
          </div>
        </div>

        <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cx("h-full rounded-full transition-all duration-500", overBudget ? "bg-rose-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500")}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Monthly budget (AUD)</span>
            <Input
              type="number"
              min={0}
              step={50}
              value={settings.total}
              onChange={(e) => updateSettings({ total: Math.max(0, Number(e.target.value) || 0) })}
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">City (for benchmark)</span>
            <Select value={settings.city} onChange={(e) => updateSettings({ city: e.target.value })} className="mt-1">
              {CITY_COSTS.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}, {c.country}
                </option>
              ))}
            </Select>
          </label>
          <div className="col-span-2 flex items-end">
            <Button variant="ghost" onClick={() => setShowLimits((v) => !v)} className="w-full">
              {showLimits ? "Hide category limits" : "Set category limits"}
            </Button>
          </div>
        </div>

        {showLimits && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 sm:grid-cols-3">
            {BUDGET_CATEGORIES.map((c) => (
              <label key={c.key} className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{c.label}</span>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  placeholder="No limit"
                  value={settings.limits[c.key] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0);
                    const limits = { ...settings.limits };
                    if (v === undefined) delete limits[c.key];
                    else limits[c.key] = v;
                    updateSettings({ limits });
                  }}
                  className="mt-1"
                />
              </label>
            ))}
          </div>
        )}
      </Card>

      {/* Benchmark */}
      {bench && (
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{bench.city} planning benchmark</p>
              <p className="text-sm text-slate-600">
                Typical student month: <strong>{money(benchmarkTotal(bench))}</strong> (rent {money(bench.rent)}, groceries {money(bench.groceries)},
                transport {money(bench.transport)}, utilities {money(bench.utilities)}, everyday {money(bench.entertainment)}).
              </p>
            </div>
            <Badge className={summary.spent <= benchmarkTotal(bench) ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}>
              {summary.spent <= benchmarkTotal(bench) ? "You're below it" : "You're above it"}
            </Badge>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">{bench.sourceNote}</p>
        </Card>
      )}

      {/* Categories */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">By category</h2>
          <span className="text-xs text-slate-500">{summary.count} entries</span>
        </div>
        <div className="space-y-3">
          {BUDGET_CATEGORIES.map((c) => {
            const spent = summary.byCategory[c.key] ?? 0;
            if (spent === 0 && settings.limits[c.key] == null) return null;
            const limit = settings.limits[c.key];
            const ref = limit ?? (c.benchmarkKey && bench ? Math.round(bench[c.benchmarkKey] * 0.6) : undefined);
            const w = ref && ref > 0 ? Math.min(100, (spent / ref) * 100) : spent > 0 ? 100 : 0;
            const hot = ref != null && spent > ref;
            return (
              <div key={c.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5 text-slate-400">
                      <path d={c.icon} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {c.label}
                  </span>
                  <span className={cx("font-bold", hot ? "text-rose-600" : "text-slate-700")}>
                    {money(spent)}
                    {ref ? <span className="font-medium text-slate-400"> / {money(ref)}</span> : null}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={cx("h-full rounded-full", hot ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${w}%` }} />
                </div>
              </div>
            );
          })}
          {summary.count === 0 && <Empty title="No spending logged yet" body="Add your first expense below — rent, groceries, a coffee. Small entries make the projection useful." />}
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          No limit set? Categories with a benchmark show 60% of the city estimate as a soft guide.
        </p>
      </Card>

      {/* Add */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Log an expense</h2>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-4">
          <Field label="Date">
            <Input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Amount (AUD)">
            <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="12.50" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as BudgetCategory)}>
              {BUDGET_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note (optional)">
            <Input placeholder="Flat share rent" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="sm:col-span-4">
            <Button type="submit">Add expense</Button>
          </div>
        </form>
      </Card>

      {/* History */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Last months</h2>
        {monthStats.length <= 1 ? (
          <p className="text-sm text-slate-500">History appears once you've logged spending in more than one month.</p>
        ) : (
          <div className="flex h-40 items-end gap-3">
            {monthStats.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1" title={`${m.label}: ${money(m.spent)}`}>
                <span className="text-[10px] font-bold text-slate-500">{money(m.spent)}</span>
                <div
                  className={cx("w-full rounded-t-md", m.key === month ? "bg-emerald-500" : m.spent > settings.total ? "bg-rose-400" : "bg-slate-300")}
                  style={{ height: `${Math.max(6, (m.spent / peak) * 110)}px` }}
                />
                <span className="text-[10px] font-semibold uppercase text-slate-400">
                  {new Date(`${m.key}-01T00:00:00`).toLocaleDateString("en-AU", { month: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent */}
      <Card>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Recent entries</h2>
        {recent.length === 0 ? (
          <Empty title="Nothing logged yet" body="Your entries will appear here, newest first." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((ex, i) => (
              <li key={`${ex.date}-${ex.amount}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {CATEGORY_META[ex.category].label}
                    {ex.note ? <span className="font-normal text-slate-500"> — {ex.note}</span> : null}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(`${ex.date}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-900">{money(ex.amount)}</span>
                  <button
                    onClick={() => remove(i)}
                    aria-label="Delete entry"
                    className="rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                      <path d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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

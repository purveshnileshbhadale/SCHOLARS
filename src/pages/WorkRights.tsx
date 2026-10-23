import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  currentFortnight,
  estimateTax,
  formatRange,
  formatShort,
  fortnightWindow,
  history,
  localToday,
  parseISO,
  HOURS_LIMIT,
  PAYSLIP_CHECKS,
  type WorkEntry,
} from "../lib/workRights";
import { Badge, Button, Card, DeadlineChip, Empty, ErrorNote, Input, PageHeader, Select, Spinner, Textarea, Toast } from "../components/ui";
import { cx, money } from "../lib/utils";

const LS_KEY = "sa_work_log_v1";

function loadEntries(): WorkEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as WorkEntry[];
    return Array.isArray(raw) ? raw.filter((e) => e && e.date) : [];
  } catch {
    return [];
  }
}

function parseAmount(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 48) : 0;
}

/**
 * Student visa (subclass 500) work-rights tracker — 48 hours per fortnight.
 * All computation lives in src/lib/workRights.ts; this page is presentation.
 * Persisted to localStorage so no migration is required.
 */
export default function WorkRights() {
  const [entries, setEntries] = useState<WorkEntry[]>(loadEntries);
  const [date, setDate] = useState(localToday());
  const [hours, setHours] = useState("8");
  const [note, setNote] = useState("");
  const [inBreak, setInBreak] = useState(false);
  const [rate, setRate] = useState("24.50");
  const [hasTfn, setHasTfn] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"log" | "history" | "rights">("log");

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(entries));
    } catch {
      setErr("Could not save to local storage — your browser may be blocking it.");
    }
  }, [entries]);

  const fn = useMemo(() => currentFortnight(entries, date), [entries, date]);
  const past = useMemo(() => history(entries).filter((h) => h.start !== fn.start), [entries, fn.start]);

  const gross = useMemo(() => Number.parseFloat(rate) * fn.hours, [rate, fn.hours]);
  const tax = useMemo(() => estimateTax(Number.isFinite(gross) ? gross : 0, hasTfn), [gross, hasTfn]);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const h = parseAmount(hours);
    if (h <= 0) {
      setErr("Enter hours worked (0–48).");
      return;
    }
    setErr(null);
    const d = parseISO(date);
    setEntries((cur) => {
      const i = cur.findIndex((x) => x.date === d);
      const next: WorkEntry = { date: d, hours: h, note: note.trim() || undefined };
      if (i >= 0) {
        const copy = [...cur];
        copy[i] = next;
        return copy;
      }
      return [...cur, next];
    });
    setToast(`${h} h logged for ${formatShort(d)}`);
    setNote("");
  }

  function remove(dateStr: string) {
    setEntries((cur) => cur.filter((x) => x.date !== dateStr));
    setToast("Entry removed");
  }

  const gaugePct = inBreak ? Math.min(100, fn.pct) : fn.pct;
  const overBy = Math.max(0, fn.hours - HOURS_LIMIT);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Work rights"
        subtitle="48 hours per fortnight on a student visa — log your hours, see the rolling window and stay compliant."
        right={
          <div className="flex gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1">{entries.length} entries</span>
          </div>
        }
      />
      <ErrorNote>{err}</ErrorNote>
      <Toast message={toast} />

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        {(["log", "history", "rights"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              "rounded-full border px-4 py-1.5 text-xs font-bold capitalize transition",
              tab === t ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-300",
            )}
          >
            {t === "rights" ? "Your rights" : t}
          </button>
        ))}
      </div>

      {tab === "log" ? (
        <>
          {/* Compliance gauge */}
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">This fortnight</p>
                <p className="text-sm font-semibold text-slate-600">
                  {formatRange(fn.start, fn.end)} — {formatShort(fn.start)} to {formatShort(fn.end)}
                </p>
              </div>
              <div className="text-right">
                <p className={cx("text-3xl font-extrabold", fn.overLimit ? "text-rose-600" : fn.warning ? "text-amber-600" : "text-emerald-700")}>
                  {fn.hours}
                  <span className="text-base font-semibold text-slate-400"> / {HOURS_LIMIT} h</span>
                </p>
                <p className="text-xs text-slate-500">{fn.overLimit ? `${overBy} h over the cap` : `${fn.remaining} h remaining`}</p>
              </div>
            </div>

            <div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cx(
                  "h-full rounded-full transition-all duration-500",
                  fn.overLimit ? "bg-gradient-to-r from-rose-500 to-red-500" : fn.warning ? "bg-gradient-to-r from-amber-400 to-orange-400" : "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500",
                )}
                style={{ width: `${inBreak ? Math.min(100, gaugePct) : gaugePct}%` }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="size-4 rounded border-slate-300 text-emerald-600" checked={inBreak} onChange={(e) => setInBreak(e.target.checked)} />
                <span className="font-semibold">Course break (unlimited hours)</span>
              </label>
              {inBreak ? (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Break mode — 48h cap suspended</Badge>
              ) : fn.overLimit ? (
                <Badge className="border-rose-300 bg-rose-50 text-rose-800">Over the cap — reduce hours immediately</Badge>
              ) : fn.warning ? (
                <Badge className="border-amber-300 bg-amber-50 text-amber-800">Near the cap — {fn.remaining} h left</Badge>
              ) : (
                <Badge className="border-slate-200 bg-slate-50 text-slate-600">Within your rights</Badge>
              )}
            </div>
          </Card>

          {/* Earnings estimate */}
          <Card className="mb-6 border-sky-200/60 bg-gradient-to-r from-sky-50 to-cyan-50/50">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Hourly rate (AUD)</span>
                <Input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} className="mt-1 w-32" />
              </label>
              <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs font-semibold text-slate-600">
                <input type="checkbox" className="size-4 rounded border-slate-300 text-emerald-600" checked={hasTfn} onChange={(e) => setHasTfn(e.target.checked)} />
                I have quoted my TFN
              </label>
              <div className="text-right">
                <p className="text-xs text-slate-500">Gross this fortnight</p>
                <p className="text-xl font-extrabold text-slate-900">{money(Number.isFinite(gross) ? gross : 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Estimated take-home</p>
                <p className="text-xl font-extrabold text-emerald-700">{money(tax.net)}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{tax.note} Estimates only — check your payslip or the ATO calculator for exact figures.</p>
          </Card>

          {/* Log form */}
          <Card className="mb-6">
            <h3 className="mb-3 font-bold text-slate-900">Log hours</h3>
            <form onSubmit={add} className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Date</span>
                <Input type="date" value={date} max={localToday()} onChange={(e) => setDate(e.target.value)} className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Hours (max 48)</span>
                <Input type="number" step="0.5" min="0" max="48" value={hours} onChange={(e) => setHours(e.target.value)} className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Note (optional)</span>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Café shift" className="mt-1" />
              </label>
              <div className="sm:col-span-3">
                <Button type="submit">{fn.entries.some((x) => x.date === parseISO(date)) ? "Update day" : "Add day"}</Button>
              </div>
            </form>
          </Card>

          {/* This fortnight's entries */}
          <Card className="mb-6">
            <h3 className="mb-3 font-bold text-slate-900">Days in this fortnight</h3>
            {fn.entries.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing logged yet for {formatRange(fn.start, fn.end)}.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {fn.entries.map((e) => (
                  <li key={e.date} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {formatShort(e.date)}
                        <span className="ml-2 text-xs font-normal text-slate-400">{new Date(`${e.date}T00:00:00`).toLocaleDateString("en-AU", { weekday: "short" })}</span>
                      </p>
                      {e.note ? <p className="text-xs text-slate-500">{e.note}</p> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900">{e.hours} h</span>
                      <button onClick={() => remove(e.date)} title="Remove" className="rounded-lg border border-rose-200 bg-rose-50 p-1 text-rose-500 hover:text-rose-700">
                        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Payslip checks */}
          <Card>
            <h3 className="mb-1 font-bold text-slate-900">Every payslip must show</h3>
            <p className="mb-3 text-xs text-slate-500">Fair Work Ombudsman minimum requirements — if any line is missing, ask your employer.</p>
            <ul className="space-y-1.5">
              {PAYSLIP_CHECKS.map((p) => (
                <li key={p.label} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-800">{p.label}</span>
                  <span className="block text-xs text-slate-500">{p.why}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : tab === "history" ? (
        <>
          {past.length === 0 ? (
            <Empty title="No past fortnights logged" body="Log at least two weeks and your history will build here automatically." />
          ) : (
            <div className="space-y-3">
              {past.map((h) => (
                <Card key={h.start}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{formatRange(h.start, h.end)}</p>
                      <p className="text-xs text-slate-500">{h.entries.length} day{h.entries.length === 1 ? "" : "s"} logged</p>
                    </div>
                    <div className="text-right">
                      <p className={cx("text-xl font-extrabold", h.overLimit ? "text-rose-600" : "text-slate-900")}>{h.hours} h</p>
                      <p className="text-xs text-slate-500">of {HOURS_LIMIT} h</p>
                    </div>
                    <Badge className={h.overLimit ? "border-rose-300 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
                      {h.overLimit ? "Over" : "Compliant"}
                    </Badge>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={cx("h-full rounded-full", h.overLimit ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, h.pct)}%` }} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <Card>
            <h3 className="font-bold text-slate-900">Student visa condition 8547</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              <li className="rounded-lg bg-emerald-50 px-3 py-2">
                <strong>While your course is in session:</strong> a maximum of <strong>48 hours per fortnight</strong> (any 14 consecutive days
                starting Monday).
              </li>
              <li className="rounded-lg bg-sky-50 px-3 py-2">
                <strong>During scheduled course breaks:</strong> <strong>unlimited</strong> hours. Toggle "Course break" when your institution
                publishes the break dates.
              </li>
              <li className="rounded-lg bg-amber-50 px-3 py-2">
                <strong>Research students / doctoral candidates:</strong> hours are not formally capped once coursework is complete — but keep a log
                in case you're asked to demonstrate genuine progress.
              </li>
              <li className="rounded-lg bg-rose-50 px-3 py-2">
                <strong>Breach consequences:</strong> visa cancellation. The Department can request work evidence at any time — keep 12 months of
                payslips.
              </li>
            </ul>
          </Card>

          <Card>
            <h3 className="font-bold text-slate-900">Getting paid properly</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              <li>• National minimum wage is reviewed each 1 July — check the Fair Work rate, not what an employer offers.</li>
              <li>• Cash-in-hand below award rate is illegal even if you agree to it.</li>
              <li>• Casual loading is typically +25% on top of the base rate.</li>
              <li>• Super guarantee (11.5%) is paid on top of wages regardless of hours.</li>
              <li>• Report underpayment: <a href="https://www.fairwork.gov.au/" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 hover:underline">fairwork.gov.au</a> or 13 13 94.</li>
            </ul>
          </Card>

          <Card>
            <h3 className="font-bold text-slate-900">TFN status</h3>
            <p className="mt-1 text-sm text-slate-600">
              You must quote your Tax File Number to your employer within 28 days of starting. Without it, the top marginal rate is withheld from
              your first dollar — often 45%.
            </p>
            <a
              href="https://www.ato.gov.au/individuals-and-families/tax-file-number"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-emerald-700 hover:underline"
            >
              Apply for a TFN (ATO) ↗
            </a>
          </Card>

          <Card className="border-sky-200/60 bg-gradient-to-r from-sky-50 to-cyan-50/60">
            <p className="text-sm text-slate-700">
              Need a work-rights sanity check? Book a counsellor session — they see breaches coming before they happen.
            </p>
            <div className="mt-3 flex gap-2">
              <Link to="/counsellors">
                <Button variant="ghost" className="text-xs">Find a counsellor</Button>
              </Link>
            </div>
          </Card>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Reminder: your log is stored on this device only. Cross-check against payslips — a mismatch is your first warning that something is off.
      </p>
    </div>
  );
}

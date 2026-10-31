import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, DeviceNote, Input, PageHeader, Select } from "../components/ui";
import {
  COVER_LABEL,
  OSHC_CHECKS,
  addMonths,
  cheapest,
  defaultCourseDates,
  isoDate,
  rankQuotes,
  requiredCover,
  savingsVs,
  type CoverType,
  type Quote,
} from "../lib/oshc";

const STORE_KEY = "sa_oshc_plan";

interface SavedPlan {
  start: string;
  end: string;
  startBufferDays: number;
  endBufferMonths: number;
  coverType: CoverType;
  quotes: Quote[];
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function loadPlan(): SavedPlan {
  const fallback = defaultCourseDates();
  const base: SavedPlan = {
    start: fallback.start,
    end: fallback.end,
    startBufferDays: 14,
    endBufferMonths: 2,
    coverType: "single",
    quotes: [
      { id: makeId(), provider: "Bupa", monthly: 0 },
      { id: makeId(), provider: "Medibank", monthly: 0 },
      { id: makeId(), provider: "Allianz Care", monthly: 0 },
    ],
  };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<SavedPlan>;
    return {
      ...base,
      ...parsed,
      quotes: Array.isArray(parsed.quotes) && parsed.quotes.length ? (parsed.quotes as Quote[]) : base.quotes,
    };
  } catch {
    return base;
  }
}

function money(n: number): string {
  return `A$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function niceDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/** Health-cover planner: works out the cover window a student visa needs and prices the quotes you have. */
export default function Oshc() {
  const [plan, setPlan] = useState<SavedPlan>(() => loadPlan());

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(plan));
    } catch {
      /* private mode — still usable this session */
    }
  }, [plan]);

  const cover = useMemo(
    () =>
      requiredCover(plan.start, plan.end, {
        startBufferDays: plan.startBufferDays,
        endBufferMonths: plan.endBufferMonths,
      }),
    [plan.start, plan.end, plan.startBufferDays, plan.endBufferMonths],
  );

  const ranked = useMemo(() => (cover ? rankQuotes(plan.quotes, cover.months) : []), [plan.quotes, cover]);
  const best = useMemo(() => cheapest(ranked), [ranked]);
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const saving = useMemo(() => savingsVs(ranked, worst), [ranked, worst]);

  /** Course length in years, shown as a sanity check on the dates. */
  const years = useMemo(() => {
    if (!cover) return 0;
    return Math.round((cover.days / 365.25) * 10) / 10;
  }, [cover]);

  function patch(next: Partial<SavedPlan>) {
    setPlan((p) => ({ ...p, ...next }));
  }

  function setQuote(id: string, next: Partial<Quote>) {
    patch({ quotes: plan.quotes.map((q) => (q.id === id ? { ...q, ...next } : q)) });
  }

  function addQuote() {
    patch({ quotes: [...plan.quotes, { id: makeId(), provider: "", monthly: 0 }] });
  }

  function removeQuote(id: string) {
    patch({ quotes: plan.quotes.filter((q) => q.id !== id) });
  }

  function suggestEnd(start: string, yearsToAdd: number) {
    const d = new Date(`${start}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    patch({ end: isoDate(addMonths(d, Math.round(yearsToAdd * 12))) });
  }

  return (
    <div>
      <PageHeader
        title="OSHC planner"
        subtitle="Work out exactly how long your Overseas Student Health Cover has to run, then price the quotes you have — no gaps, no surprises at visa time."
        right={
          <Button variant="ghost" onClick={() => window.print()} className="no-print">
            Print summary
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="space-y-4 no-print">
          <Card>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Your course</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Course start</span>
                <Input type="date" value={plan.start} onChange={(e) => patch({ start: e.target.value })} className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Course end</span>
                <Input type="date" value={plan.end} onChange={(e) => patch({ end: e.target.value })} className="mt-1" />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[1, 1.5, 2, 3, 4].map((y) => (
                  <button
                    key={y}
                    onClick={() => suggestEnd(plan.start, y)}
                    className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:border-emerald-300"
                  >
                    {y} yr course
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Cover starts</span>
                <Select
                  value={String(plan.startBufferDays)}
                  onChange={(e) => patch({ startBufferDays: Number(e.target.value) })}
                  className="mt-1"
                >
                  <option value="0">On the course start date</option>
                  <option value="7">1 week before</option>
                  <option value="14">2 weeks before (recommended)</option>
                  <option value="30">1 month before</option>
                </Select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Cover ends after the course</span>
                <Select
                  value={String(plan.endBufferMonths)}
                  onChange={(e) => patch({ endBufferMonths: Number(e.target.value) })}
                  className="mt-1"
                >
                  <option value="0">Same day the course ends</option>
                  <option value="1">1 month later</option>
                  <option value="2">2 months later (recommended)</option>
                  <option value="3">3 months later</option>
                </Select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Who is covered</span>
                <Select value={plan.coverType} onChange={(e) => patch({ coverType: e.target.value as CoverType })} className="mt-1">
                  <option value="single">{COVER_LABEL.single}</option>
                  <option value="couple">{COVER_LABEL.couple}</option>
                  <option value="family">{COVER_LABEL.family}</option>
                </Select>
              </label>
            </div>
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Your quotes</h2>
              <Button variant="ghost" onClick={addQuote} className="text-xs">
                + Add
              </Button>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
              Enter the monthly premium each provider quoted you. Premiums differ by provider, cover type and start date, so
              we never hard-code them.
            </p>
            <div className="space-y-2">
              {plan.quotes.map((q) => (
                <div key={q.id} className="flex items-center gap-2">
                  <Input
                    value={q.provider}
                    onChange={(e) => setQuote(q.id, { provider: e.target.value })}
                    placeholder="Provider"
                    className="min-w-0 flex-1"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={q.monthly || ""}
                    onChange={(e) => setQuote(q.id, { monthly: Number(e.target.value) })}
                    placeholder="A$/mo"
                    className="w-24"
                  />
                  <button
                    onClick={() => removeQuote(q.id)}
                    title="Remove"
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-rose-300 hover:text-rose-600"
                  >
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {!cover ? (
            <Card className="border-rose-200 bg-rose-50/60">
              <p className="text-sm font-semibold text-rose-800">
                Check your dates — the course must end after it starts, and the cover window has to be at least a day long.
              </p>
            </Card>
          ) : (
            <>
              <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/60">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">The cover you need</p>
                    <p className="mt-1 font-display text-2xl font-extrabold text-slate-900">
                      {niceDate(cover.start)} → {niceDate(cover.end)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {cover.days} days · billed as <span className="font-bold text-slate-800">{cover.months} months</span> ·{" "}
                      {years} year course + buffers
                    </p>
                  </div>
                  <Badge className="border-emerald-200 bg-white/80 text-emerald-800">{COVER_LABEL[plan.coverType]}</Badge>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                  A student visa needs cover from the day you arrive until the visa ends. Starting a fortnight early and
                  ending two months after the course is the buffer most providers quote — change it above if your agent
                  advised different dates.
                </p>
              </Card>

              <Card>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Cost over {cover.months} months</h2>
                {ranked.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Enter at least one monthly premium on the left and the totals appear here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ranked.map((q, i) => (
                      <div
                        key={q.id}
                        className={
                          i === 0
                            ? "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50/70 px-3 py-2.5"
                            : "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5"
                        }
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {q.provider || "Unnamed provider"}{" "}
                            {i === 0 ? <Badge className="ml-1 border-emerald-200 bg-white text-emerald-700">Cheapest</Badge> : null}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {money(q.monthly)}/mo · {money(q.annualised)}/yr · ≈ {money(q.weekly)}/week
                          </p>
                        </div>
                        <p className="font-display text-lg font-extrabold text-slate-900">{money(q.total)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {best && saving > 0 ? (
                  <p className="mt-3 text-xs font-medium text-emerald-700">
                    Choosing {best.provider || "the cheapest quote"} saves {money(saving)} against the most expensive quote
                    for the same cover.
                  </p>
                ) : null}
                {best ? (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Budget it monthly: {money(best.monthly)} — check whether your provider allows instalments instead of one
                    upfront payment.
                  </p>
                ) : null}
              </Card>

              <DeviceNote>
                These numbers live in this browser only — nothing is sent anywhere. Premiums and policy rules come from your
                provider, so confirm the dates on the certificate before you lodge a visa.
              </DeviceNote>
            </>
          )}

          <Card>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Before you buy</h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {OSHC_CHECKS.map((c) => (
                <div key={c.title} className="rounded-xl border border-slate-200/70 bg-slate-50/50 px-3 py-2">
                  <p className="text-xs font-bold text-slate-800">{c.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, DeviceNote, PageHeader, Select } from "../components/ui";
import {
  DEFAULT_CONTEXT,
  ENGLISH_LABEL,
  EXPIRY_NOTES,
  FUNDING_LABEL,
  GROUP_ORDER,
  buildChecklist,
  loadPack,
  nextSteps,
  packProgress,
  savePack,
  type EnglishTest,
  type EvidenceContext,
  type FundingSource,
} from "../lib/evidence";
import { cx } from "../lib/utils";

/** Visa evidence checklist: which documents apply to you, and how complete the pack is. */
export default function Evidence() {
  const [pack, setPack] = useState(() => loadPack());
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    savePack(pack);
  }, [pack]);

  const items = useMemo(() => buildChecklist(pack.ctx), [pack.ctx]);
  const progress = useMemo(() => packProgress(items, pack.done), [items, pack.done]);
  const todo = useMemo(() => nextSteps(items, pack.done), [items, pack.done]);

  const doneSet = useMemo(() => new Set(pack.done), [pack.done]);

  /** Drop ids that no longer apply when the answers change, so the percentage stays honest. */
  useEffect(() => {
    const valid = new Set(items.map((i) => i.id));
    const pruned = pack.done.filter((id) => valid.has(id));
    if (pruned.length !== pack.done.length) setPack((p) => ({ ...p, done: pruned }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function patchCtx(next: Partial<EvidenceContext>) {
    setPack((p) => ({ ...p, ctx: { ...p.ctx, ...next } }));
  }

  function toggle(id: string) {
    setPack((p) =>
      p.done.includes(id) ? { ...p, done: p.done.filter((x) => x !== id) } : { ...p, done: [...p.done, id] },
    );
  }

  function reset() {
    setPack({ ctx: DEFAULT_CONTEXT, done: [] });
  }

  const pct = progress.pct;

  return (
    <div>
      <PageHeader
        title="Evidence pack"
        subtitle="The documents a student visa asks for change with how you are funded, who is coming with you and whether you have been refused before. Answer three questions and this builds the list."
        right={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={reset} disabled={!pack.done.length}>
              Clear ticks
            </Button>
            <Button variant="ghost" onClick={() => window.print()} className="no-print">
              Print pack
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* Answers that shape the list */}
        <div className="space-y-4 no-print">
          <Card>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Your situation</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">How will you pay?</span>
                <Select
                  value={pack.ctx.funding}
                  onChange={(e) => patchCtx({ funding: e.target.value as FundingSource })}
                  className="mt-1"
                >
                  {(Object.keys(FUNDING_LABEL) as FundingSource[]).map((k) => (
                    <option key={k} value={k}>
                      {FUNDING_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">English requirement</span>
                <Select
                  value={pack.ctx.englishTest}
                  onChange={(e) => patchCtx({ englishTest: e.target.value as EnglishTest })}
                  className="mt-1"
                >
                  {(Object.keys(ENGLISH_LABEL) as EnglishTest[]).map((k) => (
                    <option key={k} value={k}>
                      {ENGLISH_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </label>

              <div className="space-y-1.5 pt-1">
                {(
                  [
                    { key: "dependants", label: "Partner or children coming with me" },
                    { key: "under18", label: "I will be under 18 when I start" },
                    { key: "priorRefusal", label: "I have been refused an Australian visa before" },
                    { key: "scholarship", label: "I hold a scholarship" },
                  ] as { key: keyof EvidenceContext; label: string }[]
                ).map((row) => {
                  const on = Boolean(pack.ctx[row.key]);
                  return (
                    <button
                      key={row.key}
                      onClick={() => patchCtx({ [row.key]: !on } as Partial<EvidenceContext>)}
                      className={cx(
                        "flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-semibold transition",
                        on
                          ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                          : "border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-300",
                      )}
                    >
                      <span
                        className={cx(
                          "grid size-4 shrink-0 place-items-center rounded border",
                          on ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white",
                        )}
                      >
                        {on ? (
                          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                      </span>
                      {row.label}
                    </button>
                  );
                })}
              </div>

              <p className="pt-1 text-[11px] leading-relaxed text-slate-500">
                These answers only decide which items appear. They stay in this browser.
              </p>
            </div>
          </Card>

          <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 to-teal-50/50">
            <div className="flex items-center gap-4">
              <div className="relative size-16 shrink-0">
                <svg viewBox="0 0 36 36" className="size-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3.2" className="text-white/80" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeDasharray={`${pct} ${100 - pct}`}
                    className="text-emerald-600 transition-all duration-500"
                    stroke="currentColor"
                  />
                </svg>
                <span className="absolute inset-0 grid place-items-center font-display text-sm font-extrabold text-slate-900">
                  {pct}%
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {progress.done} of {progress.total} gathered
                </p>
                <p className="text-[11px] text-slate-600">
                  {progress.missing.length === 0
                    ? "Pack complete — re-check every date before you lodge."
                    : `${progress.missing.length} item(s) still missing.`}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {progress.byGroup.map((g) => (
                <div key={g.group} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 truncate text-[10px] font-semibold text-slate-600">{g.group}</span>
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${g.total ? (g.done / g.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[10px] font-bold text-slate-500">
                    {g.done}/{g.total}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {todo.length > 0 ? (
            <Card className="border-dashed">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Gather these next</p>
              <ul className="mt-1.5 space-y-1">
                {todo.map((i) => (
                  <li key={i.id} className="flex gap-2 text-[11px] leading-relaxed text-slate-700">
                    <span className="text-emerald-600">→</span>
                    <span>{i.title}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* Checklist */}
        <div className="space-y-5">
          {GROUP_ORDER.filter((g) => items.some((i) => i.group === g)).map((group) => {
            const groupItems = items.filter((i) => i.group === group);
            const groupDone = groupItems.filter((i) => doneSet.has(i.id)).length;
            return (
              <section key={group}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900">{group}</h2>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {groupDone}/{groupItems.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {groupItems.map((item) => {
                    const checked = doneSet.has(item.id);
                    const isOpen = open === item.id;
                    return (
                      <Card key={item.id}>
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => toggle(item.id)}
                            aria-pressed={checked}
                            aria-label={checked ? `Mark ${item.title} as not gathered` : `Mark ${item.title} as gathered`}
                            className={cx(
                              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition",
                              checked
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-slate-300 bg-white hover:border-emerald-400",
                            )}
                          >
                            {checked ? (
                              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : null}
                          </button>

                          <div className="min-w-0 grow">
                            <button
                              onClick={() => setOpen(isOpen ? null : item.id)}
                              className="block w-full text-left"
                              aria-expanded={isOpen}
                            >
                              <span
                                className={cx(
                                  "text-sm font-bold",
                                  checked ? "text-slate-400 line-through decoration-slate-300" : "text-slate-900",
                                )}
                              >
                                {item.title}
                              </span>
                            </button>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                              <span className="font-semibold text-slate-500">Why:</span> {item.why}
                            </p>

                            {isOpen ? (
                              <ul className="mt-1.5 space-y-1 rounded-lg bg-slate-50/80 px-2.5 py-2">
                                {item.tips.map((t) => (
                                  <li key={t} className="text-[11px] leading-relaxed text-slate-600">
                                    • {t}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <button
                                onClick={() => setOpen(item.id)}
                                className="mt-1 text-[11px] font-bold text-emerald-700 hover:underline"
                              >
                                How people get this wrong
                              </button>
                            )}
                          </div>

                          {checked ? (
                            <Badge className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">Ready</Badge>
                          ) : null}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <Card>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Things that expire</h2>
            <dl className="grid gap-2 sm:grid-cols-2">
              {EXPIRY_NOTES.map((n) => (
                <div key={n.label} className="rounded-xl border border-slate-200/70 bg-slate-50/50 px-3 py-2">
                  <dt className="text-xs font-bold text-slate-800">{n.label}</dt>
                  <dd className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{n.note}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-slate-500">
              Track the actual dates on{" "}
              <Link to="/validity" className="font-semibold text-emerald-700 hover:underline">
                Expiry radar
              </Link>
              .
            </p>
          </Card>

          <DeviceNote>
            Tick marks and your answers stay in this browser. Requirements change — confirm the current list on the Home
            Affairs website before you lodge, and never upload unredacted bank details anywhere you do not trust.
          </DeviceNote>
        </div>
      </div>
    </div>
  );
}

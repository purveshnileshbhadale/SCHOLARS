import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, DeviceNote, PageHeader, Textarea } from "../components/ui";
import {
  GS_GROUPS,
  GS_QUESTIONS,
  GS_TIPS,
  checkAnswer,
  loadAnswers,
  saveAnswers,
  scoreAll,
  type GsGroup,
} from "../lib/gsInterview";
import { cx } from "../lib/utils";

type Filter = "all" | "todo" | "done";

/** Genuine Student interview rehearsal: answer the questions an officer actually asks, scored on facts not prose. */
export default function Interview() {
  const [answers, setAnswers] = useState<Record<string, string>>(() => loadAnswers());
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    saveAnswers(answers);
  }, [answers]);

  const summary = useMemo(() => scoreAll(answers), [answers]);

  const grouped = useMemo(() => {
    const keep = (id: string) =>
      filter === "all" ? true : filter === "todo" ? !summary.perQuestion[id].done : summary.perQuestion[id].done;
    const map = new Map<GsGroup, typeof GS_QUESTIONS>();
    for (const group of GS_GROUPS) {
      const list = GS_QUESTIONS.filter((q) => q.group === group && keep(q.id));
      if (list.length) map.set(group, list);
    }
    return map;
  }, [filter, summary]);

  function update(id: string, value: string) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function reset() {
    setAnswers({});
  }

  const pct = summary.readiness;

  return (
    <div>
      <PageHeader
        title="Visa interview prep"
        subtitle="The Genuine Student interview rewards consistency, not eloquence. Draft an answer to every question, then check it against the facts an officer listens for."
        right={
          <Button variant="ghost" onClick={reset} disabled={!Object.keys(answers).length}>
            Clear answers
          </Button>
        }
      />

      <Card className="mb-6 border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/60">
        <div className="flex flex-wrap items-center gap-5">
          <div className="relative size-20 shrink-0">
            <svg viewBox="0 0 36 36" className="size-20 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/70" />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${pct} ${100 - pct}`}
                className="text-emerald-600 transition-all duration-500"
                stroke="currentColor"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-extrabold text-slate-900">
              {pct}%
            </span>
          </div>
          <div className="min-w-0 grow">
            <p className="font-bold text-slate-900">
              {summary.answered} of {summary.total} answers ready
            </p>
            <p className="text-sm text-slate-600">
              A score of 70+ means every answer is long enough and covers the facts that matter. It is a checklist, not a
              prediction — the decision stays with the case officer.
            </p>
          </div>
          <div className="flex gap-1.5">
            {(["all", "todo", "done"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cx(
                  "rounded-full border px-3 py-1 text-xs font-bold transition",
                  filter === f
                    ? "border-emerald-500 bg-white text-emerald-800"
                    : "border-white/60 bg-white/40 text-slate-600 hover:border-emerald-300",
                )}
              >
                {f === "all" ? "All" : f === "todo" ? "Needs work" : "Ready"}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {summary.weakest.length > 0 && filter !== "done" ? (
        <Card className="mb-6 border-dashed">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Do these next</p>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {summary.weakest.map((q) => (
              <li key={q.id} className="flex gap-2">
                <span className="text-emerald-600">→</span>
                <span>{q.question}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="space-y-8">
        {Array.from(grouped.entries()).map(([group, questions]) => (
          <section key={group}>
            <h2 className="mb-2 flex items-baseline gap-2 text-lg font-bold text-slate-900">
              {group}
              <span className="text-xs font-medium text-slate-400">{questions.length} question(s)</span>
            </h2>
            <div className="space-y-3">
              {questions.map((q) => {
                const check = summary.perQuestion[q.id] ?? checkAnswer(q, answers[q.id] ?? "");
                const text = answers[q.id] ?? "";
                return (
                  <Card key={q.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 grow text-sm font-bold text-slate-900">{q.question}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        {check.done ? (
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Ready</Badge>
                        ) : text.trim() ? (
                          <Badge className="border-amber-200 bg-amber-50 text-amber-700">Expand</Badge>
                        ) : (
                          <Badge className="border-slate-200 bg-slate-50 text-slate-500">Not started</Badge>
                        )}
                        <span className={cx("text-xs font-bold", check.score >= 70 ? "text-emerald-700" : "text-slate-400")}>
                          {check.score}/100
                        </span>
                      </div>
                    </div>

                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      <span className="font-bold text-slate-600">What they are testing:</span> {q.lookFor}
                    </p>

                    <Textarea
                      value={text}
                      onChange={(e) => update(q.id, e.target.value)}
                      placeholder="Write it the way you would say it out loud — then trim it."
                      className="mt-2 min-h-24 text-sm"
                    />

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-400">{check.words} words</span>
                      {q.keywords.map((k) => {
                        const hit = check.matched.includes(k);
                        return (
                          <span
                            key={k}
                            className={cx(
                              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              hit ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400",
                            )}
                            title={hit ? "Mentioned" : "Not mentioned yet"}
                          >
                            {k}
                          </span>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {grouped.size === 0 ? (
        <Card className="border-dashed">
          <p className="text-sm text-slate-600">
            {filter === "done" ? "Nothing marked ready yet — start with the course questions." : "Every answer is ready. Re-read them aloud once before the interview."}
          </p>
        </Card>
      ) : null}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {GS_TIPS.map((t) => (
          <Card key={t.title}>
            <p className="text-sm font-bold text-slate-900">{t.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{t.body}</p>
          </Card>
        ))}
      </div>

      <DeviceNote>
        Your drafts stay in this browser — nothing is uploaded. Say each answer out loud; if it sounds memorised, rewrite it in
        your own words.
      </DeviceNote>
    </div>
  );
}

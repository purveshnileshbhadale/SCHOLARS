import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, Textarea, Toast } from "../components/ui";
import { cx } from "../lib/utils";
import { englishEquivalents } from "../lib/normaliser";
import {
  BAND_MEANING,
  CUE_CARDS,
  VOCAB,
  WRITING_CRITERIA,
  WRITING_PROMPTS,
  WRITING_TASK_TYPES,
  bandMeaning,
  bumpSpeakingCount,
  loadMastered,
  loadSpeakingCount,
  loadWritingLog,
  saveMastered,
  saveWritingAttempt,
  type WritingTaskType,
} from "../lib/testPrep";

type Tab = "vocab" | "writing" | "speaking" | "target";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * English test practice — vocabulary flashcards, timed Writing Task 2,
 * Speaking Part 2 cue cards with timers, and a score-target converter that
 * reuses the published concordance table in normaliser.ts.
 */
export default function TestPrep() {
  const [tab, setTab] = useState<Tab>("vocab");
  const [toast, setToast] = useState<string | null>(null);

  // Vocabulary
  const [deck, setDeck] = useState(() => shuffle(VOCAB.map((_, i) => i)));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState<Record<string, number>>(loadMastered);
  const [onlyNew, setOnlyNew] = useState(false);

  // Writing
  const [taskType, setTaskType] = useState<WritingTaskType>("opinion");
  const [promptIdx, setPromptIdx] = useState(() => Math.floor(Math.random() * WRITING_PROMPTS.length));
  const [draft, setDraft] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(40 * 60);
  const [running, setRunning] = useState(false);
  const log = useMemo(() => loadWritingLog(), []);

  // Speaking
  const [cardIdx, setCardIdx] = useState(() => Math.floor(Math.random() * CUE_CARDS.length));
  const [speakPhase, setSpeakPhase] = useState<"idle" | "prep" | "talk" | "done">("idle");
  const [speakLeft, setSpeakLeft] = useState(60);
  const [spoken, setSpoken] = useState(() => loadSpeakingCount());
  const speakRef = useRef<"prep" | "talk">("prep");

  // Target
  const [from, setFrom] = useState<"IELTS" | "TOEFL" | "PTE">("IELTS");
  const [score, setScore] = useState("6.5");

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setRunning(false);
          setToast("Time's up — save your attempt.");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (speakPhase === "idle" || speakPhase === "done") return;
    const id = window.setInterval(() => {
      setSpeakLeft((t) => {
        if (t > 1) return t - 1;
        if (speakRef.current === "prep") {
          speakRef.current = "talk";
          setSpeakPhase("talk");
          setToast("Prep over — start speaking for 2 minutes.");
          return 120;
        }
        setSpeakPhase("done");
        setToast("Two minutes done. How did it feel?");
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [speakPhase]);

  const masteredCount = VOCAB.filter((w) => (mastered[w.word] ?? 0) > 0).length;
  const filteredDeck = useMemo(() => {
    if (!onlyNew) return deck;
    const d = deck.filter((i) => (mastered[VOCAB[i].word] ?? 0) === 0);
    return d.length ? d : deck;
  }, [deck, onlyNew, mastered]);
  const current = filteredDeck[Math.min(pos, filteredDeck.length - 1)];

  const prompt = WRITING_PROMPTS[promptIdx];
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const checkedCount = Object.values(checks).filter(Boolean).length;
  const totalChecks = WRITING_CRITERIA.reduce((n, c) => n + c.checks.length, 0);

  function markKnown(known: boolean) {
    const w = VOCAB[current];
    const next = { ...mastered, [w.word]: Math.max(0, (mastered[w.word] ?? 0) + (known ? 1 : -1)) };
    setMastered(next);
    saveMastered(next);
    setFlipped(false);
    setPos((p) => (p + 1 >= filteredDeck.length ? 0 : p + 1));
  }

  function newPrompt(type?: WritingTaskType) {
    const pool = WRITING_PROMPTS.map((p, i) => ({ p, i })).filter((x) => !type || x.p.type === type);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setPromptIdx(pick.i);
    setChecks({});
    setTimeLeft(40 * 60);
    setRunning(false);
  }

  function resetWriting() {
    setDraft("");
    setChecks({});
    setTimeLeft(40 * 60);
    setRunning(false);
  }

  function saveAttempt() {
    if (wordCount < 40) {
      setToast("Write at least a few sentences before saving an attempt.");
      return;
    }
    saveWritingAttempt({ at: new Date().toISOString(), type: prompt.type, words: wordCount, checked: checkedCount });
    setToast(`Attempt saved — ${wordCount} words, ${checkedCount}/${totalChecks} checks.`);
    resetWriting();
  }

  function startSpeaking() {
    speakRef.current = "prep";
    setSpeakPhase("prep");
    setSpeakLeft(60);
  }

  function finishSpeaking(credit: boolean) {
    if (credit) {
      bumpSpeakingCount();
      setSpoken(loadSpeakingCount());
      setToast("Cue card practised — nice.");
    }
    setSpeakPhase("idle");
    setSpeakLeft(60);
  }

  const eq = useMemo(() => {
    const n = Number.parseFloat(score.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    return englishEquivalents(from, n);
  }, [from, score]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Test prep"
        subtitle="IELTS / PTE practice that works offline — flashcards, a timed Task 2 writer, cue cards with timers and a score target converter."
        right={<Badge className="bg-sky-50 text-sky-700 ring-sky-200">{masteredCount}/{VOCAB.length} words</Badge>}
      />
      <Toast message={toast} />

      <div className="mb-5 flex flex-wrap gap-2">
        {(["vocab", "writing", "speaking", "target"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              "rounded-full border px-4 py-1.5 text-xs font-bold capitalize transition",
              tab === t ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-300",
            )}
          >
            {t === "target" ? "My target" : t}
          </button>
        ))}
      </div>

      {tab === "vocab" && (
        <>
          <Card className="mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Card {(pos % filteredDeck.length) + 1} / {filteredDeck.length}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOnlyNew((v) => !v)}
                  className={cx(
                    "rounded-full border px-3 py-1 text-[11px] font-bold transition",
                    onlyNew ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  {onlyNew ? "New words only" : "All words"}
                </button>
                <button
                  onClick={() => {
                    setDeck(shuffle(VOCAB.map((_, i) => i)));
                    setPos(0);
                    setFlipped(false);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600 transition hover:border-emerald-300"
                >
                  Shuffle
                </button>
              </div>
            </div>

            <button
              onClick={() => setFlipped((f) => !f)}
              className="w-full rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 text-left shadow-sm transition hover:border-emerald-300"
            >
              <p className="text-2xl font-extrabold text-slate-900">{VOCAB[current].word}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{VOCAB[current].pos}</p>
              {flipped ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-slate-700">{VOCAB[current].meaning}</p>
                  <p className="text-sm italic text-slate-500">“{VOCAB[current].example}”</p>
                  <p className="text-xs font-semibold text-slate-400">Synonyms: {VOCAB[current].synonyms.join(", ")}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Tap to reveal meaning, example and synonyms.</p>
              )}
            </button>

            <div className="mt-4 flex gap-3">
              <Button variant="danger" className="flex-1" onClick={() => markKnown(false)}>
                Again
              </Button>
              <Button className="flex-1" onClick={() => markKnown(true)}>
                Got it
              </Button>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(masteredCount / VOCAB.length) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {masteredCount} mastered · {VOCAB.length - masteredCount} to go. “Got it” twice counts as mastered.
            </p>
          </Card>
        </>
      )}

      {tab === "writing" && (
        <>
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Field label="Task type">
                <Select
                  value={taskType}
                  onChange={(e) => {
                    setTaskType(e.target.value as WritingTaskType);
                    const pool = WRITING_PROMPTS.map((p, i) => ({ p, i })).filter((x) => x.p.type === e.target.value);
                    const pick = pool[Math.floor(Math.random() * pool.length)];
                    setPromptIdx(pick.i);
                    setChecks({});
                  }}
                >
                  {WRITING_TASK_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end gap-2">
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Time left</p>
                  <p className={cx("text-3xl font-extrabold tabular-nums", timeLeft === 0 ? "text-rose-600" : running ? "text-emerald-700" : "text-slate-800")}>
                    {fmt(timeLeft)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setRunning((r) => !r)} disabled={timeLeft === 0}>
                    {running ? "Pause" : "Start"}
                  </Button>
                  <Button variant="ghost" onClick={() => { setTimeLeft(40 * 60); setRunning(false); }}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <p className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm font-medium leading-relaxed text-slate-800">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-emerald-600">
                Task 2 — {WRITING_TASK_TYPES.find((t) => t.key === prompt.type)?.label}
              </span>
              {prompt.text}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-slate-500">{WRITING_TASK_TYPES.find((t) => t.key === taskType)?.hint}</p>
              <button onClick={() => newPrompt()} className="text-xs font-bold text-emerald-700 hover:underline">
                Different prompt →
              </button>
            </div>

            <div className="mt-4">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write at least 250 words in 40 minutes…"
                className="min-h-56 font-serif"
              />
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className={cx("font-bold", wordCount >= 250 ? "text-emerald-600" : wordCount >= 150 ? "text-amber-600" : "text-slate-500")}>
                  {wordCount} words {wordCount >= 250 ? "✓" : "— aim 250–290"}
                </span>
                <span className="text-slate-400">{checkedCount}/{totalChecks} self-checks ticked</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={saveAttempt}>Save attempt</Button>
              <Button variant="ghost" onClick={resetWriting}>
                Clear
              </Button>
            </div>
          </Card>

          <Card className="mb-6">
            <h2 className="mb-1 text-sm font-bold text-slate-900">Self-mark against the band criteria</h2>
            <p className="mb-3 text-xs text-slate-500">Tick each line only if it's actually true in your draft — that's how examiners score it.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {WRITING_CRITERIA.map((c) => (
                <div key={c.key} className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800">{c.label}</p>
                    <span className="text-[10px] font-bold uppercase text-slate-400">{c.weight}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {c.checks.map((line) => {
                      const key = `${c.key}:${line.slice(0, 24)}`;
                      return (
                        <li key={key}>
                          <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={!!checks[key]}
                              onChange={(e) => setChecks((cur) => ({ ...cur, [key]: e.target.checked }))}
                              className="mt-0.5 size-3.5 accent-emerald-600"
                            />
                            {line}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            {log.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                {log.length} saved attempt{log.length === 1 ? "" : "s"} · {log.reduce((n, a) => n + a.words, 0)} words written total.
              </p>
            )}
          </Card>
        </>
      )}

      {tab === "speaking" && (
        <Card className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <Badge className="bg-rose-50 text-rose-700 ring-rose-200">Part 2 cue card</Badge>
            <span className="text-xs font-semibold text-slate-500">{spoken} practised</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/70 p-5">
            <p className="text-lg font-extrabold text-slate-900">{CUE_CARDS[cardIdx].topic}</p>
            <p className="mt-1 text-xs text-slate-500">You should say:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
              {CUE_CARDS[cardIdx].bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {speakPhase === "prep" ? "Preparation" : speakPhase === "talk" ? "Speaking" : speakPhase === "done" ? "Done" : "Ready?"}
              </p>
              <p className={cx("text-3xl font-extrabold tabular-nums", speakPhase === "idle" ? "text-slate-400" : "text-emerald-700")}>
                {speakPhase === "idle" ? "1:00 + 2:00" : fmt(speakLeft)}
              </p>
            </div>
            <div className="flex gap-2">
              {speakPhase === "idle" && <Button onClick={startSpeaking}>Start (1 min prep)</Button>}
              {speakPhase !== "idle" && speakPhase !== "done" && (
                <Button variant="ghost" onClick={() => finishSpeaking(false)}>
                  Stop
                </Button>
              )}
              {speakPhase === "done" && (
                <>
                  <Button onClick={() => finishSpeaking(true)}>Practised ✓</Button>
                  <Button variant="ghost" onClick={() => finishSpeaking(false)}>
                    Skip
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => { setCardIdx((i) => (i + 1) % CUE_CARDS.length); setSpeakPhase("idle"); setSpeakLeft(60); }}>
                Next card
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Examiner follow-ups</p>
            <ul className="space-y-1 text-sm text-slate-600">
              {CUE_CARDS[cardIdx].followUps.map((f) => (
                <li key={f} className="rounded-lg bg-slate-50 px-3 py-1.5">
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Tip: record yourself on your phone, then listen back for filler words (um, like, actually) — removing three of them lifts fluency more than
            adding fancy vocabulary.
          </p>
        </Card>
      )}

      {tab === "target" && (
        <>
          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Score target converter</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="I took / will take">
                <Select value={from} onChange={(e) => setFrom(e.target.value as "IELTS" | "TOEFL" | "PTE")}>
                  <option value="IELTS">IELTS</option>
                  <option value="TOEFL">TOEFL iBT</option>
                  <option value="PTE">PTE Academic</option>
                </Select>
              </Field>
              <Field label={`Score (${from === "TOEFL" ? "0–120" : from === "PTE" ? "10–90" : "0–9"})`}>
                <Input value={score} onChange={(e) => setScore(e.target.value)} inputMode="decimal" placeholder={from === "TOEFL" ? "93" : from === "PTE" ? "70" : "6.5"} />
              </Field>
              <div className="flex items-end">
                <Button variant="ghost" className="w-full" onClick={() => setScore(from === "TOEFL" ? "93" : from === "PTE" ? "70" : "6.5")}>
                  Use common target
                </Button>
              </div>
            </div>

            {eq && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "IELTS", v: eq.ielts == null ? "—" : eq.ielts.toFixed(1) },
                  { label: "TOEFL iBT", v: eq.toefl == null ? "—" : String(eq.toefl) },
                  { label: "PTE Academic", v: eq.pte == null ? "—" : String(eq.pte) },
                ].map((r) => (
                  <div key={r.label} className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{r.label}</p>
                    <p className="text-3xl font-extrabold text-slate-900">{r.v}</p>
                  </div>
                ))}
              </div>
            )}

            {eq?.cefr && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <p className="text-sm font-bold text-emerald-800">
                  CEFR {eq.cefr} — {bandMeaning(eq.ielts ?? 0).label}
                </p>
                <p className="text-xs text-emerald-700">{bandMeaning(eq.ielts ?? 0).meaning}</p>
              </div>
            )}
            <p className="mt-3 text-[11px] text-slate-400">
              Conversion uses the published British Council / ETS / Pearson concordance — nearest band to your score.
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-bold text-slate-900">What each band means</h2>
            <ul className="space-y-2">
              {BAND_MEANING.filter((b) => b.min > 0).map((b) => (
                <li key={b.min} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white/60 px-3 py-2">
                  <span className="w-10 shrink-0 text-lg font-extrabold text-emerald-700">{b.min}+</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{b.label}</p>
                    <p className="text-xs text-slate-500">{b.meaning}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {tab === "vocab" && masteredCount === VOCAB.length && (
        <Empty title="Deck complete" body="You've mastered every card — shuffle for a refresher or move to timed writing." />
      )}
    </div>
  );
}

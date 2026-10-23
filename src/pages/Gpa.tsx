import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, Toast } from "../components/ui";
import { cx } from "../lib/utils";
import {
  SCALES,
  bandFor,
  bandForLetter,
  computeGpa,
  gpaClass,
  indianToAustralianBand,
  type GpaUnit,
  type ScaleKey,
} from "../lib/gpa";

const LS_KEY = "sa_gpa_v1";
const LETTERS = ["HD", "D", "C", "P", "F", "H1", "H2", "H2A", "H2B", "H3", "N"];

interface Saved {
  scale: ScaleKey;
  units: GpaUnit[];
}

function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? "null") as Saved | null;
    if (raw && Array.isArray(raw.units) && raw.scale in SCALES) return raw;
  } catch {}
  return { scale: "standard", units: [] };
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * GPA / WAM calculator — Australian grading scales, credit-weighted,
 * with an indicative 7→4 conversion and an Indian-percentage helper.
 */
export default function Gpa() {
  const [state, setState] = useState<Saved>(load);
  const [mark, setMark] = useState("");
  const [name, setName] = useState("");
  const [credits, setCredits] = useState("6");
  const [letter, setLetter] = useState("");
  const [pctHelper, setPctHelper] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const scale = state.scale;
  const result = useMemo(() => computeGpa(state.units, scale), [state.units, scale]);
  const klass = gpaClass(result.gpa7);

  function addUnit(e: React.FormEvent) {
    e.preventDefault();
    const c = Number.parseFloat(credits);
    if (!Number.isFinite(c) || c <= 0) {
      setToast("Credits must be greater than zero.");
      return;
    }
    const m = mark.trim() === "" ? null : Number.parseFloat(mark.replace(",", "."));
    const l = letter.trim() === "" ? null : letter.trim().toUpperCase();
    if (m == null && !l) {
      setToast("Enter a percentage or pick a letter grade.");
      return;
    }
    if (m != null && (!Number.isFinite(m) || m < 0 || m > 100)) {
      setToast("Percentage must be between 0 and 100.");
      return;
    }
    if (m != null && !bandFor(scale, m)) {
      setToast("That mark doesn't fit the selected scale.");
      return;
    }
    if (m == null && l && !bandForLetter(scale, l)) {
      setToast(`The ${SCALES[scale].label.split(" ")[0]} scale has no ${l} band.`);
      return;
    }
    setState((s) => ({
      ...s,
      units: [...s.units, { id: uid(), name: name.trim() || `Unit ${s.units.length + 1}`, mark: m, letter: l, credits: c }],
    }));
    setMark("");
    setName("");
    setLetter("");
  }

  function removeUnit(id: string) {
    setState((s) => ({ ...s, units: s.units.filter((u) => u.id !== id) }));
  }

  const helper = pctHelper.trim() ? indianToAustralianBand(Number.parseFloat(pctHelper.replace(",", "."))) : null;
  const helperPct = Number.parseFloat(pctHelper.replace(",", "."));
  const bands = SCALES[scale].bands;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="GPA & WAM"
        subtitle="Credit-weighted Australian GPA (7-point), WAM and an indicative 4-point conversion — rules from published grade bands, not guesswork."
        right={<Badge className="bg-sky-50 text-sky-700 ring-sky-200">{result.units} units</Badge>}
      />
      <Toast message={toast} />

      <Card className="mb-6">
        <Field label="Grading scale" hint={SCALES[scale].blurb}>
          <Select value={scale} onChange={(e) => setState((s) => ({ ...s, scale: e.target.value as ScaleKey }))}>
            {Object.entries(SCALES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          {bands.map((b) => (
            <span key={b.letter} className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {b.letter} · {b.min}%{b.max != null ? `–${b.max - 1}%` : "+"} → {b.points7} pts
            </span>
          ))}
        </div>
      </Card>

      {/* Results */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "GPA (7-point)", value: result.gpa7 == null ? "—" : result.gpa7.toFixed(2), tone: "text-slate-900" },
          { label: "WAM (%)", value: result.wam == null ? "—" : `${result.wam.toFixed(1)}%`, tone: "text-slate-900" },
          { label: "GPA (4-point, indicative)", value: result.gpa4 == null ? "—" : result.gpa4.toFixed(2), tone: "text-slate-900" },
        ].map((r) => (
          <Card key={r.label}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{r.label}</p>
            <p className={cx("text-3xl font-extrabold", r.tone)}>{r.value}</p>
          </Card>
        ))}
      </div>

      {result.gpa7 != null && (
        <Card className="mb-6">
          <p className={cx("text-sm font-bold", klass.tone)}>{klass.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{klass.note}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(result.bandCounts).map(([letter, n]) => (
              <span key={letter} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                {letter} × {n}
              </span>
            ))}
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{result.totalCredits} credits graded</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            4-point conversion is indicative (7→4.0, 6→3.3, 5→2.3, 4→1.5). Each university converts differently — always check theirs.
          </p>
        </Card>
      )}

      {/* Add unit */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Add a unit</h2>
        <form onSubmit={addUnit} className="grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-4">
            <Field label="Unit / subject">
              <Input placeholder="Data Structures" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Mark %">
              <Input type="number" min="0" max="100" step="0.1" inputMode="decimal" placeholder="82" value={mark} onChange={(e) => setMark(e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="or letter">
              <Select value={letter} onChange={(e) => setLetter(e.target.value)}>
                <option value="">—</option>
                {LETTERS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Credits">
              <Input type="number" min="0" step="0.5" inputMode="decimal" value={credits} onChange={(e) => setCredits(e.target.value)} />
            </Field>
          </div>
          <div className="flex items-end sm:col-span-1">
            <Button type="submit" className="w-full">
              Add
            </Button>
          </div>
        </form>
      </Card>

      {/* Units */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Your transcript</h2>
        {state.units.length === 0 ? (
          <Empty title="No units yet" body="Add each subject with its mark and credit points — the GPA updates as you type." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {state.units.map((u) => {
              const effective = u.mark ?? (u.letter ? bandForLetter(scale, u.letter)?.typical ?? null : null);
              const band = effective != null ? bandFor(scale, effective) : null;
              return (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400">
                      {u.mark != null ? `${u.mark}%` : u.letter}
                      {band ? ` · ${band.label}` : ""} · {u.credits} cr
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={band?.points7 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}>
                      {band?.letter ?? "?"} · {band?.points7 ?? 0} pts
                    </Badge>
                    <button
                      onClick={() => removeUnit(u.id)}
                      aria-label="Remove unit"
                      className="rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                        <path d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {state.units.length > 0 && (
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setState((s) => ({ ...s, units: [] }))}>
              Clear all
            </Button>
          </div>
        )}
      </Card>

      {/* Indian percentage helper */}
      <Card>
        <h2 className="mb-1 text-sm font-bold text-slate-900">Indian percentage helper</h2>
        <p className="mb-3 text-xs text-slate-500">
          Universities often ask how your percentage maps to Australian bands. This uses the common rule-of-thumb thresholds — your official
          transcript + grading note is still what counts.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Aggregate % (e.g. 78.4)">
            <Input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={pctHelper} onChange={(e) => setPctHelper(e.target.value)} />
          </Field>
          {helper && Number.isFinite(helperPct) && (
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-2">
              <p className="text-lg font-extrabold text-slate-900">
                {helper.letter} <span className="text-xs font-semibold text-slate-400">({helperPct}%). </span>
                {helper.note}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

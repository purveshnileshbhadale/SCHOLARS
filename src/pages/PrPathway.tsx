import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  computePoints,
  pathwaySteps,
  POINTS_THRESHOLDS,
  NOMINATION_BONUS,
  type EducationLevel,
  type EnglishLevel,
  type PointsResult,
  type ProfileInput,
  type VisaSubclass,
} from "../lib/prPoints";
import { Badge, Button, Card, Empty, ErrorNote, Input, PageHeader, Select, Spinner, Toast } from "../components/ui";
import { cx } from "../lib/utils";

const LS_KEY = "sa_pr_points_v1";

const DEFAULT: ProfileInput = {
  age: 24,
  english: "proficient",
  overseasYears: 0,
  australianYears: 0,
  education: "bachelor",
  australianStudy: false,
  regionalStudy: false,
  specialistEducation: false,
  partnerEnglish: "single",
  communityLanguage: false,
  subclass: "189",
};

function loadInput(): ProfileInput {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<ProfileInput>) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

const ENGLISH_OPTIONS: { value: EnglishLevel; label: string }[] = [
  { value: "none", label: "Below Competent (< 6.0 each)" },
  { value: "competent", label: "Competent — IELTS 6.0 each" },
  { value: "proficient", label: "Proficient — IELTS 7.0 each" },
  { value: "superior", label: "Superior — IELTS 8.0 each" },
];

const EDU_OPTIONS: { value: EducationLevel; label: string }[] = [
  { value: "none", label: "No formal qualification" },
  { value: "certificate", label: "Diploma / Trade certificate" },
  { value: "bachelor", label: "Bachelor degree" },
  { value: "masters", label: "Masters degree" },
  { value: "phd", label: "Doctorate (PhD)" },
];

const SUBCLASSES: { value: VisaSubclass; label: string; blurb: string }[] = [
  { value: "189", label: "189 — Skilled Independent", blurb: "Permanent. No sponsorship. Highest bar — competitive occupations cleared 85–95 in recent rounds." },
  { value: "190", label: "190 — Skilled Nominated", blurb: "Permanent. State nomination adds +5 points. Must live in the nominating state for 2 years." },
  { value: "491", label: "491 — Skilled Work Regional", blurb: "Provisional (5 yr). +15 points — the biggest single boost. Pathway to 191 PR after 3 years regionally." },
];

/**
 * PR points calculator + 485 → 189/190/491 pathway.
 * All point values come from src/lib/prPoints.ts tables — deterministic,
 * rules-first, per the blueprint.
 */
export default function PrPathway() {
  const [input, setInput] = useState<ProfileInput>(loadInput);
  const [tab, setTab] = useState<"points" | "pathway">("points");
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(`${LS_KEY}_saved`) ?? "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(input));
    } catch {}
  }, [input]);

  const result: PointsResult = useMemo(() => computePoints(input), [input]);
  const steps = useMemo(() => pathwaySteps(input.subclass), [input.subclass]);

  function set<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setInput((cur) => ({ ...cur, [key]: value }));
  }

  function saveSnapshot() {
    const line = `${new Date().toLocaleDateString("en-AU")} — ${result.total} pts (${input.subclass})`;
    const next = [line, ...saved].slice(0, 12);
    setSaved(next);
    try {
      localStorage.setItem(`${LS_KEY}_saved`, JSON.stringify(next));
    } catch {}
    setToast(`Snapshot saved: ${result.total} points`);
  }

  const pct = Math.min(100, Math.round((result.total / 130) * 100)); // 130 ≈ practical max
  const gapToMin = Math.max(0, POINTS_THRESHOLDS.minimum - result.total);
  const gapToComp = Math.max(0, POINTS_THRESHOLDS.competitive - result.total);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="PR pathway"
        subtitle="Points-tested skilled migration (189 / 190 / 491) and the 485 post-study route — every point from an official table."
        right={
          <div className="flex gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1">Min 65</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">Invited 80+</span>
          </div>
        }
      />
      <ErrorNote>{null}</ErrorNote>
      <Toast message={toast} />

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setTab("points")}
          className={cx(
            "rounded-full border px-4 py-1.5 text-xs font-bold transition",
            tab === "points" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-300",
          )}
        >
          Points test
        </button>
        <button
          onClick={() => setTab("pathway")}
          className={cx(
            "rounded-full border px-4 py-1.5 text-xs font-bold transition",
            tab === "pathway" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-300",
          )}
        >
          485 → PR pathway
        </button>
      </div>

      {tab === "points" ? (
        <>
          {/* Score card */}
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Your points — {input.subclass}</p>
                <p className={cx("text-5xl font-extrabold tracking-tight", result.competitive ? "text-emerald-600" : result.meetsMinimum ? "text-amber-600" : "text-rose-600")}>
                  {result.total}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Badge className={result.meetsMinimum ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}>
                  {result.meetsMinimum ? `Meets minimum — ${gapToComp > 0 ? `${gapToComp} short of competitive` : "competitive"}` : `${gapToMin} short of the 65 minimum`}
                </Badge>
                <Badge className={result.competitive ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}>
                  {result.competitive ? "At typical invitation level" : `Need ${gapToComp} more to hit 80`}
                </Badge>
              </div>
            </div>
            <div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cx("h-full rounded-full transition-all duration-500", result.competitive ? "bg-gradient-to-r from-emerald-500 to-teal-500" : result.meetsMinimum ? "bg-gradient-to-r from-amber-400 to-orange-400" : "bg-gradient-to-r from-rose-500 to-red-500")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={saveSnapshot} className="text-xs">Save snapshot</Button>
              <button
                onClick={() => setInput(DEFAULT)}
                className="rounded-xl border border-slate-300/70 bg-white/80 px-4 text-xs font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700"
              >
                Reset
              </button>
            </div>
            {saved.length ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Saved snapshots</p>
                <ul className="mt-1 space-y-0.5">
                  {saved.map((s) => (
                    <li key={s} className="text-xs text-slate-600">{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {/* Inputs */}
          <Card className="mb-6">
            <h3 className="mb-3 font-bold text-slate-900">Your profile</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Subclass targeting</span>
                <Select value={input.subclass} onChange={(e) => set("subclass", e.target.value as VisaSubclass)} className="mt-1">
                  {SUBCLASSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Age</span>
                <Input type="number" min={18} max={49} value={input.age} onChange={(e) => set("age", Math.max(18, Math.min(49, Number(e.target.value) || 18)))} className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">English (highest claimable)</span>
                <Select value={input.english} onChange={(e) => set("english", e.target.value as EnglishLevel)} className="mt-1">
                  {ENGLISH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Highest qualification</span>
                <Select value={input.education} onChange={(e) => set("education", e.target.value as EducationLevel)} className="mt-1">
                  {EDU_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Overseas skilled experience (years, last 10)</span>
                <Input type="number" min={0} max={20} value={input.overseasYears} onChange={(e) => set("overseasYears", Math.max(0, Math.min(20, Number(e.target.value) || 0)))} className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Australian skilled experience (years)</span>
                <Input type="number" min={0} max={20} value={input.australianYears} onChange={(e) => set("australianYears", Math.max(0, Math.min(20, Number(e.target.value) || 0)))} className="mt-1" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Partner English</span>
                <Select
                  value={input.partnerEnglish}
                  onChange={(e) => set("partnerEnglish", e.target.value as ProfileInput["partnerEnglish"])}
                  className="mt-1"
                >
                  <option value="single">Single / no partner claimed</option>
                  <option value="none">Partner — below Competent</option>
                  <option value="competent">Partner — Competent (+5)</option>
                  <option value="proficient">Partner — Proficient (+10)</option>
                  <option value="superior">Partner — Superior (+10)</option>
                </Select>
              </label>
              <div className="space-y-2 pt-5">
                {(
                  [
                    ["australianStudy", "Australian study (2+ yr degree) (+5)"],
                    ["regionalStudy", "Regional campus (+5)"],
                    ["specialistEducation", "Specialist STEM research degree (+10)"],
                    ["communityLanguage", "NAATI community language (+5)"],
                  ] as [keyof ProfileInput, string][]
                ).map(([k, label]) => (
                  <label key={k as string} className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300 text-emerald-600"
                      checked={Boolean(input[k])}
                      onChange={(e) => set(k as never, (e.target.checked ? true : false) as never)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
              {SUBCLASSES.find((s) => s.value === input.subclass)?.blurb}
            </p>
          </Card>

          {/* Breakdown table */}
          <Card className="mb-6 p-0">
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="font-bold text-slate-900">Where your points come from</h3>
              <p className="text-xs text-slate-500">Every row is a fixed Home Affairs table lookup — no estimates.</p>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {result.breakdown.map((b) => (
                  <tr key={b.label} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-2.5">
                      <span className="font-semibold text-slate-800">{b.label}</span>
                      {b.detail ? <span className="block text-xs text-slate-500">{b.detail}</span> : null}
                    </td>
                    <td className={cx("px-5 py-2.5 text-right font-extrabold", b.points > 0 ? "text-emerald-700" : "text-slate-300")}>{b.points}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50/60">
                  <td className="px-5 py-3 font-display font-bold text-slate-900">Total</td>
                  <td className={cx("px-5 py-3 text-right text-2xl font-extrabold", result.competitive ? "text-emerald-600" : result.meetsMinimum ? "text-amber-600" : "text-rose-600")}>
                    {result.total}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Levers */}
          <Card>
            <h3 className="mb-1 font-bold text-slate-900">Fastest ways to add points</h3>
            <p className="mb-3 text-xs text-slate-500">Ranked by effort-to-points ratio for your current profile.</p>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {[
                { gain: 15, label: "Target 491 instead of 189", why: "Regional sponsorship is a +15 point jump — the single biggest lever.", available: input.subclass !== "491" },
                { gain: 10, label: "Raise English to Superior (IELTS 8.0)", why: "From Proficient (7.0) this is +10 and costs one test sitting.", available: input.english !== "superior" },
                { gain: 10, label: "Complete a specialist STEM research degree", why: "+10 on top of the base qualification points.", available: !input.specialistEducation && (input.education === "masters" || input.education === "phd") },
                { gain: 5, label: "Get NAATI credentialed", why: "+5 for a community language credential — self-paced.", available: !input.communityLanguage },
                { gain: 5, label: "Secure state nomination (190)", why: "+5 plus a second invitation pathway.", available: input.subclass !== "190" },
                { gain: 5, label: "Move study to a regional campus", why: "+5 regional study plus often lower tuition.", available: !input.regionalStudy },
                { gain: 5, label: "Clock 1 year of Australian skilled work", why: "+5 once you cross 12 months — the 485 visa is designed for this.", available: input.australianYears < 1 },
              ]
                .filter((x) => x.available)
                .sort((a, b) => b.gain - a.gain)
                .map((x) => (
                  <li key={x.label} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="mt-0.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-extrabold text-emerald-800">+{x.gain}</span>
                    <div>
                      <p className="font-semibold text-slate-800">{x.label}</p>
                      <p className="text-xs text-slate-500">{x.why}</p>
                    </div>
                  </li>
                ))}
            </ul>
          </Card>
        </>
      ) : (
        <>
          {/* Pathway timeline */}
          <Card className="mb-6 border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50/50">
            <p className="text-sm font-semibold text-emerald-900">
              Target: <span className="text-lg font-extrabold">{SUBCLASSES.find((s) => s.value === input.subclass)?.label}</span>
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              Nomination bonus in your points calculation: <strong>+{NOMINATION_BONUS[input.subclass].points}</strong> — {NOMINATION_BONUS[input.subclass].label}
            </p>
            <div className="mt-3 flex gap-2">
              {SUBCLASSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => set("subclass", s.value)}
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs font-bold transition",
                    input.subclass === s.value ? "border-emerald-500 bg-emerald-100 text-emerald-900" : "border-emerald-200 bg-white/70 text-emerald-700 hover:bg-emerald-50",
                  )}
                >
                  {s.value}
                </button>
              ))}
            </div>
          </Card>

          <div className="space-y-3">
            {steps.map((s, i) => (
              <Card key={s.title} className={cx(!s.required && "opacity-75")}>
                <div className="flex gap-3">
                  <span
                    className={cx(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                      s.required ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{s.phase}</span>
                      <h3 className="font-bold text-slate-900">{s.title}</h3>
                      {!s.required ? <Badge className="border-slate-200 bg-slate-50 text-slate-500">Optional</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{s.detail}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="mt-6 border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50/60">
            <h3 className="font-bold text-slate-900">Honest disclaimer</h3>
            <p className="mt-1 text-sm text-slate-700">
              Migration rules, occupation lists and invitation thresholds change frequently. This calculator mirrors the published points test but
              does not assess occupation eligibility, skills assessment outcomes or state nomination criteria. Treat it as a planning signal, not
              migration advice — confirm with a registered migration agent (MARA) before acting.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="https://www.mara.gov.au/" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-700 hover:underline">
                Find a MARA agent ↗
              </a>
              <span className="text-xs text-slate-400">·</span>
              <a href="https://immi.homeaffairs.gov.au/" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-700 hover:underline">
                Home Affairs ↗
              </a>
              <span className="text-xs text-slate-400">·</span>
              <Link to="/counsellors" className="text-xs font-semibold text-emerald-700 hover:underline">
                Talk to a counsellor
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

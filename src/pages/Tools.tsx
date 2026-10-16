import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { StudentProfile, University } from "../lib/types";
import { cx, fetchAudToInr, inr, money } from "../lib/utils";
import { waShareUrl } from "../lib/config";
import { Badge, Button, Card, Empty, Input, PageHeader, Select, Spinner } from "../components/ui";

type Tool = "eligibility" | "cost" | "converter";
type TestKey = "ielts" | "toefl" | "pte";
type Status = "meets" | "close" | "below" | "unknown";

const TESTS: { key: TestKey; label: string; step: string; placeholder: string }[] = [
  { key: "ielts", label: "IELTS Academic", step: "0.5", placeholder: "e.g. 6.5" },
  { key: "toefl", label: "TOEFL iBT", step: "1", placeholder: "e.g. 90" },
  { key: "pte", label: "PTE Academic", step: "1", placeholder: "e.g. 61" },
];

/** Indicative concordance bands (Pearson/ETS published ranges — verify for admissions). */
const CONVERSION: { ielts: string; pte: string; toefl: string }[] = [
  { ielts: "5.0", pte: "36–43", toefl: "35–45" },
  { ielts: "5.5", pte: "42–49", toefl: "46–59" },
  { ielts: "6.0", pte: "50–57", toefl: "60–78" },
  { ielts: "6.5", pte: "58–64", toefl: "79–93" },
  { ielts: "7.0", pte: "65–72", toefl: "94–105" },
  { ielts: "7.5", pte: "73–78", toefl: "106–112" },
  { ielts: "8.0", pte: "79–83", toefl: "113–115" },
  { ielts: "8.5", pte: "84–89", toefl: "116–117" },
];

function minFor(u: University, test: TestKey): number | null {
  if (test === "ielts") return u.ielts_min;
  if (test === "toefl") return u.toefl_min;
  return u.pte_min;
}

function statusOf(min: number | null, score: number | null, test: TestKey): Status {
  if (min == null || score == null || Number.isNaN(score)) return "unknown";
  if (score >= min) return "meets";
  const threshold = test === "ielts" ? 0.5 : test === "toefl" ? 4 : 3;
  return min - score <= threshold ? "close" : "below";
}

const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  meets: { label: "Meets", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  close: { label: "Close", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  below: { label: "Below", cls: "border-rose-200 bg-rose-50 text-rose-800" },
  unknown: { label: "—", cls: "border-slate-200 bg-slate-50 text-slate-500" },
};

const STATUS_ORDER: Record<Status, number> = { meets: 0, close: 1, below: 2, unknown: 3 };

export default function Tools() {
  const { session } = useAuth();
  const [tool, setTool] = useState<Tool>("eligibility");
  const [unis, setUnis] = useState<University[]>([]);
  const [sp, setSp] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Eligibility
  const [test, setTest] = useState<TestKey>("ielts");
  const [score, setScore] = useState("");

  // Cost calculator
  const [costUniId, setCostUniId] = useState("");
  const [tuition, setTuition] = useState("");
  const [living, setLiving] = useState("");
  const [years, setYears] = useState("2");
  const [budget, setBudget] = useState("");
  const [visaFee, setVisaFee] = useState("1600");
  const [oshc, setOshc] = useState("700");
  const [personalMonthly, setPersonalMonthly] = useState("");
  const [hoursFortnight, setHoursFortnight] = useState("48");
  const [hourlyRate, setHourlyRate] = useState("24.10");
  const [fx, setFx] = useState<{ rate: number; live: boolean; at: number }>({ rate: 55.5, live: false, at: 0 });

  // Converter
  const [myTest, setMyTest] = useState<TestKey>("ielts");
  const [myScore, setMyScore] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: ul }, { data: spl }] = await Promise.all([
        supabase.from("universities").select("*").order("qs_rank", { ascending: true, nullsFirst: false }),
        session ? supabase.from("student_profiles").select("*").eq("user_id", session.user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setUnis((ul as University[]) ?? []);
      setSp((spl as StudentProfile) ?? null);
      setLoading(false);
    })();
  }, [session]);

  // Prefill eligibility scores from onboarding (once).
  useEffect(() => {
    if (!sp || score !== "") return;
    if (sp.ielts != null) {
      setTest("ielts");
      setScore(String(sp.ielts));
    } else if (sp.toefl != null) {
      setTest("toefl");
      setScore(String(sp.toefl));
    } else if (sp.pte != null) {
      setTest("pte");
      setScore(String(sp.pte));
    }
  }, [sp, score]);

  // Live FX (feature: AUD→INR with cache + fallback).
  useEffect(() => {
    fetchAudToInr().then(setFx);
  }, []);

  // Prefill budget once.
  useEffect(() => {
    if (sp?.budget_aud_per_year != null && budget === "") setBudget(String(sp.budget_aud_per_year));
  }, [sp, budget]);

  // Prefill cost inputs when the selected university changes.
  useEffect(() => {
    const u = unis.find((x) => x.id === costUniId);
    if (!u) return;
    setTuition(u.tuition_aud != null ? String(u.tuition_aud) : "");
    setLiving(u.living_cost_aud != null ? String(u.living_cost_aud) : "");
  }, [costUniId, unis]);

  const scoreNum = score.trim() === "" ? null : Number(score);

  const eligibilityRows = useMemo(() => {
    const rows = unis.map((u) => {
      const min = minFor(u, test);
      return { u, min, st: statusOf(min, scoreNum, test) };
    });
    rows.sort((a, b) => STATUS_ORDER[a.st] - STATUS_ORDER[b.st] || (a.u.qs_rank ?? 1e9) - (b.u.qs_rank ?? 1e9));
    return rows;
  }, [unis, test, scoreNum]);

  const counts = useMemo(() => {
    const c = { meets: 0, close: 0, below: 0, unknown: 0 } as Record<Status, number>;
    for (const r of eligibilityRows) c[r.st] += 1;
    return c;
  }, [eligibilityRows]);

  const costUni = unis.find((u) => u.id === costUniId) ?? null;
  const tuitionN = Number(tuition) || 0;
  const livingN = Number(living) || 0;
  const yearsN = Math.max(1, Math.min(4, Number(years) || 2));
  const yearlyTotal = tuitionN + livingN;
  const degreeTotal = yearlyTotal * yearsN;
  const budgetN = budget.trim() === "" ? null : Number(budget) || 0;
  const gap = budgetN == null ? null : budgetN - yearlyTotal;

  // One-off visa & health-insurance costs (editable — fees change; verify before paying).
  const visaN = Number(visaFee) || 0;
  const oshcYearly = Number(oshc) || 0;
  const oshcTotal = oshcYearly * yearsN;
  const oneOffTotal = visaN + oshcTotal;

  // Personal discretionary spend (monthly) folded into the split.
  const personalYearly = (Number(personalMonthly) || 0) * 12;
  const personalTotal = personalYearly * yearsN;

  // Part-time earnings estimate (student visa work rights change — verify at Home Affairs).
  const hours = Math.max(0, Math.min(80, Number(hoursFortnight) || 0));
  const rate = Math.max(0, Number(hourlyRate) || 0);
  const earningsYearly = hours * rate * 26; // 26 fortnights / year
  const earningsPctOfLiving = livingN > 0 ? Math.round((earningsYearly / livingN) * 100) : 0;

  // Budget split (feature: shareable budget summary).
  const split = [
    { key: "Tuition", aud: tuitionN * yearsN, cls: "bg-emerald-500" },
    { key: "Living", aud: livingN * yearsN, cls: "bg-sky-500" },
    { key: "Personal", aud: personalTotal, cls: "bg-amber-400" },
    { key: "Visa + OSHC", aud: oneOffTotal, cls: "bg-violet-500" },
  ];
  const splitSum = split.reduce((s, x) => s + x.aud, 0);

  const shareSummary = () => {
    const lines = [
      `Scholars Abroad — budget plan${costUni ? ` · ${costUni.name}` : ""}`,
      `Horizon: ${yearsN} year${yearsN > 1 ? "s" : ""}`,
      ...split.filter((x) => x.aud > 0).map((x) => `${x.key}: ${money(x.aud)} (${inr(x.aud, fx.rate)})`),
      `Total: ${money(splitSum)} (${inr(splitSum, fx.rate)})`,
      earningsYearly > 0 ? `Part-time estimate: ${money(earningsYearly)}/yr (${earningsPctOfLiving}% of living)` : "",
      budgetN != null ? `Budget: ${money(budgetN)}/yr → ${gap! >= 0 ? `surplus ${money(gap!)}/yr` : `gap ${money(-gap!)}/yr`}` : "",
      "Indicative only — verify fees, visa and work rules on official sites.",
    ].filter(Boolean);
    return lines.join("\n");
  };

  const [copiedSummary, setCopiedSummary] = useState(false);
  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(shareSummary());
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const converterHighlight = useMemo(() => {
    const v = myScore.trim() === "" ? null : Number(myScore);
    if (v == null || Number.isNaN(v)) return null;
    let best = 0;
    let bestDist = Infinity;
    CONVERSION.forEach((row, i) => {
      const raw = row[myTest].replace("–", " ");
      const nums = raw.split(/\s+/).map(Number).filter((n) => !Number.isNaN(n));
      if (!nums.length) return;
      const mid = nums.length === 2 ? (nums[0] + nums[1]) / 2 : nums[0];
      const dist = Math.abs(v - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }, [myTest, myScore]);

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  const tabs: { key: Tool; label: string }[] = [
    { key: "eligibility", label: "Am I eligible?" },
    { key: "cost", label: "Cost calculator" },
    { key: "converter", label: "Score converter" },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Free tools for Australia"
        subtitle="Check your entry chances, true degree costs and score equivalents — built on the same data as your shortlist."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button key={t.key} variant={tool === t.key ? "primary" : "ghost"} onClick={() => setTool(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tool === "eligibility" ? (
        <Card>
          <h2 className="font-bold text-slate-900">Am I eligible? — English entry checker</h2>
          <p className="mt-1 text-sm text-slate-500">
            Compare your score against each university's indicative minimum English requirement. Program-level requirements
            can be higher or lower — always confirm on the program page.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Select value={test} onChange={(e) => setTest(e.target.value as TestKey)} aria-label="Test type">
              {TESTS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              step={TESTS.find((t) => t.key === test)?.step}
              placeholder={TESTS.find((t) => t.key === test)?.placeholder}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              aria-label="Your score"
            />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {sp ? <span className="font-semibold text-emerald-700">Prefilled from your profile</span> : null}
              {score !== "" ? (
                <button className="font-semibold text-slate-500 hover:text-slate-800" onClick={() => setScore("")}>
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Badge className={STATUS_STYLE.meets.cls}>{counts.meets} meet</Badge>
            <Badge className={STATUS_STYLE.close.cls}>{counts.close} close</Badge>
            <Badge className={STATUS_STYLE.below.cls}>{counts.below} below</Badge>
            <Badge className={STATUS_STYLE.unknown.cls}>{counts.unknown} no score entered</Badge>
          </div>

          <ul className="mt-4 divide-y divide-slate-100">
            {eligibilityRows.map(({ u, min, st }) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="min-w-52 grow text-sm font-semibold text-slate-800">{u.name}</span>
                <span className="text-xs text-slate-500">
                  {u.city} · req {test.toUpperCase()} {min ?? "—"}
                  {scoreNum != null && min != null ? ` · you: ${score}` : ""}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="hidden text-xs text-slate-400 sm:inline">Intakes {(u.intakes ?? []).join(", ") || "—"}</span>
                  <Badge className={STATUS_STYLE[st].cls}>{STATUS_STYLE[st].label}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tool === "cost" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <h2 className="font-bold text-slate-900">True cost of your degree</h2>
            <p className="mt-1 text-sm text-slate-500">
              Tuition and living figures prefill from the directory — edit them to match your offer or program page.
            </p>
            <div className="mt-4 space-y-3">
              <Select value={costUniId} onChange={(e) => setCostUniId(e.target.value)} aria-label="University">
                <option value="">Choose a university…</option>
                {unis.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-500">
                  Tuition / yr (AUD)
                  <Input
                    className="mt-1"
                    type="number"
                    value={tuition}
                    onChange={(e) => setTuition(e.target.value)}
                    placeholder="e.g. 45000"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Living / yr (AUD)
                  <Input
                    className="mt-1"
                    type="number"
                    value={living}
                    onChange={(e) => setLiving(e.target.value)}
                    placeholder="e.g. 23000"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Years
                  <Select className="mt-1" value={years} onChange={(e) => setYears(e.target.value)}>
                    {[1, 2, 3, 4].map((y) => (
                      <option key={y} value={String(y)}>
                        {y} year{y > 1 ? "s" : ""}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Your budget / yr (AUD)
                  <Input
                    className="mt-1"
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 65000"
                  />
                </label>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Visa & health cover (one-off + yearly)</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-500">
                    Student visa fee (AUD)
                    <Input className="mt-1" type="number" value={visaFee} onChange={(e) => setVisaFee(e.target.value)} />
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    OSHC / yr (AUD)
                    <Input className="mt-1" type="number" value={oshc} onChange={(e) => setOshc(e.target.value)} />
                  </label>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  Indicative defaults — subclass 500 fees and OSHC premiums change; confirm on homeaffairs.gov.au and your
                  insurer before paying.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Part-time earnings estimate</p>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <label className="text-xs font-semibold text-slate-500">
                    Hrs / fortnight
                    <Input className="mt-1" type="number" value={hoursFortnight} onChange={(e) => setHoursFortnight(e.target.value)} />
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Rate (AUD/hr)
                    <Input className="mt-1" type="number" step="0.10" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Personal / mo (AUD)
                    <Input className="mt-1" type="number" value={personalMonthly} onChange={(e) => setPersonalMonthly(e.target.value)} />
                  </label>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  Rate is your editable indicative minimum wage — update it from fairwork.gov.au. Student visa work rights
                  change with policy; confirm your allowed hours at homeaffairs.gov.au.
                </p>
              </div>
              {costUni?.intakes?.length ? (
                <p className="text-xs text-slate-400">Intakes: {costUni.intakes.join(", ")}</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="font-bold text-slate-900">Result</h2>
            {!costUniId ? (
              <Empty title="Pick a university" body="Choose one on the left to see costs." />
            ) : (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Per year (tuition + living)" value={money(yearlyTotal)} sub={inr(yearlyTotal, fx.rate)} />
                  <Stat
                    label={`${yearsN}-year total`}
                    value={money(degreeTotal)}
                    sub={inr(degreeTotal, fx.rate)}
                    highlight
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label={`Tuition × ${yearsN} yr`} value={money(tuitionN * yearsN)} sub={inr(tuitionN * yearsN, fx.rate)} />
                  <Stat label={`Living × ${yearsN} yr`} value={money(livingN * yearsN)} sub={inr(livingN * yearsN, fx.rate)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label="Visa + OSHC"
                    value={money(oneOffTotal)}
                    sub={`${inr(oneOffTotal, fx.rate)} · visa ${money(visaN)} + OSHC ${money(oshcTotal)}`}
                  />
                  <Stat
                    label="Part-time earnings /yr (est.)"
                    value={earningsYearly > 0 ? money(earningsYearly) : "—"}
                    sub={
                      earningsYearly > 0
                        ? `${inr(earningsYearly, fx.rate)} · ≈${earningsPctOfLiving}% of living costs`
                        : "Add hours + rate to estimate"
                    }
                  />
                </div>
                {splitSum > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Budget split · {money(splitSum)} ({inr(splitSum, fx.rate)})
                    </p>
                    <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
                      {split
                        .filter((x) => x.aud > 0)
                        .map((x) => (
                          <div
                            key={x.key}
                            className={x.cls}
                            style={{ width: `${(x.aud / splitSum) * 100}%` }}
                            title={`${x.key}: ${money(x.aud)}`}
                          />
                        ))}
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                      {split
                        .filter((x) => x.aud > 0)
                        .map((x) => (
                          <li key={x.key} className="flex items-center gap-1.5">
                            <span className={cx("inline-block size-2 rounded-full", x.cls)} />
                            {x.key} <strong>{money(x.aud)}</strong>
                          </li>
                        ))}
                    </ul>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button variant="ghost" onClick={copySummary}>
                        {copiedSummary ? "Copied ✓" : "Copy summary"}
                      </Button>
                      <Button variant="ghost" onClick={() => window.open(waShareUrl(shareSummary()), "_blank", "noopener")}>
                        Share on WhatsApp
                      </Button>
                    </div>
                  </div>
                ) : null}
                {gap != null ? (
                  <div
                    className={cx(
                      "rounded-xl border px-3 py-2.5 text-sm font-semibold",
                      gap >= 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-rose-200 bg-rose-50 text-rose-800",
                    )}
                  >
                    {gap >= 0
                      ? `Within budget — ${money(gap)}/yr to spare (${inr(gap, fx.rate)})`
                      : `Over budget by ${money(-gap)}/yr (${inr(-gap, fx.rate)}) — consider a lower-fee city or a scholarship`}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Add your yearly budget to see a fit verdict.</p>
                )}
                <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                  <p className="font-semibold text-slate-700">Visa funds indicator</p>
                  <p className="mt-1">
                    For the student visa you'll need to show roughly <strong>A$30,000 for 12 months</strong> of living costs
                    (plus travel and tuition evidence) — an indicative figure; confirm the current amount on the Home
                    Affairs website.
                  </p>
                </div>
                <p className="text-[11px] text-slate-400">
                  {fx.live
                    ? `Converted at A$1 = ₹${fx.rate.toFixed(2)} (${fx.at ? new Date(fx.at).toLocaleDateString("en-AU") : "cached rate"}).`
                    : `Converted at an indicative A$1 = ₹${fx.rate.toFixed(2)} fallback (live rates unavailable).`}{" "}
                  Figures are indicative (data year {costUni?.data_year ?? "—"}), not a quote.
                </p>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tool === "converter" ? (
        <Card>
          <h2 className="font-bold text-slate-900">IELTS ↔ PTE ↔ TOEFL converter</h2>
          <p className="mt-1 text-sm text-slate-500">
            Indicative concordance bands. Universities accept specific tests at specific minimums — check which test your
            program accepts.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Select className="w-44" value={myTest} onChange={(e) => setMyTest(e.target.value as TestKey)} aria-label="Your test">
              {TESTS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Input
              className="w-40"
              type="number"
              value={myScore}
              onChange={(e) => setMyScore(e.target.value)}
              placeholder="Your score"
            />
          </div>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="border-b border-slate-200 p-2">IELTS Academic</th>
                <th className="border-b border-slate-200 p-2">PTE Academic</th>
                <th className="border-b border-slate-200 p-2">TOEFL iBT</th>
              </tr>
            </thead>
            <tbody>
              {CONVERSION.map((row, i) => (
                <tr key={row.ielts} className={cx( converterHighlight === i && "bg-emerald-50 font-bold text-emerald-900")}>
                  <td className="border-b border-slate-100 p-2">{row.ielts}</td>
                  <td className="border-b border-slate-100 p-2">{row.pte}</td>
                  <td className="border-b border-slate-100 p-2">{row.toefl}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {converterHighlight != null ? (
            <p className="mt-3 text-xs font-semibold text-emerald-700">
              Closest band: IELTS {CONVERSION[converterHighlight].ielts} · PTE {CONVERSION[converterHighlight].pte} · TOEFL{" "}
              {CONVERSION[converterHighlight].toefl}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={cx("rounded-xl border px-3 py-2.5", highlight ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50")}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx("text-lg font-bold", highlight ? "text-emerald-800" : "text-slate-900")}>{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}

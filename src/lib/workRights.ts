/**
 * Work-rights engine — student visa (subclass 500) compliance.
 *
 * Home Affairs condition 8547 (in effect for student visas):
 *   • 48 hours per fortnight while your course is in session
 *   • Unlimited hours during scheduled course breaks
 *
 * A "fortnight" is defined by the Department as 14 consecutive days
 * beginning on a Monday. All math here is deterministic — no LLM.
 */

export interface WorkEntry {
  /** YYYY-MM-DD */
  date: string;
  hours: number;
  note?: string;
}

export const HOURS_LIMIT = 48;
export const FORTNIGHT_DAYS = 14;

function toMs(d: string): number {
  return new Date(`${d}T00:00:00`).getTime();
}

function fromMs(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function localToday(): string {
  return fromMs(Date.now());
}

/** The Monday that starts the fortnight containing `date` (YYYY-MM-DD). */
export function fortnightStart(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const day = d.getDay(); // 0 = Sun … 6 = Sat
  // Monday = 1 … Sunday = 0 → shift back to the most recent Monday.
  const backToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - backToMonday);
  return fromMs(d.getTime());
}

/** Both YYYY-MM-DD dates of the 14-day fortnight containing `date`. */
export function fortnightWindow(date: string): { start: string; end: string } {
  const start = fortnightStart(date);
  const s = new Date(`${start}T00:00:00`);
  s.setDate(s.getDate() + FORTNIGHT_DAYS - 1);
  return { start, end: fromMs(s.getTime()) };
}

export interface FortnightSummary {
  start: string;
  end: string;
  hours: number;
  remaining: number;
  pct: number;
  overLimit: boolean;
  warning: boolean; // ≥ 80% of the cap
  entries: WorkEntry[];
}

/** Sum all entries that fall inside the fortnight containing `date`. */
export function currentFortnight(entries: WorkEntry[], date = localToday()): FortnightSummary {
  const { start, end } = fortnightWindow(date);
  const s = toMs(start);
  const e = toMs(end);
  const inside = entries.filter((x) => {
    const t = toMs(x.date);
    return t >= s && t <= e;
  });
  const hours = inside.reduce((sum, x) => sum + Math.max(0, x.hours || 0), 0);
  const remaining = Math.max(0, HOURS_LIMIT - hours);
  return {
    start,
    end,
    hours,
    remaining,
    pct: Math.min(100, Math.round((hours / HOURS_LIMIT) * 100)),
    overLimit: hours > HOURS_LIMIT,
    warning: hours >= HOURS_LIMIT * 0.8 && hours <= HOURS_LIMIT,
    entries: inside.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** Every fortnight that has at least one entry, newest first. */
export function history(entries: WorkEntry[]): FortnightSummary[] {
  const seen = new Map<string, FortnightSummary>();
  for (const e of entries) {
    const { start } = fortnightWindow(e.date);
    if (!seen.has(start)) seen.set(start, currentFortnight(entries, start));
  }
  return [...seen.values()].sort((a, b) => b.start.localeCompare(a.start));
}

export function parseISO(d: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : localToday();
}

export function formatShort(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function formatRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const sameMonth = s.getMonth() === e.getMonth();
  const sPart = s.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const ePart = e.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  return sameMonth ? `${s.getDate()}–${ePart}` : `${sPart} – ${ePart}`;
}

/** Earnings with a TFN vs without — Australian withholding schedule. */
export function estimateTax(gross: number, hasTfn: boolean): { net: number; withheld: number; note: string } {
  if (!hasTfn) {
    // No TFN quoted: employer must withhold from the first dollar at the
    // top marginal rate (47% including Medicare levy) — approximated at 45%.
    const withheld = Math.round(gross * 0.45);
    return { net: gross - withheld, withheld, note: "No TFN quoted — employer withholds ~45% from the first dollar." };
  }
  // With a TFN, the tax-free threshold ($18,200/yr ≈ $699/fn) applies.
  const fortnightlyThreshold = 18200 / 26;
  const taxable = Math.max(0, gross - fortnightlyThreshold);
  // Simplified progressive: 15% on first tranche, 30% above $45k/yr.
  const over45kFortnightly = 45000 / 26;
  let tax = 0;
  if (taxable <= over45kFortnightly) tax = taxable * 0.15;
  else tax = over45kFortnightly * 0.15 + (taxable - over45kFortnightly) * 0.3;
  const withheld = Math.round(tax);
  return { net: gross - withheld, withheld, note: "TFN quoted — tax-free threshold applied. Estimates only." };
}

export interface PayslipCheck {
  label: string;
  why: string;
}

export const PAYSLIP_CHECKS: PayslipCheck[] = [
  { label: "Gross and net pay shown separately", why: "Fair Work requires both on every payslip." },
  { label: "Employer name, ABN and your name", why: "Missing ABN is a red flag for cash-in-hand work." },
  { label: "Pay period and date of payment", why: "Needed to reconcile against your 48-hour fortnight log." },
  { label: "Hours worked and hourly rate", why: "The number you log here must match the payslip." },
  { label: "Deductions itemised (tax, super, fees)", why: "Any unexplained deduction can be recovered from the Fair Work Ombudsman." },
  { label: "Super guarantee paid to your fund", why: "11.5% on top of wages for most students — check your super fund balance annually." },
];

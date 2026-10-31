// ============================================================
// OSHC planner — Overseas Student Health Cover
//
// The rules here are the ones that catch people out:
//  · cover must run for the whole stay, not just teaching weeks;
//  · a student visa cannot be granted without continuous cover;
//  · premiums are billed in whole months, rounded up.
//
// Premiums are NOT hard-coded: published rates change every year, so the
// student enters the quote their provider gave them and we do the maths.
// ============================================================

export type CoverType = "single" | "couple" | "family";

export const COVER_LABEL: Record<CoverType, string> = {
  single: "Single",
  couple: "Couple (you + partner)",
  family: "Family (you + partner + children)",
};

const DAY_MS = 86_400_000;

/** How long cover must run. */
export interface CoverWindow {
  start: string;
  end: string;
  days: number;
  /** Whole months to pay for (rounded up — providers bill monthly). */
  months: number;
}

function parse(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local calendar date as YYYY-MM-DD. Never use toISOString here: it shifts the day in IST/AEST. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function iso(d: Date): string {
  return isoDate(d);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Add whole months, clamping the day (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/**
 * The cover window a student visa needs.
 *
 * Start: a fortnight before the course so arrival is covered (Home Affairs
 * requires cover from the day you arrive if that is earlier).
 * End: course end plus the buffer your provider will quote — two months is the
 * common default and covers the gap before the 485 decision.
 */
export function requiredCover(
  courseStart: string,
  courseEnd: string,
  opts: { startBufferDays?: number; endBufferMonths?: number } = {},
): CoverWindow | null {
  const start = parse(courseStart);
  const end = parse(courseEnd);
  if (!start || !end) return null;

  const startBuffer = opts.startBufferDays ?? 14;
  const endBuffer = opts.endBufferMonths ?? 2;

  const policyStart = addDays(start, -startBuffer);
  if (end <= start) return null;
  const policyEnd = addMonths(end, endBuffer);
  if (policyEnd <= policyStart) return null;

  const days = Math.round((policyEnd.getTime() - policyStart.getTime()) / DAY_MS);
  return { start: iso(policyStart), end: iso(policyEnd), days, months: Math.ceil(days / 30.44) };
}

/** Include an existing policy start so back-to-back cover never leaves a gap. */
export function coverFromPolicy(policyStart: string, courseEnd: string, endBufferMonths = 2): CoverWindow | null {
  const start = parse(policyStart);
  const end = parse(courseEnd);
  if (!start || !end) return null;
  const policyEnd = addMonths(end, endBufferMonths);
  if (policyEnd <= start) return null;
  const days = Math.round((policyEnd.getTime() - start.getTime()) / DAY_MS);
  return { start: iso(start), end: iso(policyEnd), days, months: Math.ceil(days / 30.44) };
}

export interface Quote {
  id: string;
  provider: string;
  /** What the provider quoted per month, in AUD. */
  monthly: number;
}

export interface QuoteTotal {
  id: string;
  provider: string;
  monthly: number;
  total: number;
  annualised: number;
  weekly: number;
}

/** Total cost of a quote over the required cover, plus annual/weekly yardsticks. */
export function totalFor(quote: Quote, months: number): QuoteTotal {
  const total = Math.round(quote.monthly * months * 100) / 100;
  return {
    id: quote.id,
    provider: quote.provider,
    monthly: quote.monthly,
    total,
    annualised: Math.round(quote.monthly * 12 * 100) / 100,
    weekly: months > 0 ? Math.round((total / (months * 4.345)) * 100) / 100 : 0,
  };
}

export function rankQuotes(quotes: Quote[], months: number): QuoteTotal[] {
  return quotes
    .filter((q) => q.monthly > 0)
    .map((q) => totalFor(q, months))
    .sort((a, b) => a.total - b.total);
}

export function cheapest(ranked: QuoteTotal[]): QuoteTotal | null {
  return ranked[0] ?? null;
}

export function savingsVs(ranked: QuoteTotal[], baseline: QuoteTotal | null): number {
  if (!baseline || ranked.length < 2) return 0;
  return Math.round((baseline.total - ranked[0].total) * 100) / 100;
}

/** Things students get caught on — shown alongside the numbers. */
export const OSHC_CHECKS: { title: string; body: string }[] = [
  {
    title: "No gaps, ever",
    body: "Cover has to be continuous from the day you arrive until your visa ends. A one-week gap can hold up a visa grant or a future visa application.",
  },
  {
    title: "Cover the whole family on the visa",
    body: "If your partner or children are on your student visa, they need cover for the same dates — a single policy will not do.",
  },
  {
    title: "Check the waiting periods",
    body: "Pregnancy and pre-existing conditions often have a 12-month waiting period. If they matter to you, compare policies, not just prices.",
  },
  {
    title: "Ambulance cover varies",
    body: "Some policies cap emergency ambulance. In Australia an ambulance call-out can cost over A$1,000, so check the benefit limit.",
  },
  {
    title: "Keep the certificate",
    body: "Your provider issues a certificate of cover — you need the policy number and dates for the visa application and for your university's enrolment check.",
  },
  {
    title: "You can switch providers",
    body: "OSHC is not tied to your university. You can change provider between policies as long as cover never lapses.",
  },
];

/** The dates a typical first-year student would enter, used as sensible defaults. */
export function defaultCourseDates(): { start: string; end: string } {
  const now = new Date();
  const year = now.getMonth() > 1 ? now.getFullYear() + 1 : now.getFullYear();
  const start = new Date(year, 1, 23); // late February intake (local date, never UTC)
  const end = addMonths(start, 36); // a three-year bachelor
  return { start: iso(start), end: iso(end) };
}

import { CITY_COSTS, cityTotal, type CityCost } from "./costOfLiving";

/**
 * Budget engine — monthly expense tracking against a student budget.
 * Benchmark rows come from the shared CITY_COSTS table (planning estimates).
 * All math is deterministic; persistence is localStorage (no migration).
 */

export interface Expense {
  /** YYYY-MM-DD */
  date: string;
  amount: number;
  category: BudgetCategory;
  note?: string;
}

export type BudgetCategory =
  | "rent"
  | "utilities"
  | "groceries"
  | "transport"
  | "entertainment"
  | "dining"
  | "health"
  | "study"
  | "other";

export interface CategoryMeta {
  key: BudgetCategory;
  label: string;
  icon: string;
  /** Maps onto the COST_CATEGORIES benchmark key when there is one. */
  benchmarkKey?: keyof Omit<CityCost, "city" | "country" | "sourceNote">;
}

export const BUDGET_CATEGORIES: CategoryMeta[] = [
  { key: "rent", label: "Rent", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10", benchmarkKey: "rent" },
  { key: "utilities", label: "Utilities & internet", icon: "M13 2L3 14h9l-1 8 10-12h-9z", benchmarkKey: "utilities" },
  { key: "groceries", label: "Groceries", icon: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z M3 6h18 M16 10a4 4 0 01-8 0", benchmarkKey: "groceries" },
  { key: "transport", label: "Transport", icon: "M5 17h14M6 17l1.5-6h9L18 17M8 11V7a4 4 0 018 0v4", benchmarkKey: "transport" },
  { key: "entertainment", label: "Everyday & fun", icon: "M12 3v18M3 12h18", benchmarkKey: "entertainment" },
  { key: "dining", label: "Dining out", icon: "M5 3v8a3 3 0 006 0V3 M8 11v10 M17 3c-1.5 2-2 4-2 6h4c0-2-.5-4-2-6z M17 9v12" },
  { key: "health", label: "Health & pharmacy", icon: "M12 5v14M5 12h14" },
  { key: "study", label: "Study materials", icon: "M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" },
  { key: "other", label: "Other", icon: "M12 2a10 10 0 100 20 10 10 0 000-20z" },
];

export const CATEGORY_META = Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c.key, c])) as Record<BudgetCategory, CategoryMeta>;

export interface BudgetSettings {
  /** Total monthly budget in AUD. */
  total: number;
  /** Optional per-category ceilings. */
  limits: Partial<Record<BudgetCategory, number>>;
  /** Preferred city — used for the benchmark row. */
  city: string;
}

export const DEFAULT_BUDGET: BudgetSettings = { total: 2500, limits: {}, city: "Melbourne" };

const LS_SETTINGS = "sa_budget_v1";
const LS_EXPENSES = "sa_expenses_v1";

export function loadSettings(): BudgetSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    return raw ? { ...DEFAULT_BUDGET, ...(JSON.parse(raw) as Partial<BudgetSettings>) } : DEFAULT_BUDGET;
  } catch {
    return DEFAULT_BUDGET;
  }
}

export function saveSettings(s: BudgetSettings) {
  try {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  } catch {}
}

export function loadExpenses(): Expense[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_EXPENSES) ?? "[]") as Expense[];
    return Array.isArray(raw) ? raw.filter((e) => e && e.date && typeof e.amount === "number") : [];
  } catch {
    return [];
  }
}

export function saveExpenses(list: Expense[]) {
  try {
    localStorage.setItem(LS_EXPENSES, JSON.stringify(list));
  } catch {}
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function currentMonth(): string {
  return monthKey(new Date().toISOString().slice(0, 10));
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

export interface MonthSummary {
  key: string;
  label: string;
  spent: number;
  byCategory: Record<BudgetCategory, number>;
  count: number;
}

export function summarize(expenses: Expense[], key: string): MonthSummary {
  const rows = expenses.filter((e) => monthKey(e.date) === key);
  const byCategory = Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c.key, 0])) as Record<BudgetCategory, number>;
  let spent = 0;
  for (const r of rows) {
    const amt = Math.max(0, r.amount);
    spent += amt;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + amt;
  }
  return { key, label: monthLabel(key), spent, byCategory, count: rows.length };
}

/** Days elapsed and projected spend at the current burn rate. */
export function projection(spent: number, dayOfMonth: number, daysInMonth: number): { dailyAvg: number; projected: number; onTrack: boolean } {
  const d = Math.max(1, dayOfMonth);
  const dailyAvg = spent / d;
  const projected = dailyAvg * daysInMonth;
  return { dailyAvg, projected, onTrack: true };
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Find a benchmark city row — exact, then case-insensitive, then null. */
export function benchmarkFor(city: string): CityCost | null {
  if (!city) return null;
  const needle = city.trim().toLowerCase();
  return CITY_COSTS.find((c) => c.city.toLowerCase() === needle) ?? null;
}

export function benchmarkTotal(c: CityCost): number {
  return cityTotal(c);
}

/** Last 6 months of keys, newest first — including the current month. */
export function recentMonths(expenses: Expense[], span = 6): string[] {
  const keys = new Set(expenses.map((e) => monthKey(e.date)));
  keys.add(currentMonth());
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < span; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (keys.has(k)) out.push(k);
  }
  return out;
}

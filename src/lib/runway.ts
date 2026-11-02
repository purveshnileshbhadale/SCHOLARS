// ============================================================
// Affordability runway — can the shortlist be funded, and how?
//
// Rules only, no LLM. Takes a degree's true cost and the student's
// available funds (savings + scholarship + sanctioned loan) and
// projects the funding gap across the course years.
// ============================================================

export interface CostInput {
  tuitionAud: number;
  livingCostAud: number;
  /** OSHC premium in AUD/month. */
  oshcMonthly: number;
  /** Course length in years. */
  years: number;
}

/** True total cost: tuition + living + health cover over the whole course. */
export function degreeCost(c: CostInput): number {
  const years = Math.max(0, c.years);
  const oshcMonths = Math.max(0, Math.ceil((Math.max(1, years) * 365.25) / 30.44));
  const oshcTotal = c.oshcMonthly * oshcMonths;
  return c.tuitionAud * years + c.livingCostAud * years + oshcTotal;
}

export type RunwayStatus = "afford" | "tight" | "beyond";

export interface RunwayRow {
  id: string;
  name: string;
  cost: number;
  available: number;
  gap: number;
  /** How many of the course years savings alone can cover. */
  yearsAffordable: number;
  /** Gap divided by the unfunded years — the monthly savings pace needed. */
  monthlySavingsNeeded: number;
  status: RunwayStatus;
}

export function computeRunway(id: string, name: string, cost: number, available: number, years: number): RunwayRow {
  const courseYears = Math.max(1, Math.round(years));
  const annual = courseYears > 0 ? cost / courseYears : 0;
  const gap = Math.max(0, cost - Math.max(0, available));
  const yearsAffordable = available > 0 && annual > 0 ? Math.min(courseYears, Math.floor(available / annual)) : 0;

  const funded = Math.min(yearsAffordable, courseYears) * annual;
  const remainder = Math.max(0, cost - funded);
  const monthsLeft = Math.max(0, courseYears - yearsAffordable);
  const monthlySavingsNeeded = gap > 0 && monthsLeft > 0 ? remainder / (monthsLeft * 12) : 0;

  let status: RunwayStatus = "afford";
  if (gap > 0) status = annual > 0 && gap > annual * 1.25 ? "beyond" : "tight";

  return {
    id,
    name,
    cost,
    available: Math.max(0, available),
    gap,
    yearsAffordable,
    monthlySavingsNeeded: Math.round(monthlySavingsNeeded * 100) / 100,
    status,
  };
}

/** Affordability row for one university. */
export function runwayForUni(
  tuitionAud: number | null,
  livingCostAud: number | null,
  oshcMonthly: number,
  years: number,
  available: number,
): RunwayRow | null {
  const tuition = tuitionAud ?? 0;
  const living = livingCostAud ?? 0;
  const yearsN = Math.max(0, years);
  if (yearsN <= 0) return null;
  const cost = degreeCost({ tuitionAud: tuition, livingCostAud: living, oshcMonthly, years });
  return computeRunway("uni", "University", cost, available, years);
}

export const DEFAULT_OSHC_MONTHLY = 540;

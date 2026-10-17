import { useMemo, useState } from "react";
import { CITY_COSTS, COST_CATEGORIES, cityTotal, type CityCost } from "../lib/costOfLiving";
import { Card, PageHeader, Select } from "../components/ui";

const DEFAULT_PICKS = ["Melbourne", "London", "Toronto"];

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-3 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function CostOfLiving() {
  const [picks, setPicks] = useState<string[]>(DEFAULT_PICKS);

  const chosen: CityCost[] = useMemo(
    () => picks.map((name) => CITY_COSTS.find((c) => c.city === name)).filter((c): c is CityCost => !!c),
    [picks],
  );
  const totals = chosen.map(cityTotal);
  const max = Math.max(...totals, 1);
  const cheapest = chosen.length ? chosen[totals.indexOf(Math.min(...totals))] : null;

  function setSlot(i: number, city: string) {
    const next = [...picks];
    next[i] = city;
    // avoid duplicates
    if (next.filter((c) => c === city).length > 1) return;
    setPicks(next);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Cost of living"
        subtitle="Rough monthly student costs in AUD across popular study cities. Estimates for planning only — verify with the university's cost-of-living page and local rental sites before you commit."
      />

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {picks.map((p, i) => (
            <label key={i} className="text-xs font-semibold text-slate-600">
              City {i + 1}
              <Select className="mt-1" value={p} onChange={(e) => setSlot(i, e.target.value)}>
                {CITY_COSTS.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}, {c.country}
                  </option>
                ))}
              </Select>
            </label>
          ))}
        </div>
        {cheapest ? (
          <p className="mt-3 text-sm font-semibold text-emerald-800">
            Lowest estimate here: {cheapest.city} at about AU${cityTotal(cheapest).toLocaleString("en-IN")} / month.
          </p>
        ) : null}
      </Card>

      <Card className="mb-6">
        <h2 className="font-bold text-slate-900">Monthly total (AUD, estimates)</h2>
        <ul className="mt-4 space-y-4">
          {chosen.map((c, i) => (
            <li key={c.city}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-slate-800">
                  {c.city}
                  <span className="ml-2 text-xs font-normal text-slate-500">{c.country}</span>
                </span>
                <span className="font-bold text-slate-900">≈ AU${totals[i]?.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-1.5">
                <Bar value={totals[i] ?? 0} max={max} color="bg-gradient-to-r from-emerald-500 to-teal-400" />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">{c.sourceNote}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="font-bold text-slate-900">Category breakdown</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3">Category</th>
                {chosen.map((c) => (
                  <th key={c.city} className="py-2 pr-3 text-right">
                    {c.city}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COST_CATEGORIES.map((cat) => (
                <tr key={cat.key} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-700">{cat.label}</td>
                  {chosen.map((c) => (
                    <td key={c.city} className="py-2 pr-3 text-right text-slate-600">
                      ${c[cat.key].toLocaleString("en-IN")}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-3 font-bold text-slate-900">Total</td>
                {chosen.map((c, i) => (
                  <td key={c.city} className="py-2 pr-3 text-right font-bold text-slate-900">
                    ${totals[i]?.toLocaleString("en-IN")}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Figures are rounded planning estimates converted to AUD and exclude tuition. Sharing a flat, cooking at home
          and concession transport typically cut 20–30% off the rent line.
        </p>
      </Card>
    </div>
  );
}

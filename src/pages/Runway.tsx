import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Shortlist, University } from "../lib/types";
import { runwayForUni, degreeCost, DEFAULT_OSHC_MONTHLY } from "../lib/runway";
import { Badge, Button, Card, DeviceNote, Empty, PageHeader, Spinner } from "../components/ui";
import { cx } from "../lib/utils";

function money(n: number): string {
  return `A$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  afford: { label: "Afforded", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  tight: { label: "Tight", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  beyond: { label: "Beyond", cls: "border-rose-200 bg-rose-50 text-rose-800" },
};

/** Affordability runway: can the shortlist be funded, and at what savings pace? */
export default function Runway() {
  const { session } = useAuth();
  const [shortlist, setShortlist] = useState<Shortlist | null>(null);
  const [unis, setUnis] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [years, setYears] = useState(3);
  const [savings, setSavings] = useState(0);
  const [scholarship, setScholarship] = useState(0);
  const [loanSanction, setLoanSanction] = useState(0);
  const [usingLoan, setUsingLoan] = useState(false);

  useEffect(() => {
    if (!session) return;
    let live = true;
    (async () => {
      const { data } = await supabase
        .from("shortlists")
        .select("*")
        .eq("student_id", session.user.id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sl = (data as Shortlist) ?? null;
      if (!live) return;
      setShortlist(sl);
      const ids = (sl?.result?.items ?? []).map((i) => i.university_id);
      if (ids.length) {
        const { data: rows } = await supabase.from("universities").select("*").in("id", ids);
        if (!live) return;
        setUnis((rows as University[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [session]);

  const available = useMemo(
    () => Math.max(0, savings + scholarship + (usingLoan ? loanSanction : 0)),
    [savings, scholarship, loanSanction, usingLoan],
  );

  const summary = useMemo(() => {
    const rs = unis
      .map((u) => runwayForUni(u.tuition_aud, u.living_cost_aud, DEFAULT_OSHC_MONTHLY, years, available))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const costTotal = rs.reduce((s, r) => s + r.cost, 0);
    const gapTotal = rs.reduce((s, r) => s + r.gap, 0);
    const status = (s: string) => rs.filter((r) => r.status === s).length;
    return {
      cost: costTotal,
      gap: gapTotal,
      affordable: status("afford"),
      tight: status("tight"),
      beyond: status("beyond"),
      rows: rs,
    };
  }, [unis, available, years]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (err) {
    return <Empty title="Could not load your shortlist" body={err} />;
  }

  return (
    <div>
      <PageHeader
        title="Affordability runway"
        subtitle="Can your shortlist actually be funded, and over how many course years can your savings carry you?"
        right={
          <Button variant="ghost" onClick={() => window.print()} className="no-print">
            Print
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Your funds</h2>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Course length</span>
              <select value={years} onChange={(e) => setYears(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-sm">
                {[1, 2, 3, 4].map((y) => (
                  <option key={y} value={y}>
                    {y} year{y > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Savings you can put at risk</span>
              <input type="number" min={0} step="1000" value={savings} onChange={(e) => setSavings(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Scholarship / award (AUD)</span>
              <input type="number" min={0} step="1000" value={scholarship} onChange={(e) => setScholarship(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <input type="checkbox" checked={usingLoan} onChange={(e) => setUsingLoan(e.target.checked)} className="accent-emerald-600" />
              Adding a sanctioned education loan to the pool
            </label>
            {usingLoan ? (
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Sanctioned loan amount (AUD)</span>
                <input type="number" min={0} step="1000" value={loanSanction} onChange={(e) => setLoanSanction(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-sm" />
              </label>
            ) : null}
            <p className="text-[11px] leading-relaxed text-slate-500">
              Available pool: <span className="font-bold text-slate-800">{money(available)}</span>. This is savings you can
              commit to the deposit, plus any scholarship or sanctioned loan.
            </p>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50/80 to-teal-50/60">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Across your shortlist</p>
            <div className="mt-2 flex flex-wrap gap-4">
              <div>
                <p className="font-display text-2xl font-extrabold text-slate-900">{money(summary.cost)}</p>
                <p className="text-[10px] font-bold uppercase text-slate-500">total degree cost</p>
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold text-rose-600">{money(summary.gap)}</p>
                <p className="text-[10px] font-bold uppercase text-slate-500">funds gap</p>
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold text-emerald-700">{summary.affordable}</p>
                <p className="text-[10px] font-bold uppercase text-slate-500">affordable</p>
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold text-amber-700">{summary.tight}</p>
                <p className="text-[10px] font-bold uppercase text-slate-500">tight</p>
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold text-rose-700">{summary.beyond}</p>
                <p className="text-[10px] font-bold uppercase text-slate-500">beyond reach</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Per university</h2>
            {summary.rows.length === 0 ? (
              <Empty
                title="Nothing to runway yet"
                body="Generate a shortlist first and we will score exactly how fundable each pick is."
                action={
                  <Link to="/dashboard">
                    <Button>Go to shortlist</Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                {summary.rows.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 grow truncate text-sm font-bold text-slate-900">{r.name}</p>
                      <Badge className={cx("border", STATUS_STYLE[r.status].cls)}>{STATUS_STYLE[r.status].label}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                      <span>
                        Cost <span className="font-bold text-slate-900">{money(r.cost)}</span>
                      </span>
                      <span>
                        Available <span className="font-bold text-slate-900">{money(r.available)}</span>
                      </span>
                      <span>
                        Gap <span className={cx("font-bold", r.gap > 0 ? "text-rose-700" : "text-emerald-700")}>{money(r.gap)}</span>
                      </span>
                      <span>
                        Savings cover <span className="font-bold text-slate-900">{r.yearsAffordable}/{Math.max(1, years)} yr</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Costs include tuition, living and a provisional OSHC premium of A$540/month. Scholarships and sanctioned loans
              enter the pool only when you tick the loan option.
            </p>
          </Card>
        </div>
      </div>

      <DeviceNote>
        Estimates only. Published fees and premium rates change — treat every figure as a starting point and confirm with
        the provider before committing savings.
      </DeviceNote>
    </div>
  );
}

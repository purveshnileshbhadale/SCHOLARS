import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Application, OfferCondition, University } from "../lib/types";
import { money } from "../lib/utils";
import { Badge, Button, Card, DeadlineChip, Empty, ErrorNote, PageHeader, Spinner } from "../components/ui";
import { cx } from "../lib/utils";

/**
 * Side-by-side offer comparison. Consumes the existing `applications`,
 * `offer_conditions` and `universities` tables — no new schema.
 *
 * Every row is a deterministic field read or arithmetic; nothing here is
 * guessed by a model.
 */

interface AppWithUni extends Application {
  uni?: University;
  conditions?: OfferCondition[];
}

const DECISIONS = [
  { key: "cost", label: "Lowest first-year cost", pick: (a: AppWithUni) => firstYearCost(a), better: "min" as const },
  { key: "rank", label: "Highest QS rank", pick: (a: AppWithUni) => a.uni?.qs_rank, better: "min" as const },
  { key: "psw", label: "Longest post-study work", pick: (a: AppWithUni) => a.uni?.post_study_work_years, better: "max" as const },
  { key: "conditions", label: "Fewest conditions left", pick: (a: AppWithUni) => unmetConditions(a), better: "min" as const },
];

function firstYearCost(a: AppWithUni): number | undefined {
  if (!a.uni) return undefined;
  const tuition = a.uni.tuition_aud ?? 0;
  const living = a.uni.living_cost_aud ?? 0;
  return tuition + living;
}

function unmetConditions(a: AppWithUni): number {
  if (!a.conditions?.length) return 0;
  return a.conditions.filter((c) => !c.met).length;
}

function hasOffer(a: AppWithUni): boolean {
  return a.status === "Offer Received" || !!a.offer_received_on;
}

export default function OffersCompare() {
  const { session } = useAuth();
  const [apps, setApps] = useState<AppWithUni[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [{ data: a, error }, { data: c }] = await Promise.all([
        supabase.from("applications").select("*").eq("student_id", session.user.id).order("created_at", { ascending: false }),
        supabase.from("offer_conditions").select("*"),
      ]);
      if (error) setErr(error.message);
      const rows = (a as Application[]) ?? [];
      const conds = (c as OfferCondition[]) ?? [];

      // Prefetch universities for the apps that have one.
      const uniIds = [...new Set(rows.map((r) => r.university_id).filter(Boolean))] as string[];
      const { data: unis } = uniIds.length
        ? await supabase.from("universities").select("*").in("id", uniIds)
        : { data: [] as University[] };
      const uniMap = new Map((unis as University[] ?? []).map((u) => [u.id, u]));

      const merged = rows.map((r) => ({
        ...r,
        uni: r.university_id ? uniMap.get(r.university_id) : undefined,
        conditions: conds.filter((c) => c.application_id === r.id),
      }));
      setApps(merged);
      // Pre-select every offer we have so the comparison is useful on first load.
      setSelected(new Set(merged.filter(hasOffer).map((m) => m.id)));
      setLoading(false);
    })();
  }, [session]);

  const offers = useMemo(() => apps.filter(hasOffer), [apps]);
  const chosen = useMemo(() => apps.filter((a) => selected.has(a.id)), [apps, selected]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < 5) n.add(id);
      return n;
    });
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  if (offers.length < 2) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Compare offers" subtitle="Put two or more offers side by side — cost, rank, conditions and deadlines in one table." />
        <ErrorNote>{err}</ErrorNote>
        <Empty
          title={offers.length === 0 ? "No offers received yet" : "You only have one offer so far"}
          body={
            offers.length === 0
              ? "Once you mark an application as Offer Received, it will appear here for comparison."
              : "Comparison needs at least two offers. Track your other applications and mark them when decisions arrive."
          }
          action={
            <Link to="/applications">
              <Button>Open applications</Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Winner per decision, computed only across the chosen set.
  const winners = DECISIONS.map((d) => {
    const vals = chosen
      .map((a) => ({ id: a.id, v: d.pick(a) }))
      .filter((x) => typeof x.v === "number" && !Number.isNaN(x.v)) as { id: string; v: number }[];
    if (vals.length < 2) return { key: d.key, label: d.label, winnerId: null as string | null };
    const sorted = [...vals].sort((x, y) => (d.better === "min" ? x.v - y.v : y.v - x.v));
    const isTie = sorted.length > 1 && sorted[0].v === sorted[1].v;
    return { key: d.key, label: d.label, winnerId: isTie ? null : sorted[0].id };
  });

  const costOf = (a: AppWithUni) => {
    const t = a.uni?.tuition_aud ?? null;
    const l = a.uni?.living_cost_aud ?? null;
    return t != null || l != null ? (t ?? 0) + (l ?? 0) : null;
  };

  const rows: { label: string; render: (a: AppWithUni) => React.ReactNode; highlight?: boolean }[] = [
    { label: "University", render: (a) => <span className="font-bold text-slate-900">{a.uni?.name ?? "—"}</span> },
    { label: "Program", render: (a) => a.program ?? "—" },
    {
      label: "Status",
      render: (a) => (
        <Badge className={cx(a.status === "Offer Received" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : a.status === "Waitlisted" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700")}>
          {a.status}
        </Badge>
      ),
    },
    {
      label: "First-year cost",
      render: (a) => {
        const c = costOf(a);
        return c != null ? <span className="font-extrabold text-slate-900">{money(c)}</span> : "—";
      },
      highlight: true,
    },
    {
      label: "Tuition / yr",
      render: (a) => (a.uni?.tuition_aud != null ? money(a.uni.tuition_aud) : "—"),
    },
    {
      label: "Living / yr",
      render: (a) => (a.uni?.living_cost_aud != null ? money(a.uni.living_cost_aud) : "—"),
    },
    {
      label: "QS rank",
      render: (a) => (a.uni?.qs_rank ? <span className="font-semibold">#{a.uni.qs_rank}</span> : "—"),
    },
    {
      label: "City",
      render: (a) => [a.uni?.city, a.uni?.state].filter(Boolean).join(", ") || "—",
    },
    {
      label: "English min",
      render: (a) => {
        const parts = [
          a.uni?.ielts_min != null ? `IELTS ${a.uni.ielts_min}` : null,
          a.uni?.pte_min != null ? `PTE ${a.uni.pte_min}` : null,
          a.uni?.toefl_min != null ? `TOEFL ${a.uni.toefl_min}` : null,
        ].filter(Boolean);
        return parts.length ? parts.join(" / ") : "—";
      },
    },
    {
      label: "Post-study work",
      render: (a) => (a.uni?.post_study_work_years != null ? `${a.uni.post_study_work_years} yr${a.uni.post_study_work_years > 1 ? "s" : ""}` : "—"),
      highlight: true,
    },
    {
      label: "Offer received",
      render: (a) => (a.offer_received_on ? new Date(a.offer_received_on).toLocaleDateString("en-AU") : "—"),
    },
    {
      label: "Accept by",
      render: (a) => (a.offer_accept_by ? <DeadlineChip date={a.offer_accept_by} /> : <span className="text-slate-400">—</span>),
      highlight: true,
    },
    {
      label: "Conditions",
      render: (a) => {
        if (!a.conditions?.length) return <span className="text-slate-400">None</span>;
        const met = a.conditions.filter((c) => c.met).length;
        const all = a.conditions.length;
        return (
          <span className={cx("font-semibold", met === all ? "text-emerald-700" : "text-amber-700")}>
            {met}/{all} met
          </span>
        );
      },
    },
    {
      label: "Unmet conditions",
      render: (a) => {
        const unmet = (a.conditions ?? []).filter((c) => !c.met);
        if (!unmet.length) return <span className="text-emerald-700">All clear</span>;
        return (
          <ul className="space-y-1 text-left text-xs">
            {unmet.map((c) => (
              <li key={c.id} className="rounded bg-amber-50 px-2 py-1 text-amber-800">
                {c.label}
              </li>
            ))}
          </ul>
        );
      },
    },
    {
      label: "Application fee",
      render: (a) => {
        if (a.application_fee_aud == null) return "—";
        const paid = a.fee_paid_aud != null;
        return (
          <span className={cx(paid ? "text-emerald-700" : "text-slate-700")}>
            {paid ? "Paid " : "Due "}
            {money(a.fee_paid_aud ?? a.application_fee_aud)}
          </span>
        );
      },
    },
    {
      label: "CoE issued",
      render: (a) => (a.coe_issued_on ? new Date(a.coe_issued_on).toLocaleDateString("en-AU") : <span className="text-slate-400">—</span>),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Compare offers"
        subtitle="Pick up to five offers and read the decision straight off the table — cost, rank, conditions and deadlines."
        right={
          <div className="text-xs font-semibold text-slate-500">
            {selected.size} of {offers.length} offers selected
          </div>
        }
      />
      <ErrorNote>{err}</ErrorNote>

      {/* Selection tray */}
      <Card className="mb-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">Choose offers to compare (max 5)</p>
        <div className="flex flex-wrap gap-2">
          {offers.map((a) => {
            const on = selected.has(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                disabled={!on && selected.size >= 5}
                className={cx(
                  "rounded-full border px-3.5 py-1.5 text-xs font-bold transition disabled:opacity-40",
                  on ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200" : "border-slate-200 bg-white/80 text-slate-600 hover:border-emerald-300",
                )}
              >
                {a.uni?.name ?? a.program ?? "Untitled"}
              </button>
            );
          })}
        </div>
      </Card>

      {chosen.length < 2 ? (
        <Empty title="Select at least two offers" body="Use the chips above to pick the offers you want side by side." />
      ) : (
        <>
          {/* Decision callouts */}
          <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {winners.map((w) => {
              const winner = w.winnerId ? apps.find((a) => a.id === w.winnerId) : null;
              return (
                <Card key={w.key} className="px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{w.label}</p>
                  <p className="mt-1 text-sm font-extrabold text-emerald-800">{winner ? winner.uni?.name ?? winner.program ?? "—" : "Tie / n/a"}</p>
                </Card>
              );
            })}
          </div>

          {/* Comparison table */}
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="sticky left-0 z-10 bg-white/95 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 backdrop-blur">
                    Field
                  </th>
                  {chosen.map((a) => (
                    <th key={a.id} className="min-w-[170px] px-4 py-3 text-left">
                      <span className="block font-display text-sm font-bold text-slate-900">{a.uni?.name ?? "—"}</span>
                      <span className="block truncate text-xs font-normal text-slate-500">{a.program}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className={cx("border-b border-slate-100 last:border-0", r.highlight && "bg-emerald-50/40")}>
                    <td className={cx("sticky left-0 z-10 bg-white/95 px-4 py-2.5 text-xs font-semibold text-slate-500 backdrop-blur", r.highlight && "bg-emerald-50/95")}>
                      {r.label}
                    </td>
                    {chosen.map((a) => (
                      <td key={a.id} className="px-4 py-2.5 align-top text-slate-800">
                        {r.render(a)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <p className="mt-5 text-xs text-slate-400">
            Numbers come from your tracked applications and the university directory — nothing is estimated. Cross-check the{" "}
            <Link to="/deadlines" className="font-semibold text-emerald-700 hover:underline">accept-by dates</Link> before deciding; offers lapse and
            deposits are rarely refundable.
          </p>
        </>
      )}
    </div>
  );
}

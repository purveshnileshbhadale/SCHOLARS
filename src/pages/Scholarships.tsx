import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Scholarship, Shortlist, StudentProfile } from "../lib/types";
import { cx, inr } from "../lib/utils";
import { daysLeft } from "../lib/deadlines";
import { Badge, Button, Card, DeadlineChip, Empty, Input, PageHeader, Spinner } from "../components/ui";

type Row = Scholarship & { universities: { name: string; city: string | null; image_url: string | null } | null };

export default function Scholarships() {
  const { session } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [intlOnly, setIntlOnly] = useState(false);
  const [match, setMatch] = useState(false);
  const [shortlistIds, setShortlistIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [sp, setSp] = useState<StudentProfile | null>(null);

  useEffect(() => {
    supabase
      .from("scholarships")
      .select("*, universities(name, city, image_url)")
      .order("name")
      .then(({ data }) => {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const uid = session.user.id;
      const [{ data: sl }, { data: sv }, { data: spl }] = await Promise.all([
        supabase.from("shortlists").select("result").eq("student_id", uid).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("saved_universities").select("university_id"),
        supabase.from("student_profiles").select("*").eq("user_id", uid).maybeSingle(),
      ]);
      const s = (sl as Shortlist | null)?.result?.items?.map((i) => i.university_id) ?? [];
      setShortlistIds(new Set(s));
      setSavedIds(new Set((sv ?? []).map((r) => r.university_id as string)));
      setSp((spl as StudentProfile) ?? null);
    })();
  }, [session]);

  function reasonsFor(s: Row): string[] {
    const r: string[] = [];
    if (shortlistIds.has(s.university_id)) r.push("Your shortlist");
    if (savedIds.has(s.university_id)) r.push("Saved uni");
    if (s.universities?.city && sp?.preferred_cities?.includes(s.universities.city)) r.push(`Preferred city: ${s.universities.city}`);
    if (sp?.needs_scholarship && /tuition|fee|reduction/i.test(s.coverage ?? "")) r.push("Fee reduction");
    if (sp?.needs_scholarship && s.category === "merit") r.push("Merit-based");
    return r;
  }

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((s) => {
      if (intlOnly || match) if (!s.international_eligible) return false;
      if (!needle) return true;
      return [s.name, s.universities?.name, s.coverage, s.eligibility].filter(Boolean).some((v) =>
        String(v).toLowerCase().includes(needle),
      );
    });
    if (match) {
      out = out
        .map((s) => ({ s, reasons: reasonsFor(s) }))
        .filter((x) => x.reasons.length > 0)
        .sort(
          (a, b) =>
            b.reasons.length - a.reasons.length ||
            (b.s.amount_aud ?? -1) - (a.s.amount_aud ?? -1) ||
            a.s.name.localeCompare(b.s.name),
        )
        .map((x) => x.s);
    } else {
      // Deadline proximity: closing soonest first, undated next, passed last.
      out = [...out].sort((a, b) => {
        const da = daysLeft(a.deadline);
        const db = daysLeft(b.deadline);
        const rank = (d: number | null) => (d === null ? 1 : d < 0 ? 2 : 0);
        if (rank(da) !== rank(db)) return rank(da) - rank(db);
        if (da !== null && db !== null && da >= 0 && db >= 0 && da !== db) return da - db;
        return a.name.localeCompare(b.name);
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, intlOnly, match, shortlistIds, savedIds, sp]);

  // Feature 8: grouped sections — closing soon / later / passed.
  const groups = useMemo(() => {
    if (match) return [{ label: "", items: shown }];
    const soon: Row[] = [];
    const later: Row[] = [];
    const expired: Row[] = [];
    for (const s of shown) {
      const d = daysLeft(s.deadline);
      if (d === null) later.push(s);
      else if (d < 0) expired.push(s);
      else if (d <= 30) soon.push(s);
      else later.push(s);
    }
    return [
      { label: "Closing soon (within 30 days)", items: soon },
      { label: "Later & rolling deadlines", items: later },
      { label: "Deadline passed", items: expired },
    ].filter((g) => g.items.length > 0);
  }, [shown, match]);

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Scholarships"
        subtitle="Scholarships and fee waivers at the universities in our directory — check eligibility and deadlines on the official page."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search scholarship or university…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search scholarships"
        />
        <Button variant={intlOnly ? "primary" : "ghost"} onClick={() => setIntlOnly(!intlOnly)}>
          International eligible only
        </Button>
        <Button
          variant={match ? "primary" : "ghost"}
          disabled={!session}
          title={session ? undefined : "Sign in to match your profile"}
          onClick={() => setMatch(!match)}
        >
          {match ? "✓ Matching your profile" : "Match my profile"}
        </Button>
      </div>

      {match ? (
        <p className="mb-4 text-xs text-slate-500">
          Ranked by how well each one fits <strong>your</strong> shortlist, saved universities, preferred cities and
          scholarship need. Eligibility is always confirmed by the university.
        </p>
      ) : null}

      {shown.length === 0 ? (
        match ? (
          <Empty
            title="No matches yet"
            body="Save universities or generate your shortlist first — or browse everything."
            action={
              <Button variant="ghost" onClick={() => setMatch(false)}>
                Show all scholarships
              </Button>
            }
          />
        ) : (
          <Empty title="No scholarships match" body="Try a different search term." />
        )
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
          <section key={g.label || "all"}>
            {g.label ? (
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                {g.label}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                  {g.items.length}
                </span>
              </h2>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
          {g.items.map((s) => {
            const reasons = match ? reasonsFor(s) : [];
            return (
              <Card key={s.id} className="flex flex-col">
                <div className="flex items-start gap-3">
                  {s.universities?.image_url ? (
                    <img
                      src={s.universities.image_url}
                      alt={s.universities.name}
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : null}
                  <div className="grow">
                    <h3 className="font-bold text-slate-900">{s.name}</h3>
                    <p className="text-xs text-slate-500">
                      {[s.universities?.name, s.universities?.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {s.international_eligible ? (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900">International</Badge>
                  ) : (
                    <Badge className="border-slate-200 bg-slate-100 text-slate-600">Domestic only</Badge>
                  )}
                </div>

                {reasons.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {reasons.map((r) => (
                      <Badge key={r} className="border-emerald-300 bg-white text-emerald-800">
                        {r}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
                  {s.amount ? (
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Amount</dt>
                      <dd className="font-semibold text-slate-800">
                        {s.amount}
                        {s.amount_aud ? <span className="ml-1 font-normal text-slate-500">≈ {inr(s.amount_aud)}</span> : null}
                      </dd>
                    </div>
                  ) : null}
                  {s.coverage ? (
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Covers</dt>
                      <dd>{s.coverage}</dd>
                    </div>
                  ) : null}
                  {s.eligibility ? (
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Eligible</dt>
                      <dd>{s.eligibility}</dd>
                    </div>
                  ) : null}
                  {s.deadline ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <dt className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Deadline</dt>
                      <dd className="font-semibold text-amber-700">{s.deadline}</dd>
                      <DeadlineChip date={s.deadline} />
                    </div>
                  ) : null}
                </dl>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.category !== "both" ? (
                    <Badge className="border-sky-200 bg-sky-50 text-sky-800">
                      {s.category === "merit" ? "Merit-based" : "Need-based"}
                    </Badge>
                  ) : null}
                  {s.study_level !== "both" ? (
                    <Badge className="border-slate-200 bg-slate-100 text-slate-600">
                      {s.study_level === "ug" ? "Undergraduate" : "Postgraduate"}
                    </Badge>
                  ) : null}
                </div>

                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="mt-4 text-sm font-semibold text-emerald-800 hover:underline">
                    Official page →
                  </a>
                ) : null}
              </Card>
            );
          })}
            </div>
          </section>
          ))}
        </div>
      )}
    </div>
  );
}

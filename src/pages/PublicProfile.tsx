import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { money } from "../lib/utils";
import { Badge, Card, Spinner } from "../components/ui";
import type { Tier } from "../lib/types";

interface PublicProfile {
  name: string | null;
  phone: string | null;
  intended_major: string | null;
  career_goal: string | null;
  linkedin_url: string | null;
  class_10_marks: number | null;
  class_12_marks: number | null;
  grading_system: string | null;
  ielts: number | null;
  toefl: number | null;
  pte: number | null;
  sat: number | null;
  budget_aud_per_year: number | null;
  needs_scholarship: boolean;
  preferred_cities: string[];
  priorities_ranked: string[];
  resume_url: string | null;
  shortlist_generated_at: string | null;
  shortlist: { name: string; tier: Tier; fit_score: number; reasoning: string; tuition_aud: number | null }[];
  sop_answers_count: number;
}

const TIER_CLS: Record<Tier, string> = {
  reach: "border-amber-200 bg-amber-50 text-amber-800",
  target: "border-emerald-200 bg-emerald-50 text-emerald-800",
  safety: "border-sky-200 bg-sky-50 text-sky-800",
};

export default function PublicProfile() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-profile?token=${encodeURIComponent(token)}`;
      const res = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setErr(body.error ?? "This profile link is not valid.");
      else setData(body as PublicProfile);
      setLoading(false);
    })();
  }, [token]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="size-8" />
      </div>
    );

  if (err || !data)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-md text-center">
          <img src="/logo.png" alt="Scholars Abroad" className="mx-auto h-10 w-auto" />
          <h1 className="mt-4 text-lg font-bold text-slate-900">Profile unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{err ?? "This profile link is not valid."}</p>
        </Card>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <img src="/logo.png" alt="Scholars Abroad" className="h-8 w-auto" />
          <span className="font-bold text-slate-900">Scholars Abroad</span>
          <Badge className="ml-auto border-emerald-200 bg-emerald-50 text-emerald-800">Verified student profile</Badge>
          <button
            onClick={() => window.print()}
            className="no-print ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-600"
            title="Print or save as PDF"
          >
            Print / PDF
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">{data.name ?? "Student"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.intended_major ?? "Course not specified"}
            {data.phone ? ` · ${data.phone}` : ""}
          </p>
          {data.career_goal ? <p className="mt-2 text-sm text-slate-600">{data.career_goal}</p> : null}
          {data.linkedin_url ? (
            <a
              href={data.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V24h-4V8zm7.5 0h3.8v2.2h.05c.53-1 1.83-2.2 3.77-2.2 4.03 0 4.78 2.65 4.78 6.1V24h-4v-7.9c0-1.9-.03-4.3-2.6-4.3-2.6 0-3 2-3 4.15V24h-4V8z" />
              </svg>
              LinkedIn profile ↗
            </a>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <h2 className="font-bold text-slate-900">Academics</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {data.class_12_marks != null ? (
                <div className="flex gap-3">
                  <dt className="w-32 text-xs font-semibold uppercase tracking-wide text-slate-400">Class 12</dt>
                  <dd className="font-semibold text-slate-800">
                    {data.class_12_marks}{data.grading_system ? ` (${data.grading_system.toUpperCase()})` : ""}
                  </dd>
                </div>
              ) : null}
              {data.class_10_marks != null ? (
                <div className="flex gap-3">
                  <dt className="w-32 text-xs font-semibold uppercase tracking-wide text-slate-400">Class 10</dt>
                  <dd className="font-semibold text-slate-800">{data.class_10_marks}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <h2 className="font-bold text-slate-900">Test scores</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-800">
              {data.ielts != null ? <li>IELTS: <strong>{data.ielts}</strong></li> : null}
              {data.toefl != null ? <li>TOEFL iBT: <strong>{data.toefl}</strong></li> : null}
              {data.pte != null ? <li>PTE Academic: <strong>{data.pte}</strong></li> : null}
              {data.sat != null ? <li>SAT: <strong>{data.sat}</strong></li> : null}
            </ul>
          </Card>

          <Card>
            <h2 className="font-bold text-slate-900">Budget & preferences</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {data.budget_aud_per_year != null ? (
                <div className="flex gap-3">
                  <dt className="w-32 text-xs font-semibold uppercase tracking-wide text-slate-400">Budget</dt>
                  <dd className="font-semibold text-slate-800">{money(data.budget_aud_per_year)}/yr{data.needs_scholarship ? " · needs scholarship" : ""}</dd>
                </div>
              ) : null}
              {data.preferred_cities.length ? (
                <div className="flex gap-3">
                  <dt className="w-32 text-xs font-semibold uppercase tracking-wide text-slate-400">Cities</dt>
                  <dd className="text-slate-800">{data.preferred_cities.join(", ")}</dd>
                </div>
              ) : null}
              {data.priorities_ranked.length ? (
                <div className="flex gap-3">
                  <dt className="w-32 text-xs font-semibold uppercase tracking-wide text-slate-400">Priorities</dt>
                  <dd className="text-slate-800">{data.priorities_ranked.join(" → ")}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <h2 className="font-bold text-slate-900">Documents</h2>
            {data.resume_url ? (
              <a
                href={data.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800"
              >
                View resume ↗
              </a>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Resume not shared.</p>
            )}
          </Card>
        </div>

        {data.shortlist.length ? (
          <Card className="mt-4">
            <h2 className="font-bold text-slate-900">
              University shortlist
              {data.shortlist_generated_at ? (
                <span className="ml-2 text-xs font-normal text-slate-400">
                  generated {new Date(data.shortlist_generated_at).toLocaleDateString("en-AU")}
                </span>
              ) : null}
            </h2>
            <ul className="mt-3 space-y-2">
              {data.shortlist.map((s, i) => (
                <li key={i} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{s.name}</span>
                    <span className="flex items-center gap-2">
                      <Badge className={TIER_CLS[s.tier]}>{s.tier}</Badge>
                      <span className="font-bold text-emerald-800">{s.fit_score}</span>
                    </span>
                  </div>
                  {s.reasoning ? <p className="mt-0.5 text-xs text-slate-500">{s.reasoning}</p> : null}
                  {s.tuition_aud != null ? <p className="mt-0.5 text-xs text-slate-400">{money(s.tuition_aud)}/yr tuition</p> : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <footer className="mt-8 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          Served securely by Scholars Abroad. This link can be revoked by the student at any time.
        </footer>
      </main>
    </div>
  );
}

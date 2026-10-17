import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { linksFor } from "../lib/nav";
import { PageHeader } from "../components/ui";

/** One-line info shown for every section (feature: "all info in menu page"). */
const INFO: Record<string, string> = {
  "/dashboard": "AI-matched Australian universities with fit scores, tuition, living costs and intakes.",
  "/universities": "Browse the full directory — ranks, fees, entry requirements, intakes and highlights.",
  "/scholarships": "Scholarships for international students with amounts, eligibility and deadlines.",
  "/cost-of-living": "Compare monthly living costs across 12 cities, category by category.",
  "/tools": "Entry-chance checker, score converters, eligibility screener and true degree cost.",
  "/mentor": "ScholarAI coach for SOPs, interviews, research topics, deadlines, GTE and more.",
  "/sop": "Structured SOP questionnaire with AI feedback, version history and compare view.",
  "/applications": "Track every application — milestones, offer conditions and visa checklist.",
  "/documents": "Store and verify transcripts, IDs, letters and resumes in one place.",
  "/deadlines": "Every deadline on one timeline with reminders, lead-time control and calendar export.",
  "/cv": "One-page printable CV built from your profile — open, print or save as PDF.",
  "/counsellors": "Book expert counselling sessions for course, visa and admission guidance.",
  "/bookings": "Your paid and scheduled sessions — reschedule, cancel or review notes.",
  "/community": "Ask questions, share wins and learn from other students.",
  "/settings": "Account details, appearance, two-factor security, notifications, privacy and data export.",
  "/menu": "This page — every section of the app with a short description.",
  // Counsellor
  "/counsellor": "Students assigned to you — profiles, shortlists, resumes and private notes.",
  "/counsellor/bookings": "Accept or decline booking requests and manage your session schedule.",
  // Admin
  "/admin": "Platform stats, conversion funnel and requests that need attention.",
  "/admin/users": "Search everyone, switch roles — promote a counsellor or admin instantly.",
  "/admin/universities": "Edit university records — ranks, fees, intakes, highlights and sources.",
  "/admin/scholarships": "Create, edit and delete scholarship records shown to students.",
  "/admin/import": "Bulk-upload or update universities from spreadsheets (Excel/CSV).",
  "/admin/counsellors": "Manage counsellor accounts, bios and specialisations.",
  "/admin/bookings": "Review all booking requests, payments and session statuses.",
};

const GROUPS: { title: string; blurb: string; keys: string[] }[] = [
  {
    title: "Explore",
    blurb: "Find and compare your options",
    keys: ["/dashboard", "/universities", "/scholarships", "/cost-of-living"],
  },
  {
    title: "Plan & apply",
    blurb: "From shortlist to offer letter",
    keys: ["/applications", "/deadlines", "/documents", "/sop", "/cv", "/tools"],
  },
  {
    title: "Get help",
    blurb: "AI coaching, experts and community",
    keys: ["/mentor", "/counsellors", "/bookings", "/community"],
  },
  {
    title: "Counsellor",
    blurb: "Your student work",
    keys: ["/counsellor", "/counsellor/bookings"],
  },
  {
    title: "Admin",
    blurb: "Platform management",
    keys: ["/admin", "/admin/universities", "/admin/import", "/admin/counsellors", "/admin/bookings"],
  },
  {
    title: "Account",
    blurb: "Your details, privacy and preferences",
    keys: ["/settings"],
  },
];

export default function Menu() {
  const { profile } = useAuth();
  const all = linksFor(profile?.role).filter((l) => (l.to as string) !== "/menu");
  const claimed = new Set(GROUPS.flatMap((g) => g.keys));
  const more = all.filter((l) => !claimed.has(l.to as string));

  function card(to: string, label: string) {
    return (
      <Link
        key={to}
        to={to}
        className="group rounded-2xl border border-slate-200/70 bg-white/85 p-4 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_12px_26px_-18px_rgba(16,185,129,0.9)]"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-bold text-slate-900 group-hover:text-emerald-800">{label}</span>
          <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600">→</span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{INFO[to] ?? "Open this section."}</p>
      </Link>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Menu" subtitle="Everything in the app, in one place — with a short note on what each section does." />
      <div className="space-y-8">
        {GROUPS.map((g) => {
          const items = all.filter((l) => g.keys.includes(l.to as string));
          if (!items.length) return null;
          return (
            <section key={g.title}>
              <h2 className="mb-3 flex flex-wrap items-baseline gap-2 text-lg font-bold text-slate-900">
                {g.title}
                <span className="text-xs font-medium text-slate-400">{g.blurb}</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">{items.map((l) => card(l.to as string, l.label))}</div>
            </section>
          );
        })}
        {more.length ? (
          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">More</h2>
            <div className="grid gap-3 sm:grid-cols-2">{more.map((l) => card(l.to as string, l.label))}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

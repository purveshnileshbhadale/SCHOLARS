import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { waShareUrl } from "../lib/config";
import { cx } from "../lib/utils";
import { Button, Card, ErrorNote, Field, Input, Select, Spinner, Textarea } from "../components/ui";

type FieldType = "text" | "textarea" | "select";

interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  prefillFromMajor?: boolean;
}

interface Accent {
  badge: string;
  soft: string;
  active: string;
  dot: string;
}

interface ModuleDef {
  key: string;
  label: string;
  hint: string;
  blurb: string;
  group: string;
  icon: ReactNode;
  accent: Accent;
  fields: FieldDef[];
}

const ICON = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const ICONS = {
  mail: ICON("M4 6h16v12H4zM4 7l8 6 8-6"),
  bulb: ICON("M9 18h6M10 21.5h4M12 2.5a6.5 6.5 0 0 0-4 11.6c.8.7 1.2 1.6 1.2 2.6v.3h5.6v-.3c0-1 .4-1.9 1.2-2.6A6.5 6.5 0 0 0 12 2.5z"),
  file: ICON("M14 2.5H7A1.5 1.5 0 0 0 5.5 4v16A1.5 1.5 0 0 0 7 21.5h10a1.5 1.5 0 0 0 1.5-1.5V7zM14 2.5V7h4.5M8.5 12.5h7M8.5 16.5h7"),
  globe: ICON("M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zM2.8 12h18.4M12 2.5c2.4 2.6 3.7 6 3.7 9.5s-1.3 6.9-3.7 9.5c-2.4-2.6-3.7-6-3.7-9.5S9.6 5.1 12 2.5z"),
  trophy: ICON("M8 21.5h8M12 17.5v4M7 3.5h10v5a5 5 0 0 1-10 0zM7 5.5H4a.8.8 0 0 0-.8.8c0 2.2 1.7 3.9 4.3 4.4M17 5.5h3a.8.8 0 0 1 .8.8c0 2.2-1.7 3.9-4.3 4.4"),
  shield: ICON("M12 2.5l7.5 3.5v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6zM9 12l2.2 2.2L15.5 10"),
  pen: ICON("M12.5 20.5H21M16.2 3.3a2.1 2.1 0 0 1 3 3L7.5 18l-4.2 1.2L4.5 15z"),
  code: ICON("M16.5 18.5l6-6-6-6M7.5 5.5l-6 6 6 6M14 3l-4 18"),
  edit: ICON("M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"),
  mic: ICON("M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v4M8 22h8"),
  compass: ICON("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM16 8l-2 6-6 2 2-6 6-2z"),
  calendar: ICON("M6 4h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 2v4M16 2v4M4 10h16"),
  search: ICON("M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35"),
  id: ICON("M3 7h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM8 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 17h4M14 11h5M14 15h5"),
};

const GROUPS = [
  { label: "Research & outreach", keys: ["professor", "topics", "paper"] },
  { label: "Competitions & chances", keys: ["mun", "opportunities"] },
  { label: "Your profile", keys: ["audit", "activities", "portfolio", "bio", "majors"] },
  { label: "Plan & apply", keys: ["essay", "interview", "gte", "rec-email", "planner", "screener"] },
];

const MODULES: ModuleDef[] = [
  {
    key: "professor",
    label: "Professor email",
    hint: "Fit check + email draft",
    blurb: "Honest fit analysis and a short, specific outreach email — never flattery.",
    group: "Research & outreach",
    icon: ICONS.mail,
    accent: {
      badge: "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[0_10px_24px_-10px_rgba(16,185,129,0.9)]",
      soft: "bg-emerald-50 text-emerald-700",
      active: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_10px_26px_-14px_rgba(16,185,129,0.95)]",
      dot: "bg-emerald-500",
    },
    fields: [
      { key: "professor_name", label: "Professor name", required: true, placeholder: "e.g. Dr. Ananya Rao" },
      { key: "university", label: "University", required: true, placeholder: "e.g. University of Melbourne" },
      { key: "department", label: "Department / lab", placeholder: "e.g. Electrical Engineering" },
      { key: "page_url", label: "Faculty page URL (paste it — AI can't browse)", placeholder: "https://…" },
      {
        key: "purpose",
        label: "Purpose",
        type: "select",
        required: true,
        options: ["MS/PhD supervision", "research internship", "summer program", "question about their lab"],
      },
    ],
  },
  {
    key: "topics",
    label: "Research topics",
    hint: "5 feasible ideas",
    blurb: "Five feasible, specific research questions matched to your time and tools.",
    group: "Research & outreach",
    icon: ICONS.bulb,
    accent: {
      badge: "bg-gradient-to-br from-cyan-500 to-sky-600 shadow-[0_10px_24px_-10px_rgba(6,182,212,0.9)]",
      soft: "bg-cyan-50 text-cyan-700",
      active: "bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-[0_10px_26px_-14px_rgba(6,182,212,0.95)]",
      dot: "bg-cyan-500",
    },
    fields: [
      { key: "field", label: "Field", prefillFromMajor: true },
      { key: "interests", label: "Interests", required: true, placeholder: "e.g. wireless communication, embedded systems" },
      { key: "projects_skills", label: "Projects & skills", type: "textarea", placeholder: "e.g. Arduino Li-Fi prototype, Python, basic ML" },
      { key: "available_time", label: "Available time", placeholder: "e.g. 6 hrs/week for 2 months" },
      { key: "resources", label: "Equipment / budget", placeholder: "e.g. laptop only, free datasets" },
      {
        key: "level",
        label: "Level",
        type: "select",
        options: ["High school", "Early undergraduate", "Final-year undergraduate"],
      },
      {
        key: "target",
        label: "Target",
        type: "select",
        options: ["School project", "Competition", "Journal", "Science fair", "College application"],
      },
    ],
  },
  {
    key: "paper",
    label: "Paper mentor",
    hint: "Stage-by-stage",
    blurb: "One stage at a time: question → literature → method → data → structure → feedback → publishing.",
    group: "Research & outreach",
    icon: ICONS.file,
    accent: {
      badge: "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_10px_24px_-10px_rgba(124,58,237,0.9)]",
      soft: "bg-violet-50 text-violet-700",
      active: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_10px_26px_-14px_rgba(124,58,237,0.95)]",
      dot: "bg-violet-500",
    },
    fields: [
      {
        key: "stage",
        label: "Stage",
        type: "select",
        required: true,
        options: [
          "1 — Question & hypothesis",
          "2 — Literature search",
          "3 — Method design",
          "4 — Data & analysis",
          "5 — Structure & outline",
          "6 — Feedback on my draft",
          "7 — Publishing",
        ],
      },
      {
        key: "detail",
        label: "Your question / notes / pasted draft",
        type: "textarea",
        required: true,
        placeholder: "Paste what you have so far — the mentor only works from YOUR work.",
      },
      { key: "field", label: "Field (optional)", prefillFromMajor: true },
    ],
  },
  {
    key: "mun",
    label: "MUN researcher",
    hint: "Brief & speech",
    blurb: "Country brief, verified past positions, blocs, solutions, position paper, speech practice.",
    group: "Competitions & chances",
    icon: ICONS.globe,
    accent: {
      badge: "bg-gradient-to-br from-sky-500 to-blue-600 shadow-[0_10px_24px_-10px_rgba(14,165,233,0.9)]",
      soft: "bg-sky-50 text-sky-700",
      active: "bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-[0_10px_26px_-14px_rgba(14,165,233,0.95)]",
      dot: "bg-sky-500",
    },
    fields: [
      { key: "committee", label: "Committee", required: true, placeholder: "e.g. UNHRC, UNEP, DISEC" },
      { key: "agenda", label: "Agenda / topic", required: true, placeholder: "e.g. regulating autonomous weapons" },
      { key: "country", label: "Assigned country", required: true },
      { key: "conference", label: "Conference (optional)" },
      { key: "experience", label: "Experience", type: "select", options: ["First-time delegate", "Intermediate", "Advanced"] },
    ],
  },
  {
    key: "opportunities",
    label: "Opportunities",
    hint: "Deadlines matched",
    blurb: "Real contests, programs and internships matched to you — sorted by deadline.",
    group: "Competitions & chances",
    icon: ICONS.trophy,
    accent: {
      badge: "bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_10px_24px_-10px_rgba(249,115,22,0.9)]",
      soft: "bg-amber-50 text-amber-700",
      active: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_10px_26px_-14px_rgba(249,115,22,0.95)]",
      dot: "bg-amber-500",
    },
    fields: [
      { key: "interests", label: "Interests / fields", required: true, placeholder: "e.g. CS, AI, physics olympiad, writing" },
      { key: "grade_level", label: "Grade / year", required: true, placeholder: "e.g. Grade 11, B.Tech 2nd year" },
      { key: "country", label: "Country (for local programs)", placeholder: "e.g. India" },
      { key: "by_when", label: "Looking to apply by", placeholder: "e.g. within 2 months" },
    ],
  },
  {
    key: "audit",
    label: "Profile audit",
    hint: "Gaps & roadmap",
    blurb: "Honest strengths, gaps, your spike, a month-by-month plan, and what to stop doing.",
    group: "Your profile",
    icon: ICONS.shield,
    accent: {
      badge: "bg-gradient-to-br from-rose-500 to-pink-600 shadow-[0_10px_24px_-10px_rgba(244,63,94,0.9)]",
      soft: "bg-rose-50 text-rose-700",
      active: "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-[0_10px_26px_-14px_rgba(244,63,94,0.95)]",
      dot: "bg-rose-500",
    },
    fields: [
      {
        key: "targets",
        label: "Target universities / programs",
        type: "textarea",
        required: true,
        placeholder: "e.g. MS CS (Research) — Melbourne, UNSW, Monash",
      },
      { key: "intake", label: "Target intake", required: true, placeholder: "e.g. Feb 2027" },
      { key: "extras", label: "Anything the profile misses (activities, awards, work exp)", type: "textarea" },
    ],
  },
  {
    key: "activities",
    label: "Activity writer",
    hint: "150-char entries",
    blurb: "Strong entries for Common App / UCAS / CV — built only from your real facts.",
    group: "Your profile",
    icon: ICONS.pen,
    accent: {
      badge: "bg-gradient-to-br from-teal-500 to-emerald-600 shadow-[0_10px_24px_-10px_rgba(20,184,166,0.9)]",
      soft: "bg-teal-50 text-teal-700",
      active: "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-[0_10px_26px_-14px_rgba(20,184,166,0.95)]",
      dot: "bg-teal-500",
    },
    fields: [
      {
        key: "format",
        label: "Format",
        type: "select",
        required: true,
        options: ["Common App activity (150 chars)", "UCAS personal statement point", "CV / resume bullet"],
      },
      {
        key: "activity",
        label: "The activity",
        type: "textarea",
        required: true,
        placeholder: "e.g. Built a campus waste-reporting app used by 200 students",
      },
      { key: "facts", label: "Numbers & facts (hours, people, results)", type: "textarea", placeholder: "The more real numbers you give, the stronger the entry." },
    ],
  },
  {
    key: "portfolio",
    label: "Portfolio review",
    hint: "GitHub review",
    blurb: "Ranked, concrete improvements for your GitHub and projects — and how to present them.",
    group: "Your profile",
    icon: ICONS.code,
    accent: {
      badge: "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_10px_24px_-10px_rgba(99,102,241,0.9)]",
      soft: "bg-indigo-50 text-indigo-700",
      active: "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_10px_26px_-14px_rgba(99,102,241,0.95)]",
      dot: "bg-indigo-500",
    },
    fields: [
      {
        key: "github_or_projects",
        label: "GitHub URL and/or project list (paste text)",
        type: "textarea",
        required: true,
        placeholder: "Paste README excerpts or a bullet list of projects with tech stacks.",
      },
      { key: "field", label: "Field", prefillFromMajor: true },
    ],
  },
  {
    key: "bio",
    label: "Profile bio",
    hint: "150-word shareable bio",
    blurb: "A grounded, third-person bio from your saved profile — plus a 25-word elevator line.",
    group: "Your profile",
    icon: ICONS.id,
    accent: {
      badge: "bg-gradient-to-br from-rose-500 to-orange-500 shadow-[0_10px_24px_-10px_rgba(244,63,94,0.9)]",
      soft: "bg-rose-50 text-rose-700",
      active: "bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-[0_10px_26px_-14px_rgba(244,63,94,0.95)]",
      dot: "bg-rose-500",
    },
    fields: [
      {
        key: "extras",
        label: "Extras beyond your saved profile",
        type: "textarea",
        placeholder: "Activities, achievements, languages, fun facts — grounded facts only.",
      },
      { key: "audience", label: "Audience (optional)", placeholder: "e.g. counsellor intro, community post, referral" },
    ],
  },
  {
    key: "majors",
    label: "Major suggester",
    hint: "6-8 program matches",
    blurb: "Majors and degrees that fit your interests and goals, with honest fit ratings.",
    group: "Your profile",
    icon: ICONS.compass,
    accent: {
      badge: "bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_10px_24px_-10px_rgba(139,92,246,0.9)]",
      soft: "bg-violet-50 text-violet-700",
      active: "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-[0_10px_26px_-14px_rgba(139,92,246,0.95)]",
      dot: "bg-violet-500",
    },
    fields: [
      { key: "interests", label: "Interests (blank = use profile)", type: "textarea", prefillFromMajor: true, placeholder: "e.g. machine learning, healthcare data, robotics" },
      { key: "level", label: "Level", type: "select", options: ["Any", "Bachelor", "Master"] },
      { key: "dislikes", label: "Avoid (optional)", placeholder: "e.g. heavy theory, lab work" },
    ],
  },
  {
    key: "essay",
    label: "Essay coach",
    hint: "Outline + critique",
    blurb: "Deconstruct the prompt, build your outline, critique your draft — you write the final words.",
    group: "Plan & apply",
    icon: ICONS.edit,
    accent: {
      badge: "bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_10px_24px_-10px_rgba(245,158,11,0.9)]",
      soft: "bg-amber-50 text-amber-700",
      active: "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_10px_26px_-14px_rgba(245,158,11,0.95)]",
      dot: "bg-amber-500",
    },
    fields: [
      { key: "prompt", label: "Essay prompt", type: "textarea", required: true, placeholder: "Paste the full scholarship essay prompt." },
      { key: "draft", label: "Your draft (optional — for critique)", type: "textarea", placeholder: "Paste what you've written so far." },
      { key: "word_limit", label: "Word limit (optional)", placeholder: "e.g. 500" },
    ],
  },
  {
    key: "interview",
    label: "Interview mock",
    hint: "Qs → feedback",
    blurb: "Tailored admission/visa questions, then honest per-answer feedback — coach, not script.",
    group: "Plan & apply",
    icon: ICONS.mic,
    accent: {
      badge: "bg-gradient-to-br from-sky-500 to-indigo-600 shadow-[0_10px_24px_-10px_rgba(14,165,233,0.9)]",
      soft: "bg-sky-50 text-sky-700",
      active: "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-[0_10px_26px_-14px_rgba(14,165,233,0.95)]",
      dot: "bg-sky-500",
    },
    fields: [
      { key: "mode", label: "Mode", type: "select", required: true, options: ["Question set", "Evaluate my answer"] },
      { key: "interview_type", label: "Interview type", type: "select", required: true, options: ["Admission", "Visa (subclass 500)", "Both"] },
      { key: "focus", label: "Focus areas (optional)", placeholder: "e.g. why Australia, CS fit, post-study plan" },
      { key: "question", label: "The question (Evaluate mode)", type: "textarea", placeholder: "Paste the question you were asked." },
      { key: "answer", label: "Your answer (Evaluate mode)", type: "textarea", placeholder: "Paste your answer — the coach scores and improves it." },
    ],
  },
  {
    key: "gte",
    label: "GTE / GS review",
    hint: "Structure check",
    blurb: "Coverage map and targeted fixes for your Genuine Student statement — no rewrites.",
    group: "Plan & apply",
    icon: ICONS.shield,
    accent: {
      badge: "bg-gradient-to-br from-emerald-500 to-green-600 shadow-[0_10px_24px_-10px_rgba(16,185,129,0.9)]",
      soft: "bg-emerald-50 text-emerald-700",
      active: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-[0_10px_26px_-14px_rgba(16,185,129,0.95)]",
      dot: "bg-emerald-500",
    },
    fields: [
      {
        key: "draft",
        label: "Your GTE / GS draft (200+ characters)",
        type: "textarea",
        required: true,
        placeholder: "Paste the statement — the reviewer maps coverage, scores sections and lists fixes.",
      },
    ],
  },
  {
    key: "rec-email",
    label: "Recommendation email",
    hint: "Ask your recommender",
    blurb: "Your honest request to a teacher or manager — you supply the real achievements.",
    group: "Plan & apply",
    icon: ICONS.mail,
    accent: {
      badge: "bg-gradient-to-br from-cyan-500 to-teal-600 shadow-[0_10px_24px_-10px_rgba(6,182,212,0.9)]",
      soft: "bg-cyan-50 text-cyan-700",
      active: "bg-gradient-to-r from-cyan-500 to-teal-600 text-white shadow-[0_10px_26px_-14px_rgba(6,182,212,0.95)]",
      dot: "bg-cyan-500",
    },
    fields: [
      { key: "recommender_name", label: "Recommender name", required: true, placeholder: "e.g. Prof. Meera Iyer" },
      { key: "relationship", label: "Relationship", placeholder: "e.g. project guide, 2 years" },
      { key: "context", label: "Program + deadline", placeholder: "e.g. MSc Data Science, apply by 1 Dec" },
      { key: "highlights", label: "Real achievements they saw", type: "textarea", placeholder: "What you actually did in their class/team — facts only." },
    ],
  },
  {
    key: "planner",
    label: "Weekly planner",
    hint: "≤3 focus items",
    blurb: "From your real deadlines to exactly three focus items for this week — realistically sized.",
    group: "Plan & apply",
    icon: ICONS.calendar,
    accent: {
      badge: "bg-gradient-to-br from-fuchsia-500 to-pink-600 shadow-[0_10px_24px_-10px_rgba(217,70,239,0.9)]",
      soft: "bg-fuchsia-50 text-fuchsia-700",
      active: "bg-gradient-to-r from-fuchsia-500 to-pink-600 text-white shadow-[0_10px_26px_-14px_rgba(217,70,239,0.95)]",
      dot: "bg-fuchsia-500",
    },
    fields: [
      {
        key: "deadlines",
        label: "Deadlines (one per line: title | date)",
        type: "textarea",
        required: true,
        placeholder: "Scholarship X | 2026-11-01\nOffer accept-by — UniY | 2026-11-15",
      },
      { key: "notes", label: "Context (optional)", type: "textarea", placeholder: "Weekly hours available, exams, travel…" },
    ],
  },
  {
    key: "screener",
    label: "Eligibility screener",
    hint: "Paste official rules",
    blurb: "Paste the official scholarship rules — get a Met / Not met / Unclear verdict per criterion.",
    group: "Plan & apply",
    icon: ICONS.search,
    accent: {
      badge: "bg-gradient-to-br from-orange-500 to-rose-600 shadow-[0_10px_24px_-10px_rgba(249,115,22,0.9)]",
      soft: "bg-orange-50 text-orange-700",
      active: "bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-[0_10px_26px_-14px_rgba(249,115,22,0.95)]",
      dot: "bg-orange-500",
    },
    fields: [
      {
        key: "rules_text",
        label: "Official eligibility rules (paste from the scholarship page)",
        type: "textarea",
        required: true,
        placeholder: "Paste the eligibility section verbatim — only pasted rules are used.",
      },
      { key: "facts", label: "Facts not in your saved profile (optional)", type: "textarea", placeholder: "e.g. citizenship, year of study, first-gen status" },
    ],
  },
];

function defaultsFor(m: ModuleDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of m.fields) if (f.options?.length && f.required) out[f.key] = f.options[0];
  return out;
}

function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "\n…" : s;
}

/* ---------------- markdown-lite renderer (no dangerouslySetInnerHTML) --------------- */

function inline(text: string, k: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return (
        <strong key={`${k}-${i}`} className="font-semibold text-slate-900">
          {p.slice(2, -2)}
        </strong>
      );
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code key={`${k}-${i}`} className="rounded-md bg-slate-200/70 px-1.5 py-0.5 font-mono text-[12px] text-emerald-800">
          {p.slice(1, -1)}
        </code>
      );
    return <span key={`${k}-${i}`}>{p}</span>;
  });
}

function Markdown({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let bullets: ReactNode[] = [];
  let ordered: ReactNode[] = [];
  const flush = () => {
    if (bullets.length) nodes.push(<ul key={`u${nodes.length}`} className="my-2 list-disc space-y-1.5 pl-5">{bullets}</ul>);
    if (ordered.length) nodes.push(<ol key={`o${nodes.length}`} className="my-2 list-decimal space-y-1.5 pl-5">{ordered}</ol>);
    bullets = [];
    ordered = [];
  };
  const lines = text.split("\n");
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) {
      flush();
      return;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) {
      flush();
      const depth = h[1].length;
      nodes.push(
        depth <= 2 ? (
          <h4 key={`h${i}`} className="font-display mt-4 mb-1.5 text-[15px] font-bold text-slate-900">
            {inline(h[2], `h${i}`)}
          </h4>
        ) : (
          <h5 key={`h${i}`} className="mt-3 mb-1 text-[13px] font-bold uppercase tracking-wide text-slate-500">
            {inline(h[2], `h${i}`)}
          </h5>
        ),
      );
      return;
    }
    if (/^(-{3,}|_{3,}|={3,})$/.test(t)) {
      flush();
      nodes.push(<hr key={`r${i}`} className="my-3 border-slate-200" />);
      return;
    }
    const num = /^(\d{1,2})[.)]\s+(.*)$/.exec(t);
    if (num) {
      if (bullets.length) flush();
      ordered.push(<li key={`n${i}`}>{inline(num[2], `n${i}`)}</li>);
      return;
    }
    if (/^[-*•]\s+/.test(t)) {
      if (ordered.length) flush();
      bullets.push(<li key={`b${i}`}>{inline(t.replace(/^[-*•]\s+/, ""), `b${i}`)}</li>);
      return;
    }
    flush();
    nodes.push(
      <p key={`p${i}`} className="my-1.5 leading-relaxed">
        {inline(t, `p${i}`)}
      </p>,
    );
  });
  flush();
  return <div className="text-[13.5px] text-slate-700">{nodes}</div>;
}

/* ------------------------------ page ---------------------------------- */

export default function Mentor() {
  const { studentProfile } = useAuth();
  const [active, setActive] = useState(MODULES[0].key);
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({});
  const [outputs, setOutputs] = useState<Record<string, string | null>>({});
  const [errs, setErrs] = useState<Record<string, string | null>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mod = useMemo(() => MODULES.find((m) => m.key === active) ?? MODULES[0], [active]);
  const form = forms[active] ?? {};
  const output = outputs[active] ?? null;
  const err = errs[active] ?? null;
  const busy = busyKey === active;

  // Seed each module's form once (defaults + prefilled major), never overwriting input.
  useEffect(() => {
    setForms((prev) => {
      const cur = prev[active] ?? {};
      const merged = { ...defaultsFor(mod), ...cur };
      if (studentProfile?.intended_major) {
        for (const f of mod.fields) {
          if (f.prefillFromMajor && !merged[f.key]) merged[f.key] = studentProfile.intended_major;
        }
      }
      return { ...prev, [active]: merged };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, studentProfile?.intended_major]);

  function setField(key: string, v: string) {
    setForms((prev) => ({ ...prev, [active]: { ...(prev[active] ?? {}), [key]: v } }));
  }

  async function ask() {
    setBusyKey(active);
    setErrs((e) => ({ ...e, [active]: null }));
    setOutputs((o) => ({ ...o, [active]: null }));
    try {
      const { data, error } = await supabase.functions.invoke("mentor", {
        body: { module: active, payload: form },
      });
      if (error) {
        const body = error.context ? await error.context.json().catch(() => null) : null;
        throw new Error(body?.error ?? "ScholarAI is unavailable right now.");
      }
      setOutputs((o) => ({ ...o, [active]: data.output as string }));
    } catch (e) {
      setErrs((er) => ({ ...er, [active]: e instanceof Error ? e.message : "Something went wrong" }));
    } finally {
      setBusyKey(null);
    }
  }

  async function copy() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setErrs((e) => ({ ...e, [active]: "Could not copy — select the text manually." }));
    }
  }

  function shareWa() {
    if (!output) return;
    window.open(waShareUrl(`${mod.label} — ScholarAI mentor\n\n${clip(output, 1700)}`), "_blank", "noopener");
  }

  function clear() {
    setOutputs((o) => ({ ...o, [active]: null }));
    setErrs((e) => ({ ...e, [active]: null }));
  }

  return (
    <div className="pb-16">
      {/* ---------------- hero ---------------- */}
      <div className="fade-up relative mb-6 overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-[0_30px_70px_-34px_rgba(16,185,129,0.95)] md:p-7">
        <div className="starfield absolute inset-0 opacity-25" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur">
            <svg viewBox="0 0 24 24" className="size-7 text-white" fill="currentColor" aria-hidden>
              <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">ScholarAI mentor</h1>
            <p className="mt-0.5 max-w-xl text-sm text-emerald-50/90">
              A coach, not a ghostwriter — sixteen tools for research, competitions and your entire application.
            </p>
          </div>
          <div className="ml-auto hidden flex-wrap justify-end gap-2 lg:flex">
            {["Coach, not ghostwriter", "Never invents sources", "Personalised with your profile"].map((c) => (
              <span
                key={c}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white/95 backdrop-blur"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- mobile switcher ---------------- */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden" style={{ scrollbarWidth: "none" }}>
        {MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => setActive(m.key)}
            className={cx(
              "flex shrink-0 snap-start items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold transition-all duration-200",
              m.key === active
                ? cx(m.accent.active, "border-transparent")
                : "border-slate-200 bg-white/85 text-slate-600 hover:border-slate-300",
            )}
          >
            <span className={cx("flex size-6 items-center justify-center rounded-full", m.key === active ? "bg-white/20 text-white" : m.accent.soft)}>
              {m.icon}
            </span>
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
        {/* ---------------- desktop rail ---------------- */}
        <nav className="sticky top-24 hidden lg:block">
          <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-2 glow-soft backdrop-blur-sm">
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-1 last:mb-0">
                <div className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  {g.label}
                </div>
                {g.keys.map((k) => {
                  const m = MODULES.find((x) => x.key === k)!;
                  const on = k === active;
                  return (
                    <button
                      key={k}
                      onClick={() => setActive(k)}
                      className={cx(
                        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                        on ? m.accent.active : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      <span
                        className={cx(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                          on ? "bg-white/20 text-white" : m.accent.soft,
                        )}
                      >
                        {m.icon}
                      </span>
                      <span className="min-w-0">
                        <span className={cx("block truncate text-[13px] font-bold", on ? "text-white" : "text-slate-800")}>
                          {m.label}
                        </span>
                        <span className={cx("block truncate text-[11px]", on ? "text-white/80" : "text-slate-400")}>
                          {m.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 px-2 text-[11px] leading-relaxed text-slate-400">
            Uses your saved profile: major, marks, scores, budget and preferences. Answers marked “needs verification”
            must be checked on official sources.
          </p>
        </nav>

        {/* ---------------- main ---------------- */}
        <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          {/* form */}
          <Card className="overflow-hidden">
            <div className="-mx-5 -mt-5 mb-4 flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-4">
              <div className={cx("flex size-11 shrink-0 items-center justify-center rounded-xl text-white", mod.accent.badge)}>
                {mod.icon}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">{mod.label}</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{mod.blurb}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {mod.fields.map((f) => (
                <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
                  <Field label={f.label}>
                    {f.type === "textarea" ? (
                      <Textarea
                        value={form[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        required={f.required}
                      />
                    ) : f.type === "select" ? (
                      <Select value={form[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)} required={f.required}>
                        {!f.required && !form[f.key] ? <option value="">Select…</option> : null}
                        {f.options?.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        value={form[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        required={f.required}
                      />
                    )}
                  </Field>
                </div>
              ))}
            </div>

            {err ? (
              <div className="mt-4">
                <ErrorNote>{err}</ErrorNote>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
              <p className="max-w-[55%] text-[11px] leading-snug text-slate-500">
                Personalised with your saved profile. Edit every suggestion until it sounds like you.
              </p>
              <Button className="shine min-h-12 px-6" onClick={ask} disabled={busy}>
                {busy ? <Spinner className="size-4" /> : null}
                {busy ? "ScholarAI is thinking…" : "Ask ScholarAI"}
              </Button>
            </div>
          </Card>

          {/* response */}
          <Card className="flex min-h-80 flex-col overflow-hidden">
            <div className="-mx-5 -mt-5 mb-4 flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className={cx("size-2.5 rounded-full", busy ? "animate-pulse bg-amber-400" : output ? mod.accent.dot : "bg-slate-300")} />
                <h2 className="text-base font-bold text-slate-900">Response</h2>
                <span className="hidden text-[11px] text-slate-400 sm:inline">{mod.label}</span>
              </div>
              {output ? (
                <div className="flex gap-1.5">
                  <Button variant="ghost" className="min-h-8 px-2.5 py-1 text-xs" onClick={copy}>
                    {copied ? "Copied ✓" : "Copy"}
                  </Button>
                  <Button variant="wa" className="min-h-8 px-2.5 py-1 text-xs" onClick={shareWa}>
                    WhatsApp
                  </Button>
                  <Button variant="ghost" className="min-h-8 px-2.5 py-1 text-xs" onClick={clear}>
                    Clear
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1">
              {busy ? (
                <div className="space-y-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <span className="inline-block size-2 animate-ping rounded-full bg-emerald-400" />
                    ScholarAI is thinking…
                  </div>
                  <div className="h-4 w-2/5 animate-pulse rounded-md bg-slate-200/80" />
                  {[94, 88, 96, 72, 90, 64].map((w, i) => (
                    <div key={i} className="h-3 animate-pulse rounded-md bg-slate-200/60" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : output ? (
                <div className="fade-up max-h-[70vh] overflow-auto pr-1">
                  <Markdown text={output} />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-2 py-8 text-center">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 shadow-[0_14px_34px_-16px_rgba(16,185,129,0.7)]">
                    <svg viewBox="0 0 24 24" className="size-7 text-emerald-600" fill="currentColor" aria-hidden>
                      <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
                    </svg>
                  </div>
                  <p className="max-w-xs text-sm font-semibold text-slate-700">Your coach's answer appears here</p>
                  <ul className="mt-3 space-y-1.5 text-left text-xs text-slate-400">
                    <li>• Fill the form and press Ask ScholarAI</li>
                    <li>• Each tool keeps its own answer — switch freely</li>
                    <li>• Anything marked “needs verification” must be checked by you</li>
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

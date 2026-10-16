import { Link, Navigate } from "react-router-dom";
import { homeFor, useAuth } from "../lib/auth";

const STEPS = [
  { t: "Build your profile", d: "Academics, IELTS/TOEFL/PTE, budget and preferences — a few minutes, all about you." },
  {
    t: "Get a free shortlist",
    d: "Our AI screens every Australian university against your profile and returns Reach / Target / Safety matches.",
  },
  {
    t: "Talk to a counsellor",
    d: "Like what you see? Book a counsellor for applications, SOP, visa and scholarships — that step is paid.",
  },
];

const BULLETS = [
  "Australia-only data: CRICOS, tuition, living costs, English minimums",
  "Fit scores built from your marks, tests, budget and priorities",
  "Scholarships shown per university",
  "Your data stays private — RLS on every table",
];

const FEATURES = [
  {
    t: "AI shortlist",
    d: "Reach / Target / Safety tiers with fit scores from your marks, budget and priorities.",
    p: "M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z",
  },
  {
    t: "University directory",
    d: "Fees, QS/THE ranks, campuses photos, intakes and student reviews — all in one place.",
    p: "M12 3L2 9l10 6 8-4.8V17h2V9zM6 14.4V18c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.6",
  },
  {
    t: "Scholarship matcher",
    d: "Match your profile against scholarships and fee waivers at every directory university.",
    p: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm-3.6 2.4L12 21l3.6-3.6M10.4 10.4l1.2 1.2 2-2",
  },
  {
    t: "SOP AI copilot",
    d: "Draft, refine and structure your statement of purpose with guided prompts.",
    p: "M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 0v5h5M9 13h6M9 17h6",
  },
  {
    t: "Free planning tools",
    d: "Eligibility checker, true degree cost calculator and IELTS/PTE/TOEFL converter.",
    p: "M4 5h16v14H4zM8 9h2m4 0h2M8 13h2m4 0h2M8 17h8",
  },
  {
    t: "Counsellors & community",
    d: "Book paid sessions, hand off on WhatsApp, and meet other students in the community feed.",
    p: "M8 10h8M8 14h5M21 12a9 9 0 0 1-13 8l-5 1 1-5a9 9 0 1 1 17-4z",
  },
];

export default function Landing() {
  const { session, profile, loading } = useAuth();
  if (!loading && session) return <Navigate to={homeFor(profile?.role)} replace />;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ---------- Deep-space hero ---------- */}
      <div className="relative overflow-hidden bg-[#050a1f] text-white">
        <div aria-hidden className="absolute inset-0">
          <div className="starfield absolute inset-0" />
          <div className="orb aurora-drift -left-40 -top-40 size-[36rem] bg-emerald-500/25" />
          <div className="orb float-slower -right-32 top-24 size-[30rem] bg-violet-500/30" />
          <div className="orb float-slow bottom-[-10rem] left-1/4 size-[28rem] bg-cyan-500/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(5,10,31,0.75)_100%)]" />
        </div>

        <header className="relative z-10 border-b border-white/10">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
            <img src="/logo.png" alt="Scholars Abroad" className="h-9 w-auto drop-shadow-[0_0_16px_rgba(16,185,129,0.6)]" />
            <span className="font-display font-bold text-white">Scholars Abroad</span>
            <div className="grow" />
            <Link
              to="/login"
              className="text-sm font-semibold text-slate-300 transition hover:text-emerald-300"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="shine rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_-12px_rgba(16,185,129,0.9)] transition hover:-translate-y-0.5"
            >
              Get my free shortlist
            </Link>
          </div>
        </header>

        <section className="relative z-10 mx-auto max-w-6xl px-4 py-24 text-center md:py-28">
          <p className="fade-up mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Free · AI-powered · Australia-only
          </p>
          <h1 className="fade-up mx-auto mt-6 max-w-4xl font-display text-4xl font-extrabold leading-[1.06] tracking-tight md:text-6xl">
            Your Australian university shortlist —{" "}
            <span className="gradient-text-light">free, automatic, in minutes</span>
          </h1>
          <p className="fade-up mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300/90">
            Complete your profile and Scholars Abroad's AI builds a Reach / Target / Safety shortlist of Australian
            universities matched to your marks, English scores, budget and goals. No counsellor required for the shortlist.
          </p>
          <div className="fade-up mt-9 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="shine glow-emerald rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-7 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:from-emerald-400 hover:to-teal-400"
            >
              Build my profile — it's free
            </Link>
            <Link
              to="/login"
              className="rounded-xl border border-white/25 bg-white/5 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:border-emerald-400/60 hover:bg-white/10"
            >
              I already have an account
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium uppercase tracking-widest text-slate-400">
            <span>12 Australian universities</span>
            <span className="hidden text-slate-600 sm:inline">·</span>
            <span>Reach / Target / Safety tiers</span>
            <span className="hidden text-slate-600 sm:inline">·</span>
            <span>No payment for your shortlist</span>
          </div>
        </section>

        <div aria-hidden className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-white" />
      </div>

      {/* ---------- How it works ---------- */}
      <section className="relative py-16">
        <div aria-hidden className="orb -left-24 top-4 size-72 bg-emerald-200/40" />
        <div className="relative mx-auto max-w-6xl px-4">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">How it works</p>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-slate-900">
            Three steps to your shortlist
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div
                key={s.t}
                className="glass rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(15,23,42,0.35)]"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-sm font-bold text-white shadow-[0_10px_24px_-10px_rgba(16,185,129,0.9)]">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Feature strip ---------- */}
      <section className="relative overflow-hidden bg-slate-50/80 py-16">
        <div aria-hidden className="orb -right-24 top-10 size-80 bg-violet-200/40" />
        <div className="relative mx-auto max-w-6xl px-4">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-violet-700">Everything in one place</p>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-slate-900">
            Built to beat the usual consultant chaos
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.t}
                className="glass group rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-24px_rgba(15,23,42,0.35)]"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-[0_12px_26px_-12px_rgba(16,185,129,0.8)] transition group-hover:scale-105">
                  <svg viewBox="0 0 24 24" className="size-5.5 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.p} />
                  </svg>
                </div>
                <h3 className="mt-4 font-bold text-slate-900">{f.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Free shortlist bullets ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-extrabold tracking-tight">
          <span className="gradient-text">What you get with the free shortlist</span>
        </h2>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-slate-700">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_6px_14px_-6px_rgba(16,185,129,0.9)]">
                <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3.5">
                  <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm">{b}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm text-slate-500">
          After your shortlist you can book a Scholars Abroad counsellor (paid) for applications, SOP/LOR, scholarships,
          education loans and visa support. The shortlist itself never requires payment.
        </p>
      </section>

      {/* ---------- CTA band ---------- */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-[#050a1f] px-6 py-12 text-center text-white shadow-[0_30px_70px_-30px_rgba(5,10,31,0.9)]">
          <div aria-hidden className="absolute inset-0">
            <div className="starfield absolute inset-0 opacity-80" />
            <div className="orb aurora-drift -left-16 -top-16 size-72 bg-emerald-500/30" />
            <div className="orb float-slower -right-16 -bottom-20 size-72 bg-violet-500/30" />
          </div>
          <div className="relative z-10">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">
              Ready to see your <span className="gradient-text-light">perfect-fit shortlist</span>?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-300">
              A few minutes of profile details is all it takes — the AI does the rest, free.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                to="/signup"
                className="shine glow-emerald rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-7 py-3 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
              >
                Get my free shortlist
              </Link>
              <Link
                to="/tools"
                className="rounded-xl border border-white/25 bg-white/5 px-7 py-3 font-semibold text-white backdrop-blur transition hover:border-emerald-400/60 hover:bg-white/10"
              >
                Explore the free tools
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 text-xs text-slate-500">
          <img src="/logo.png" alt="" className="h-6 w-auto" />
          <span>© {new Date().getFullYear()} Scholars Abroad Consulting Pvt. Ltd., Pune</span>
          <span>Fergusson College Road, Pune 411005 · +91 86987 86251</span>
          <span className="ml-auto">Not affiliated with any university or embassy.</span>
        </div>
      </footer>
    </div>
  );
}

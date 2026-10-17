import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { homeFor, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { linksFor } from "../lib/nav";
import { getTheme, setTheme } from "../lib/theme";
import ActionBell from "./ActionBell";
import CommandPalette from "./CommandPalette";

const gearPath =
  "M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.09a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z";

export default function Shell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [dark, setDark] = useState(getTheme() === "dark");
  const [announce, setAnnounce] = useState<{ id: string; title: string; body: string } | null>(null);
  const links = linksFor(profile?.role);

  // Admin announcements (feature: broadcast banner, dismiss per device).
  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("announcements")
          .select("id, title, body, created_at")
          .order("created_at", { ascending: false })
          .limit(1);
        const a = data?.[0];
        if (!a) return;
        if (localStorage.getItem("sa_ann_dismissed") === a.id) return;
        setAnnounce({ id: a.id, title: a.title, body: a.body });
      } catch {
        /* banner is non-critical */
      }
    })();
  }, [profile]);

  function dismissAnnouncement() {
    if (!announce) return;
    try {
      localStorage.setItem("sa_ann_dismissed", announce.id);
    } catch {
      /* private mode */
    }
    setAnnounce(null);
  }

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    setTheme(next);
    setDark(next === "dark");
  }

  return (
    <div className="min-h-screen">
      {/* Celestial backdrop behind the whole app */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="orb aurora-drift -left-32 -top-40 size-[34rem] bg-emerald-300/25" />
        <div className="orb float-slower -right-40 top-40 size-[30rem] bg-violet-300/20" />
        <div className="orb float-slow bottom-[-14rem] left-1/3 size-[26rem] bg-cyan-300/15" />
        <div className="starfield absolute inset-0 opacity-[0.35]" />
      </div>

      <header className="no-print sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to={homeFor(profile?.role)} className="flex items-center gap-2 font-display font-bold text-slate-900">
            <img src="/logo.png" alt="Scholars Abroad" className="h-7 w-auto drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]" />
            <span className="hidden bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-sm text-transparent sm:inline">
              Scholars Abroad
            </span>
          </Link>
          <nav className="ml-4 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to as string}
                to={l.to}
                className={({ isActive }) =>
                  `shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-900 shadow-[0_8px_18px_-12px_rgba(16,185,129,0.9)] ring-1 ring-emerald-200/70"
                      : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <span className="hidden rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-xs text-slate-500 sm:inline">
            <span className="max-w-32 truncate font-semibold text-slate-700">{profile?.name}</span> · {profile?.role}
          </span>
          <ActionBell />
          <button
            onClick={() => setCmdOpen(true)}
            title="Search & jump to (Ctrl or ⌘ K)"
            aria-label="Open command palette"
            className="hidden items-center gap-1.5 rounded-lg border border-slate-300/70 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-slate-500 backdrop-blur transition hover:border-emerald-500 hover:text-emerald-800 sm:flex"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" strokeLinecap="round" />
            </svg>
            ⌘K
          </button>
          <button
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            title={dark ? "Light mode" : "Dark mode"}
            className="rounded-lg border border-slate-300/70 bg-white/70 p-1.5 text-slate-600 backdrop-blur transition hover:border-emerald-500 hover:text-emerald-800"
          >
            {dark ? (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <NavLink
            to="/settings"
            aria-label="Settings"
            title="Settings"
            className="rounded-lg border border-slate-300/70 bg-white/70 px-2.5 py-1.5 text-slate-600 backdrop-blur transition hover:border-emerald-500 hover:text-emerald-800 hover:shadow-[0_8px_18px_-12px_rgba(16,185,129,0.9)]"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d={gearPath} />
            </svg>
          </NavLink>
          <button
            className="rounded-lg border border-slate-300/70 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 backdrop-blur transition hover:border-emerald-500 hover:text-emerald-800"
            onClick={async () => {
              await signOut();
              nav("/");
            }}
          >
            Sign out
          </button>
          <button className="md:hidden" aria-label="Menu" onClick={() => setOpen(!open)}>
            <svg viewBox="0 0 24 24" className="size-6 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {open ? (
          <nav className="border-t border-slate-200/60 px-4 py-2 md:hidden" onClick={() => setOpen(false)}>
            {links.map((l) => (
              <NavLink
                key={l.to as string}
                to={l.to}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive ? "bg-emerald-50 text-emerald-900" : "text-slate-700"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <p className="border-t border-slate-200/60 px-3 pb-1 pt-2 text-right text-[10px] text-slate-400">
              Info made by B2C Solutions
            </p>
          </nav>
        ) : null}
      </header>
      {announce ? (
        <div className="no-print mx-auto max-w-6xl px-4 pt-3">
          <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
            <div className="min-w-0 grow">
              <p className="text-sm font-bold text-slate-900">{announce.title}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{announce.body}</p>
            </div>
            <button
              onClick={dismissAnnouncement}
              aria-label="Dismiss announcement"
              className="shrink-0 rounded-lg px-2 text-lg leading-none text-slate-400 transition hover:text-slate-700"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div key={loc.pathname} className="fade-up">
          {children}
        </div>
      </main>
      <footer className="no-print mx-auto flex max-w-6xl justify-end px-4 pb-5">
        <span className="text-[10px] font-medium tracking-wide text-slate-400">Info made by B2C Solutions</span>
      </footer>
      <CommandPalette open={cmdOpen} setOpen={setCmdOpen} />
    </div>
  );
}

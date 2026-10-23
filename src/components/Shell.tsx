import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { homeFor, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { groupsFor, type IconKey } from "../lib/nav";
import { getTheme, setTheme } from "../lib/theme";
import { cx } from "../lib/utils";
import ActionBell from "./ActionBell";
import CommandPalette from "./CommandPalette";

// ---- SVG icon paths (24×24, stroke-based) ----
const ICONS: Record<IconKey, string[]> = {
  sparkles: ["M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z"],
  building: ["M3 21h18", "M5 21V7l7-4 7 4v14", "M9 21v-4h6v4", "M9 10h.01", "M15 10h.01", "M9 14h.01", "M15 14h.01"],
  award: ["M12 15a7 7 0 100-14 7 7 0 000 14z", "M8.21 13.89L7 23l5-3 5 3-1.21-9.12"],
  wrench: ["M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"],
  home: ["M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z", "M9 22V12h6v10"],
  robot: ["M12 2a2 2 0 012 2v1h3a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h3V4a2 2 0 012-2z", "M9 12h.01", "M15 12h.01", "M9 16h6"],
  file: ["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"],
  clipboard: ["M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2", "M15 2H9a1 1 0 00-1 1v2a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1z"],
  folder: ["M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"],
  calendar: ["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"],
  user: ["M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2", "M12 11a4 4 0 100-8 4 4 0 000 8z"],
  map: ["M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z", "M8 2v16", "M16 6v16"],
  target: ["M12 2a10 10 0 100 20 10 10 0 000-20z", "M12 6a6 6 0 100 12 6 6 0 000-12z", "M12 10a2 2 0 100 4 2 2 0 000-4z"],
  users: ["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2", "M9 11a4 4 0 100-8 4 4 0 000 8z", "M23 21v-2a4 4 0 00-3-3.87", "M16 3.13a4 4 0 010 7.75"],
  settings: ["M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09a1.7 1.7 0 001.55-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34h.09a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55h.09a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v.09a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.55 1z"],
  graduation: ["M22 10L12 5 2 10l10 5 10-5z", "M6 12v5c3 3 9 3 12 0v-5"],
  chart: ["M18 20V10", "M12 20V4", "M6 20v-6"],
  book: ["M4 19.5A2.5 2.5 0 016.5 17H20", "M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"],
  dollar: ["M12 1v22", "M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"],
  clock: ["M12 2a10 10 0 100 20 10 10 0 000-20z", "M12 6v6l4 2"],
  mail: ["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z", "M22 6l-10 7L2 6"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
  database: ["M12 2c-4.42 0-8 1.79-8 4v12c0 2.21 3.58 4 8 4s8-1.79 8-4V6c0-2.21-3.58-4-8-4z", "M4 6c0-2.21 3.58-4 8-4s8 1.79 8 4", "M4 12c0-2.21 3.58-4 8-4s8 1.79 8 4", "M4 18c0-2.21 3.58-4 8-4s8 1.79 8 4"],
  upload: ["M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  "user-check": ["M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2", "M8.5 11a4 4 0 100-8 4 4 0 000 8z", "M17 11l2 2 4-4"],
  card: ["M1 4h22v16H1z", "M1 10h22"],
  check: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"],
  globe: ["M12 2a10 10 0 100 20 10 10 0 000-20z", "M2 12h20", "M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"],
  message: ["M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"],
  compass: ["M12 2a10 10 0 100 20 10 10 0 000-20z", "M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z"],
  plane: ["M17.8 19.2L16 11l3.5-3.5a2.1 2.1 0 00-3-3L13 8 4.8 6.2a.5.5 0 00-.5.8L8 11l-2 2H3.5a.5.5 0 00-.4.8L5 16l2.2 1.9a.5.5 0 00.8-.4V15l2-2 3.9 3.7a.5.5 0 00.8-.5z"],
  trophy: ["M6 9H4.5a2.5 2.5 0 010-5H6", "M18 9h1.5a2.5 2.5 0 000-5H18", "M4 22h16", "M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22", "M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8", "M18 2H6v7a6 6 0 0012 0V2z"],
  send: ["M22 2L11 13", "M22 2L15 22l-4-9-9-4z"],
  columns: ["M3 3h18v18H3z", "M9 3v18", "M15 3v18"],
  briefcase: ["M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z", "M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"],
  flag: ["M4 22V4a1 1 0 011-1h13l-2.5 4L18 11H5a1 1 0 00-1 1"],
};

function Icon({ name, className }: { name: string; className?: string }) {
  const paths = ICONS[name as IconKey] ?? ICONS.compass;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [dark, setDark] = useState(getTheme() === "dark");
  const [announce, setAnnounce] = useState<{ id: string; title: string; body: string } | null>(null);
  const groups = groupsFor(profile?.role);

  // Close mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

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

      {/* ---- Mobile overlay ---- */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* ---- Sidebar ---- */}
      <aside
        className={cx(
          "no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/60 bg-white/85 backdrop-blur-xl transition-transform duration-200 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200/60 px-4">
          <Link to={homeFor(profile?.role)} className="flex items-center gap-2.5 font-display font-bold text-slate-900">
            <img src="/logo.png" alt="Scholars Abroad" className="h-7 w-auto drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]" />
            <span className="bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-sm text-transparent">
              Scholars Abroad
            </span>
          </Link>
          <button
            className="ml-auto rounded-lg p-1 text-slate-400 hover:text-slate-700 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" onClick={() => setMobileOpen(false)}>
          {groups.map((group) => (
            <div key={group.title} className="mb-5">
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to as string}
                    to={item.to}
                    className={({ isActive }) =>
                      cx(
                        "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150",
                        isActive
                          ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-900 shadow-[0_4px_14px_-8px_rgba(16,185,129,0.8)] ring-1 ring-emerald-200/60"
                          : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          name={item.icon}
                          className={cx(
                            "size-4 shrink-0 transition-colors",
                            isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-600",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer: user, theme, sign out */}
        <div className="shrink-0 border-t border-slate-200/60 px-3 py-3">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-50/80 px-3 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-xs font-bold text-white">
              {(profile?.name ?? profile?.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-800">{profile?.name ?? "Student"}</p>
              <p className="truncate text-[10px] text-slate-400 capitalize">{profile?.role}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={toggleTheme}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Light mode" : "Dark mode"}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/70 px-2 py-1.5 text-xs font-semibold text-slate-500 backdrop-blur transition hover:border-emerald-500 hover:text-emerald-800"
            >
              {dark ? (
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
              {dark ? "Light" : "Dark"}
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/70 px-2 py-1.5 text-xs font-semibold text-slate-500 backdrop-blur transition hover:border-rose-400 hover:text-rose-700"
              onClick={async () => {
                await signOut();
                nav("/");
              }}
            >
              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" strokeLinecap="round" />
                <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" />
              </svg>
              Sign out
            </button>
          </div>
          <p className="mt-2 text-center text-[9px] text-slate-300">Info made by B2C Solutions</p>
        </div>
      </aside>

      {/* ---- Main content area ---- */}
      <div className="md:pl-64">
        {/* Slim top bar */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200/60 bg-white/70 px-4 backdrop-blur-xl">
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
          {/* Mobile hamburger */}
          <button
            className="rounded-lg p-2 text-slate-600 hover:bg-white/70 hover:text-emerald-800 md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
          {/* Page title area — left empty, pages render their own PageHeader */}
          <div className="min-w-0 flex-1" />
          <button
            onClick={() => setCmdOpen(true)}
            title="Search & jump to (Ctrl or ⌘ K)"
            aria-label="Open command palette"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300/70 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-slate-500 backdrop-blur transition hover:border-emerald-500 hover:text-emerald-800"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">⌘K</span>
          </button>
          <ActionBell />
          <span className="hidden items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-xs text-slate-500 lg:inline-flex">
            <span className="max-w-28 truncate font-semibold text-slate-700">{profile?.name}</span>
            <span className="text-slate-300">·</span>
            <span className="capitalize">{profile?.role}</span>
          </span>
        </header>

        {/* Announcement banner */}
        {announce ? (
          <div className="no-print px-4 pt-3">
            <div className="mx-auto flex max-w-6xl items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
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

        {/* Page content */}
        <main className="px-4 py-6">
          <div key={loc.pathname} className="fade-up mx-auto max-w-6xl">
            {children}
          </div>
        </main>

        <footer className="no-print flex max-w-6xl justify-end px-4 pb-5">
          <span className="text-[10px] font-medium tracking-wide text-slate-400">Info made by B2C Solutions</span>
        </footer>
      </div>

      <CommandPalette open={cmdOpen} setOpen={setCmdOpen} />
    </div>
  );
}

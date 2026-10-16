import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { linksFor } from "../lib/nav";
import { getTheme, setTheme } from "../lib/theme";
import { cx } from "../lib/utils";

type Command = { key: string; label: string; hint: string; run: () => void };

export default function CommandPalette({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const nav = useNavigate();
  const { profile, signOut } = useAuth();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => {
      setOpen(false);
      nav(to);
    };
    const items: Command[] = linksFor(profile?.role).map((l) => ({
      key: `nav:${l.to}`,
      label: l.label,
      hint: String(l.to),
      run: go(String(l.to)),
    }));
    items.push({
      key: "action:theme",
      label: getTheme() === "dark" ? "Switch to light mode" : "Switch to dark mode",
      hint: "appearance",
      run: () => {
        setTheme(getTheme() === "dark" ? "light" : "dark");
        setOpen(false);
      },
    });
    items.push({
      key: "action:signout",
      label: "Sign out",
      hint: "account",
      run: () => {
        setOpen(false);
        void signOut().then(() => nav("/"));
      },
    });
    return items;
  }, [profile?.role, nav, setOpen, signOut]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(needle) || c.hint.toLowerCase().includes(needle),
    );
  }, [commands, q]);

  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  function move(delta: number) {
    setSel((s) => (results.length ? (s + delta + results.length) % results.length : 0));
  }

  function run(cmd: Command | undefined) {
    if (cmd) cmd.run();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/60 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move(-1);
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(results[sel]);
            }
          }}
          placeholder="Jump to a page or run a command…"
          aria-label="Search commands"
          className="w-full border-b border-slate-200/70 bg-transparent px-4 py-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        <ul className="max-h-80 overflow-auto py-2" role="listbox">
          {results.map((c, i) => (
            <li key={c.key} role="option" aria-selected={i === sel}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => run(c)}
                className={cx(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm",
                  i === sel ? "bg-emerald-50 text-emerald-900" : "text-slate-700",
                )}
              >
                <span className="font-semibold">{c.label}</span>
                <span className="ml-auto text-xs text-slate-400">{c.hint}</span>
              </button>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-400">No matches.</li>
          ) : null}
        </ul>
        <div className="border-t border-slate-200/70 px-4 py-2 text-[11px] text-slate-400">
          ↑ ↓ to navigate · Enter to open · Esc to close
        </div>
      </div>
    </div>
  );
}

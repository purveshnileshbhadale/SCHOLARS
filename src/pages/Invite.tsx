import { useEffect, useState } from "react";
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Toast } from "../components/ui";
import { cx } from "../lib/utils";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { waShareUrl } from "../lib/config";

interface ReferralRow {
  id: string;
  created_at: string;
}

const MILESTONES = [
  { at: 1, title: "First friend in", note: "Someone you referred created an account." },
  { at: 3, title: "Small crew", note: "Three friends on board — you're clearly selling it well." },
  { at: 5, title: "Ambassador", note: "Five friends. The community feels your presence." },
  { at: 10, title: "Squad leader", note: "Ten referrals — you might as well run a study group." },
];

/**
 * Refer-a-friend — the referral link already works at signup (?ref=<uid>);
 * this page surfaces it, counts who joined and celebrates milestones.
 * Rows are readable by the referrer only (RLS: involved only).
 */
export default function Invite() {
  const { session, profile } = useAuth();
  const [rows, setRows] = useState<ReferralRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const uid = session?.user.id;
  const link = uid ? `${window.location.origin}/signup?ref=${uid}` : "";

  useEffect(() => {
    let live = true;
    if (!uid) return;
    supabase
      .from("referrals")
      .select("id, created_at")
      .eq("referrer_id", uid)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (!live) return;
        if (error) setErr(error.message);
        setRows((data ?? []) as ReferralRow[]);
      });
    return () => {
      live = false;
    };
  }, [uid]);

  const count = rows?.length ?? 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setToast("Link copied — send it to a friend");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast("Could not copy — select the link and copy manually.");
    }
  }

  const message = `Hey! I'm using Scholars Abroad to plan my study-abroad journey (university matching, SOPs, deadlines, the lot). Join with my link and we can compare shortlists: ${link}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Refer a friend"
        subtitle="Share your link — when they sign up with it, they land on the same toolkit instead of starting from zero."
        right={<Badge className="bg-violet-50 text-violet-700 ring-violet-200">{count} joined</Badge>}
      />
      <ErrorNote>{err}</ErrorNote>
      <Toast message={toast} />

      {/* Link card */}
      <Card className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Your personal link</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-700">{link}</code>
          <Button onClick={copy} disabled={!link}>
            {copied ? "Copied ✓" : "Copy link"}
          </Button>
          <a href={waShareUrl(message)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(37,211,102,0.8)] transition hover:-translate-y-0.5 hover:bg-[#1eae57]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
              <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5.1-1.3A10 10 0 1012 2zm5.4 14.2c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3.2-.9-2.7-1.2-4.4-4-4.5-4.2-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l2 1c.2.1.4.2.4.3.1.2.1.7-.1 1.3z" />
            </svg>
            WhatsApp
          </a>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          The link opens the signup page with your ID attached — nothing else is shared. Works for any country ({profile?.name ? "signed in as " + profile.name : "you"}).
        </p>
      </Card>

      {/* Milestones */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-bold text-slate-900">Milestones</h2>
        <ul className="space-y-3">
          {MILESTONES.map((m) => {
            const done = count >= m.at;
            return (
              <li key={m.at} className={cx("flex items-start gap-3 rounded-2xl border px-4 py-3", done ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white/60")}>
                <span
                  className={cx(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ring-1",
                    done ? "bg-emerald-500 text-white ring-emerald-400" : "bg-slate-100 text-slate-400 ring-slate-200",
                  )}
                >
                  {m.at}
                </span>
                <div>
                  <p className={cx("text-sm font-bold", done ? "text-emerald-800" : "text-slate-700")}>
                    {m.title}
                    {done ? " · unlocked" : ""}
                  </p>
                  <p className="text-xs text-slate-500">{m.note}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Referral list */}
      <Card>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Friends who joined</h2>
        {rows === null ? (
          <Spinner className="mx-auto my-6 size-6" />
        ) : rows.length === 0 ? (
          <Empty title="No referrals yet" body="Share the link — each friend who signs up with it shows up here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-semibold text-slate-700">Friend #{rows.length - i}</span>
                <span className="text-xs text-slate-400">
                  Joined {new Date(r.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          We show join dates only — friends' names stay private, matching how the referral table is locked down.
        </p>
      </Card>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { getTheme, setTheme, type Theme } from "../lib/theme";
import { Button, Card, ErrorNote, Field, Input, PageHeader, Select } from "../components/ui";

export default function Settings() {
  const { session, profile, studentProfile, refresh, signOut } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [confirmText, setConfirmText] = useState("");

  // ---- Feature 59: TOTP two-factor authentication ----
  type MfaFactor = { id: string; factor_type: string; status: string };
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [enrollId, setEnrollId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    if (!session) return;
    supabase.auth.mfa
      .listFactors()
      .then(({ data }) => setFactors((data?.all ?? []) as MfaFactor[]))
      .catch(() => setFactors([]));
  }, [session?.access_token]);

  async function startEnroll() {
    setErr(null);
    setNote(null);
    setBusy("mfa");
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
    setEnrollId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  async function confirmEnroll() {
    if (!enrollId) return;
    setErr(null);
    setNote(null);
    setBusy("mfa-v");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollId, code: mfaCode });
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
    cancelEnroll();
    setNote("Two-factor authentication is on — you'll enter a code at every login.");
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.all ?? []) as MfaFactor[]);
  }

  function cancelEnroll() {
    setEnrollId(null);
    setQr(null);
    setSecret(null);
    setMfaCode("");
  }

  async function removeFactor(id: string) {
    setErr(null);
    setNote(null);
    setBusy("mfa-x");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
    setNote("Two-factor authentication turned off.");
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.all ?? []) as MfaFactor[]);
  }

  const verifiedTotp = factors.find((f) => f.factor_type === "totp" && f.status === "verified");

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  async function saveDetails(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy("details");
    setErr(null);
    setNote(null);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim() || null, phone: phone.trim() || null })
      .eq("id", session.user.id);
    if (error) setErr(error.message);
    else {
      setNote("Details saved.");
      await refresh();
    }
    setBusy(null);
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setNote(null);
    if (pw1.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy("pw");
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) setErr(error.message);
    else {
      setNote("Password updated.");
      setPw1("");
      setPw2("");
    }
    setBusy(null);
  }

  function applyTheme(t: Theme) {
    setTheme(t);
    setThemeState(t);
  }

  // ---- Feature 55: notification preferences (digest opt-out + reminder window) ----
  async function saveNotify(patch: { email_digest_enabled?: boolean; reminder_lead_days?: number }) {
    if (!session) return;
    setBusy("notify");
    setErr(null);
    const { error } = await supabase.from("profiles").update(patch).eq("id", session.user.id);
    if (error) setErr(error.message);
    else await refresh();
    setBusy(null);
  }

  // ---- Feature 45: export everything this account owns, as one JSON file ----
  async function exportMyData() {
    if (!session) return;
    setBusy("export");
    setErr(null);
    setNote(null);
    const uid = session.user.id;
    const queries: [string, PromiseLike<{ data: unknown; error: { message: string } | null }>][] = [
      ["profiles", supabase.from("profiles").select("*").eq("id", uid)],
      ["student_profiles", supabase.from("student_profiles").select("*").eq("user_id", uid)],
      ["shortlists", supabase.from("shortlists").select("*").eq("student_id", uid)],
      ["applications", supabase.from("applications").select("*").eq("student_id", uid)],
      [
        "application_documents",
        supabase
          .from("application_documents")
          .select("*, applications!inner(student_id)")
          .eq("applications.student_id", uid),
      ],
      ["student_documents", supabase.from("student_documents").select("*").eq("student_id", uid)],
      ["lor_requests", supabase.from("lor_requests").select("*").eq("student_id", uid)],
      ["bookings", supabase.from("bookings").select("*").eq("student_id", uid)],
      ["reminders", supabase.from("reminders").select("*").eq("student_id", uid)],
      ["sop_responses", supabase.from("sop_responses").select("*").eq("student_id", uid)],
      ["university_reviews", supabase.from("university_reviews").select("*").eq("student_id", uid)],
      ["saved_universities", supabase.from("saved_universities").select("*").eq("student_id", uid)],
      ["community_posts", supabase.from("community_posts").select("*").eq("author_id", uid)],
      ["post_comments", supabase.from("post_comments").select("*").eq("author_id", uid)],
      ["post_reactions", supabase.from("post_reactions").select("*").eq("student_id", uid)],
      ["post_bookmarks", supabase.from("post_bookmarks").select("*").eq("student_id", uid)],
      ["uni_questions", supabase.from("uni_questions").select("*").eq("student_id", uid)],
      ["uni_answers", supabase.from("uni_answers").select("*").eq("student_id", uid)],
      ["profile_shares", supabase.from("profile_shares").select("*").eq("student_id", uid)],
      ["referrals", supabase.from("referrals").select("*").or(`referrer_id.eq.${uid},referred_id.eq.${uid}`)],
    ];
    try {
      const results = await Promise.all(queries.map(([, q]) => q));
      const data: Record<string, unknown> = {};
      const errors: Record<string, string> = {};
      queries.forEach(([name2], i) => {
        const r = results[i];
        if (r.error) errors[name2] = r.error.message;
        else data[name2] = r.data;
      });
      const payload = {
        exported_at: new Date().toISOString(),
        account: { id: uid, email: session.user.email },
        data,
        ...(Object.keys(errors).length ? { skipped: errors } : {}),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scholars-abroad-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNote(
        Object.keys(errors).length
          ? `Export downloaded (some sections skipped: ${Object.keys(errors).join(", ")}).`
          : "Export downloaded — every section included.",
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  // ---- Feature 46: community visibility toggle inside the privacy centre ----
  async function toggleCommunityVisibility() {
    if (!session || !studentProfile) return;
    setBusy("community");
    setErr(null);
    setNote(null);
    const joining = !studentProfile.community_joined_at;
    const { error } = await supabase
      .from("student_profiles")
      .update({ community_joined_at: joining ? new Date().toISOString() : null })
      .eq("user_id", session.user.id);
    if (error) setErr(error.message);
    else {
      setNote(joining ? "You are visible in the community directory." : "You are hidden from the community directory.");
      await refresh();
    }
    setBusy(null);
  }

  // ---- Feature 47: account deletion (edge function, full cascade) ----
  async function deleteAccount() {
    if (!session || confirmText !== "DELETE") return;
    setBusy("delete");
    setErr(null);
    setNote(null);
    try {
      const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
      if (error) {
        const body = error.context ? await error.context.json().catch(() => null) : null;
        throw new Error(body?.error ?? "Could not delete the account");
      }
      await supabase.auth.signOut().catch(() => undefined);
      nav("/", { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete the account");
      setBusy(null);
    }
  }

  const joined = !!studentProfile?.community_joined_at;
  const consent = !!studentProfile?.share_consent;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="Your account details, appearance, privacy and data." />
      {err ? <ErrorNote>{err}</ErrorNote> : null}
      {note ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{note}</p>
      ) : null}

      <Card>
        <h2 className="font-bold text-slate-900">Contact details</h2>
        <p className="mt-1 text-xs text-slate-500">Used by counsellors when you share your profile or book a session.</p>
        <form onSubmit={saveDetails} className="mt-4 space-y-4">
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxx xxxxx" />
          </Field>
          <Button type="submit" disabled={busy === "details"}>
            {busy === "details" ? "Saving…" : "Save details"}
          </Button>
        </form>
      </Card>

      {/* Feature 43: appearance */}
      <Card>
        <h2 className="font-bold text-slate-900">Appearance</h2>
        <p className="mt-1 text-xs text-slate-500">Dark mode follows this device only — your choice is remembered.</p>
        <div className="mt-3 flex gap-2">
          <Button variant={theme === "light" ? "primary" : "ghost"} className="px-5" onClick={() => applyTheme("light")}>
            Light
          </Button>
          <Button variant={theme === "dark" ? "primary" : "ghost"} className="px-5" onClick={() => applyTheme("dark")}>
            Dark
          </Button>
        </div>
      </Card>

      {/* Feature 55: notification preferences */}
      <Card>
        <h2 className="font-bold text-slate-900">Notifications</h2>
        <p className="mt-1 text-xs text-slate-500">Deadline digest email and how early reminders start shouting.</p>
        <div className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-slate-300 text-emerald-600"
              checked={profile?.email_digest_enabled ?? true}
              disabled={busy === "notify"}
              onChange={(e) => saveNotify({ email_digest_enabled: e.target.checked })}
            />
            <span>
              <span className="text-sm font-semibold text-slate-800">Weekly deadline digest email</span>
              <span className="block text-xs text-slate-500">
                One email when deadlines, sessions or reminders fall due. Only sent if email is configured on the server.
              </span>
            </span>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Remind me this many days before a deadline
            <Select
              className="mt-1 max-w-56"
              value={String(profile?.reminder_lead_days ?? 30)}
              disabled={busy === "notify"}
              onChange={(e) => saveNotify({ reminder_lead_days: Number(e.target.value) })}
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </Select>
            <span className="mt-1 block font-normal text-slate-400">
              Controls the action bell window and calendar alarm timing.
            </span>
          </label>
        </div>
      </Card>

      {/* Feature 59: TOTP two-factor authentication */}
      <Card>
        <h2 className="font-bold text-slate-900">Two-factor authentication</h2>
        <p className="mt-1 text-xs text-slate-500">
          Protect your account with a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password…).
        </p>
        {enrollId ? (
          <div className="mt-4 space-y-3">
            {qr ? (
              <div
                className="w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
            ) : null}
            <div>
              <p className="text-xs font-semibold text-slate-600">Can't scan? Add it manually:</p>
              <code className="mt-1 block break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">{secret ?? ""}</code>
            </div>
            <Field label="Enter the 6-digit code to confirm">
              <Input
                inputMode="numeric"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
              />
            </Field>
            <div className="flex gap-2">
              <Button disabled={busy === "mfa-v" || mfaCode.length !== 6} onClick={confirmEnroll}>
                {busy === "mfa-v" ? "Verifying…" : "Turn on"}
              </Button>
              <Button variant="ghost" disabled={busy === "mfa-v"} onClick={cancelEnroll}>
                Cancel
              </Button>
            </div>
          </div>
        ) : verifiedTotp ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
            <span className="text-sm font-semibold text-emerald-800">On — a code is required at every login</span>
            <Button variant="ghost" disabled={busy === "mfa-x"} onClick={() => removeFactor(verifiedTotp.id)}>
              {busy === "mfa-x" ? "Turning off…" : "Turn off"}
            </Button>
          </div>
        ) : (
          <Button className="mt-4" disabled={busy === "mfa"} onClick={startEnroll}>
            {busy === "mfa" ? "Preparing…" : "Set up authenticator app"}
          </Button>
        )}
      </Card>

      <Card>
        <h2 className="font-bold text-slate-900">Email</h2>
        <dl className="mt-3 flex gap-3 text-sm">
          <dt className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">Email</dt>
          <dd className="text-slate-800">{session?.user.email ?? "—"}</dd>
        </dl>
        <p className="mt-2 text-xs text-slate-400">Email cannot be changed here. Contact support if you need this updated.</p>
      </Card>

      <Card>
        <h2 className="font-bold text-slate-900">Change password</h2>
        <form onSubmit={changePassword} className="mt-4 space-y-4">
          <Field label="New password" hint="min 8 characters">
            <Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password">
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} autoComplete="new-password" />
          </Field>
          <Button type="submit" variant="ghost" disabled={busy === "pw"}>
            {busy === "pw" ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Card>

      {/* Feature 46: privacy centre */}
      <Card>
        <h2 className="font-bold text-slate-900">Privacy centre</h2>
        <p className="mt-1 text-xs text-slate-500">You control what leaves your account. Nothing is ever sold.</p>
        <ul className="mt-4 space-y-3">
          <li className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="min-w-52 grow">
              <p className="text-sm font-semibold text-slate-800">Public profile link</p>
              <p className="text-xs text-slate-500">
                {consent
                  ? "Consent is ON — a revocable link can reveal your shortlist to counsellors."
                  : "Consent is OFF — nobody can view your profile through a link."}
              </p>
            </div>
            <Link to="/applications">
              <Button variant="ghost" className="px-3">
                Manage
              </Button>
            </Link>
          </li>
          <li className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="min-w-52 grow">
              <p className="text-sm font-semibold text-slate-800">Community directory</p>
              <p className="text-xs text-slate-500">
                {joined
                  ? "Visible — members see your name, course and LinkedIn."
                  : "Hidden — only your posts (if any) are visible."}
              </p>
            </div>
            <Button
              variant="ghost"
              className="px-3"
              onClick={toggleCommunityVisibility}
              disabled={busy === "community"}
            >
              {busy === "community" ? "Saving…" : joined ? "Hide me" : "Show me"}
            </Button>
          </li>
          <li className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-800">What we store</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Profile and academic details, your documents (private, in your own vault), application tracker rows, and
              anything you post publicly (community posts, reviews, Q&amp;A). Counsellors only ever see what you
              explicitly share.
            </p>
          </li>
          <li className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="min-w-52 grow">
              <p className="text-sm font-semibold text-slate-800">Export my data</p>
              <p className="text-xs text-slate-500">Download everything above as a single JSON file.</p>
            </div>
            <Button variant="ghost" className="px-3" onClick={exportMyData} disabled={busy === "export"}>
              {busy === "export" ? "Preparing…" : "Download JSON"}
            </Button>
          </li>
        </ul>
      </Card>

      {/* Feature 47: account deletion */}
      <Card className="border-rose-200">
        <h2 className="font-bold text-rose-800">Delete account</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          This permanently removes your account and everything attached to it: profile, shortlist, applications,
          documents, bookings, community posts and referrals. It cannot be undone. (Payments already made are handled
          separately — contact support for refunds.)
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-52 grow">
            <Field label='Type "DELETE" to confirm'>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </Field>
          </div>
          <Button
            variant="danger"
            onClick={deleteAccount}
            disabled={busy === "delete" || confirmText !== "DELETE"}
            className="min-h-11"
          >
            {busy === "delete" ? "Deleting…" : "Delete my account"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth, homeFor } from "../lib/auth";
import { Button, Card, ErrorNote, Field, Input } from "../components/ui";

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const nav = useNavigate();
  const { refresh, profile, session, loading } = useAuth();

  // Already logged in — never show the login form again ("once login, keep login").
  if (!loading && session) return <Navigate to={homeFor(profile?.role)} replace />;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function forgot() {
    setErr(null);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setResetSent(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, phone } },
        });
        if (error) throw error;
        if (data.session) {
          // Fill profile contact details (trigger already created the row).
          await supabase.from("profiles").update({ name, phone }).eq("id", data.user!.id);
          // Refer-a-friend: record who invited this signup (?ref=<referrer uuid>).
          const ref = new URLSearchParams(window.location.search).get("ref");
          if (ref && ref !== data.user!.id) {
            await supabase.from("referrals").insert({ referrer_id: ref, referred_id: data.user!.id });
          }
          await refresh();
          nav("/onboarding");
        } else {
          setErr("Check your email to confirm your account, then log in.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Fetch the role fresh — the context profile can be stale here, which
        // previously bounced admins/counsellors to the student dashboard.
        const [{ data: prof }] = await Promise.all([
          supabase.from("profiles").select("role").eq("id", data.user!.id).maybeSingle(),
          refresh(),
        ]);
        nav(homeFor(prof?.role ?? "student"), { replace: true });
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setErr(error.message);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <img src="/logo.png" alt="Scholars Abroad" className="h-10 w-auto" />
          <h1 className="mt-3 text-xl font-bold text-slate-900">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "signup" ? "Free Australian university shortlist in minutes." : "Log in to see your shortlist."}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" ? (
            <>
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Aarav Sharma" />
              </Field>
              <Field label="Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxx xxxxx" />
              </Field>
            </>
          ) : null}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </Field>
          <Field label="Password" hint={mode === "signup" ? "min 8 characters" : undefined}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
            />
          </Field>
          {mode === "login" && !showForgot ? (
            <button
              type="button"
              className="-mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
              onClick={() => setShowForgot(true)}
            >
              Forgot password?
            </button>
          ) : null}
          {mode === "login" && showForgot ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              {resetSent ? (
                <p className="text-sm text-slate-700">
                  Reset link sent to <strong>{email}</strong>. Open it on this device to set a new password.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-slate-500">Enter your email above, then send yourself a reset link.</p>
                  <Button type="button" variant="ghost" className="w-full" disabled={busy || !email} onClick={forgot}>
                    {busy ? "Sending…" : "Send reset link"}
                  </Button>
                </>
              )}
            </div>
          ) : null}
          <ErrorNote>{err}</ErrorNote>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Please wait…" : mode === "signup" ? "Sign up free" : "Log in"}
          </Button>
        </form>
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <Button type="button" variant="ghost" className="w-full" onClick={google} disabled={busy}>
          <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>
        <p className="mt-5 text-center text-sm text-slate-600">
          {mode === "signup" ? (
            <>
              Already registered?{" "}
              <Link to="/login" className="font-semibold text-emerald-800">
                Log in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link to="/signup" className="font-semibold text-emerald-800">
                Create a free account
              </Link>
            </>
          )}
        </p>
        <p className="mt-4 text-center text-xs">
          <Link to="/" className="text-slate-400 hover:text-slate-600">
            ← Back to home
          </Link>
        </p>
      </Card>
    </div>
  );
}

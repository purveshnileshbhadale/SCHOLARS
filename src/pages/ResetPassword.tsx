import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Button, Card, ErrorNote, Field, Input, Spinner } from "../components/ui";

/** Entered via the emailed recovery link (GoTrue hash session). */
export default function ResetPassword() {
  const nav = useNavigate();
  const { session } = useAuth();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Give supabase-js a beat to pick the recovery token out of the URL hash.
    const t = setTimeout(() => setChecking(false), 800);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw1.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) setErr(error.message);
    else nav("/dashboard", { replace: true });
    setBusy(false);
  }

  if (checking)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="size-8" />
      </div>
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <img src="/logo.png" alt="Scholars Abroad" className="h-10 w-auto" />
          <h1 className="mt-3 text-xl font-bold text-slate-900">Set a new password</h1>
        </div>
        {!session ? (
          <>
            <ErrorNote>
              This reset link is invalid or has expired. Go to Log in → "Forgot password?" to request a new one.
            </ErrorNote>
            <div className="mt-4 text-center text-sm">
              <a href="/login" className="font-semibold text-emerald-800">
                Back to log in
              </a>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="New password" hint="min 8 characters">
              <Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} required minLength={8} autoFocus />
            </Field>
            <Field label="Confirm password">
              <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} />
            </Field>
            <ErrorNote>{err}</ErrorNote>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Updating…" : "Set password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

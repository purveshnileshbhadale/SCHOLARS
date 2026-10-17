import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { homeFor, useAuth } from "./lib/auth";
import type { Role } from "./lib/types";
import { supabase } from "./lib/supabase";
import { Button, Card, ErrorNote, Field, Input, Spinner } from "./components/ui";
import Shell from "./components/Shell";

// First-paint routes stay eager (landing, auth, post-signup, post-login,
// reset link, shareable public profile). Every other page loads on
// navigation — perf pass: entry chunk was 820 kB with all pages eager.
import Landing from "./pages/Landing";
import AuthPage from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import ResetPassword from "./pages/ResetPassword";
import PublicProfile from "./pages/PublicProfile";

const Menu = lazy(() => import("./pages/Menu"));
const Universities = lazy(() => import("./pages/Universities"));
const Scholarships = lazy(() => import("./pages/Scholarships"));
const Tools = lazy(() => import("./pages/Tools"));
const Counsellors = lazy(() => import("./pages/Counsellors"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Applications = lazy(() => import("./pages/Applications"));
const Documents = lazy(() => import("./pages/Documents"));
const Deadlines = lazy(() => import("./pages/Deadlines"));
const Community = lazy(() => import("./pages/Community"));
const Mentor = lazy(() => import("./pages/Mentor"));
const Settings = lazy(() => import("./pages/Settings"));
const Sop = lazy(() => import("./pages/Sop"));
const CostOfLiving = lazy(() => import("./pages/CostOfLiving"));
const Cv = lazy(() => import("./pages/Cv"));
const CounsellorHome = lazy(() => import("./pages/counsellor/CounsellorHome"));
const CounsellorBookings = lazy(() => import("./pages/counsellor/CounsellorBookings"));
const CounsellorStudent = lazy(() => import("./pages/counsellor/CounsellorStudent"));
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const AdminUniversities = lazy(() => import("./pages/admin/AdminUniversities"));
const AdminCounsellors = lazy(() => import("./pages/admin/AdminCounsellors"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings"));
// SheetJS is only needed on the admin import screen — keep it out of the main chunk.
const AdminImport = lazy(() => import("./pages/admin/AdminImport"));

// AAL2 gate: if the user has a verified TOTP factor, every session that lands
// at aal1 (password OR OAuth) must enter a code before the app opens.
function MfaChallenge({ onPass }: { onPass: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { data: mf } = await supabase.auth.mfa.listFactors();
      const factor = (mf?.all ?? []).find((f) => f.factor_type === "totp" && f.status === "verified");
      if (!factor) throw new Error("No authenticator enrolled. Log out, then log back in.");
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) throw error;
      onPass();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Invalid code — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-slate-900">Two-factor check</h1>
        <p className="mt-1 text-sm text-slate-500">Enter the 6-digit code from your authenticator app to continue.</p>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <Field label="Authentication code">
            <Input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
            />
          </Field>
          <ErrorNote>{err}</ErrorNote>
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            {busy ? "Verifying…" : "Verify and continue"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Guard({ role, children }: { role?: Role; children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const loc = useLocation();
  const [aal, setAal] = useState<"checking" | "pass" | "challenge">("checking");

  useEffect(() => {
    let live = true;
    if (!session) {
      setAal("checking");
      return;
    }
    supabase.auth.mfa
      .getAuthenticatorAssuranceLevel()
      .then(({ data }) => {
        if (live) setAal(data?.currentLevel === "aal1" && data?.nextLevel === "aal2" ? "challenge" : "pass");
      })
      .catch(() => {
        if (live) setAal("pass");
      });
    return () => {
      live = false;
    };
  }, [session?.access_token]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (aal === "checking")
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  if (aal === "challenge") return <MfaChallenge onPass={() => setAal("pass")} />;
  if (role && profile?.role !== role) return <Navigate to={homeFor(profile?.role)} replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="size-8" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />

        {/* Public counsellor-facing profile — no Shell, no auth (token is the credential). */}
        <Route path="/student-profile/:token" element={<PublicProfile />} />

        <Route path="/onboarding" element={<Guard><Onboarding /></Guard>} />
        <Route path="/menu" element={<Guard><Menu /></Guard>} />
        <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
        <Route path="/universities" element={<Guard><Universities /></Guard>} />
        <Route path="/scholarships" element={<Guard><Scholarships /></Guard>} />
        <Route path="/tools" element={<Guard><Tools /></Guard>} />
        <Route path="/cost-of-living" element={<Guard><CostOfLiving /></Guard>} />
        <Route path="/cv" element={<Guard><Cv /></Guard>} />
        <Route path="/mentor" element={<Guard><Mentor /></Guard>} />
        <Route path="/counsellors" element={<Guard><Counsellors /></Guard>} />
        <Route path="/bookings" element={<Guard><Bookings /></Guard>} />
        <Route path="/applications" element={<Guard><Applications /></Guard>} />
        <Route path="/documents" element={<Guard><Documents /></Guard>} />
        <Route path="/deadlines" element={<Guard><Deadlines /></Guard>} />
        <Route path="/sop" element={<Guard><Sop /></Guard>} />
        <Route path="/community" element={<Guard><Community /></Guard>} />
        <Route path="/settings" element={<Guard><Settings /></Guard>} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/counsellor" element={<Guard role="counsellor"><CounsellorHome /></Guard>} />
        <Route path="/counsellor/bookings" element={<Guard role="counsellor"><CounsellorBookings /></Guard>} />
        <Route path="/counsellor/student/:id" element={<Guard role="counsellor"><CounsellorStudent /></Guard>} />

        <Route path="/admin" element={<Guard role="admin"><AdminHome /></Guard>} />

        <Route path="/admin/universities" element={<Guard role="admin"><AdminUniversities /></Guard>} />
        <Route path="/admin/import" element={<Guard role="admin"><AdminImport /></Guard>} />
        <Route path="/admin/counsellors" element={<Guard role="admin"><AdminCounsellors /></Guard>} />
        <Route path="/admin/bookings" element={<Guard role="admin"><AdminBookings /></Guard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

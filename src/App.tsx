import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { homeFor, useAuth } from "./lib/auth";
import type { Role } from "./lib/types";
import { Spinner } from "./components/ui";
import Shell from "./components/Shell";
import Landing from "./pages/Landing";
import AuthPage from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Universities from "./pages/Universities";
import Scholarships from "./pages/Scholarships";
import Tools from "./pages/Tools";
import Counsellors from "./pages/Counsellors";
import Bookings from "./pages/Bookings";
import Applications from "./pages/Applications";
import Documents from "./pages/Documents";
import Deadlines from "./pages/Deadlines";
import Community from "./pages/Community";
import Mentor from "./pages/Mentor";
import Settings from "./pages/Settings";
import ResetPassword from "./pages/ResetPassword";
import Sop from "./pages/Sop";
import PublicProfile from "./pages/PublicProfile";
import CounsellorHome from "./pages/counsellor/CounsellorHome";
import CounsellorStudent from "./pages/counsellor/CounsellorStudent";
import CounsellorBookings from "./pages/counsellor/CounsellorBookings";
import AdminHome from "./pages/admin/AdminHome";
import AdminUniversities from "./pages/admin/AdminUniversities";
import AdminCounsellors from "./pages/admin/AdminCounsellors";
import AdminBookings from "./pages/admin/AdminBookings";

// SheetJS is only needed on the admin import screen — keep it out of the main chunk.
const AdminImport = lazy(() => import("./pages/admin/AdminImport"));

function Guard({ role, children }: { role?: Role; children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const loc = useLocation();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (role && profile?.role !== role) return <Navigate to={homeFor(profile?.role)} replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />

      {/* Public counsellor-facing profile — no Shell, no auth (token is the credential). */}
      <Route path="/student-profile/:token" element={<PublicProfile />} />

      <Route path="/onboarding" element={<Guard><Onboarding /></Guard>} />
      <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
      <Route path="/universities" element={<Guard><Universities /></Guard>} />
      <Route path="/scholarships" element={<Guard><Scholarships /></Guard>} />
      <Route path="/tools" element={<Guard><Tools /></Guard>} />
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
      <Route path="/admin/import" element={<Guard role="admin"><Suspense fallback={<div className="flex justify-center py-24"><Spinner className="size-8" /></div>}><AdminImport /></Suspense></Guard>} />
      <Route path="/admin/counsellors" element={<Guard role="admin"><AdminCounsellors /></Guard>} />
      <Route path="/admin/bookings" element={<Guard role="admin"><AdminBookings /></Guard>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

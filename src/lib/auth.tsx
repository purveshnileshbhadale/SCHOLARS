import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Profile, Role, StudentProfile } from "./types";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  studentProfile: StudentProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  studentProfile: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(uid: string) {
    const [{ data: prof }, { data: sp }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("student_profiles").select("*").eq("user_id", uid).maybeSingle(),
    ]);
    setProfile((prof as Profile) ?? null);
    setStudentProfile((sp as StudentProfile) ?? null);
  }

  async function refresh() {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) await load(data.session.user.id);
    else {
      setProfile(null);
      setStudentProfile(null);
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) load(s.user.id);
      else {
        setProfile(null);
        setStudentProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setStudentProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, profile, studentProfile, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function homeFor(role: Role | undefined): string {
  if (role === "admin") return "/admin/universities";
  if (role === "counsellor") return "/counsellor";
  return "/dashboard";
}

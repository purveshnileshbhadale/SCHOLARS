/**
 * Achievement engine — deterministic badges computed from existing activity.
 * Signals come from Supabase tables (applications, documents, shortlists …)
 * plus localStorage lifelog counters. No LLM, no new tables.
 */

export interface Signals {
  profileComplete: boolean;
  hasResume: boolean;
  shareConsent: boolean;
  shortlistCount: number;
  shortlistReviewed: boolean;
  applications: number;
  submitted: number;
  offers: number;
  documents: number;
  sopAnswers: number;
  bookings: number;
  posts: number;
  roadmapDone: number;
  gapReports: number;
  scholarshipSubmitted: number;
  scholarshipAwarded: number;
  outreachSent: number;
  outreachReplied: number;
  streak: number;
  budgetEntries: number;
  workEntries: number;
  predepartureChecked: number;
  vocabMastered: number;
  writingAttempts: number;
  speakingPractised: number;
}

export const EMPTY_SIGNALS: Signals = {
  profileComplete: false,
  hasResume: false,
  shareConsent: false,
  shortlistCount: 0,
  shortlistReviewed: false,
  applications: 0,
  submitted: 0,
  offers: 0,
  documents: 0,
  sopAnswers: 0,
  bookings: 0,
  posts: 0,
  roadmapDone: 0,
  gapReports: 0,
  scholarshipSubmitted: 0,
  scholarshipAwarded: 0,
  outreachSent: 0,
  outreachReplied: 0,
  streak: 0,
  budgetEntries: 0,
  workEntries: 0,
  predepartureChecked: 0,
  vocabMastered: 0,
  writingAttempts: 0,
  speakingPractised: 0,
};

export type BadgeCategory = "Getting started" | "Applications" | "Planning" | "Community" | "Life in AU";

export interface Badge {
  id: string;
  title: string;
  desc: string;
  icon: string;
  category: BadgeCategory;
  tone: string;
  target: number;
  unit: string;
  value: (s: Signals) => number;
}

export const BADGES: Badge[] = [
  // Getting started
  { id: "profile", title: "Profile complete", desc: "Finished onboarding with every required field.", icon: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 7a4 4 0 100-8 4 4 0 000 8z", category: "Getting started", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", target: 1, unit: "", value: (s) => (s.profileComplete ? 1 : 0) },
  { id: "cv", title: "CV ready", desc: "Uploaded or built a CV in the vault.", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M8 13h8 M8 17h5", category: "Getting started", tone: "bg-sky-50 text-sky-700 ring-sky-200", target: 1, unit: "", value: (s) => (s.hasResume ? 1 : 0) },
  { id: "shortlist", title: "First shortlist", desc: "Generated your AI-matched university shortlist.", icon: "M11 3l2 4 4 .5-3 3 .8 4.4L11 13l-3.8 1.9.8-4.4-3-3 4-.5z M5 21h14", category: "Getting started", tone: "bg-violet-50 text-violet-700 ring-violet-200", target: 1, unit: "", value: (s) => s.shortlistCount },
  { id: "review", title: "Shortlist reviewed", desc: "Opened every uni on your shortlist list view.", icon: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z M12 9a3 3 0 100 6 3 3 0 000-6z", category: "Getting started", tone: "bg-teal-50 text-teal-700 ring-teal-200", target: 1, unit: "", value: (s) => (s.shortlistReviewed ? 1 : 0) },

  // Applications
  { id: "app1", title: "First application", desc: "Started tracking your first university application.", icon: "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11", category: "Applications", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", target: 1, unit: "", value: (s) => s.applications },
  { id: "app3", title: "Three in play", desc: "Running three or more applications at once — the safe way.", icon: "M3 7h18v13H3z M3 7l2-4h14l2 4 M12 11v5 M9.5 13.5h5", category: "Applications", tone: "bg-amber-50 text-amber-700 ring-amber-200", target: 3, unit: "applications", value: (s) => s.applications },
  { id: "submitted", title: "Sent it off", desc: "Marked your first application as submitted.", icon: "M22 2L11 13 M22 2l-7 20-4-9-9-4z", category: "Applications", tone: "bg-rose-50 text-rose-700 ring-rose-200", target: 1, unit: "", value: (s) => s.submitted },
  { id: "offer", title: "Offer in hand", desc: "Received at least one offer of admission.", icon: "M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z", category: "Applications", tone: "bg-violet-50 text-violet-700 ring-violet-200", target: 1, unit: "", value: (s) => s.offers },
  { id: "sop", title: "Statement started", desc: "Answered the first SOP prompts.", icon: "M12 20h9 M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z", category: "Applications", tone: "bg-sky-50 text-sky-700 ring-sky-200", target: 1, unit: "", value: (s) => s.sopAnswers },

  // Planning
  { id: "docs", title: "Vault of five", desc: "Five or more documents secured in one place.", icon: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z", category: "Planning", tone: "bg-teal-50 text-teal-700 ring-teal-200", target: 5, unit: "documents", value: (s) => s.documents },
  { id: "gap", title: "Gap report run", desc: "Generated your first rules-based gap report.", icon: "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11", category: "Planning", tone: "bg-amber-50 text-amber-700 ring-amber-200", target: 1, unit: "", value: (s) => s.gapReports },
  { id: "road5", title: "Five steps done", desc: "Completed five roadmap tasks.", icon: "M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11", category: "Planning", tone: "bg-sky-50 text-sky-700 ring-sky-200", target: 5, unit: "tasks", value: (s) => s.roadmapDone },
  { id: "road10", title: "Ten steps done", desc: "Completed ten roadmap tasks. Momentum is real.", icon: "M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z", category: "Planning", tone: "bg-violet-50 text-violet-700 ring-violet-200", target: 10, unit: "tasks", value: (s) => s.roadmapDone },
  { id: "streak7", title: "7-day streak", desc: "Seven consecutive days of ticking off the daily plan.", icon: "M12 2c3 4 5 6.5 5 10a5 5 0 01-10 0c0-3.5 2-6 5-10z", category: "Planning", tone: "bg-amber-50 text-amber-700 ring-amber-200", target: 7, unit: "days", value: (s) => s.streak },
  { id: "predep", title: "Departure-ready", desc: "Fifteen or more pre-departure items ticked.", icon: "M17.8 1.2L15 4l-6.5-2.3L6 4.7 1.2 9l3.4 2.3L2.3 16l4.7 1.4 1.4 4.7 4.7-2.3 2.3 3.4 4.8-4.8-2.3-6.5L21 9.5z", category: "Planning", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", target: 15, unit: "items", value: (s) => s.predepartureChecked },

  // Community
  { id: "post", title: "First post", desc: "Shared something with the community.", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z", category: "Community", tone: "bg-sky-50 text-sky-700 ring-sky-200", target: 1, unit: "", value: (s) => s.posts },
  { id: "booking", title: "Spoke to a counsellor", desc: "Booked or completed a counselling session.", icon: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z", category: "Community", tone: "bg-teal-50 text-teal-700 ring-teal-200", target: 1, unit: "", value: (s) => s.bookings },
  { id: "share", title: "Profile shared", desc: "Turned on share consent so a counsellor can see your progress.", icon: "M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8 M16 6l-4-4-4 4 M12 2v13", category: "Community", tone: "bg-violet-50 text-violet-700 ring-violet-200", target: 1, unit: "", value: (s) => (s.shareConsent ? 1 : 0) },
  { id: "outreach5", title: "Five cold emails", desc: "Sent outreach to five professors or mentors.", icon: "M4 4h16v16H4z M4 7l8 6 8-6", category: "Community", tone: "bg-amber-50 text-amber-700 ring-amber-200", target: 5, unit: "emails", value: (s) => s.outreachSent },

  // Life in AU
  { id: "sch1", title: "Scholarship tracked", desc: "Added your first scholarship to the tracker.", icon: "M12 15l-5.5 3 1-6-4.5-4 6.1-.9L12 2l2.4 5.1 6.1.9-4.5 4 1 6z", category: "Life in AU", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", target: 1, unit: "", value: (s) => s.scholarshipSubmitted },
  { id: "budget10", title: "Budget keeper", desc: "Logged ten expenses — you know where the money goes.", icon: "M3 7h18v12H3z M3 7l2-3h14l2 3 M16 13h2", category: "Life in AU", tone: "bg-teal-50 text-teal-700 ring-teal-200", target: 10, unit: "entries", value: (s) => s.budgetEntries },
  { id: "work", title: "Fortnight logged", desc: "Recorded a full fortnight of shifts and breaks.", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a3 3 0 016 0 M9 12h6 M9 16h4", category: "Life in AU", tone: "bg-amber-50 text-amber-700 ring-amber-200", target: 14, unit: "entries", value: (s) => s.workEntries },
  { id: "vocab20", title: "Word collector", desc: "Mastered twenty academic words.", icon: "M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z", category: "Life in AU", tone: "bg-sky-50 text-sky-700 ring-sky-200", target: 20, unit: "words", value: (s) => s.vocabMastered },
  { id: "writing3", title: "Essay machine", desc: "Completed three timed Writing Task 2 practices.", icon: "M12 20h9 M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z", category: "Life in AU", tone: "bg-violet-50 text-violet-700 ring-violet-200", target: 3, unit: "essays", value: (s) => s.writingAttempts },
  { id: "speaking5", title: "Out loud", desc: "Practised five speaking cue cards with the timer.", icon: "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4", category: "Life in AU", tone: "bg-rose-50 text-rose-700 ring-rose-200", target: 5, unit: "cards", value: (s) => s.speakingPractised },
];

export interface BadgeState extends Badge {
  current: number;
  unlocked: boolean;
  pct: number;
}

export function badgeStates(s: Signals): BadgeState[] {
  return BADGES.map((b) => {
    const current = Math.min(b.value(s), b.target);
    return {
      ...b,
      current,
      unlocked: current >= b.target,
      pct: b.target > 0 ? Math.round((current / b.target) * 100) : 0,
    };
  });
}

export function unlockedCount(states: BadgeState[]): number {
  return states.filter((b) => b.unlocked).length;
}

/** Consecutive-day streak from a set of YYYY-MM-DD day strings. */
export function streakFrom(days: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  // Today may or may not be ticked — start from today, step back.
  for (let i = 0; i < 3650; i++) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (i === 0) {
      cursor.setDate(cursor.getDate() - 1); // today not ticked yet — still count yesterday onwards
    } else {
      break;
    }
  }
  return streak;
}

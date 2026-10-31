// ============================================================
// Evidence pack — what a student visa (subclass 500) actually asks for
//
// The list is not a generic "documents" folder. Which items you need
// depends on how you are funded, whether family is coming with you,
// how old you are, and whether you have been refused before.
//
// Rules only: this engine decides which items apply and scores how
// complete the pack is. It never says whether a visa will be granted.
// ============================================================

export type FundingSource = "savings" | "loan" | "sponsor" | "scholarship" | "mixed";
export type EnglishTest = "ielts" | "toefl" | "pte" | "other" | "exempt" | "none";

/** The facts that change which evidence is required. */
export interface EvidenceContext {
  funding: FundingSource;
  dependants: boolean;
  under18: boolean;
  priorRefusal: boolean;
  englishTest: EnglishTest;
  scholarship: boolean;
}

export const DEFAULT_CONTEXT: EvidenceContext = {
  funding: "savings",
  dependants: false,
  under18: false,
  priorRefusal: false,
  englishTest: "ielts",
  scholarship: false,
};

export const FUNDING_LABEL: Record<FundingSource, string> = {
  savings: "Family savings",
  loan: "Education loan",
  sponsor: "Sponsor (relative)",
  scholarship: "Scholarship",
  mixed: "A mix of the above",
};

export const ENGLISH_LABEL: Record<EnglishTest, string> = {
  ielts: "IELTS",
  toefl: "TOEFL iBT",
  pte: "PTE Academic",
  other: "Another accepted test",
  exempt: "Exempt from testing",
  none: "Not taken yet",
};

export type EvidenceGroup =
  | "Identity & passport"
  | "Course & enrolment"
  | "English"
  | "Finances"
  | "Genuine Student"
  | "Health & insurance"
  | "Family on the visa"
  | "After the grant";

export const GROUP_ORDER: EvidenceGroup[] = [
  "Identity & passport",
  "Course & enrolment",
  "English",
  "Finances",
  "Genuine Student",
  "Health & insurance",
  "Family on the visa",
  "After the grant",
];

export interface EvidenceItem {
  id: string;
  group: EvidenceGroup;
  title: string;
  /** What the case officer is checking by asking for this. */
  why: string;
  /** Practical notes — how people get this one wrong. */
  tips: string[];
  /** Only required when this returns true. Undefined = always required. */
  when?: (c: EvidenceContext) => boolean;
}

export const EVIDENCE_ITEMS: EvidenceItem[] = [
  // ---- Identity & passport ----
  {
    id: "passport",
    group: "Identity & passport",
    title: "Current passport, bio-data page",
    why: "Identity, nationality and the name that must match every other document exactly.",
    tips: [
      "Check the expiry date covers your whole intended stay — renew first rather than mid-course.",
      "A middle name or spelling difference against your CoE causes delays; fix the name on one of them before you lodge.",
    ],
  },
  {
    id: "photos",
    group: "Identity & passport",
    title: "Passport-style photographs",
    why: "Standard identity requirement for the application.",
    tips: ["Use a recent photo that matches the passport photo standards published by Home Affairs."],
  },
  {
    id: "name-consistency",
    group: "Identity & passport",
    title: "Name and date-of-birth consistency check",
    why: "A mismatch between passport, CoE, English result and bank documents is one of the most common reasons for delay.",
    tips: [
      "Write your name once, exactly as it appears in the passport, and reuse it on every form.",
      "If a document uses a different spelling, attach a short explanation rather than hoping it is ignored.",
    ],
  },

  // ---- Course & enrolment ----
  {
    id: "coe",
    group: "Course & enrolment",
    title: "Confirmation of Enrolment (CoE)",
    why: "Proves you are enrolled in a CRICOS-registered course — the visa is granted for that course.",
    tips: [
      "The CoE number, course name and dates must match your offer letter.",
      "If you change course or provider later, a new CoE is needed; the visa does not follow you automatically.",
    ],
  },
  {
    id: "offer",
    group: "Course & enrolment",
    title: "Offer letter and acceptance",
    why: "Shows the course you were admitted to and the conditions you accepted.",
    tips: ["Keep the version you accepted — conditional offers are often still conditional when the CoE is issued."],
  },
  {
    id: "osp",
    group: "Course & enrolment",
    title: "Overseas Student Program (OSP) / welfare details",
    why: "Confirms who is responsible for you while you study, particularly for younger students.",
    tips: ["Your provider usually supplies this with the CoE; check the contact details are current."],
  },
  {
    id: "caaw",
    group: "Course & enrolment",
    title: "Welfare arrangement (CAAW) for a minor",
    why: "Under 18, the visa requires approved accommodation and welfare arrangements before it can be granted.",
    tips: ["This has to be arranged by your provider or an approved carer — a relative's letter is not enough."],
    when: (c) => c.under18,
  },

  // ---- English ----
  {
    id: "english-result",
    group: "English",
    title: "English test result",
    why: "Shows you meet the English requirement for your course and the visa.",
    tips: [
      "Your provider may require a higher score than the visa minimum — clear the higher bar.",
      "Results are only valid for a limited period (usually two years); a stale result will be rejected.",
    ],
    when: (c) => c.englishTest !== "exempt" && c.englishTest !== "none",
  },
  {
    id: "english-booking",
    group: "English",
    title: "Test booking confirmation",
    why: "If you have not sat the test yet, a booked date explains the gap in the pack.",
    tips: ["Book early enough that the result arrives before your CoE deposit deadline."],
    when: (c) => c.englishTest === "none",
  },
  {
    id: "english-exemption",
    group: "English",
    title: "Evidence supporting the English exemption",
    why: "Exemptions are only accepted with proof — for example a passport from an exempt country or years of study taught in English.",
    tips: ["Match the exemption you are claiming to the exact wording published by Home Affairs."],
    when: (c) => c.englishTest === "exempt",
  },

  // ---- Finances ----
  {
    id: "funds-capacity",
    group: "Finances",
    title: "Evidence of financial capacity",
    why: "You must show access to enough money for tuition, living costs and travel for the period the visa covers.",
    tips: [
      "Use the current 12-month living-cost figure published by Home Affairs — it is revised, so check the date on your source.",
      "The money must be genuinely available, not a balance that appears the week before you lodge and disappears after.",
    ],
  },
  {
    id: "bank-statements",
    group: "Finances",
    title: "Bank statements covering the required period",
    why: "Shows the funds exist and have been held, not borrowed for a single day to satisfy the form.",
    tips: [
      "Ask the bank for a stamped statement; a screenshot from a banking app is usually not accepted.",
      "Explain any large recent deposit with a source document (sale, bonus, loan disbursement).",
    ],
    when: (c) => c.funding === "savings" || c.funding === "mixed" || c.funding === "sponsor",
  },
  {
    id: "loan-sanction",
    group: "Finances",
    title: "Loan sanction letter",
    why: "A sanctioned education loan is treated as available funds — but only once it is formally approved.",
    tips: [
      "A pre-approval or eligibility check is not a sanction letter.",
      "Check the sanction amount covers tuition plus living costs, not just tuition.",
    ],
    when: (c) => c.funding === "loan" || c.funding === "mixed",
  },
  {
    id: "loan-disbursement",
    group: "Finances",
    title: "Loan disbursement schedule",
    why: "Explains when the money actually reaches the university, which is what the CoE deposit depends on.",
    tips: ["Ask the lender for the disbursement plan in writing and share it with your provider's admissions team."],
    when: (c) => c.funding === "loan" || c.funding === "mixed",
  },
  {
    id: "sponsor-affidavit",
    group: "Finances",
    title: "Sponsor affidavit and relationship evidence",
    why: "If someone else funds you, the relationship and their commitment must be documented.",
    tips: [
      "The affidavit should name you, the course, and the amount — a generic 'I will support' letter is weak.",
      "Attach proof of the relationship: birth certificate, passport, or family records.",
    ],
    when: (c) => c.funding === "sponsor" || c.funding === "mixed",
  },
  {
    id: "sponsor-income",
    group: "Finances",
    title: "Sponsor income and tax evidence",
    why: "Shows the sponsor can fund the course without hardship and that the money is lawfully sourced.",
    tips: [
      "Income tax returns for two to three years plus a letter from the employer or accountant.",
      "For business income, add registration documents and business bank statements.",
    ],
    when: (c) => c.funding === "sponsor" || c.funding === "mixed",
  },
  {
    id: "scholarship-letter",
    group: "Finances",
    title: "Scholarship award letter",
    why: "A confirmed award reduces the funds you must show, but only if it is unconditional and documented.",
    tips: [
      "A conditional or 'considered' scholarship does not reduce the funds requirement.",
      "Note whether the award covers tuition only or living costs as well.",
    ],
    when: (c) => c.scholarship || c.funding === "scholarship",
  },
  {
    id: "funds-calculation",
    group: "Finances",
    title: "One-page cost and funding calculation",
    why: "Officers should not have to add up your documents themselves — show tuition + living + travel against your funds.",
    tips: [
      "Use the same figures that appear in your bank and CoE documents, to the dollar.",
      "The budget tool in this app produces exactly this breakdown for you.",
    ],
  },

  // ---- Genuine Student ----
  {
    id: "gs-statement",
    group: "Genuine Student",
    title: "Genuine Student (GS) statement",
    why: "The core of the application: why this course, why Australia, and how it fits your future.",
    tips: [
      "Answer the questions the form asks in your own words — a template is obvious and counts against you.",
      "Every claim should be checkable against another document in the pack.",
    ],
  },
  {
    id: "gs-interview-prep",
    group: "Genuine Student",
    title: "Interview answers rehearsed",
    why: "A case officer may ask you to explain your statement; inconsistency between the two is what fails applications.",
    tips: [
      "Say the numbers out loud — tuition, living costs, who is paying — until they match the documents.",
      "The visa interview page in this app scores your drafts against the facts officers look for.",
    ],
  },
  {
    id: "refusal-explanation",
    group: "Genuine Student",
    title: "Explanation of any previous refusal",
    why: "A prior refusal is not disqualifying, but an unexplained one looks like concealment.",
    tips: [
      "State what was refused, when, on what grounds, and exactly what has changed since.",
      "Attach the refusal letter if you still have it.",
    ],
    when: (c) => c.priorRefusal,
  },
  {
    id: "study-gap",
    group: "Genuine Student",
    title: "Explanation of any gap in study or work",
    why: "A gap between qualifications invites the question of what you were doing and why you are returning to study now.",
    tips: ["One short paragraph with dates and a checkable reason (work, illness, exams) is enough."],
  },
  {
    id: "career-plan",
    group: "Genuine Student",
    title: "Career plan after graduation",
    why: "Shows the course is a deliberate step, not an entry route.",
    tips: [
      "Name a role, a sector and a realistic salary band — vague ambition reads as an unfinished plan.",
      "Never claim a guaranteed job or permanent residence; that undermines the whole statement.",
    ],
  },

  // ---- Health & insurance ----
  {
    id: "oshc",
    group: "Health & insurance",
    title: "Overseas Student Health Cover (OSHC)",
    why: "The visa cannot be granted without cover for your whole stay, starting from arrival.",
    tips: [
      "Cover must be continuous — a gap between policies is a problem, even a short one.",
      "The OSHC planner in this app calculates the exact window you need to buy.",
    ],
  },
  {
    id: "health-exam",
    group: "Health & insurance",
    title: "Health examination (if requested)",
    why: "Some applicants are asked to complete a medical; it is arranged through an approved clinic.",
    tips: ["Wait for the request — you do not need to book one unless your application asks for it."],
  },
  {
    id: "biometrics",
    group: "Health & insurance",
    title: "Biometrics (if requested)",
    why: "Identity verification at an approved collection point, for some nationalities and locations.",
    tips: ["You usually have a limited window to provide them — check the request date carefully."],
  },

  // ---- Family on the visa ----
  {
    id: "family-relationship",
    group: "Family on the visa",
    title: "Relationship evidence for partner and children",
    why: "Family members can only be included if the relationship is documented.",
    tips: [
      "Marriage certificate for a spouse; birth certificates for children.",
      "For a de facto partner, expect to show shared finances, address history and duration of the relationship.",
    ],
    when: (c) => c.dependants,
  },
  {
    id: "family-oshc",
    group: "Family on the visa",
    title: "Health cover for every family member on the visa",
    why: "Each person included in the application needs cover for the same dates as you.",
    tips: ["A single policy does not cover a family — the cover type has to match who is on the visa."],
    when: (c) => c.dependants,
  },
  {
    id: "family-school",
    group: "Family on the visa",
    title: "School enrolment for school-age children",
    why: "Dependent children of school age must be enrolled in an Australian school.",
    tips: ["Fees vary by state; confirm them before you finalise your budget."],
    when: (c) => c.dependants,
  },
  {
    id: "family-funds",
    group: "Family on the visa",
    title: "Additional funds covering each family member",
    why: "Living-cost requirements rise with every person included in the application.",
    tips: ["Add the published per-person amount for each dependant to your funds calculation."],
    when: (c) => c.dependants,
  },

  // ---- After the grant ----
  {
    id: "grant-letter",
    group: "After the grant",
    title: "Visa grant letter, saved",
    why: "It carries your visa conditions and the dates you must comply with.",
    tips: ["Save the PDF and note the 'must not arrive after' date in your calendar."],
  },
  {
    id: "conditions",
    group: "After the grant",
    title: "Visa conditions understood",
    why: "Conditions such as work-hour limits and enrolment requirements bind you from arrival.",
    tips: ["The work rights page in this app explains the current limits and what counts as a breach."],
  },
  {
    id: "arrival-update",
    group: "After the grant",
    title: "Address update within the required period",
    why: "You must tell your provider where you are living after you arrive.",
    tips: ["Do it in the first week — providers generally require it within seven days of arrival."],
  },
];

/** Items that actually apply to this student. */
export function buildChecklist(ctx: EvidenceContext): EvidenceItem[] {
  return EVIDENCE_ITEMS.filter((i) => !i.when || i.when(ctx));
}

export interface PackProgress {
  total: number;
  done: number;
  /** 0–100, rounded. */
  pct: number;
  missing: EvidenceItem[];
  byGroup: { group: EvidenceGroup; total: number; done: number }[];
}

/** Score the pack. Unknown ids in `done` are ignored, so a changed answer can't inflate the score. */
export function packProgress(items: EvidenceItem[], done: string[]): PackProgress {
  const doneSet = new Set(done);
  const applicable = items;
  const completed = applicable.filter((i) => doneSet.has(i.id));

  const byGroup = GROUP_ORDER.filter((g) => applicable.some((i) => i.group === g)).map((group) => {
    const groupItems = applicable.filter((i) => i.group === group);
    return {
      group,
      total: groupItems.length,
      done: groupItems.filter((i) => doneSet.has(i.id)).length,
    };
  });

  return {
    total: applicable.length,
    done: completed.length,
    pct: applicable.length ? Math.round((completed.length / applicable.length) * 100) : 0,
    missing: applicable.filter((i) => !doneSet.has(i.id)),
    byGroup,
  };
}

/** The next few things to gather, in checklist order. */
export function nextSteps(items: EvidenceItem[], done: string[], limit = 3): EvidenceItem[] {
  const doneSet = new Set(done);
  return items.filter((i) => !doneSet.has(i.id)).slice(0, limit);
}

/**
 * Documents that carry an expiry, so the pack stays useful after the visa.
 * Deliberately no dates are invented — the student supplies them.
 */
export const EXPIRY_NOTES: { label: string; note: string }[] = [
  { label: "Passport", note: "Must stay valid for the whole stay; renewing mid-course means transferring the visa." },
  { label: "English test", note: "Generally accepted for two years — check the date on the certificate." },
  { label: "OSHC policy", note: "Cover must not lapse; renew before the end date, not after." },
  { label: "Police checks", note: "Usually valid for a limited period, so do not obtain them too early." },
];

const STORE_KEY = "sa_evidence_pack";

export interface SavedPack {
  ctx: EvidenceContext;
  done: string[];
}

export function loadPack(): SavedPack {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ctx: DEFAULT_CONTEXT, done: [] };
    const parsed = JSON.parse(raw) as Partial<SavedPack>;
    return {
      ctx: { ...DEFAULT_CONTEXT, ...(parsed.ctx ?? {}) },
      done: Array.isArray(parsed.done) ? parsed.done.filter((x): x is string => typeof x === "string") : [],
    };
  } catch {
    return { ctx: DEFAULT_CONTEXT, done: [] };
  }
}

export function savePack(pack: SavedPack): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(pack));
  } catch {
    /* private mode — still usable this session */
  }
}

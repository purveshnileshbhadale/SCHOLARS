// ============================================================
// Genuine Student (GS) interview prep
//
// The visa interview is not a test of English — it is a check that
// your story is consistent, specific and verifiable. The scoring here
// is a deterministic checklist (length + the facts an officer looks
// for), never a prediction of the outcome.
// ============================================================

export interface GsQuestion {
  id: string;
  group: string;
  question: string;
  /** What the officer is actually testing. */
  lookFor: string;
  /** Facts a strong answer normally contains. */
  keywords: string[];
}

export const GS_GROUPS = [
  "Course & institution",
  "Why Australia",
  "Finances",
  "Ties & intentions",
  "After graduation",
] as const;

export type GsGroup = (typeof GS_GROUPS)[number];

export const GS_QUESTIONS: GsQuestion[] = [
  {
    id: "course-why",
    group: "Course & institution",
    question: "Why did you choose this course, and what will it give you that a course in India would not?",
    lookFor: "A specific academic reason tied to the curriculum, not rankings or migration.",
    keywords: ["curriculum", "specialisation", "research", "industry", "practical", "accreditation"],
  },
  {
    id: "course-fit",
    group: "Course & institution",
    question: "How does this course connect to what you studied before?",
    lookFor: "A clear academic progression — the new course builds on your degree, it does not restart it.",
    keywords: ["bachelor", "prerequisite", "foundation", "progress", "related", "background"],
  },
  {
    id: "uni-why",
    group: "Course & institution",
    question: "Why this university and this city in particular?",
    lookFor: "Evidence you looked past the brochure: units, staff, facilities, placement, campus.",
    keywords: ["units", "placement", "internship", "faculty", "campus", "labs"],
  },
  {
    id: "course-outcomes",
    group: "Course & institution",
    question: "What does the course structure look like, and which subjects are you most looking forward to?",
    lookFor: "You have actually read the handbook — units, credits, assessment style.",
    keywords: ["semester", "units", "elective", "capstone", "assessment", "credits"],
  },
  {
    id: "au-why",
    group: "Why Australia",
    question: "Why Australia rather than the UK, Canada or the US?",
    lookFor: "A considered comparison — qualification recognition, cost, safety, course design.",
    keywords: ["recognition", "cost", "safety", "compared", "qualification", "timezone"],
  },
  {
    id: "au-know",
    group: "Why Australia",
    question: "What do you know about living and studying in Australia?",
    lookFor: "Realistic awareness of costs, climate, culture — not just weather and beaches.",
    keywords: ["cost of living", "rent", "transport", "culture", "climate", "part-time"],
  },
  {
    id: "au-plan",
    group: "Why Australia",
    question: "Have you been to Australia before, or spoken to anyone who studied there?",
    lookFor: "Your research is real: alumni, relatives, agents, university webinars.",
    keywords: ["alumni", "webinar", "relative", "agent", "visited", "spoke"],
  },
  {
    id: "fin-source",
    group: "Finances",
    question: "How will your tuition and living costs be funded?",
    lookFor: "A named, documented source: savings, education loan, sponsor, scholarship.",
    keywords: ["loan", "savings", "sponsor", "father", "mother", "scholarship", "sanction"],
  },
  {
    id: "fin-amount",
    group: "Finances",
    question: "What is your total cost per year, and how does that break down?",
    lookFor: "You can quote tuition, living and OSHC figures that match your documents.",
    keywords: ["tuition", "living", "oshc", "accommodation", "aud", "per year"],
  },
  {
    id: "fin-docs",
    group: "Finances",
    question: "What financial documents have you provided, and who prepared them?",
    lookFor: "Consistency with what you lodged — bank statements, loan sanction, ITR, affidavits.",
    keywords: ["bank statement", "loan sanction", "itr", "affidavit", "ca", "six months"],
  },
  {
    id: "fin-family",
    group: "Finances",
    question: "Does sponsoring your studies affect your family's finances?",
    lookFor: "An honest, proportionate answer — the sponsor can fund this without hardship.",
    keywords: ["income", "savings", "afford", "business", "salary", "comfortable"],
  },
  {
    id: "ties-home",
    group: "Ties & intentions",
    question: "What are your plans after you finish the course?",
    lookFor: "A plan that uses the qualification at home, stated without hedging.",
    keywords: ["return", "india", "job", "family", "career", "company"],
  },
  {
    id: "ties-job",
    group: "Ties & intentions",
    question: "What job do you expect to hold in India when you come back?",
    lookFor: "A specific role and sector that this course unlocks, with realistic salary expectations.",
    keywords: ["role", "sector", "company", "salary", "industry", "position"],
  },
  {
    id: "ties-family",
    group: "Ties & intentions",
    question: "Who is in your family, and what are their circumstances?",
    lookFor: "Genuine ties: parents, dependants, family business, property.",
    keywords: ["parents", "family business", "property", "siblings", "dependant", "home"],
  },
  {
    id: "ties-property",
    group: "Ties & intentions",
    question: "Do you own or expect to inherit any assets in India?",
    lookFor: "Straightforward facts. If you own nothing, say so plainly.",
    keywords: ["property", "land", "inheritance", "flat", "none", "family"],
  },
  {
    id: "after-work",
    group: "After graduation",
    question: "Do you intend to work in Australia after graduating?",
    lookFor: "Legal honesty: temporary graduate work is allowed, permanent residence is not guaranteed.",
    keywords: ["485", "temporary", "experience", "skilled", "no guarantee", "return"],
  },
  {
    id: "after-gap",
    group: "After graduation",
    question: "What will you do if you cannot find work in your field in Australia?",
    lookFor: "A plan B that still respects the visa conditions.",
    keywords: ["return", "further study", "other role", "plan", "india", "comply"],
  },
  {
    id: "after-compliance",
    group: "After graduation",
    question: "What do you understand about your visa conditions?",
    lookFor: "Work-hour caps, enrolment, OSHC, address updates — the obligations, not just the rights.",
    keywords: ["48 hours", "enrolment", "oshc", "conditions", "attendance", "address"],
  },
];

export interface AnswerCheck {
  id: string;
  words: number;
  /** 0–1 share of the expected facts mentioned. */
  coverage: number;
  matched: string[];
  missing: string[];
  /** 0–100 deterministic score. */
  score: number;
  /** Long enough to be a real answer. */
  done: boolean;
}

const MIN_WORDS = 20;
/** Words after which the length component is maxed out. */
const GOOD_WORDS = 45;

export function checkAnswer(q: GsQuestion, text: string): AnswerCheck {
  const clean = (text ?? "").trim();
  const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
  const lower = clean.toLowerCase();

  const matched = q.keywords.filter((k) => lower.includes(k.toLowerCase()));
  const missing = q.keywords.filter((k) => !lower.includes(k.toLowerCase()));
  const coverage = q.keywords.length ? matched.length / q.keywords.length : 0;

  const lengthScore = Math.min(1, words / GOOD_WORDS);
  const score = words === 0 ? 0 : Math.round(Math.min(100, lengthScore * 60 + coverage * 40));

  return { id: q.id, words, coverage, matched, missing, score, done: words >= MIN_WORDS };
}

export interface GsSummary {
  answered: number;
  total: number;
  /** 0–100 readiness across every question (unanswered count as zero). */
  readiness: number;
  perQuestion: Record<string, AnswerCheck>;
  weakest: GsQuestion[];
}

export function scoreAll(answers: Record<string, string>): GsSummary {
  const perQuestion: Record<string, AnswerCheck> = {};
  for (const q of GS_QUESTIONS) perQuestion[q.id] = checkAnswer(q, answers[q.id] ?? "");

  const answered = GS_QUESTIONS.filter((q) => perQuestion[q.id].done).length;
  const average = GS_QUESTIONS.reduce((sum, q) => sum + perQuestion[q.id].score, 0) / GS_QUESTIONS.length;

  const weakest = [...GS_QUESTIONS]
    .filter((q) => (answers[q.id] ?? "").trim().length > 0 && !perQuestion[q.id].done)
    .concat(GS_QUESTIONS.filter((q) => !(answers[q.id] ?? "").trim()))
    .slice(0, 3);

  return {
    answered,
    total: GS_QUESTIONS.length,
    readiness: Math.round(average),
    perQuestion,
    weakest,
  };
}

const STORE_KEY = "sa_gs_answers";

export function loadAnswers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveAnswers(answers: Record<string, string>): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(answers));
  } catch {
    /* private mode */
  }
}

export const GS_TIPS: { title: string; body: string }[] = [
  {
    title: "Be specific, not impressive",
    body: "“Ranked 19th in the world” says nothing about you. Name a unit, a lab or a placement that matters to your goal.",
  },
  {
    title: "Match your documents",
    body: "Every number you say out loud should appear in what you lodged. Inconsistency is what fails interviews.",
  },
  {
    title: "Answer the question asked",
    body: "Short, direct answers. If you do not understand, ask them to repeat it — that is normal and not a mark against you.",
  },
  {
    title: "Never claim a guarantee",
    body: "No one can promise you PR or a job. Saying otherwise suggests you were coached with the wrong script.",
  },
];

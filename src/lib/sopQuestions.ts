// SOP student questionnaire — questions from the Scholars Abroad
// undergraduate SOP questionnaire (SOP_Questionnaire_UG_Updated.docx).
// Students answer in their own words; "don't know yet" is a valid answer.
// Sections 01–08 are CORE (required for application readiness);
// 09–10 are optional (funding may be filled by a parent/sponsor).

export interface SopQuestion {
  id: string;
  q: string;
  hint?: string;
  core: boolean;
}

export interface SopSection {
  id: string;
  title: string;
  intro?: string;
  questions: SopQuestion[];
}

export const SOP_SECTIONS: SopSection[] = [
  {
    id: "s1",
    title: "01 · Introducing yourself",
    intro: "Paragraph 1 of the SOP. The opening has one job: to make the reader want to keep reading.",
    questions: [
      {
        id: "intro_five",
        q: "Introduce yourself in five sentences. Who are you, where have you grown up, and what are you studying right now?",
        core: true,
      },
      {
        id: "family",
        q: "Tell us about your family — what your parents do, and any brothers or sisters. Has anyone in the family studied or worked abroad? Mention it if so.",
        core: true,
      },
      {
        id: "three_words",
        q: "Give three words other people would use to describe you. For each one, give the specific incident that proves it.",
        hint: "Anyone can claim to be 'hardworking'. The incident is what makes it believable.",
        core: true,
      },
      {
        id: "curious_about",
        q: "What are you genuinely curious about outside of the syllabus?",
        hint: "Something you read about, watch, build or argue about for no marks at all.",
        core: true,
      },
      {
        id: "course_one_sentence",
        q: "In one sentence: which course do you want to study, and why does it suit the person you have just described?",
        core: true,
      },
    ],
  },
  {
    id: "s2",
    title: "02 · Your academics",
    intro: "Paragraph 2. Your record, in your own account of it.",
    questions: [
      {
        id: "results",
        q: "List your Class X and Class XII results — board, stream and subjects taken. Predicted grades are fine if boards are still pending.",
        core: true,
      },
      {
        id: "subjects_best_worst",
        q: "Which subjects have you done best in, and which have you struggled with? Be honest about why.",
        core: true,
      },
      {
        id: "project",
        q: "Describe a school project, science fair entry, research paper, coding project, business idea or Model UN case you worked on.",
        hint: "Tell us what you personally did — not what the team did.",
        core: true,
      },
      {
        id: "olympiads",
        q: "List any olympiads, competitions, certifications or online courses (Coursera, NPTEL, edX and similar). Name, year, and what you took away from it.",
        core: true,
      },
      {
        id: "outside_classroom_school",
        q: "What have you done outside the classroom at school — sport, music, debate, theatre, NCC or NSS, the school magazine, student council?",
        hint: "Include any position of responsibility and how long you held it.",
        core: true,
      },
      {
        id: "break_in_schooling",
        q: "Has there been a break in your schooling, a repeated year, or a term where your grades dropped?",
        hint: "Say plainly what happened and what changed afterwards. Explain honestly; this rarely hurts an application — left unexplained, it always raises a question.",
        core: true,
      },
    ],
  },
  {
    id: "s3",
    title: "03 · Beyond the classroom",
    intro: "Paragraph 3. You are not expected to have work experience at this stage — but almost every applicant has done more than they think.",
    questions: [
      {
        id: "internship",
        q: "Have you done an internship, a summer school, a workshop, or shadowed someone at work? Where, for how long, and what did you actually do there?",
        core: true,
      },
      {
        id: "part_time",
        q: "Any part-time work, tutoring of juniors, or helping out in a family business?",
        core: true,
      },
      {
        id: "volunteering",
        q: "Volunteering or community work — which organisation, how long, and what was your role?",
        core: true,
      },
      {
        id: "built_anything",
        q: "Have you built, run, organised, sold or led anything? A club, an event, a channel, a small venture, a fundraiser, a team.",
        core: true,
      },
      {
        id: "taught_outside_school",
        q: "What did any of this teach you that school did not?",
        core: true,
      },
    ],
  },
  {
    id: "s4",
    title: "04 · Why this course",
    intro: "Paragraph 4. The heart of the essay, and the part most applicants answer far too vaguely.",
    questions: [
      {
        id: "exact_course_name",
        q: "State the exact name of the course as it appears on the university website.",
        core: true,
      },
      {
        id: "interest_trigger",
        q: "When did you first become interested in this field? Give the specific moment or trigger.",
        hint: "A class, a book, a person, a problem you could not stop thinking about. 'I have been interested since childhood' tells the reader nothing.",
        core: true,
      },
      {
        id: "modules",
        q: "Go to the course page and read the module list. Which two or three modules genuinely interest you, and why?",
        hint: "Naming real modules is the single clearest signal that you have done your homework.",
        core: true,
      },
      {
        id: "class12_connection",
        q: "How do your Class XII subjects connect to this course? If you are changing direction, explain why.",
        core: true,
      },
      {
        id: "prior_knowledge",
        q: "What do you already know about this field — from books, documentaries, podcasts, people you have spoken to, or work you have done?",
        core: true,
      },
      {
        id: "full_cost",
        q: "Do you know the full cost of the programme — tuition plus living costs? State the figure.",
        core: true,
      },
    ],
  },
  {
    id: "s5",
    title: "05 · Why this university",
    intro: "Paragraph 5. Your answer should be impossible to paste into an application to a different university.",
    questions: [
      {
        id: "uni_research",
        q: "Which university, and what research did you do into it?",
        hint: "Rankings, faculty, labs, facilities, societies, placement record, alumni outcomes.",
        core: true,
      },
      {
        id: "uni_specific",
        q: "Name one professor, module, laboratory, society or facility there that specifically attracted you, and say why.",
        core: true,
      },
      {
        id: "other_unis",
        q: "Which other universities did you apply to or consider? Why does this one come out ahead?",
        core: true,
      },
      {
        id: "learning_style_fit",
        q: "Is there something about the campus, the city, the teaching style or the way you are assessed that suits how you learn?",
        core: true,
      },
    ],
  },
  {
    id: "s6",
    title: "06 · Why this country",
    intro: "Paragraph 6. This matters for admission, and it matters again at the visa interview.",
    questions: [
      {
        id: "country_why",
        q: "Which country and city, and how will studying there help you specifically?",
        core: true,
      },
      {
        id: "other_countries",
        q: "Which other countries did you consider, and why did you rule them out?",
        core: true,
      },
      {
        id: "education_system",
        q: "What do you know about the education system there — course length, teaching style, assessment, work rights while studying?",
        core: true,
      },
      {
        id: "city_draw",
        q: "Is there anything about that particular city that draws you — the industries based there, the cost of living, the community, the safety?",
        core: true,
      },
    ],
  },
  {
    id: "s7",
    title: "07 · Why not India",
    intro: "Paragraph 7. Answer this as what you gain by going, never as what is wrong with Indian education.",
    questions: [
      {
        id: "india_option",
        q: "Is this course offered in India? Where, and did you consider those options?",
        core: true,
      },
      {
        id: "overseas_gain",
        q: "What does the overseas programme offer that the Indian one does not?",
        hint: "Be factual and specific — structure, specialisation, lab access, industry links, flexibility to combine subjects.",
        core: true,
      },
      {
        id: "teaching_difference",
        q: "How is the teaching or assessment different, and why does that difference suit you?",
        core: true,
      },
    ],
  },
  {
    id: "s8",
    title: "08 · After the course",
    intro: "Paragraph 8. A clear, credible plan here reassures the admissions officer and the visa officer alike.",
    questions: [
      {
        id: "first_job",
        q: "What role or job do you want in the first year after you graduate?",
        core: true,
      },
      {
        id: "work_location",
        q: "Where do you intend to work? Do you plan to return to India, and to which sector or companies?",
        core: true,
      },
      {
        id: "five_ten_years",
        q: "Where do you see yourself in five to ten years?",
        core: true,
      },
      {
        id: "family_opportunity",
        q: "Is there a family business, or a specific opportunity, waiting for you? Describe it.",
        core: true,
      },
      {
        id: "connect_dots",
        q: "Connect the dots for us: how does this particular degree, from this particular university, get you there?",
        core: true,
      },
    ],
  },
  {
    id: "s9",
    title: "09 · Funding",
    intro: "Required for the visa statement. A parent or sponsor may prefer to fill this section.",
    questions: [
      { id: "sponsor", q: "Who is sponsoring your studies? Name, relationship to you, occupation and annual income.", core: false },
      {
        id: "how_met",
        q: "How will the tuition and living costs be met — savings, fixed deposits, property, sponsor income, an education loan?",
        core: false,
      },
      {
        id: "loan_details",
        q: "If a loan is involved: which bank, what amount, and is it sanctioned or still in process?",
        core: false,
      },
    ],
  },
  {
    id: "s10",
    title: "10 · Anything else",
    intro: "The questions we did not think to ask.",
    questions: [
      { id: "proud_of", q: "Is there an accomplishment you are proud of that has not come up anywhere above?", core: false },
      {
        id: "record_explain",
        q: "Is there anything in your record — a grade, a gap, a change of school or stream — that you would rather explain to us now than have a university ask about later?",
        core: false,
      },
      {
        id: "leave_out",
        q: "Is there anything you would prefer we left out of the essay altogether?",
        core: false,
      },
    ],
  },
];

export const SOP_ALL_QUESTIONS: SopQuestion[] = SOP_SECTIONS.flatMap((s) => s.questions);
export const SOP_CORE_QUESTIONS = SOP_ALL_QUESTIONS.filter((q) => q.core);

export function sopStats(answers: Record<string, string>): { coreTotal: number; coreAnswered: number; allTotal: number; allAnswered: number; ready: boolean } {
  const answered = (id: string) => typeof answers[id] === "string" && answers[id].trim().length > 0;
  const coreAnswered = SOP_CORE_QUESTIONS.filter((q) => answered(q.id)).length;
  const allAnswered = SOP_ALL_QUESTIONS.filter((q) => answered(q.id)).length;
  return {
    coreTotal: SOP_CORE_QUESTIONS.length,
    coreAnswered,
    allTotal: SOP_ALL_QUESTIONS.length,
    allAnswered,
    ready: coreAnswered === SOP_CORE_QUESTIONS.length,
  };
}

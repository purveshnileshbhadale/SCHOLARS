/**
 * English test practice content — deterministic, no LLM, no migration.
 * Vocabulary deck, Writing Task 2 prompts, Speaking Part 2 cue cards and the
 * official four writing band criteria used for self-marking.
 */

export interface VocabWord {
  word: string;
  pos: string;
  meaning: string;
  example: string;
  synonyms: string[];
}

/** Academic word list aimed at IELTS 6.5–7.5 targets. */
export const VOCAB: VocabWord[] = [
  { word: "alleviate", pos: "verb", meaning: "To make suffering or a problem less severe.", example: "Cheap public transport can alleviate congestion in city centres.", synonyms: ["ease", "mitigate", "relieve"] },
  { word: "ambiguous", pos: "adjective", meaning: "Open to more than one interpretation; unclear.", example: "The policy's ambiguous wording confused applicants.", synonyms: ["vague", "unclear", "equivocal"] },
  { word: "coherent", pos: "adjective", meaning: "Logical and consistent as a whole.", example: "A coherent essay links each paragraph to the thesis.", synonyms: ["logical", "consistent", "well-structured"] },
  { word: "compelling", pos: "adjective", meaning: "Evoking strong interest or conviction.", example: "She made a compelling case for funding the programme.", synonyms: ["convincing", "persuasive", "engaging"] },
  { word: "comprise", pos: "verb", meaning: "To consist of; to be made up of.", example: "The committee comprises twelve academic staff.", synonyms: ["consist of", "include", "contain"] },
  { word: "consecutive", pos: "adjective", meaning: "Following one after another without interruption.", example: "Temperatures broke records for four consecutive years.", synonyms: ["successive", "sequential", "unbroken"] },
  { word: "consensus", pos: "noun", meaning: "General agreement among a group.", example: "There is broad consensus that housing costs are too high.", synonyms: ["agreement", "accord", "unanimity"] },
  { word: "detrimental", pos: "adjective", meaning: "Causing harm or damage.", example: "Late-night screen use is detrimental to sleep quality.", synonyms: ["harmful", "damaging", "injurious"] },
  { word: "disparity", pos: "noun", meaning: "A great difference between things or people.", example: "The report highlights the disparity between urban and rural wages.", synonyms: ["gap", "inequality", "divide"] },
  { word: "elaborate", pos: "verb", meaning: "To explain in more detail.", example: "Could you elaborate on how you reached that figure?", synonyms: ["expand", "detail", "develop"] },
  { word: "empirical", pos: "adjective", meaning: "Based on observation or experiment rather than theory.", example: "The claim is supported by empirical evidence from three trials.", synonyms: ["observed", "measured", "experimental"] },
  { word: "endorse", pos: "verb", meaning: "To declare approval or support of.", example: "Several professors endorsed the proposed curriculum.", synonyms: ["approve", "support", "advocate"] },
  { word: "exacerbate", pos: "verb", meaning: "To make a problem or bad situation worse.", example: "Building more roads can exacerbate urban sprawl.", synonyms: ["worsen", "aggravate", "intensify"] },
  { word: "feasible", pos: "adjective", meaning: "Possible and practical to achieve.", example: "A four-day week proved feasible for the pilot firms.", synonyms: ["viable", "practicable", "workable"] },
  { word: "fundamental", pos: "adjective", meaning: "Forming a base; essential.", example: "Literacy is fundamental to economic participation.", synonyms: ["essential", "basic", "core"] },
  { word: "hinder", pos: "verb", meaning: "To slow or obstruct progress.", example: "Poor internet access hinders remote learning.", synonyms: ["impede", "obstruct", "hamper"] },
  { word: "indispensable", pos: "adjective", meaning: "Absolutely necessary.", example: "Internships are indispensable for building a network.", synonyms: ["essential", "vital", "critical"] },
  { word: "inevitable", pos: "adjective", meaning: "Certain to happen; unavoidable.", example: "Some job displacement from automation is inevitable.", synonyms: ["unavoidable", "certain", "inescapable"] },
  { word: "inherent", pos: "adjective", meaning: "Existing as a natural or permanent quality.", example: "Every system has inherent security risks.", synonyms: ["intrinsic", "innate", "built-in"] },
  { word: "integrate", pos: "verb", meaning: "To combine parts into a whole.", example: "The course integrates theory with workplace projects.", synonyms: ["combine", "merge", "unify"] },
  { word: "mitigate", pos: "verb", meaning: "To reduce the severity of something harmful.", example: "Planting trees mitigates the urban heat-island effect.", synonyms: ["reduce", "soften", "counter"] },
  { word: "nuanced", pos: "adjective", meaning: "Showing subtle distinctions or variations.", example: "The debate requires a nuanced view, not a yes/no answer.", synonyms: ["subtle", "shaded", "delicate"] },
  { word: "overwhelming", pos: "adjective", meaning: "Very great in amount or intensity.", example: "There was overwhelming support for the new scholarship.", synonyms: ["dominant", "massive", "compelling"] },
  { word: "paramount", pos: "adjective", meaning: "More important than anything else.", example: "Student safety is paramount during fieldwork.", synonyms: ["supreme", "chief", "foremost"] },
  { word: "prevalent", pos: "adjective", meaning: "Widespread in a particular area or time.", example: "Online shopping has become prevalent among students.", synonyms: ["common", "widespread", "ubiquitous"] },
  { word: "profound", pos: "adjective", meaning: "Very great or intense; deeply felt.", example: "Living abroad has a profound effect on independence.", synonyms: ["deep", "immense", "significant"] },
  { word: "rigorous", pos: "adjective", meaning: "Extremely thorough and careful.", example: "The selection process is rigorous and transparent.", synonyms: ["stringent", "strict", "thorough"] },
  { word: "scrutinise", pos: "verb", meaning: "To examine something closely and critically.", example: "Admissions teams scrutinise personal statements for detail.", synonyms: ["examine", "inspect", "analyse"] },
  { word: "substantial", pos: "adjective", meaning: "Large in size, value or importance.", example: "The scholarship covers a substantial share of tuition.", synonyms: ["considerable", "significant", "sizeable"] },
  { word: "sustainable", pos: "adjective", meaning: "Able to continue over time without depleting resources.", example: "Cities need sustainable transport planning.", synonyms: ["viable", "enduring", "ecological"] },
  { word: "undermine", pos: "verb", meaning: "To weaken gradually or secretly.", example: "Late submissions undermine your credibility.", synonyms: ["weaken", "erode", "sabotage"] },
  { word: "unprecedented", pos: "adjective", meaning: "Never done or known before.", example: "Enrolment saw unprecedented growth after 2020.", synonyms: ["novel", "remarkable", "unparalleled"] },
  { word: "whereas", pos: "conjunction", meaning: "In contrast to the fact that.", example: "Rent is higher in Sydney, whereas Adelaide stays affordable.", synonyms: ["while", "whilst", "though"] },
  { word: "articulate", pos: "adjective", meaning: "Able to express ideas clearly and effectively.", example: "An articulate candidate explains complex ideas simply.", synonyms: ["eloquent", "fluent", "expressive"] },
  { word: "benchmark", pos: "noun", meaning: "A standard against which things are measured.", example: "IELTS 6.5 is the benchmark for most master's programmes.", synonyms: ["standard", "yardstick", "reference"] },
  { word: "allocate", pos: "verb", meaning: "To distribute something for a particular purpose.", example: "Universities allocate funding to the highest-need departments.", synonyms: ["assign", "distribute", "apportion"] },
];

export type WritingTaskType = "opinion" | "discussion" | "problem-solution" | "two-part";

export const WRITING_TASK_TYPES: { key: WritingTaskType; label: string; hint: string }[] = [
  { key: "opinion", label: "Opinion (agree/disagree)", hint: "State your view in the intro, defend it in 2 body paragraphs." },
  { key: "discussion", label: "Discussion + opinion", hint: "Discuss both sides, then give your own view in the conclusion." },
  { key: "problem-solution", label: "Problem & solution", hint: "Paragraph 2: causes/why. Paragraph 3: solutions/how." },
  { key: "two-part", label: "Two-part question", hint: "Answer both questions — one body paragraph each." },
];

export interface WritingPrompt {
  type: WritingTaskType;
  text: string;
}

export const WRITING_PROMPTS: WritingPrompt[] = [
  { type: "opinion", text: "Some people believe universities should only teach subjects that lead directly to employment. To what extent do you agree or disagree?" },
  { type: "opinion", text: "Governments should spend money on public transport rather than building new roads. To what extent do you agree?" },
  { type: "opinion", text: "In many countries, students work part-time while studying. This does more harm than good. To what extent do you agree?" },
  { type: "opinion", text: "The internet has done more good than harm to society. To what extent do you agree or disagree?" },
  { type: "opinion", text: "Some argue that international tourism should be restricted to protect the environment. To what extent do you agree?" },
  { type: "discussion", text: "Some people think that strict punishments for driving offences are the key to reducing traffic accidents. Others, however, believe other measures are more effective. Discuss both views and give your own opinion." },
  { type: "discussion", text: "Some people believe that unpaid community service should be a compulsory part of high school programmes. Others disagree. Discuss both views and give your opinion." },
  { type: "discussion", text: "While some say that homework benefits students, others claim it adds unnecessary stress. Discuss both views and give your own opinion." },
  { type: "discussion", text: "Some people think that money is the best motivator at work; others believe recognition matters more. Discuss both views and give your opinion." },
  { type: "problem-solution", text: "In many large cities, air pollution has reached dangerous levels. What are the causes, and what measures could be taken to tackle them?" },
  { type: "problem-solution", text: "An increasing number of young people are choosing to live alone. Why is this happening, and what problems does it create?" },
  { type: "problem-solution", text: "In some countries, the gap between the rich and the poor is widening. What problems does this cause, and what solutions can you suggest?" },
  { type: "problem-solution", text: "Many university students struggle with mental health issues. Why is this, and what can universities do about it?" },
  { type: "two-part", text: "Many people now work from home. Why is this, and is it a positive or negative development for workers and employers?" },
  { type: "two-part", text: "More people are moving from rural areas to cities. Why is this happening, and is this a positive or negative development?" },
  { type: "two-part", text: "Some people spend a lot of money on weddings and parties. Why do they do this, and is it a positive or negative development?" },
];

/** The four official Task 2 band descriptors, compressed into self-check lines. */
export const WRITING_CRITERIA: { key: string; label: string; weight: string; checks: string[] }[] = [
  {
    key: "tr",
    label: "Task Response",
    weight: "25%",
    checks: [
      "I answered every part of the question (both questions for two-part).",
      "My position is clear in the introduction and stays consistent throughout.",
      "Each body paragraph has one main idea, fully developed with an example.",
      "I stayed within 250 words (aim 260–290) in 40 minutes.",
    ],
  },
  {
    key: "cc",
    label: "Coherence & Cohesion",
    weight: "25%",
    checks: [
      "Every paragraph has a clear topic sentence.",
      "Ideas are ordered logically — chronological or by strength.",
      "Linking words are varied (However, Furthermore, Consequently) not repeated.",
      "Pronouns and referencing are unambiguous (no 'it/they' confusion).",
    ],
  },
  {
    key: "lr",
    label: "Lexical Resource",
    weight: "25%",
    checks: [
      "I used topic vocabulary accurately (no forced rare words).",
      "No word is repeated more than 3 times — I used synonyms.",
      "Collocations are natural (heavy rain, not strong rain).",
      "Spelling and word formation are correct throughout.",
    ],
  },
  {
    key: "gra",
    label: "Grammatical Range & Accuracy",
    weight: "25%",
    checks: [
      "I used both simple and complex sentence structures.",
      "Conditionals / relative clauses / passive used at least once each.",
      "Very few errors, and none that block meaning.",
      "Commas, articles and subject–verb agreement are correct.",
    ],
  },
];

export interface CueCard {
  topic: string;
  bullets: string[];
  followUps: string[];
}

export const CUE_CARDS: CueCard[] = [
  { topic: "Describe a place you like to visit", bullets: ["where it is", "how often you go there", "what you do there", "and explain why you like it"], followUps: ["Is it popular with tourists?", "Will you recommend it to a friend?", "How has it changed over time?"] },
  { topic: "Describe a person who has influenced you", bullets: ["who this person is", "how you know them", "what they have said or done", "and explain how they influenced you"], followUps: ["Do you still keep in touch?", "Would you like to be like them?", "Who influences young people today?"] },
  { topic: "Describe a skill you would like to learn", bullets: ["what the skill is", "why you want to learn it", "how you would learn it", "and explain how it would help you"], followUps: ["Is it easy to learn this skill?", "Should schools teach it?", "Do you prefer learning alone or with others?"] },
  { topic: "Describe a memorable journey", bullets: ["where you went", "who you travelled with", "what happened during the trip", "and explain why you remember it"], followUps: ["Do you like travelling alone?", "How do people travel in your country?", "Will you travel more in the future?"] },
  { topic: "Describe a piece of technology you use daily", bullets: ["what it is", "when you started using it", "what you use it for", "and explain why it matters to you"], followUps: ["Has it changed your life?", "What are its drawbacks?", "Can older people use it easily?"] },
  { topic: "Describe a book or film that changed your view", bullets: ["what it was", "when you experienced it", "what it was about", "and explain how it changed your view"], followUps: ["Do you prefer books or films?", "How do reviews influence you?", "Should students read more?"] },
  { topic: "Describe a goal you want to achieve", bullets: ["what the goal is", "why you set it", "what you have done so far", "and explain how you plan to achieve it"], followUps: ["Is it difficult to achieve?", "Do people need goals to be happy?", "How do you measure success?"] },
  { topic: "Describe a time you helped someone", bullets: ["who you helped", "how you helped them", "why you did it", "and explain how you felt afterwards"], followUps: ["Do people help each other in your city?", "Should volunteering be compulsory?", "How can schools encourage helping?"] },
  { topic: "Describe a house or flat you would like to live in", bullets: ["where it would be", "what it would look like", "who you would live with", "and explain why you want to live there"], followUps: ["Do you prefer living alone or with family?", "Is buying a home important in your culture?", "What makes a good neighbourhood?" ] },
  { topic: "Describe a decision you regret", bullets: ["what the decision was", "when you made it", "why you made it", "and explain what you learned"], followUps: ["Do you make decisions quickly or slowly?", "How important is advice from others?", "Do you often regret things?"] },
  { topic: "Describe an environmental problem in your area", bullets: ["what the problem is", "what causes it", "what effects it has", "and explain how it could be solved"], followUps: ["Who should pay for solutions?", "Can individuals make a difference?", "Is it worse in cities?"] },
  { topic: "Describe a celebration you attended", bullets: ["what the celebration was", "when it happened", "who was there", "and explain why it was important"], followUps: ["Do people celebrate too much nowadays?", "Which celebration is most popular in your country?", "Will you celebrate it abroad?"] },
];

// ------------------------------------------------------------
// Local progress (localStorage — no migration needed).
// ------------------------------------------------------------

const LS_MASTERED = "sa_vocab_mastered_v1";
const LS_WRITING = "sa_writing_log_v1";
const LS_SPEAKING = "sa_speaking_log_v1";

export function loadMastered(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_MASTERED) ?? "{}") as Record<string, number>;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function saveMastered(m: Record<string, number>) {
  try {
    localStorage.setItem(LS_MASTERED, JSON.stringify(m));
  } catch {}
}

export interface WritingAttempt {
  at: string;
  type: WritingTaskType;
  words: number;
  checked: number;
}

export function loadWritingLog(): WritingAttempt[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_WRITING) ?? "[]") as WritingAttempt[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveWritingAttempt(a: WritingAttempt) {
  const list = [a, ...loadWritingLog()].slice(0, 50);
  try {
    localStorage.setItem(LS_WRITING, JSON.stringify(list));
  } catch {}
}

export function loadSpeakingCount(): number {
  try {
    return Number(localStorage.getItem(LS_SPEAKING) ?? "0") || 0;
  } catch {
    return 0;
  }
}

export function bumpSpeakingCount() {
  try {
    localStorage.setItem(LS_SPEAKING, String(loadSpeakingCount() + 1));
  } catch {}
}

/** Common band descriptor one-liners — used to label the target tab. */
export const BAND_MEANING: { min: number; label: string; meaning: string }[] = [
  { min: 9, label: "Expert user", meaning: "Fully operational command; accurate and fluent." },
  { min: 8, label: "Very good user", meaning: "Fully operational, occasional inaccuracies." },
  { min: 7, label: "Good user", meaning: "Handles complex language well; occasional lapses." },
  { min: 6, label: "Competent user", meaning: "Effective command despite some inaccuracies — the usual master's minimum." },
  { min: 5, label: "Modest user", meaning: "Partial command in familiar situations; common to undergraduate entry." },
  { min: 4, label: "Limited user", meaning: "Basic competence confined to simple contexts." },
  { min: 0, label: "Non/limited", meaning: "Below the level most courses require." },
];

export function bandMeaning(ielts: number): { label: string; meaning: string } {
  return BAND_MEANING.find((b) => ielts >= b.min) ?? BAND_MEANING[BAND_MEANING.length - 1];
}

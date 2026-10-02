const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const cut = script.indexOf("var NAV = [");
if (cut < 0) throw new Error("NAV marker not found");
const core = script.slice(0, cut);

const api = new Function(core + `
  return {
    CONFIG: CONFIG,
    demoState: demoState,
    setState: function(s){ state = s; },
    getState: function(){ return state; },
    defaultState: defaultState,
    computeStrength: computeStrength,
    computePillars: computePillars,
    pillarWeights: pillarWeights,
    computeUniversities: computeUniversities,
    generateRoadmap: generateRoadmap,
    nextBestMove: nextBestMove,
    entryPoints: entryPoints,
    diminishingScore: diminishingScore,
    blankDraft: typeof blankDraft !== "undefined" ? blankDraft : null,
    normaliseGrade: normaliseGrade,
    bandFor: bandFor,
    emphasisFor: emphasisFor,
    fitRaw: fitRaw,
    daysUntil: daysUntil,
    nextOccurrence: nextOccurrence,
    isoOf: isoOf,
    fmtDate: fmtDate,
    countdownText: countdownText,
    upcomingDates: upcomingDates,
    draftProjection: draftProjection,
    onboardingProjection: onboardingProjection,
    withState: withState
  };
`)();

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log("  PASS  " + msg); }
  else { fail++; console.log("  FAIL  " + msg); }
}

console.log("\n--- Demo student ---");
const demo = api.demoState();
api.setState(demo);
const profile = api.computeStrength();
console.log("  strength=" + profile.score + " label=" + profile.label +
  " pillars=" + JSON.stringify(Object.keys(profile.pillars).reduce((a,k)=>{
    a[k] = profile.pillars[k] === null ? null : Math.round(profile.pillars[k]); return a; }, {})) +
  " weights=" + JSON.stringify(Object.keys(profile.weights).reduce((a,k)=>{a[k]=+profile.weights[k].toFixed(2);return a;},{})) +
  " spike=" + profile.spike + " theme=" + profile.theme);

ok(profile.score >= 40 && profile.score <= 75, "demo strength is in a believable mid range (40-75): " + profile.score);
ok(profile.pillars.tests === null, "demo tests pillar is null (not-yet state)");
ok(profile.pillars.academics !== null && profile.pillars.academics > 50, "demo academics scored > 50");
ok(profile.spike >= 0 && profile.spike <= 8, "spike bonus within 0..8: " + profile.spike);
ok(profile.theme >= 0 && profile.theme <= 5, "theme bonus within 0..5: " + profile.theme);

const wsum = Object.keys(profile.weights).reduce((s,k)=>s+profile.weights[k], 0);
ok(Math.abs(wsum - 1) < 0.001, "pillar weights sum to 1: " + wsum.toFixed(3));
ok(profile.weights.tests === 0, "tests weight removed when no test data");

console.log("\n--- Grade fairness ---");
const g8 = JSON.parse(JSON.stringify(demo)); g8.student.grade = "8"; g8.academics = demo.academics;
api.setState(g8);
const p8 = api.computeStrength();
const g12 = JSON.parse(JSON.stringify(demo)); g12.student.grade = "12";
api.setState(g12);
const p12 = api.computeStrength();
console.log("  grade8=" + p8.score + " grade12=" + p12.score + " (same entries)");
ok(p8.score > 40, "Grade 8 student with same entries is not crushed: " + p8.score);
ok(p8.score >= p12.score - 2, "younger student not penalised vs grade 12 (g8=" + p8.score + " g12=" + p12.score + ")");

console.log("\n--- Weights by grade ---");
api.setState(Object.assign({}, demo, { student: Object.assign({}, demo.student, { grade: "8" }) }));
const w8 = api.pillarWeights();
ok(w8.tests === 0, "Grade 8 tests weight = 0");
api.setState(Object.assign({}, demo, { student: Object.assign({}, demo.student, { grade: "12" }) }));
const w12 = api.pillarWeights();
console.log("  g12 weights=" + JSON.stringify(Object.keys(w12).reduce((a,k)=>{a[k]=+w12[k].toFixed(2);return a;},{})));
ok(w12.tests === 0, "Grade 12 with no tests: tests weight = 0 (marked not-yet)");
ok(Math.abs(w12.academics - 0.30 / 0.85) < 0.02, "its 15% spread proportionally → academics " + w12.academics.toFixed(3) + " ≈ " + (0.30 / 0.85).toFixed(3));
const wsum12 = Object.keys(w12).reduce((s, k) => s + w12[k], 0);
ok(Math.abs(wsum12 - 1) < 0.001, "redistributed weights still sum to 1: " + wsum12.toFixed(3));

console.log("\n--- Universities ---");
api.setState(demo);
const unis = api.computeUniversities();
ok(unis.length === 8, "all 8 Ivies listed");
ok(unis.every(u => ["Reach", "High reach"].indexOf(u.band) !== -1), "bands are only Reach / High reach");
ok(unis.every(u => u.fit >= 1 && u.fit <= 5), "fit values in 1..5");
ok(unis.every(u => u.lever !== null), "every university has a biggest lever");
const ranked = unis.map(u => u.fit);
const isSortedDesc = ranked.every((v, i) => i === 0 || ranked[i-1] >= v);
ok(isSortedDesc, "ranked by fit desc: " + ranked.join(","));
const names = unis.map(u => u.name).sort().join(",");
ok(names === "Brown,Columbia,Cornell,Dartmouth,Harvard,Penn,Princeton,Yale", "correct Ivy list: " + names);
console.log("  fits: " + unis.map(u => u.name + "=" + u.fit + "/" + u.raw).join(", "));

console.log("\n--- Entry scoring ---");
const base = { type:"competition", level:"school", result:"participation", role:"member", hoursPerWeek:1, weeksPerYear:4, endDate:"2026-01-01" };
const intlWin = api.entryPoints(Object.assign({}, base, { level:"international", result:"winner", role:"founder", hoursPerWeek:5, weeksPerYear:30, proofFile:"x.pdf" }));
const schoolPart = api.entryPoints(base);
ok(intlWin > schoolPart * 4, `international winner (${intlWin.toFixed(1)}) >> school participation (${schoolPart.toFixed(1)})`);
const stateGold = api.entryPoints(Object.assign({}, base, { level:"state", result:"winner" }));
const nationalPart = api.entryPoints(Object.assign({}, base, { level:"national", result:"participation" }));
ok(stateGold > nationalPart, `state gold (${stateGold.toFixed(1)}) outscores national participation (${nationalPart.toFixed(1)})`);
const old = api.entryPoints(Object.assign({}, base, { endDate:"2020-01-01" }));
ok(old < schoolPart, "older entry decays (85%)");
const clubStale = api.entryPoints({ type:"club", level:"school", result:"participation", role:"member", hoursPerWeek:2, weeksPerYear:20, endDate:"2026-01-01" });
const clubClean = api.entryPoints({ type:"club", level:"school", result:"", role:"member", hoursPerWeek:2, weeksPerYear:20, endDate:"2026-01-01" });
ok(clubStale === clubClean, "stale result field can't penalise a club entry (" + clubStale.toFixed(2) + " vs " + clubClean.toFixed(2) + ")");

console.log("\n--- Diminishing returns ---");
const bench = 50;
const many = Array.from({length: 10}, () => ({ type:"club", level:"school", result:"participation", role:"member", hoursPerWeek:2, weeksPerYear:20, endDate:"2026-01-01" }));
const few = many.slice(0, 3);
const s10 = api.diminishingScore(many, bench);
const s3 = api.diminishingScore(few, bench);
console.log("  10 clubs=" + s10.toFixed(1) + "  3 clubs=" + s3.toFixed(1));
ok(s10 - s3 < 15, "10 shallow clubs barely beat 3 (diff " + (s10 - s3).toFixed(1) + ")");
ok(s10 <= 100, "pillar capped at 100");

console.log("\n--- Bands ---");
ok(api.bandFor(4) === "Reach" && api.bandFor(5) === "Reach", "fit 4-5 = Reach");
ok(api.bandFor(1) === "High reach" && api.bandFor(3) === "High reach", "fit 1-3 = High reach");

console.log("\n--- Roadmap ---");
["8","10","12"].forEach(g => {
  const s = JSON.parse(JSON.stringify(demo));
  s.student.grade = g;
  api.setState(s);
  const rm = api.generateRoadmap();
  const counts = ["this-term","summer","next-grade","application-year"].map(p => p + ":" + rm.byPeriod[p].length).join(" ");
  console.log("  grade " + g + " → " + counts);
  const total = ["this-term","summer","next-grade","application-year"].reduce((n,p) => n + rm.byPeriod[p].length, 0);
  ok(total >= 3, "grade " + g + " has roadmap tasks (" + total + ")");
});
const s12 = JSON.parse(JSON.stringify(demo)); s12.student.grade = "12";
api.setState(s12);
const rm12 = api.generateRoadmap();
ok(rm12.byPeriod["application-year"].length >= 3, "grade 12 application-year populated");
ok(s12.roadmapDone["log-awards"] !== undefined, "demo task completion stored");
const term12 = rm12.byPeriod["this-term"];
ok(term12.some(t => t.id === "log-awards" && t.done), "completed task shows as done");

api.setState(demo);
const move = api.nextBestMove();
console.log("  next move: " + (move ? move.title + " (+" + move.points + ", priority " + move.priority.toFixed(2) + ")" : "NONE"));
ok(move !== null, "next best move exists");
ok(move.points > 0, "next best move is score-relevant (not an unscored task)");
const logTask = move;
// deferred task is skipped
api.setState(Object.assign({}, demo, { deferredMove: { id: move.id, until: Date.now() + 86400000 } }));
const move2 = api.nextBestMove();
ok(move2 && move2.id !== move.id, "deferred task skipped for a week: " + (move2 ? move2.id : "none"));
api.setState(demo);

console.log("\n--- Grade conversion ---");
ok(api.normaliseGrade("92", "cbse") === 91, "CBSE 92 → 91 on common scale: " + api.normaliseGrade("92","cbse"));
ok(api.normaliseGrade("3.7", "gpa4") === 92.5, "GPA 3.7 → 92.5");
ok(api.normaliseGrade("38", "ib") > 80 && api.normaliseGrade("38","ib") < 90, "IB 38 → ~84");
ok(api.normaliseGrade("92", "percentage") === 92, "percentage passes through");

console.log("\n--- Young / empty students aren't crushed ---");
const fresh8 = api.defaultState();
fresh8.onboarded = true;
fresh8.student.grade = "8";
fresh8.academics = { current:"85", scale:"percentage", previous:"", rigourTaken:"", rigourOffered:"" };
api.setState(fresh8);
const freshScore = api.computeStrength().score;
console.log("  grade 8, grades only: " + freshScore);
ok(freshScore >= 20, "grade 8 with only grades is not a crushing low score: " + freshScore);
const fresh8b = JSON.parse(JSON.stringify(fresh8));
fresh8b.entries = [{ id:"x", type:"club", name:"Chess club", level:"school", role:"member",
  hoursPerWeek:2, weeksPerYear:20, endDate:"2026-05-01", createdAt:Date.now() }];
api.setState(fresh8b);
const clubScore = api.computeStrength().score;
console.log("  grade 8 + one club: " + clubScore);
ok(clubScore > freshScore + 5, "adding one activity moves the score clearly (" + clubScore + " vs " + freshScore + ")");

console.log("\n--- Emphasis redistribution ---");
const uni = api.CONFIG.universities.find(u => u.id === "harvard");
const eff = api.emphasisFor(uni, { academics:80, tests:null, activities:60, awards:50, projects:40 });
const esum = ["academics","activities","awards","projects"].reduce((s,p) => s + eff[p], 0);
ok(Math.abs(esum - 1) < 0.01, "emphasis renormalised when tests missing: sum=" + esum.toFixed(3));

console.log("\n--- Live dates ---");
const now = new Date();
const isoToday = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
ok(api.daysUntil(isoToday) === 0, "daysUntil(today) = 0");
const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
ok(api.countdownText(api.isoOf(tomorrow)) === "tomorrow", "countdown tomorrow: " + api.countdownText(api.isoOf(tomorrow)));
ok(api.countdownText(isoToday) === "today", "countdown today: today");
const in10 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10);
ok(api.countdownText(api.isoOf(in10)) === "in 10 days", "countdown +10d: " + api.countdownText(api.isoOf(in10)));
const nov = api.nextOccurrence(11, 1);
ok(nov.getMonth() === 10 && nov.getDate() === 1, "nextOccurrence(Nov 1) lands on Nov 1");
ok(nov >= new Date(now.getFullYear(), now.getMonth(), now.getDate()), "next occurrence is never in the past");
const upcoming = api.upcomingDates(5);
ok(upcoming.length === 5, "upcomingDates(5) returns 5: " + upcoming.length);
ok(upcoming.every((it, i) => i === 0 || upcoming[i - 1].date <= it.date), "upcoming dates sorted soonest first: " + upcoming.map(u => u.date).join(","));
ok(upcoming.every(it => api.daysUntil(it.date) >= 0), "no past dates leak into the list");
console.log("  next up: " + upcoming.map(u => u.label + " (" + api.countdownText(u.date) + ")").join(" | "));
const milestonesOnly = api.upcomingDates(null, { milestonesOnly: true });
ok(milestonesOnly.length === 3, "milestones-only list has exactly 3 items: " + milestonesOnly.length);
ok(milestonesOnly.some(m => m.id === "early"), "early-decision milestone present");
ok(milestonesOnly.every(m => m.kind === "milestone"), "no test dates in milestones-only mode");
ok(api.CONFIG.dates.sat.length >= 6 && api.CONFIG.dates.act.length >= 6, "SAT + ACT calendars bundled");
ok(/^\d{4}-\d{2}-\d{2}$/.test(api.CONFIG.dates.verified), "dates carry a verification stamp");

console.log("\n--- Real-time projection ---");
api.setState(demo);
const baseScore = api.computeStrength().score;
const strongDraft = { id: null, type: "competition", name: "International Science Olympiad",
  level: "international", result: "winner", role: "founder", hoursPerWeek: 5, weeksPerYear: 30,
  startDate: "2026-01-01", endDate: "2026-06-01", description: "", proofFile: "x.pdf", themed: true };
api.setState(Object.assign({}, demo, { draft: strongDraft }));
const proj = api.draftProjection();
ok(proj !== null, "projection exists once a type is picked");
ok(proj.before === baseScore, "projection 'before' matches real strength: " + proj.before);
ok(proj.after >= proj.before, "a big international win can't lower the projection (" + proj.before + " → " + proj.after + ")");
ok(proj.fits.length === 3 && proj.fits.every(f => f.before >= 1 && f.before <= 5 && f.after >= 1 && f.after <= 5),
  "fit projections stay inside 1..5: " + proj.fits.map(f => f.name + " " + f.before + "→" + f.after).join(", "));
const entriesBefore = api.getState().entries.length;

// Editing an existing entry down must project a decrease
const weakDraft = Object.assign({}, demo.entries[0], { level: "school", result: "participation", role: "member" });
api.setState(Object.assign({}, demo, { draft: weakDraft }));
const projWeak = api.draftProjection();
ok(projWeak.after < projWeak.before,
  "weakening an entry projects a drop (" + projWeak.before + " → " + projWeak.after + ")");
ok(api.getState().entries.length === entriesBefore, "still no entries saved by projecting");

// withState restores what it borrowed, even on success
const s0 = api.getState();
api.withState([], null, function(){ return 1; });
ok(s0.entries.length === entriesBefore, "withState restores entries after running");

// Onboarding preview
const ob = api.defaultState();
ob.student = Object.assign({}, ob.student, { grade: "10", scale: "cbse", current: "92", sat: "1350" });
api.setState(ob);
const obProj = api.onboardingProjection();
ok(obProj.pillars.academics > 50, "onboarding projection scores academics from typed grades: " + Math.round(obProj.pillars.academics));
ok(obProj.pillars.tests !== null && obProj.pillars.tests > 40, "typed SAT flows into projected tests: " + Math.round(obProj.pillars.tests));
ok(obProj.score > 0, "projected overall strength is live: " + obProj.score);
ok(api.getState().entries.length === 0, "onboarding projection saves nothing");
api.setState(demo);

console.log("\n=== " + pass + " passed, " + fail + " failed ===\n");
process.exit(fail ? 1 : 0);

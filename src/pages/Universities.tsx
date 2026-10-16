import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { University, UniversityReview } from "../lib/types";
import { cx, inr, money } from "../lib/utils";
import { COUNSELLOR_WHATSAPP_INTRO, waMeUrl } from "../lib/config";
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Select, Spinner, Textarea } from "../components/ui";
import { Input } from "../components/ui";

type SortKey = "qs" | "tuition" | "name" | "rating";

type UniAnswer = {
  id: string;
  question_id: string;
  student_id: string;
  answer: string;
  created_at: string;
};

type UniQuestion = {
  id: string;
  university_id: string;
  student_id: string;
  question: string;
  created_at: string;
  uni_answers?: UniAnswer[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const METRO_CITIES = new Set([
  "sydney",
  "melbourne",
  "brisbane",
  "perth",
  "adelaide",
  "canberra",
  "gold coast",
  "newcastle",
  "wollongong",
  "geelong",
  "hobart",
  "darwin",
  "cairns",
  "townsville",
  "sunshine coast",
  "toowoomba",
  "ballarat",
  "bendigo",
]);

function Stars({ value, className }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={cx("inline-flex items-center gap-0.5 text-amber-500", className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? "" : "text-slate-300"}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function Universities() {
  const { session } = useAuth();
  const [list, setList] = useState<University[]>([]);
  const [reviews, setReviews] = useState<UniversityReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<SortKey>("qs");
  const [openId, setOpenId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [savedOnly, setSavedOnly] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [reviewErr, setReviewErr] = useState<string | null>(null);
  const [questions, setQuestions] = useState<UniQuestion[]>([]);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [schCounts, setSchCounts] = useState<Record<string, number>>({});
  const [psw, setPsw] = useState("");
  const [schOnly, setSchOnly] = useState(false);
  const [csOnly, setCsOnly] = useState(false);
  const [work, setWork] = useState("");
  const [qaText, setQaText] = useState<Record<string, string>>({});
  const [ansText, setAnsText] = useState<Record<string, string>>({});

  const loadReviews = useCallback(() => {
    supabase
      .from("university_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setReviews((data as UniversityReview[]) ?? []));
  }, []);

  const loadQuestions = useCallback(() => {
    supabase
      .from("uni_questions")
      .select("*, uni_answers(*)")
      .order("created_at", { ascending: false })
      .order("created_at", { referencedTable: "uni_answers", ascending: true })
      .then(({ data }) => setQuestions((data as UniQuestion[]) ?? []));
  }, []);

  useEffect(() => {
    supabase
      .from("universities")
      .select("*")
      .order("qs_rank", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        setList((data as University[]) ?? []);
        setLoading(false);
      });
    loadReviews();
    loadQuestions();
    supabase
      .from("scholarships")
      .select("university_id")
      .then(({ data }) => {
        const m: Record<string, number> = {};
        for (const r of data ?? []) {
          const id = r.university_id;
          if (typeof id === "string" && id) m[id] = (m[id] ?? 0) + 1;
        }
        setSchCounts(m);
      });
  }, [loadReviews, loadQuestions]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("saved_universities")
      .select("university_id, notes")
      .then(({ data }) => {
        if (data) {
          setSaved(new Set(data.map((r) => r.university_id as string)));
          const nm: Record<string, string> = {};
          for (const r of data) if (r.notes) nm[r.university_id as string] = r.notes as string;
          setNotesMap(nm);
        }
      });
  }, [session]);

  async function toggleSave(u: University) {
    if (!session) return;
    const has = saved.has(u.id);
    const next = new Set(saved);
    if (has) next.delete(u.id);
    else next.add(u.id);
    setSaved(next); // optimistic
    const { error } = has
      ? await supabase
          .from("saved_universities")
          .delete()
          .eq("student_id", session.user.id)
          .eq("university_id", u.id)
      : await supabase
          .from("saved_universities")
          .insert({ student_id: session.user.id, university_id: u.id });
    if (error) {
      setSaved(saved); // revert
    }
  }

  function toggleCompare(id: string) {
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 4 ? [...c, id] : c));
  }

  async function saveNote(uniId: string, text: string) {
    if (!session) return;
    const notes = text.trim().slice(0, 4000);
    if (!saved.has(uniId)) {
      const { error } = await supabase
        .from("saved_universities")
        .upsert(
          { student_id: session.user.id, university_id: uniId, notes: notes || null },
          { onConflict: "student_id,university_id" },
        );
      if (!error) {
        setSaved(new Set([...saved, uniId]));
        setNotesMap({ ...notesMap, [uniId]: notes });
      }
      return;
    }
    const { error } = await supabase
      .from("saved_universities")
      .update({ notes: notes || null })
      .eq("student_id", session.user.id)
      .eq("university_id", uniId);
    if (!error) setNotesMap({ ...notesMap, [uniId]: notes });
  }

  async function askQuestion(uniId: string) {
    if (!session) return;
    const text = (qaText[uniId] ?? "").trim();
    if (text.length < 5) return;
    setReviewErr(null);
    const { error } = await supabase.from("uni_questions").insert({
      university_id: uniId,
      student_id: session.user.id,
      question: text.slice(0, 600),
    });
    if (error) setReviewErr(error.message);
    else {
      setQaText({ ...qaText, [uniId]: "" });
      loadQuestions();
    }
  }

  async function answerQuestion(qid: string) {
    if (!session) return;
    const text = (ansText[qid] ?? "").trim();
    if (text.length < 5) return;
    setReviewErr(null);
    const { error } = await supabase.from("uni_answers").insert({
      question_id: qid,
      student_id: session.user.id,
      answer: text.slice(0, 2000),
    });
    if (error) setReviewErr(error.message);
    else {
      setAnsText({ ...ansText, [qid]: "" });
      loadQuestions();
    }
  }

  async function deleteQuestion(qid: string) {
    if (!session || !window.confirm("Delete this question and its answers?")) return;
    setReviewErr(null);
    const { error } = await supabase.from("uni_questions").delete().eq("id", qid);
    if (error) setReviewErr(error.message);
    else loadQuestions();
  }

  function similarTo(u: University): University[] {
    return list
      .filter((x) => x.id !== u.id)
      .map((x) => {
        let s = 0;
        if (u.city && x.city === u.city) s += 3;
        if (u.state && x.state === u.state) s += 1;
        if (u.qs_rank && x.qs_rank && Math.abs(x.qs_rank - u.qs_rank) <= Math.max(15, u.qs_rank * 0.3)) s += 2;
        if (u.tuition_aud && x.tuition_aud && Math.abs(x.tuition_aud - u.tuition_aud) <= u.tuition_aud * 0.2) s += 1;
        return { x, s };
      })
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((r) => r.x);
  }

  async function saveReview(uniId: string, rating: number, comment: string) {
    if (!session) return;
    setReviewErr(null);
    const { error } = await supabase.from("university_reviews").upsert(
      {
        student_id: session.user.id,
        university_id: uniId,
        rating,
        comment: comment.trim() || null,
      },
      { onConflict: "student_id,university_id" },
    );
    if (error) setReviewErr(error.message);
    else loadReviews();
  }

  async function deleteReview(uniId: string) {
    if (!session) return;
    setReviewErr(null);
    const { error } = await supabase
      .from("university_reviews")
      .delete()
      .eq("student_id", session.user.id)
      .eq("university_id", uniId);
    if (error) setReviewErr(error.message);
    else loadReviews();
  }

  const ratingMap = useMemo(() => {
    const m = new Map<string, { avg: number; count: number }>();
    for (const r of reviews) {
      const e = m.get(r.university_id) ?? { avg: 0, count: 0 };
      e.avg += r.rating;
      e.count += 1;
      m.set(r.university_id, e);
    }
    for (const [k, v] of m) m.set(k, { avg: Math.round((v.avg / v.count) * 10) / 10, count: v.count });
    return m;
  }, [reviews]);

  const cities = useMemo(
    () => Array.from(new Set(list.map((u) => u.city).filter(Boolean))).sort() as string[],
    [list],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = list.filter((u) => {
      if (city && u.city !== city) return false;
      if (savedOnly && !saved.has(u.id)) return false;
      if (psw && (u.post_study_work_years ?? 0) < Number(psw)) return false;
      if (schOnly && !schCounts[u.id]) return false;
      if (csOnly && !(u.cs_program_highlights ?? "").trim()) return false;
      if (work === "metro" && !METRO_CITIES.has((u.city ?? "").toLowerCase())) return false;
      if (!needle) return true;
      return [u.name, u.city, u.state, u.cs_program_highlights, u.about]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle));
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "tuition") return (a.tuition_aud ?? 1e9) - (b.tuition_aud ?? 1e9);
      if (sort === "rating") return (ratingMap.get(b.id)?.avg ?? 0) - (ratingMap.get(a.id)?.avg ?? 0);
      return (a.qs_rank ?? 1e9) - (b.qs_rank ?? 1e9);
    });
    return rows;
  }, [list, q, city, sort, saved, savedOnly, ratingMap, psw, schOnly, csOnly, work, schCounts]);

  const compareUnis = compare.map((id) => list.find((u) => u.id === id)).filter(Boolean) as University[];

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  return (
    <div className="pb-24">
      <PageHeader
        title="Australian universities"
        subtitle="Our full directory — campus photos, rankings, fees, student reviews and program highlights."
        right={
          <Button
            variant="wa"
            onClick={() =>
              window.open(
                waMeUrl(`${COUNSELLOR_WHATSAPP_INTRO} I have a question about the universities directory.`),
                "_blank",
                "noopener",
              )
            }
          >
            Ask on WhatsApp
          </Button>
        }
      />

      <Card className="mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search name, city or program…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search universities"
        />
        <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city">
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="qs">Sort: QS ranking</option>
          <option value="tuition">Sort: Tuition (low → high)</option>
          <option value="rating">Sort: Student rating</option>
          <option value="name">Sort: Name (A → Z)</option>
        </Select>
        <Select value={psw} onChange={(e) => setPsw(e.target.value)} aria-label="Filter by post-study work visa">
          <option value="">Post-study work: any</option>
          <option value="1">PSW 1+ yr</option>
          <option value="2">PSW 2+ yr</option>
          <option value="3">PSW 3+ yr</option>
        </Select>
        <Select
          value={work}
          onChange={(e) => setWork(e.target.value)}
          aria-label="Filter by part-time work access"
          title="Larger metros generally have more part-time job openings — indicative guidance only."
        >
          <option value="">Part-time work: any city</option>
          <option value="metro">Part-time work access (metro cities)</option>
        </Select>
        <Button
          variant={schOnly ? "primary" : "ghost"}
          onClick={() => setSchOnly(!schOnly)}
          title="Only universities that have listed scholarships"
        >
          {schOnly ? "✓ Scholarships only" : "Scholarships available"}
        </Button>
        <Button
          variant={csOnly ? "primary" : "ghost"}
          onClick={() => setCsOnly(!csOnly)}
          title="Only universities with CS program highlights"
        >
          {csOnly ? "✓ CS programs only" : "CS programs"}
        </Button>
        <Button
          variant={savedOnly ? "primary" : "ghost"}
          onClick={() => setSavedOnly(!savedOnly)}
          disabled={!session}
          title={session ? undefined : "Sign in to bookmark universities"}
        >
          {savedOnly ? "★ Showing saved only — show all" : `★ Saved universities (${saved.size})`}
        </Button>
      </Card>

      {reviewErr ? <div className="mb-4"><ErrorNote>{reviewErr}</ErrorNote></div> : null}

      {shown.length === 0 ? (
        <Empty title="No universities match" body="Try clearing the search or city filter." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((u) => (
            <UniCard
              key={u.id}
              u={u}
              open={openId === u.id}
              onToggle={() => setOpenId(openId === u.id ? null : u.id)}
              saved={saved.has(u.id)}
              onSave={() => toggleSave(u)}
              rating={ratingMap.get(u.id) ?? null}
              comparing={compare.includes(u.id)}
              onCompare={() => toggleCompare(u.id)}
              compareFull={!compare.includes(u.id) && compare.length >= 4}
              reviews={reviews.filter((r) => r.university_id === u.id)}
              myReview={session ? reviews.find((r) => r.university_id === u.id && r.student_id === session.user.id) ?? null : null}
              onSaveReview={(rating, comment) => saveReview(u.id, rating, comment)}
              onDeleteReview={() => deleteReview(u.id)}
              notes={notesMap[u.id] ?? ""}
              onSaveNote={(v) => saveNote(u.id, v)}
              schCount={schCounts[u.id] ?? 0}
              similar={openId === u.id ? similarTo(u) : []}
              onOpenUni={(id) => setOpenId(id)}
              qa={{
                questions: questions.filter((qn) => qn.university_id === u.id),
                draft: qaText[u.id] ?? "",
                onDraft: (v) => setQaText({ ...qaText, [u.id]: v }),
                onAsk: () => askQuestion(u.id),
                ansDraft: ansText,
                onAnsDraft: (qid, v) => setAnsText({ ...ansText, [qid]: v }),
                onAnswer: (qid) => answerQuestion(qid),
                onDelete: (qid) => deleteQuestion(qid),
              }}
            />
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        Photos: Wikimedia Commons · Descriptions: Wikipedia · Fees & ranks are indicative — confirm with the university.
      </p>

      {/* Compare tray */}
      {compare.length > 0 && !showCompare ? (
        <div className="fixed bottom-4 left-1/2 z-40 flex max-w-[95vw] -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-lg">
          <span className="hidden text-xs font-semibold text-slate-500 sm:inline">Compare:</span>
          {compareUnis.map((u) => (
            <button
              key={u.id}
              onClick={() => toggleCompare(u.id)}
              title="Remove from compare"
              className="max-w-36 truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              {u.name} ×
            </button>
          ))}
          <Button
            className="px-3"
            disabled={compare.length < 2}
            onClick={() => setShowCompare(true)}
            title={compare.length < 2 ? "Pick at least 2" : undefined}
          >
            Compare ({compare.length})
          </Button>
          <button className="text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={() => setCompare([])}>
            Clear
          </button>
        </div>
      ) : null}

      {/* Compare modal */}
      {showCompare ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setShowCompare(false)}>
          <div
            className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Compare universities</h2>
              <Button variant="ghost" onClick={() => setShowCompare(false)}>
                Close
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="w-40 border-b border-slate-200 p-2 text-left text-xs uppercase tracking-wide text-slate-400">
                    {compareUnis.length} selected
                  </th>
                  {compareUnis.map((u) => (
                    <th key={u.id} className="border-b border-slate-200 p-2 text-left font-bold text-slate-900">
                      {u.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["City", (u: University) => [u.city, u.state].filter(Boolean).join(", ") || "—"],
                    ["QS rank", (u: University) => (u.qs_rank ? `#${u.qs_rank}` : "—")],
                    ["THE rank", (u: University) => (u.the_rank ? `#${u.the_rank}` : "—")],
                    ["CS subject rank", (u: University) => (u.cs_subject_rank ? `#${u.cs_subject_rank}` : "—")],
                    ["Student rating", (u: University) => {
                      const r = ratingMap.get(u.id);
                      return r ? `${r.avg} ★ (${r.count})` : "No reviews";
                    }],
                    ["Tuition/yr", (u: University) => money(u.tuition_aud)],
                    ["Tuition (≈INR)", (u: University) => inr(u.tuition_aud)],
                    ["Living/yr", (u: University) => money(u.living_cost_aud)],
                    ["Living (≈INR)", (u: University) => inr(u.living_cost_aud)],
                    ["IELTS min", (u: University) => (u.ielts_min ? String(u.ielts_min) : "—")],
                    ["TOEFL min", (u: University) => (u.toefl_min ? String(u.toefl_min) : "—")],
                    ["PTE min", (u: University) => (u.pte_min ? String(u.pte_min) : "—")],
                    ["Post-study work", (u: University) => (u.post_study_work_years ? `${u.post_study_work_years} yr` : "—")],
                    ["Scholarships listed", (u: University) => String(schCounts[u.id] ?? 0)],
                    ["Min academic", (u: University) => u.min_academic_requirement ?? "—"],
                    ["Intakes", (u: University) => (u.intakes ?? []).join(", ") || "—"],
                    ["CRICOS", (u: University) => u.cricos_code ?? "—"],
                  ] as [string, (u: University) => string][]
                ).map(([label, get]) => (
                  <tr key={label} className="odd:bg-slate-50/70">
                    <td className="p-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</td>
                    {compareUnis.map((u) => (
                      <td key={u.id} className="p-2 font-semibold text-slate-800">
                        {get(u)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UniCard({
  u,
  open,
  onToggle,
  saved,
  onSave,
  rating,
  comparing,
  onCompare,
  compareFull,
  reviews,
  myReview,
  onSaveReview,
  onDeleteReview,
  notes,
  onSaveNote,
  schCount,
  similar,
  onOpenUni,
  qa,
}: {
  u: University;
  open: boolean;
  onToggle: () => void;
  saved: boolean;
  onSave: () => void;
  rating: { avg: number; count: number } | null;
  comparing: boolean;
  onCompare: () => void;
  compareFull: boolean;
  reviews: UniversityReview[];
  myReview: UniversityReview | null;
  onSaveReview: (rating: number, comment: string) => void | Promise<void>;
  onDeleteReview: () => void | Promise<void>;
  notes: string;
  onSaveNote: (text: string) => void | Promise<void>;
  schCount: number;
  similar: University[];
  onOpenUni: (id: string) => void;
  qa: {
    questions: UniQuestion[];
    draft: string;
    onDraft: (v: string) => void;
    onAsk: () => void;
    ansDraft: Record<string, string>;
    onAnsDraft: (qid: string, v: string) => void;
    onAnswer: (qid: string) => void;
    onDelete: (qid: string) => void;
  };
}) {
  const { session } = useAuth();
  const [rRating, setRRating] = useState(myReview?.rating ?? 5);
  const [rComment, setRComment] = useState(myReview?.comment ?? "");
  const [rBusy, setRBusy] = useState(false);
  const [noteLocal, setNoteLocal] = useState(notes);

  useEffect(() => {
    setNoteLocal(notes);
  }, [notes]);

  useEffect(() => {
    if (myReview) {
      setRRating(myReview.rating);
      setRComment(myReview.comment ?? "");
    }
  }, [myReview]);

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    setRBusy(true);
    await onSaveReview(rRating, rComment);
    setRBusy(false);
  }

  return (
    <Card className="group flex flex-col overflow-hidden p-0 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_-30px_rgba(15,23,42,0.4)]">
      <div className="relative h-44 w-full overflow-hidden bg-slate-100">
        {u.image_url ? (
          <img
            src={u.image_url}
            alt={`Campus of ${u.name}`}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-slate-900/5 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-2">
          {u.qs_rank ? <Badge className="border-white/60 bg-slate-900/80 text-white">QS #{u.qs_rank}</Badge> : null}
          {u.post_study_work_years ? (
            <Badge className="border-white/60 bg-emerald-700/90 text-white">{u.post_study_work_years} yr PSW</Badge>
          ) : null}
        </div>
        <button
          onClick={onSave}
          aria-label={saved ? `Remove ${u.name} from saved` : `Save ${u.name}`}
          title={saved ? "Remove from saved" : "Save"}
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/90 text-lg shadow transition hover:bg-white"
        >
          <span className={saved ? "text-amber-500" : "text-slate-400"}>{saved ? "★" : "☆"}</span>
        </button>
        <button
          onClick={onCompare}
          disabled={compareFull}
          title={compareFull ? "Compare holds up to 4" : comparing ? "Remove from compare" : "Add to compare"}
          className={cx(
            "absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow transition",
            comparing ? "bg-emerald-700 text-white" : "bg-white/90 text-slate-600 hover:bg-white",
            compareFull && "cursor-not-allowed opacity-50",
          )}
        >
          {comparing ? "✓ Comparing" : "⇄ Compare"}
        </button>
      </div>

      <div className="flex grow flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900">{u.name}</h3>
            <p className="text-xs text-slate-500">
              {[u.city, u.state].filter(Boolean).join(", ")}
              {u.cs_subject_rank ? ` · CS subject #${u.cs_subject_rank}` : ""}
            </p>
          </div>
          {rating ? (
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600" title={`${rating.count} review(s)`}>
              <Stars value={rating.avg} className="text-xs" />
              {rating.avg} ({rating.count})
            </span>
          ) : null}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Fact label="Tuition/yr" value={money(u.tuition_aud)} />
          <Fact label="Living/yr" value={money(u.living_cost_aud)} />
          <Fact label="IELTS min" value={u.ielts_min ? String(u.ielts_min) : "—"} />
          <Fact label="Intakes" value={(u.intakes ?? []).join(", ") || "—"} />
        </dl>
        {u.tuition_aud != null || u.living_cost_aud != null ? (
          <p className="mt-1.5 text-[11px] text-slate-400">
            ≈ {inr(u.tuition_aud)} tuition · {inr(u.living_cost_aud)} living (indicative)
          </p>
        ) : null}

        {u.about ? (
          <p className={cx("mt-3 text-sm text-slate-600", !open && "line-clamp-3")}>{u.about}</p>
        ) : null}

        {open ? (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
            {u.cs_program_highlights ? (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">CS programs</h4>
                <p className="mt-1">{u.cs_program_highlights}</p>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <Fact label="THE rank" value={u.the_rank ? `#${u.the_rank}` : "—"} />
              <Fact label="CS subject" value={u.cs_subject_rank ? `#${u.cs_subject_rank}` : "—"} />
              <Fact label="TOEFL min" value={u.toefl_min ? String(u.toefl_min) : "—"} />
              <Fact label="PTE min" value={u.pte_min ? String(u.pte_min) : "—"} />
              <Fact label="CRICOS" value={u.cricos_code ?? "—"} />
              <Fact label="Data year" value={u.data_year ? String(u.data_year) : "—"} />
            </div>
            {u.min_academic_requirement ? (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Entry requirement</h4>
                <p className="mt-1">{u.min_academic_requirement}</p>
              </div>
            ) : null}

            {/* Intake calendar */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Intake calendar {schCount ? `· ${schCount} scholarship${schCount > 1 ? "s" : ""} listed` : ""}
              </h4>
              <div className="mt-1.5 grid grid-cols-6 gap-1 sm:grid-cols-12">
                {MONTHS.map((m) => {
                  const active = (u.intakes ?? []).some((i) => i.slice(0, 3).toLowerCase() === m.toLowerCase());
                  return (
                    <div
                      key={m}
                      className={cx(
                        "rounded px-1 py-1 text-center text-[10px] font-semibold",
                        active ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300" : "bg-slate-50 text-slate-400",
                      )}
                      title={active ? `${m} intake usually available` : `No usual ${m} intake`}
                    >
                      {m}
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Highlighted months are common intakes — always confirm dates with the university.
              </p>
            </div>

            {/* Personal notes (feature 34) */}
            {session ? (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  My private notes {saved ? "" : "· saving a note also bookmarks this uni"}
                </h4>
                <Textarea
                  rows={3}
                  maxLength={4000}
                  value={noteLocal}
                  onChange={(e) => setNoteLocal(e.target.value)}
                  onBlur={() => onSaveNote(noteLocal)}
                  placeholder="Deadlines you're targeting, contact names, accommodation links, thoughts… Only you can see this."
                />
                <p className="mt-1 text-[11px] text-slate-400">Saved automatically when you leave the box.</p>
              </div>
            ) : null}

            {/* Similar universities (feature 35) */}
            {similar.length ? (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Similar universities</h4>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {similar.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onOpenUni(s.id)}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-teal-400 hover:text-teal-700"
                      title={`Open ${s.name}`}
                    >
                      {s.name}
                      {s.qs_rank ? ` #${s.qs_rank}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Reviews */}
            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Student reviews {rating ? `· ${rating.avg} ★ (${rating.count})` : ""}
              </h4>
              {reviews.length ? (
                <ul className="mt-2 space-y-2">
                  {reviews.map((r) => (
                    <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Stars value={r.rating} className="text-xs" />
                        <span className="text-[11px] text-slate-400">
                          {r.student_id === session?.user.id ? "You" : "Verified student"} ·{" "}
                          {new Date(r.created_at).toLocaleDateString("en-AU")}
                        </span>
                        {r.student_id === session?.user.id ? (
                          <span className="ml-auto flex gap-2 text-[11px] font-semibold">
                            <button
                              className="text-slate-400 hover:text-rose-600"
                              disabled={rBusy}
                              onClick={() => onDeleteReview()}
                            >
                              Delete
                            </button>
                          </span>
                        ) : null}
                      </div>
                      {r.comment ? <p className="mt-1 text-xs text-slate-600">{r.comment}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-400">No reviews yet — be the first.</p>
              )}
              {session ? (
                <form onSubmit={submitReview} className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">{myReview ? "Edit your review" : "Write a review"}</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRRating(i)}
                        className={cx("text-lg transition", i <= rRating ? "text-amber-500" : "text-slate-300 hover:text-amber-300")}
                        aria-label={`${i} star${i > 1 ? "s" : ""}`}
                      >
                        ★
                      </button>
                    ))}
                    <span className="ml-2 text-xs font-semibold text-slate-500">{rRating}/5</span>
                  </div>
                  <Textarea
                    rows={2}
                    maxLength={1000}
                    value={rComment}
                    onChange={(e) => setRComment(e.target.value)}
                    placeholder="What did you like or dislike? (optional)"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" className="px-3" disabled={rBusy}>
                      {rBusy ? "Saving…" : myReview ? "Update review" : "Post review"}
                    </Button>
                    {myReview ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-3"
                        disabled={rBusy}
                        onClick={() => {
                          setRRating(myReview.rating);
                          setRComment(myReview.comment ?? "");
                          onDeleteReview();
                        }}
                      >
                        Remove mine
                      </Button>
                    ) : null}
                  </div>
                </form>
              ) : null}
            </div>

            {/* University Q&A (feature 36) */}
            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Student Q&A {qa.questions.length ? `· ${qa.questions.length}` : ""}
              </h4>
              {qa.questions.length ? (
                <ul className="mt-2 space-y-2">
                  {qa.questions.map((qn) => (
                    <li key={qn.id} className="rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-start gap-2">
                        <p className="text-xs font-semibold text-slate-800">{qn.question}</p>
                        <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                          {new Date(qn.created_at).toLocaleDateString("en-AU")}
                        </span>
                        {qn.student_id === session?.user.id ? (
                          <button
                            className="shrink-0 text-[10px] font-semibold text-slate-400 hover:text-rose-600"
                            onClick={() => qa.onDelete(qn.id)}
                            title="Delete question"
                            aria-label="Delete question"
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                      {qn.uni_answers?.length ? (
                        <ul className="mt-1.5 space-y-1 border-l-2 border-teal-200 pl-2.5">
                          {qn.uni_answers.map((a) => (
                            <li key={a.id} className="text-xs text-slate-600">
                              <span className="font-semibold text-teal-700">
                                {a.student_id === session?.user.id ? "You" : "Student"}:
                              </span>{" "}
                              {a.answer}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-[11px] text-slate-400">No answers yet.</p>
                      )}
                      {session ? (
                        <div className="mt-2 flex gap-1.5">
                          <Input
                            value={qa.ansDraft[qn.id] ?? ""}
                            onChange={(e) => qa.onAnsDraft(qn.id, e.target.value)}
                            placeholder="Add an answer — class size, campus life, part-time work…"
                            maxLength={2000}
                            aria-label="Answer question"
                          />
                          <Button
                            className="shrink-0 px-2.5 text-xs"
                            onClick={() => qa.onAnswer(qn.id)}
                            disabled={(qa.ansDraft[qn.id] ?? "").trim().length < 5}
                          >
                            Reply
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-slate-400">No questions yet — ask about placements, scholarships, accommodation…</p>
              )}
              {session ? (
                <div className="mt-3 space-y-1.5">
                  <Textarea
                    rows={2}
                    maxLength={600}
                    value={qa.draft}
                    onChange={(e) => qa.onDraft(e.target.value)}
                    placeholder="Ask students here — part-time work, housing, course difficulty…"
                  />
                  <Button className="px-3" onClick={qa.onAsk} disabled={qa.draft.trim().length < 5}>
                    Post question
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Sign in to ask a question or answer others.</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2 pt-1">
          <Button variant="ghost" className="grow" onClick={onToggle}>
            {open ? "Show less" : "Details"}
          </Button>
          <Button
            variant="wa"
            className="grow"
            onClick={() =>
              window.open(
                waMeUrl(
                  `${COUNSELLOR_WHATSAPP_INTRO} I would like to know more about ${u.name} (${u.city ?? "Australia"}).`,
                ),
                "_blank",
                "noopener",
              )
            }
          >
            Ask on WhatsApp
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

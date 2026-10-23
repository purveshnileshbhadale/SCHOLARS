import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Application, ApplicationDocument, Booking, OfferCondition, Shortlist, ShortlistItem, StudentChecklistItem, StudentProfile, University, VisaChecklist } from "../lib/types";
import { buildCounsellorWhatsAppMessage, waMeUrl, COUNSELLOR_WHATSAPP_NUMBER } from "../lib/config";
import { sopStats } from "../lib/sopQuestions";
import { money, tierBadge } from "../lib/utils";
import { VISA_TEMPLATES, seedVisaItems, visaCountryKey } from "../lib/visaTemplates";
import { Badge, Button, Card, DeadlineChip, Empty, ErrorNote, Field, Input, PageHeader, Select, Spinner, Textarea } from "../components/ui";

type StepStatus = "completed" | "in-progress" | "action" | "pending";

const STATUS_META: Record<StepStatus, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  "in-progress": { label: "In Progress", cls: "border-sky-200 bg-sky-50 text-sky-800" },
  action: { label: "Action Required", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  pending: { label: "Pending", cls: "border-slate-200 bg-slate-200/60 text-slate-600" },
};

const APP_STATUS_OPTIONS = [
  "Not Started",
  "Preparing Documents",
  "Ready to Apply",
  "Application Submitted",
  "Awaiting Decision",
  "Offer Received",
  "Waitlisted",
  "Rejected",
  "Withdrawn",
];

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function Applications() {
  const { session, studentProfile, refresh } = useAuth();
  const [shortlist, setShortlist] = useState<Shortlist | null>(null);
  const [unis, setUnis] = useState<University[]>([]);
  const [sopAnswers, setSopAnswers] = useState<Record<string, string>>({});
  const [booking, setBooking] = useState<Booking | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [docs, setDocs] = useState<ApplicationDocument[]>([]);
  const [visa, setVisa] = useState<StudentChecklistItem[]>([]);
  const [conditions, setConditions] = useState<OfferCondition[]>([]);
  const [visaLists, setVisaLists] = useState<VisaChecklist[]>([]);
  const [condInput, setCondInput] = useState<Record<string, string>>({});
  const [visaPick, setVisaPick] = useState<Record<string, string>>({});
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const [showAddApp, setShowAddApp] = useState(false);

  const [newApp, setNewApp] = useState({
    university_id: "",
    program: "",
    portal_url: "",
    admission_deadline: "",
    scholarship_deadline: "",
    application_fee_aud: "",
    required_documents: "",
  });

  const loadAll = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const [{ data: sl }, { data: sop }, { data: bk }, { data: ap }, { data: tok }, { data: dc }, { data: vi }, { data: oc }, { data: vcl }] = await Promise.all([
      supabase.from("shortlists").select("*").eq("student_id", uid).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("sop_responses").select("answers").eq("student_id", uid).maybeSingle(),
      supabase.from("bookings").select("*").in("status", ["paid", "scheduled", "completed"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("applications").select("*").order("created_at", { ascending: false }),
      supabase.from("profile_shares").select("token").eq("is_active", true).limit(1).maybeSingle(),
      supabase.from("application_documents").select("*").order("created_at", { ascending: true }),
      supabase.from("student_checklist_items").select("*").order("created_at", { ascending: true }),
      supabase.from("offer_conditions").select("*").order("created_at", { ascending: true }),
      supabase.from("visa_checklists").select("*"),
    ]);
    setShortlist((sl as Shortlist) ?? null);
    setSopAnswers((sop?.answers as Record<string, string>) ?? {});
    setBooking((bk as Booking) ?? null);
    setApps((ap as Application[]) ?? []);
    setDocs((dc as ApplicationDocument[]) ?? []);
    setVisa((vi as StudentChecklistItem[]) ?? []);
    setConditions((oc as OfferCondition[]) ?? []);
    setVisaLists((vcl as VisaChecklist[]) ?? []);
    setShareToken(tok?.token ?? null);
    const appUniIds = ((ap as Application[]) ?? []).map((a) => a.university_id).filter(Boolean) as string[];
    const slIds = (sl?.result?.items ?? []).map((i: ShortlistItem) => i.university_id);
    const uniIds = [...new Set([...appUniIds, ...slIds])];
    if (uniIds.length) {
      const { data: u } = await supabase.from("universities").select("*").in("id", uniIds);
      setUnis((u as University[]) ?? []);
    }
  }, [session]);

  useEffect(() => {
    loadAll();
    setConsent(!!studentProfile?.share_consent);
  }, [loadAll, studentProfile?.share_consent]);

  const profileDone = !!studentProfile?.is_complete;
  const docsDone = !!studentProfile?.resume_url;
  const eligibilityDone = !!shortlist && (shortlist.result.items?.length ?? 0) > 0;
  const matched = eligibilityDone;
  const reviewed = !!studentProfile?.shortlist_reviewed_at;
  const sop = sopStats(sopAnswers);
  const readinessDone = sop.ready;
  const shared = !!studentProfile?.shared_with_counsellor_at;
  const counsellingDone = booking?.status === "completed";
  const counsellingInProgress = !!booking && !counsellingDone;
  const submittedApps = apps.filter((a) => ["Application Submitted", "Awaiting Decision", "Offer Received", "Waitlisted", "Rejected"].includes(a.status));
  const decided = apps.filter((a) => ["Offer Received", "Waitlisted", "Rejected"].includes(a.status));
  const readyToShare = profileDone && docsDone && eligibilityDone && reviewed && readinessDone;

  const steps: { n: number; label: string; status: StepStatus; href?: string }[] = [
    { n: 1, label: "Profile completed", status: profileDone ? "completed" : "action", href: profileDone ? undefined : "/onboarding" },
    { n: 2, label: "Documents collected", status: docsDone ? "completed" : "action", href: docsDone ? undefined : "/onboarding" },
    { n: 3, label: "Eligibility checks completed", status: eligibilityDone ? "completed" : "pending", href: eligibilityDone ? undefined : "/dashboard" },
    { n: 4, label: "Universities matched", status: matched ? "completed" : "pending", href: matched ? undefined : "/dashboard" },
    { n: 5, label: "University shortlist reviewed", status: reviewed ? "completed" : "action" },
    { n: 6, label: "Application readiness checked", status: readinessDone ? "completed" : "action", href: readinessDone ? undefined : "/sop" },
    { n: 7, label: "Profile shared with counsellor", status: shared ? "completed" : readyToShare ? "action" : "pending" },
    {
      n: 8,
      label: "Counselling and application planning",
      status: counsellingDone ? "completed" : counsellingInProgress ? "in-progress" : shared ? "in-progress" : "pending",
    },
    { n: 9, label: "Individual university applications submitted", status: submittedApps.length ? (decided.length ? "completed" : "in-progress") : apps.length ? "action" : "pending" },
    { n: 10, label: "Admission decisions and next steps", status: decided.length ? "completed" : submittedApps.length ? "in-progress" : "pending" },
  ];

  const completedCount = steps.filter((s) => s.status === "completed").length;

  const shareUrl = shareToken ? `${window.location.origin}/student-profile/${shareToken}` : null;

  async function updateFlag(field: "share_consent" | "shortlist_reviewed_at" | "shared_with_counsellor_at", value: unknown) {
    if (!session) return;
    setBusy(field);
    setErr(null);
    const patch: Record<string, unknown> = { [field]: value };
    if (field === "share_consent" && value) patch.share_consent_at = new Date().toISOString();
    const { error } = await supabase.from("student_profiles").update(patch).eq("user_id", session.user.id);
    if (error) setErr(error.message);
    await refresh();
    setBusy(null);
  }

  async function tokenAction(action: "create" | "regenerate" | "revoke") {
    setBusy(action);
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("share-token", { method: "POST", body: { action } });
      if (error) {
        const body = error.context ? await error.context.json().catch(() => null) : null;
        throw new Error(body?.error ?? "Could not manage share link");
      }
      setShareToken(data.token ?? null);
      if (action === "revoke") setNote("Link revoked. The old URL no longer works.");
      else setNote(action === "regenerate" ? "New link created — the old link is dead." : "Share link ready.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  function openWhatsApp() {
    if (!shareUrl || !studentProfile) return;
    const top = (shortlist?.result.items ?? [])
      .slice()
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 5)
      .map((i) => `${i.name} (${i.tier}, fit ${i.fit_score})`);
    const msg = buildCounsellorWhatsAppMessage({
      student: {
        name: session?.user.user_metadata?.name ?? null,
        intendedMajor: studentProfile.intended_major,
        class12Marks: studentProfile.class_12_marks,
        gradingSystem: studentProfile.grading_system,
      },
      profileUrl: shareUrl,
      topUniversities: top,
      applicationCycle: null,
      linkedinUrl: studentProfile.linkedin_url,
    });
    window.open(waMeUrl(msg), "_blank", "noopener,noreferrer");
  }

  async function addApp(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy("add-app");
    setErr(null);
    const uni = unis.find((u) => u.id === newApp.university_id);
    const { error } = await supabase.from("applications").insert({
      student_id: session.user.id,
      university_id: newApp.university_id || null,
      program: newApp.program || studentProfile?.intended_major || null,
      portal_url: newApp.portal_url || null,
      admission_deadline: newApp.admission_deadline || null,
      scholarship_deadline: newApp.scholarship_deadline || null,
      application_fee_aud: newApp.application_fee_aud ? Number(newApp.application_fee_aud) : null,
      required_documents: newApp.required_documents
        ? newApp.required_documents.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      status: "Not Started",
    });
    if (error) setErr(error.message);
    else {
      setShowAddApp(false);
      setNewApp({ university_id: "", program: "", portal_url: "", admission_deadline: "", scholarship_deadline: "", application_fee_aud: "", required_documents: "" });
      loadAll();
    }
    setBusy(null);
    void uni;
  }

  const DEFAULT_DOCS = [
    "Passport",
    "Class 10 & 12 transcripts",
    "English test report (IELTS/TOEFL/PTE)",
    "Resume / CV",
    "Statement of Purpose",
    "Financial documents",
    "GTE / GS statement",
  ];

  async function seedDocs(appId: string) {
    const { error } = await supabase
      .from("application_documents")
      .upsert(
        DEFAULT_DOCS.map((label) => ({ application_id: appId, label })),
        { onConflict: "application_id,label", ignoreDuplicates: true },
      );
    if (error) setErr(error.message);
    else await loadAll();
  }

  async function toggleDoc(d: ApplicationDocument) {
    setDocs((cur) => cur.map((x) => (x.id === d.id ? { ...x, done: !d.done } : x))); // optimistic
    const { error } = await supabase.from("application_documents").update({ done: !d.done }).eq("id", d.id);
    if (error) {
      setDocs((cur) => cur.map((x) => (x.id === d.id ? { ...x, done: d.done } : x)));
      setErr(error.message);
    }
  }

  const VISA_DOCS = [
    "Passport (bio page, 6+ months validity)",
    "Confirmation of Enrolment (CoE)",
    "OSHC health insurance",
    "Genuine Student (GS) statement",
    "Academic transcripts & completion certificates",
    "English proficiency test report",
    "Financial evidence (12 months funds + travel)",
    "Health examination (HAP ID)",
    "Police clearance certificate",
    "Visa application fee receipt",
  ];

  async function seedVisa() {
    if (!session) return;
    const { error } = await supabase
      .from("student_checklist_items")
      .upsert(
        VISA_DOCS.map((label) => ({ student_id: session.user.id, label })),
        { onConflict: "student_id,label", ignoreDuplicates: true },
      );
    if (error) setErr(error.message);
    else await loadAll();
  }

  async function toggleVisa(item: StudentChecklistItem) {
    setVisa((cur) => cur.map((x) => (x.id === item.id ? { ...x, done: !item.done } : x)));
    const { error } = await supabase.from("student_checklist_items").update({ done: !item.done }).eq("id", item.id);
    if (error) {
      setVisa((cur) => cur.map((x) => (x.id === item.id ? { ...x, done: item.done } : x)));
      setErr(error.message);
    }
  }

  async function setAppStatus(id: string, status: string) {
    if (status === "Application Submitted") {
      const okConfirm = confirm(
        "Confirm: have you ACTUALLY submitted this application on the university portal?\n\nOnly mark submitted after you have pressed submit there. This cannot be undone lightly.",
      );
      if (!okConfirm) return;
    }
    setBusy(id);
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) setErr(error.message);
    await loadAll();
    setBusy(null);
  }

  async function deleteApp(id: string) {
    if (!confirm("Remove this application from your tracker?")) return;
    await supabase.from("applications").delete().eq("id", id);
    loadAll();
  }

  // Feature: application fee ledger
  async function markFeePaid(a: Application) {
    const raw = prompt("Amount paid (AUD)", a.application_fee_aud != null ? String(a.application_fee_aud) : "");
    if (raw == null) return;
    const amt = Number(raw);
    if (!Number.isFinite(amt) || amt < 0) {
      setErr("Enter a valid AUD amount.");
      return;
    }
    setBusy(a.id);
    const { error } = await supabase
      .from("applications")
      .update({ fee_paid_aud: amt, fee_paid_on: new Date().toISOString().slice(0, 10) })
      .eq("id", a.id);
    if (error) setErr(error.message);
    else await loadAll();
    setBusy(null);
  }

  async function undoFeePaid(a: Application) {
    if (!confirm("Remove the paid fee entry from the ledger?")) return;
    setBusy(a.id);
    const { error } = await supabase.from("applications").update({ fee_paid_aud: null, fee_paid_on: null }).eq("id", a.id);
    if (error) setErr(error.message);
    else await loadAll();
    setBusy(null);
  }

  // Feature: offer milestones (offer received → accept-by → CoE → decision)
  async function updateMilestone(id: string, patch: Partial<Application>) {
    setApps((cur) => cur.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from("applications").update(patch).eq("id", id);
    if (error) {
      setErr(error.message);
      await loadAll();
    }
  }

  // Feature: offer conditions tracker (conditional offers)
  async function addCondition(appId: string) {
    const label = (condInput[appId] ?? "").trim();
    if (!label) return;
    setCondInput({ ...condInput, [appId]: "" });
    const { error } = await supabase.from("offer_conditions").insert({ application_id: appId, label });
    if (error) setErr(error.message);
    else await loadAll();
  }

  async function toggleCondition(c: OfferCondition) {
    setConditions((cur) => cur.map((x) => (x.id === c.id ? { ...x, met: !c.met } : x)));
    const { error } = await supabase
      .from("offer_conditions")
      .update({ met: !c.met, met_on: !c.met ? new Date().toISOString().slice(0, 10) : null })
      .eq("id", c.id);
    if (error) {
      setErr(error.message);
      await loadAll();
    }
  }

  async function removeCondition(id: string) {
    if (!confirm("Remove this condition?")) return;
    await supabase.from("offer_conditions").delete().eq("id", id);
    setConditions((cur) => cur.filter((x) => x.id !== id));
  }

  // Feature: visa document checklist per application (country template)
  function appCountryKey(a: Application): string | null {
    const uni = unis.find((u) => u.id === a.university_id);
    return visaCountryKey(uni?.country);
  }

  async function startVisaChecklist(a: Application) {
    const key = visaPick[a.id] || appCountryKey(a);
    if (!key) return;
    const { error } = await supabase
      .from("visa_checklists")
      .upsert({ application_id: a.id, country: key, items: seedVisaItems(key), updated_at: new Date().toISOString() }, { onConflict: "application_id" });
    if (error) setErr(error.message);
    else await loadAll();
  }

  async function toggleVisaItem(list: VisaChecklist, itemId: string) {
    const items = list.items.map((it) => (it.id === itemId ? { ...it, done: !it.done } : it));
    setVisaLists((cur) => cur.map((x) => (x.id === list.id ? { ...x, items } : x)));
    const { error } = await supabase
      .from("visa_checklists")
      .update({ items, updated_at: new Date().toISOString() })
      .eq("id", list.id);
    if (error) {
      setErr(error.message);
      await loadAll();
    }
  }

  // Feature: CSV export of applications + documents + deadlines
  function exportApplicationsCsv() {
    const csvCell = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "University", "Program", "Status", "Submitted",
      "Admission deadline", "Scholarship deadline",
      "Fee AUD", "Fee paid AUD", "Fee paid on",
      "Offer received", "Accept by", "CoE issued", "Decision",
      "Docs ready", "Docs total", "Docs missing", "Portal",
    ];
    const rows = apps.map((a) => {
      const uni = unis.find((u) => u.id === a.university_id);
      const dRows = docs.filter((d) => d.application_id === a.id);
      const doneN = dRows.filter((d) => d.done).length;
      const missing = dRows.filter((d) => !d.done).map((d) => d.label).join("; ");
      return [
        uni?.name ?? "Manual entry", a.program, a.status, a.submitted_at,
        a.admission_deadline, a.scholarship_deadline,
        a.application_fee_aud, a.fee_paid_aud, a.fee_paid_on,
        a.offer_received_on, a.offer_accept_by, a.coe_issued_on, a.admission_decision,
        dRows.length ? doneN : "", dRows.length || "", missing, a.portal_url,
      ];
    });
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scholars-abroad-applications_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const feesPaidTotal = apps.reduce((s, a) => s + (Number(a.fee_paid_aud) || 0), 0);
  const feesPaidCount = apps.filter((a) => a.fee_paid_aud != null).length;

  if (!studentProfile)
    return (
      <Empty title="Loading…" action={<Spinner className="size-8" />} />
    );

  return (
    <div>
      <PageHeader
        title="Your University Application Journey"
        subtitle={`${completedCount} of ${steps.length} steps complete`}
        right={
          decided.length >= 2 ? (
            <Link to="/compare-offers">
              <Button variant="ghost" className="text-xs">Compare {decided.length} offers →</Button>
            </Link>
          ) : null
        }
      />
      <ErrorNote>{err}</ErrorNote>
      {note ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{note}</div>
      ) : null}

      {/* Journey progress bar */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between text-sm font-semibold">
          <span className="text-slate-800">Progress</span>
          <span className="text-emerald-700">{Math.round((completedCount / steps.length) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${(completedCount / steps.length) * 100}%` }} />
        </div>
        <ol className="mt-4 space-y-2">
          {steps.map((s) => (
            <li key={s.n} className="flex items-center gap-3 text-sm">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  s.status === "completed"
                    ? "bg-emerald-600 text-white"
                    : s.status === "action"
                      ? "bg-amber-100 text-amber-800"
                      : s.status === "in-progress"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-slate-100 text-slate-500"
                }`}
              >
                {s.n}
              </span>
              <span className={`grow ${s.status === "completed" ? "text-slate-500 line-through" : "text-slate-800"}`}>{s.label}</span>
              <Badge className={STATUS_META[s.status].cls}>{STATUS_META[s.status].label}</Badge>
              {s.href ? (
                <Link to={s.href} className="text-xs font-semibold text-emerald-800 underline">
                  fix
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>

      {/* Shortlist reviewed action */}
      {!reviewed && eligibilityDone ? (
        <Card className="mb-6 border-amber-200 bg-amber-50/60">
          <p className="text-sm font-semibold text-amber-900">
            Have you reviewed your university shortlist?
          </p>
          <Button className="mt-3" onClick={() => updateFlag("shortlist_reviewed_at", new Date().toISOString())} disabled={busy === "shortlist_reviewed_at"}>
            {busy === "shortlist_reviewed_at" ? <Spinner className="size-4" /> : null}
            Yes — I've reviewed my shortlist
          </Button>
        </Card>
      ) : null}

      {/* Final-stage section — only when all prerequisites are done */}
      {readyToShare ? (
        <Card className="mb-6 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white">
          <h2 className="text-xl font-extrabold text-slate-900">Your University Application Journey Starts Here</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Congratulations! Your profile analysis and university matching process is complete. You can now share your
            verified student profile with our counsellor through WhatsApp to receive guidance on university
            applications, admission requirements, deadlines, and next steps.
          </p>

          {/* Consent */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy === "share_consent"}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  updateFlag("share_consent", e.target.checked);
                }}
                className="mt-0.5 size-4 accent-emerald-700"
              />
              <span className="text-slate-700">
                I consent to share my profile (name, phone, academics, test scores, budget, shortlist and resume) with a
                Scholars Abroad counsellor via a secure link. I understand I can revoke this link at any time, and that
                passwords, payment details and internal notes are never shared.
              </span>
            </label>
          </div>

          {/* Secure link */}
          {consent ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-900">Your secure profile link</h3>
              {shareUrl ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="grow truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">{shareUrl}</code>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? "Copied" : "Copy link"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        window.location.href = `mailto:?subject=${encodeURIComponent("My Scholars Abroad profile")}&body=${encodeURIComponent(`Here's my verified student profile for Scholars Abroad:\n${shareUrl}`)}`;
                      }}
                    >
                      Email
                    </Button>
                    <Button variant="ghost" onClick={() => tokenAction("regenerate")} disabled={busy === "regenerate"}>
                      {busy === "regenerate" ? <Spinner className="size-4" /> : null}
                      Regenerate
                    </Button>
                    <Button variant="ghost" onClick={() => tokenAction("revoke")} disabled={busy === "revoke"}>
                      Revoke
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Anyone with this link can view the consented profile. Regenerating kills the old link. The resume opens
                    through a short-lived authorized link only.
                  </p>
                </>
              ) : (
                <Button className="mt-2" onClick={() => tokenAction("create")} disabled={busy === "create"}>
                  {busy === "create" ? <Spinner className="size-4" /> : null}
                  Generate my secure profile link
                </Button>
              )}
            </div>
          ) : null}

          {/* WhatsApp handoff */}
          {consent && shareUrl ? (
            <div className="mt-4 rounded-xl border border-[#25D366]/40 bg-[#25D366]/5 p-4">
              <h3 className="text-sm font-bold text-slate-900">Share with your counsellor on WhatsApp</h3>
              <p className="mt-1 text-xs text-slate-600">
                Opens WhatsApp to <strong>+91 {COUNSELLOR_WHATSAPP_NUMBER.replace(/^91/, "86987 86")}</strong> with a
                prefilled message containing your details, profile link and top university matches. You can review and
                edit the message before sending.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button variant="wa" onClick={openWhatsApp} className="min-h-12 px-6">
                  <WhatsAppIcon className="size-5" />
                  Share My Profile with Counsellor on WhatsApp
                </Button>
                {!shared ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setConfirmSent(true);
                      updateFlag("shared_with_counsellor_at", new Date().toISOString());
                    }}
                    disabled={busy === "shared_with_counsellor_at"}
                  >
                    {confirmSent || shared ? "✓ Confirmed sent" : "I've sent the message"}
                  </Button>
                ) : (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Message confirmed sent</Badge>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Opening WhatsApp does not mark step 7 as done — only your explicit confirmation after pressing Send does.
              </p>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card className="mb-6 border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-700">Your University Application Journey Starts Here</h2>
          <p className="mt-1 text-sm text-slate-500">
            Complete your profile, review your shortlist, and finish the SOP questionnaire to unlock counsellor handoff.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {steps
              .filter((s) => s.status === "action" && s.href)
              .map((s) => (
                <Link key={s.n} to={s.href!}>
                  <Button variant="ghost">{s.label}</Button>
                </Link>
              ))}
          </div>
        </Card>
      )}

      {/* Profile summary */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold text-slate-900">Profile summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Name" v={session?.user.user_metadata?.name ?? studentProfile.intended_major ? (session?.user.user_metadata?.name as string) : undefined} />
            <Row k="Intended major" v={studentProfile.intended_major} />
            <Row k="Class 12" v={studentProfile.class_12_marks != null ? `${studentProfile.class_12_marks} (${studentProfile.grading_system})` : undefined} />
            <Row k="English" v={[studentProfile.ielts && `IELTS ${studentProfile.ielts}`, studentProfile.toefl && `TOEFL ${studentProfile.toefl}`, studentProfile.pte && `PTE ${studentProfile.pte}`].filter(Boolean).join(", ")} />
            <Row k="Budget" v={studentProfile.budget_aud_per_year != null ? `${money(studentProfile.budget_aud_per_year)}/yr` : undefined} />
            <Row k="Cities" v={(studentProfile.preferred_cities ?? []).join(", ")} />
          </dl>
        </Card>
        <Card>
          <h2 className="font-bold text-slate-900">Recommended universities</h2>
          {shortlist?.result.items?.length ? (
            <ul className="mt-3 space-y-1.5">
              {shortlist.result.items.slice(0, 6).map((it) => (
                <li key={it.university_id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-800">{it.name}</span>
                  <span className="flex items-center gap-2">
                    <Badge className={tierBadge(it.tier)}>{it.tier}</Badge>
                    <span className="font-bold text-emerald-800">{it.fit_score}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No shortlist yet.</p>
          )}
        </Card>
      </div>

      {/* Application tracker */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900">Application tracker</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Track each university application. Statuses change only when you confirm real actions — submissions are never auto-marked.
            </p>
            {feesPaidTotal > 0 ? (
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                Fees paid: {money(feesPaidTotal)} across {feesPaidCount} application{feesPaidCount === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={exportApplicationsCsv} disabled={!apps.length} title="CSV export">
              Export CSV
            </Button>
            <Button variant="ghost" onClick={() => window.print()} title="Print tracker">
              Print
            </Button>
            <Button onClick={() => setShowAddApp(!showAddApp)}>{showAddApp ? "Close" : "Add application"}</Button>
          </div>
        </div>

        {showAddApp ? (
          <form onSubmit={addApp} className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <Field label="University">
              <Select value={newApp.university_id} onChange={(e) => setNewApp({ ...newApp, university_id: e.target.value })}>
                <option value="">— from shortlist or manual —</option>
                {unis.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Program">
              <Input value={newApp.program} onChange={(e) => setNewApp({ ...newApp, program: e.target.value })} placeholder={studentProfile.intended_major ?? "e.g. Master of Computer Science"} />
            </Field>
            <Field label="Portal URL">
              <Input type="url" value={newApp.portal_url} onChange={(e) => setNewApp({ ...newApp, portal_url: e.target.value })} placeholder="https://..." />
            </Field>
            <Field label="Admission deadline">
              <Input type="date" value={newApp.admission_deadline} onChange={(e) => setNewApp({ ...newApp, admission_deadline: e.target.value })} />
            </Field>
            <Field label="Scholarship deadline">
              <Input type="date" value={newApp.scholarship_deadline} onChange={(e) => setNewApp({ ...newApp, scholarship_deadline: e.target.value })} />
            </Field>
            <Field label="Application fee (AUD)">
              <Input type="number" value={newApp.application_fee_aud} onChange={(e) => setNewApp({ ...newApp, application_fee_aud: e.target.value })} placeholder="e.g. 150" />
            </Field>
            <Field label="Required documents" hint="comma-separated">
              <Input value={newApp.required_documents} onChange={(e) => setNewApp({ ...newApp, required_documents: e.target.value })} placeholder="Transcript, Passport, SOP, LOR" />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={busy === "add-app"}>
                {busy === "add-app" ? <Spinner className="size-4" /> : null}
                Save application
              </Button>
            </div>
          </form>
        ) : null}

        {apps.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No applications tracked yet. Add your first university above.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {apps.map((a) => {
              const uni = unis.find((u) => u.id === a.university_id);
              return (
                <div key={a.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900">{uni?.name ?? "Manual entry"}</h3>
                      <p className="text-xs text-slate-500">
                        {a.program}
                        {a.admission_deadline ? ` · deadline ${a.admission_deadline}` : ""}
                        {a.scholarship_deadline ? ` · scholarship ${a.scholarship_deadline}` : ""}
                        {a.application_fee_aud != null ? ` · fee ${money(a.application_fee_aud)}` : ""}
                      </p>
                      {deadlineChip(a.admission_deadline)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select className="w-44 py-1.5" value={a.status} onChange={(e) => setAppStatus(a.id, e.target.value)} disabled={busy === a.id}>
                        {APP_STATUS_OPTIONS.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </Select>
                      <button className="text-xs font-semibold text-rose-600" onClick={() => deleteApp(a.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                  {a.submitted_at ? <p className="mt-1 text-xs text-emerald-700">Submitted {new Date(a.submitted_at).toLocaleDateString("en-AU")}</p> : null}
                  {a.application_fee_aud != null || a.fee_paid_aud != null ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      {a.application_fee_aud != null ? (
                        <span className="text-slate-500">Fee {money(a.application_fee_aud)}</span>
                      ) : null}
                      {a.fee_paid_aud != null ? (
                        <>
                          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
                            Paid {money(a.fee_paid_aud)}
                            {a.fee_paid_on ? ` · ${a.fee_paid_on}` : ""}
                          </Badge>
                          <button className="font-semibold text-slate-400 hover:text-slate-600" onClick={() => undoFeePaid(a)}>
                            undo
                          </button>
                        </>
                      ) : a.application_fee_aud != null ? (
                        <button className="font-semibold text-emerald-700 hover:text-emerald-900" onClick={() => markFeePaid(a)}>
                          Mark as paid
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {a.portal_url ? (
                    <a href={a.portal_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-emerald-800">
                      Open portal ↗
                    </a>
                  ) : null}
                  {a.required_documents?.length ? (
                    <p className="mt-1 text-xs text-slate-500">Docs: {a.required_documents.join(", ")}</p>
                  ) : null}
                  {a.status === "Offer Received" || a.offer_received_on || a.offer_accept_by || a.coe_issued_on || a.admission_decision ? (
                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Offer milestones</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-4">
                        <label className="text-[11px] font-semibold text-slate-500">
                          Offer received
                          <Input
                            className="mt-1"
                            type="date"
                            value={a.offer_received_on ?? ""}
                            onChange={(e) => updateMilestone(a.id, { offer_received_on: e.target.value || null })}
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-500">
                          Accept by
                          <Input
                            className="mt-1"
                            type="date"
                            value={a.offer_accept_by ?? ""}
                            onChange={(e) => updateMilestone(a.id, { offer_accept_by: e.target.value || null })}
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-500">
                          CoE issued
                          <Input
                            className="mt-1"
                            type="date"
                            value={a.coe_issued_on ?? ""}
                            onChange={(e) => updateMilestone(a.id, { coe_issued_on: e.target.value || null })}
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-500">
                          Decision
                          <Input
                            className="mt-1"
                            value={a.admission_decision ?? ""}
                            placeholder="e.g. Offer accepted"
                            onChange={(e) => updateMilestone(a.id, { admission_decision: e.target.value || null })}
                          />
                        </label>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        Accept-by dates surface in your Deadline Hub — record only what you've actually received.
                      </p>
                      {(() => {
                        const rows = conditions.filter((c) => c.application_id === a.id);
                        const metCount = rows.filter((c) => c.met).length;
                        const allMet = rows.length > 0 && metCount === rows.length;
                        return (
                          <div className="mt-3 border-t border-slate-200 pt-2.5">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                              <span>Offer conditions</span>
                              {rows.length ? (
                                <span className={allMet ? "text-emerald-700" : "text-slate-500"}>
                                  {allMet ? "All met — ready to accept" : `${metCount}/${rows.length} met`}
                                </span>
                              ) : null}
                            </div>
                            {rows.length ? (
                              <ul className="mt-1.5 space-y-1">
                                {rows.map((c) => (
                                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                                    <label className="flex min-w-0 items-center gap-2">
                                      <input type="checkbox" checked={c.met} onChange={() => toggleCondition(c)} className="size-4 rounded border-slate-300 text-emerald-600" />
                                      <span className={c.met ? "text-slate-400 line-through" : "text-slate-700"}>{c.label}</span>
                                    </label>
                                    <button className="text-xs font-semibold text-rose-500 hover:text-rose-700" onClick={() => removeCondition(c.id)}>
                                      Remove
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1 text-[11px] text-slate-400">
                                e.g. “IELTS 7.0 (no band below 6.5)”, “Final transcripts”, “ATAS clearance”.
                              </p>
                            )}
                            <div className="mt-2 flex gap-2">
                              <Input
                                className="max-w-xs"
                                value={condInput[a.id] ?? ""}
                                placeholder="Add a condition from your offer letter"
                                onChange={(e) => setCondInput({ ...condInput, [a.id]: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") addCondition(a.id);
                                }}
                              />
                              <Button variant="ghost" className="px-3" onClick={() => addCondition(a.id)}>
                                Add
                              </Button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}
                  {(() => {
                    const list = visaLists.find((v) => v.application_id === a.id);
                    if (list) {
                      const done = list.items.filter((i) => i.done).length;
                      const tpl = VISA_TEMPLATES[list.country];
                      const pct = list.items.length ? Math.round((done / list.items.length) * 100) : 0;
                      return (
                        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>Visa checklist — {tpl?.label ?? list.country}</span>
                            <span className={done === list.items.length ? "text-emerald-700" : "text-slate-500"}>
                              {done}/{list.items.length} · {pct}%
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <ul className="mt-2 space-y-1">
                            {list.items.map((it) => (
                              <li key={it.id}>
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                  <input type="checkbox" checked={it.done} onChange={() => toggleVisaItem(list, it.id)} className="size-4 rounded border-slate-300 text-sky-600" />
                                  <span className={it.done ? "text-slate-400 line-through" : "text-slate-700"}>{it.label}</span>
                                </label>
                              </li>
                            ))}
                          </ul>
                          {tpl ? (
                            <p className="mt-2 text-[11px] text-slate-500">
                              {tpl.note} Official source: {tpl.official}.
                            </p>
                          ) : null}
                        </div>
                      );
                    }
                    const key = appCountryKey(a);
                    return (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {key ? (
                          <Button variant="ghost" className="px-3" onClick={() => startVisaChecklist(a)}>
                            Start visa checklist ({VISA_TEMPLATES[key]?.label ?? key})
                          </Button>
                        ) : (
                          <>
                            <Select
                              className="max-w-[16rem]"
                              value={visaPick[a.id] ?? ""}
                              onChange={(e) => setVisaPick({ ...visaPick, [a.id]: e.target.value })}
                            >
                              <option value="">Choose visa destination…</option>
                              {Object.values(VISA_TEMPLATES).map((t) => (
                                <option key={t.key} value={t.key}>
                                  {t.label}
                                </option>
                              ))}
                            </Select>
                            <Button variant="ghost" className="px-3" disabled={!visaPick[a.id]} onClick={() => startVisaChecklist(a)}>
                              Start checklist
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  {(() => {
                    const rows = docs.filter((d) => d.application_id === a.id);
                    if (!rows.length)
                      return (
                        <button
                          className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                          onClick={() => seedDocs(a.id)}
                        >
                          ＋ Add standard document checklist
                        </button>
                      );
                    const doneCount = rows.filter((d) => d.done).length;
                    return (
                      <div className="mt-3 border-t border-slate-100 pt-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span>Documents</span>
                          <span className={doneCount === rows.length ? "text-emerald-700" : "text-slate-500"}>
                            {doneCount}/{rows.length} ready
                          </span>
                        </div>
                        <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                          {rows.map((d) => (
                            <li key={d.id}>
                              <label
                                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs ${
                                  d.done ? "text-emerald-700" : "text-slate-600"
                                } hover:bg-slate-50`}
                              >
                                <input type="checkbox" checked={d.done} onChange={() => toggleDoc(d)} className="accent-emerald-600" />
                                <span className={d.done ? "line-through opacity-70" : ""}>{d.label}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Visa readiness (subclass 500) */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-slate-900">Visa readiness — Student visa (subclass 500)</h2>
            <p className="mt-1 text-sm text-slate-500">
              Typical documents for an Australian student visa. Confirm the current list with the Department of Home Affairs
              or your counsellor before applying.
            </p>
          </div>
          {visa.length ? (
            <span className={`text-sm font-bold ${visa.every((v) => v.done) ? "text-emerald-700" : "text-slate-600"}`}>
              {visa.filter((v) => v.done).length}/{visa.length} ready
            </span>
          ) : null}
        </div>
        {visa.length === 0 ? (
          <button className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-900" onClick={seedVisa}>
            ＋ Add standard visa checklist
          </button>
        ) : (
          <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {visa.map((v) => (
              <li key={v.id}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    v.done ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"
                  } hover:bg-slate-50`}
                >
                  <input type="checkbox" checked={v.done} onChange={() => toggleVisa(v)} className="accent-emerald-600" />
                  <span className={v.done ? "line-through opacity-70" : ""}>{v.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {visa.length && !visa.every((v) => v.done) ? (
          <p className="mt-3 text-xs text-slate-400">
            Tip: your SOP/GS statement and financial evidence usually take the longest — start those first.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
      <dd className="text-slate-800">{v}</dd>
    </div>
  );
}

/** Countdown chip for an application deadline (end of local day). */
function deadlineChip(dateStr?: string | null) {
  return <DeadlineChip date={dateStr} className="mt-1" />;
}

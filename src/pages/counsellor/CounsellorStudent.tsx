import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import type { Application, Booking, CounsellorNote, Profile, Shortlist, StudentProfile, University } from "../../lib/types";
import { money } from "../../lib/utils";
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Spinner, Textarea } from "../../components/ui";

type ApplicationRow = Application & { universities?: { name?: string } | null };

/** wa.me link — Indian 10-digit numbers get the +91 country code, others pass through. */
function waLink(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `https://wa.me/91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `https://wa.me/91${d.slice(1)}`;
  return `https://wa.me/${d}`;
}

export default function CounsellorStudent() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [counsellorId, setCounsellorId] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [student, setStudent] = useState<Profile | null>(null);
  const [sp, setSp] = useState<StudentProfile | null>(null);
  const [shortlist, setShortlist] = useState<Shortlist | null>(null);
  const [unis, setUnis] = useState<University[]>([]);
  const [notes, setNotes] = useState<CounsellorNote[]>([]);
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteQuery, setNoteQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id || !profile) return;
      const { data: me } = await supabase.from("counsellors").select("id").eq("user_id", profile.id).maybeSingle();
      setCounsellorId(me?.id ?? null);
      if (!me) return setLoading(false);

      const { data: b } = await supabase
        .from("bookings")
        .select("*")
        .eq("counsellor_id", me.id)
        .eq("student_id", id)
        .in("status", ["paid", "scheduled", "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setBooking((b as Booking) ?? null);
      if (!b) return setLoading(false); // RLS hides everything else anyway

      const [{ data: prof }, { data: profile2 }, { data: sl }, { data: n }, { data: ap }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
        supabase.from("student_profiles").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("shortlists").select("*").eq("student_id", id).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("counsellor_notes").select("*").eq("booking_id", b.id).order("created_at", { ascending: false }),
        supabase.from("applications").select("*, universities(name)").eq("student_id", id).order("created_at", { ascending: false }),
      ]);
      setStudent((prof as Profile) ?? null);
      setSp((profile2 as StudentProfile) ?? null);
      setShortlist((sl as Shortlist) ?? null);
      setNotes((n as CounsellorNote[]) ?? []);
      setApps((ap as ApplicationRow[]) ?? []);

      if (sl?.result?.items?.length) {
        const { data: u } = await supabase
          .from("universities")
          .select("*")
          .in("id", sl.result.items.map((i: { university_id: string }) => i.university_id));
        setUnis((u as University[]) ?? []);
      }

      if (profile2?.resume_url) {
        const { data: signed } = await supabase.storage.from("resumes").createSignedUrl(profile2.resume_url, 3600);
        setResumeUrl(signed?.signedUrl ?? null);
      }
      setLoading(false);
    })();
  }, [id, profile]);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!booking || !counsellorId || !noteText.trim()) return;
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("counsellor_notes")
      .insert({ booking_id: booking.id, counsellor_id: counsellorId, note: noteText.trim() });
    if (error) setErr(error.message);
    else {
      const { data } = await supabase
        .from("counsellor_notes")
        .select("*")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: false });
      setNotes((data as CounsellorNote[]) ?? []);
      setNoteText("");
    }
    setSaving(false);
  }

  async function setStatus(status: string) {
    if (!booking) return;
    const { error } = await supabase.from("bookings").update({ status }).eq("id", booking.id);
    if (error) setErr(error.message);
    else setBooking({ ...booking, status: status as Booking["status"] });
  }

  const noteQ = noteQuery.trim().toLowerCase();
  const shownNotes = noteQ ? notes.filter((n) => n.note.toLowerCase().includes(noteQ)) : notes;

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner className="size-8" />
      </div>
    );

  if (!booking)
    return (
      <Card>
        <p className="text-sm text-slate-600">No paid booking found for this student on your account.</p>
        <Link to="/counsellor" className="mt-3 inline-block text-sm font-semibold">
          ← Back to my students
        </Link>
      </Card>
    );

  const priority = (sp?.priorities_ranked ?? []).join(" → ");
  const cities = (sp?.preferred_cities ?? []).join(", ");

  return (
    <div>
      <PageHeader
        title={student?.name ?? "Student"}
        subtitle={student?.email ?? ""}
        right={
          <div className="flex gap-2">
            {booking.status === "paid" ? (
              <Button variant="ghost" onClick={() => setStatus("scheduled")}>
                Mark scheduled
              </Button>
            ) : null}
            {booking.status === "scheduled" ? (
              <Button variant="ghost" onClick={() => setStatus("completed")}>
                Mark completed
              </Button>
            ) : null}
          </div>
        }
      />
      <Link to="/counsellor" className="mb-4 inline-block text-sm font-semibold">
        ← All students
      </Link>
      <ErrorNote>{err}</ErrorNote>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold text-slate-900">Profile</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Phone" v={student?.phone} />
            <Row k="Intended major" v={sp?.intended_major} />
            <Row k="Career goal" v={sp?.career_goal} />
            <Row k="Class 10 / 12" v={sp && sp.class_10_marks != null ? `${sp.class_10_marks} (${sp.grading_system}) / ${sp.class_12_marks}` : undefined} />
            <Row
              k="English tests"
              v={[
                sp?.ielts != null ? `IELTS ${sp.ielts}` : null,
                sp?.toefl != null ? `TOEFL ${sp.toefl}` : null,
                sp?.pte != null ? `PTE ${sp.pte}` : null,
                sp?.sat != null ? `SAT ${sp.sat}` : null,
              ]
                .filter(Boolean)
                .join(", ")}
            />
            <Row k="Budget" v={sp?.budget_aud_per_year != null ? `${money(sp.budget_aud_per_year)}/yr${sp.needs_scholarship ? " · needs scholarship" : ""}` : undefined} />
            <Row k="Preferred cities" v={cities} />
            <Row k="Priorities" v={priority} />
          </dl>
          {resumeUrl || student?.phone ? (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {resumeUrl ? (
                <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold">
                  View resume (signed link, expires in 1h) ↗
                </a>
              ) : null}
              {student?.phone ? (
                <a
                  href={waLink(student.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm font-semibold text-emerald-800 hover:text-emerald-900"
                >
                  WhatsApp student ↗
                </a>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="font-bold text-slate-900">Shortlist</h2>
          {!shortlist ? (
            <p className="mt-2 text-sm text-slate-500">No shortlist generated yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {shortlist.result.items.map((it) => {
                const u = unis.find((x) => x.id === it.university_id);
                return (
                  <li key={it.university_id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{it.name}</span>
                      <span className="text-xs font-bold text-emerald-800">
                        {it.tier} · {it.fit_score}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {money(it.tuition_aud ?? u?.tuition_aud)}/yr tuition
                      {it.post_study_work_years != null ? ` · PSW ${it.post_study_work_years} yrs` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-bold text-slate-900">Applications</h2>
          {apps.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No applications tracked yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {apps.map((a) => {
                const uniName = Array.isArray(a.universities) ? a.universities[0]?.name : a.universities?.name;
                return (
                  <li key={a.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        {a.program ?? "Program"}
                        {uniName ? ` — ${uniName}` : ""}
                      </span>
                      <Badge className="border-slate-200 bg-slate-50 text-slate-600">{a.status}</Badge>
                    </div>
                    {a.admission_deadline ? (
                      <p className="mt-0.5 text-xs text-slate-500">Deadline {a.admission_deadline}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900">Notes{notes.length ? ` (${notes.length})` : ""}</h2>
            {notes.length > 1 ? (
              <Input
                className="max-w-56"
                placeholder="Search notes…"
                value={noteQuery}
                onChange={(e) => setNoteQuery(e.target.value)}
              />
            ) : null}
          </div>
          <form onSubmit={addNote} className="mt-3">
            <Field label="Add a note">
              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Private note — visible to counsellors and admins only." />
            </Field>
            <Button type="submit" disabled={saving || !noteText.trim()} className="mt-2">
              {saving ? <Spinner className="size-4" /> : null}
              Save note
            </Button>
          </form>
          {noteQ && shownNotes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No notes match “{noteQuery.trim()}”.</p>
          ) : null}
          <ul className="mt-4 space-y-2">
            {shownNotes.map((n) => (
              <li key={n.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap text-slate-800">{n.note}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString("en-AU")}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="flex gap-3">
      <dt className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
      <dd className="text-slate-800">{v}</dd>
    </div>
  );
}

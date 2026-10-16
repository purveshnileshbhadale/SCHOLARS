/** Shared deadline math, countdown chips and .ics calendar export. */

/** Whole days left until end of the date's local day. Negative = passed. null if unparseable. */
export function daysLeft(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const s = String(dateStr);
  let d = new Date(`${s.slice(0, 10)}T23:59:59`); // ISO date
  if (Number.isNaN(d.getTime())) d = new Date(s); // free text e.g. "31 March 2027"
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export function parseDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr);
  let d = new Date(s.slice(0, 10));
  if (Number.isNaN(d.getTime())) d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(dateStr?: string | null): string {
  const d = parseDate(dateStr);
  return d ? d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

/** VTIMEZONE-free UTC stamp for .ics. */
export function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function icsDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** All-day calendar event (deadline) with an optional N-days-before alarm. */
export function downloadDeadlineIcs(opts: {
  uid: string;
  title: string;
  description?: string;
  dateStr: string;
  alarmDays?: number;
}) {
  const day = parseDate(opts.dateStr);
  if (!day) return;
  const end = new Date(day.getTime() + 86_400_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Scholars Abroad//Deadlines//EN",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@scholarsabroad`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART;VALUE=DATE:${icsDate(day)}`,
    `DTEND;VALUE=DATE:${icsDate(end)}`,
    `SUMMARY:${opts.title.replace(/\r?\n/g, " ")}`,
    ...(opts.description ? [`DESCRIPTION:${opts.description.replace(/\r?\n/g, " ").replace(/,/g, "\\,")}`] : []),
    "BEGIN:VALARM",
    `TRIGGER:-P${opts.alarmDays ?? 2}D`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${opts.title.replace(/\r?\n/g, " ")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  downloadText(`${opts.uid.slice(0, 40)}.ics`, lines.join("\r\n"), "text/calendar");
}

/** Timed calendar event (booking) with an N-hours-before alarm. */
export function downloadEventIcs(opts: {
  uid: string;
  title: string;
  description?: string;
  start: Date;
  alarmHours?: number;
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Scholars Abroad//Calendar//EN",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@scholarsabroad`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(opts.start)}`,
    `SUMMARY:${opts.title.replace(/\r?\n/g, " ")}`,
    ...(opts.description ? [`DESCRIPTION:${opts.description.replace(/\r?\n/g, " ")}`] : []),
    "BEGIN:VALARM",
    `TRIGGER:-PT${opts.alarmHours ?? 24}H`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${opts.title.replace(/\r?\n/g, " ")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  downloadText(`${opts.uid.slice(0, 40)}.ics`, lines.join("\r\n"), "text/calendar");
}

export interface IntakeMilestone {
  key: string;
  label: string;
  date: Date;
  note: string;
}

/** Backwards plan from an intake month (0-11) + year, start assumed day 1. */
export function intakeMilestones(month: number, year: number): IntakeMilestone[] {
  const start = new Date(year, month, 1);
  const at = (days: number) => {
    const d = new Date(start);
    d.setDate(d.getDate() + days);
    return d;
  };
  return [
    { key: "open", label: "Shortlist & essays start", date: at(-240), note: "8 months out — begin SOP, tests, shortlist." },
    { key: "apply", label: "Submit applications", date: at(-120), note: "4 months out — portals usually close well before intake." },
    { key: "funds", label: "Funds & finances ready", date: at(-90), note: "3 months out — tuition deposit, loan/sponsor papers, A$ funds proof." },
    { key: "offers", label: "Offer decisions expected", date: at(-75), note: "Follow up on pending decisions; compare offers." },
    { key: "coe", label: "Accept offer & pay CoE deposit", date: at(-60), note: "2 months out — Confirmation of Enrolment for visa." },
    { key: "visa", label: "Lodge student visa (subclass 500)", date: at(-45), note: "OSHC, GTE/GS statement, CoE, finances." },
    { key: "fly", label: "Fly & orientation", date: start, note: "Arrive at least 1–2 weeks before orientation." },
  ];
}

/** One .ics file containing many all-day events (e.g. an intake milestone plan). */
export function downloadMilestonesIcs(filename: string, events: { uid: string; title: string; description?: string; date: Date }[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Scholars Abroad//Plan//EN"];
  for (const e of events) {
    const next = new Date(e.date.getTime() + 86_400_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@scholarsabroad`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
      `DTEND;VALUE=DATE:${icsDate(next)}`,
      `SUMMARY:${e.title.replace(/\r?\n/g, " ")}`,
      ...(e.description ? [`DESCRIPTION:${e.description.replace(/\r?\n/g, " ").replace(/,/g, "\\,")}`] : []),
      "BEGIN:VALARM",
      "TRIGGER:-P7D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${e.title.replace(/\r?\n/g, " ")}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  downloadText(filename, lines.join("\r\n"), "text/calendar");
}

/** Local-timezone YYYY-MM-DD for a Date. */
export function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

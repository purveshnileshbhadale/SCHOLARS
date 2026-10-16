// One configurable location for counsellor contact + WhatsApp handoff.
export const COUNSELLOR_WHATSAPP_NUMBER = "918698786251"; // +91 86987 86251

/** "+91 86987 86251" for display. */
export function counsellorPhoneDisplay(): string {
  const n = COUNSELLOR_WHATSAPP_NUMBER;
  return `+${n.slice(0, 2)} ${n.slice(2, 7)} ${n.slice(7)}`;
}

/** Generic greeting used by the free "Counsellor" tab (no personal data). */
export const COUNSELLOR_WHATSAPP_INTRO =
  "Hello, I am using Scholars Abroad and I would like guidance on studying in Australia.";

// Optional community destinations — leave empty to hide the buttons.
export const COMMUNITY_LINKEDIN_URL = ""; // e.g. https://www.linkedin.com/company/scholars-abroad
export const COMMUNITY_WHATSAPP_GROUP_URL = ""; // e.g. https://chat.whatsapp.com/XXXX

/** True if the string looks like a LinkedIn personal-profile URL. */
export function isLinkedInUrl(s: string): boolean {
  return /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w%.-]+\/?$/i.test(s.trim());
}

/** Normalises a LinkedIn URL to https://www.linkedin.com/in/… form. */
export function normalizeLinkedInUrl(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export interface ShareableStudent {
  name: string | null;
  intendedMajor: string | null;
  class12Marks: number | null;
  gradingSystem: string | null;
}

/**
 * Builds the prefilled WhatsApp message per the handoff template.
 * Fields that are unavailable are OMITTED — never fabricated.
 */
export function buildCounsellorWhatsAppMessage(opts: {
  student: ShareableStudent;
  profileUrl: string;
  topUniversities: string[]; // e.g. ["Melbourne (target, fit 87)", ...]
  applicationCycle?: string | null;
  linkedinUrl?: string | null;
}): string {
  const lines: string[] = [
    "Hello Counsellor,",
    "",
    "I have completed my student profile and university-matching process on your platform. I would like assistance with my university applications.",
    "",
    "Here are my details:",
  ];

  if (opts.student.name) lines.push(`Name: ${opts.student.name}`);
  if (opts.student.intendedMajor) {
    lines.push(`Intended Degree: ${opts.student.intendedMajor}`);
    lines.push(`Preferred Major: ${opts.student.intendedMajor}`);
  }
  lines.push("Preferred Countries: Australia");
  if (opts.student.class12Marks != null) {
    const suffix = opts.student.gradingSystem ? ` (${opts.student.gradingSystem.toUpperCase()} Class 12)` : "";
    lines.push(`Academic Score: ${opts.student.class12Marks}${suffix}`);
  }
  if (opts.applicationCycle) lines.push(`Application Cycle: ${opts.applicationCycle}`);

  lines.push("", "My complete student profile:", opts.profileUrl);
  if (opts.linkedinUrl) lines.push(`LinkedIn: ${opts.linkedinUrl}`);

  if (opts.topUniversities.length) {
    lines.push("", "My recommended universities:");
    opts.topUniversities.forEach((u, i) => lines.push(`${i + 1}. ${u}`));
  }

  lines.push(
    "",
    "Please review my profile and guide me through the next steps, application requirements, deadlines, scholarships, and admission procedures.",
    "",
    "Thank you.",
  );

  return lines.join("\n");
}

export function waMeUrl(message: string): string {
  return `https://wa.me/${COUNSELLOR_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Share sheet link (no recipient) — WhatsApp's generic ?text= deeplink. */
export function waShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

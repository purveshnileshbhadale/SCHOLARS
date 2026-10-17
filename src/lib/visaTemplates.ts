/** Student visa document templates by destination (estimates — always verify on the official immigration site). */
export interface VisaTemplateItem {
  key: string;
  label: string;
}

export interface VisaTemplate {
  key: string;
  label: string;
  official: string;
  note: string;
  items: VisaTemplateItem[];
}

export const VISA_TEMPLATES: Record<string, VisaTemplate> = {
  AU: {
    key: "AU",
    label: "Australia — Student visa (subclass 500)",
    official: "homeaffairs.gov.au",
    note: "General preparation list only. Current subclass 500 requirements and the Genuine Student (GS) criterion must be checked on homeaffairs.gov.au before you apply.",
    items: [
      { key: "passport", label: "Passport valid for the intended stay" },
      { key: "coe", label: "Confirmation of Enrolment (CoE) from the university" },
      { key: "oshc", label: "Overseas Student Health Cover (OSHC) arranged" },
      { key: "gs", label: "Genuine Student (GS) statement prepared" },
      { key: "english", label: "English test evidence (IELTS / PTE / TOEFL iBT)" },
      { key: "academic", label: "Academic transcripts and certificates" },
      { key: "finance", label: "Financial evidence (tuition + living funds)" },
      { key: "form", label: "ImmiAccount application + any required forms (e.g. 157N)" },
      { key: "health", label: "Health examination booked (if requested)" },
      { key: "biometrics", label: "Biometrics collected (if requested)" },
      { key: "photos", label: "Passport-format photos" },
      { key: "osep", label: "Overseas Student Exchange Program (OSEP) approval, if applicable" },
    ],
  },
  NZ: {
    key: "NZ",
    label: "New Zealand — Fee-paying student visa",
    official: "immigration.govt.nz",
    note: "General preparation list only. Fee amounts and acceptable-provider rules change — confirm everything on immigration.govt.nz.",
    items: [
      { key: "passport", label: "Passport valid for the intended stay" },
      { key: "offer", label: "Offer of Place from an approved provider" },
      { key: "finance", label: "Proof of funds for tuition + living (current NZD amounts: needs verification)" },
      { key: "tuition", label: "Tuition payment evidence / receipt" },
      { key: "insurance", label: "Comprehensive travel/health insurance" },
      { key: "english", label: "English proficiency evidence (if required)" },
      { key: "character", label: "Police certificate(s) for character requirements" },
      { key: "medical", label: "Medical examination / chest X-ray if from a listed country" },
      { key: "photo", label: "Recent photo meeting specs" },
      { key: "tempsponsor", label: "Temporary entry instruction (TEI) requirements read and accepted" },
    ],
  },
  UK: {
    key: "UK",
    label: "United Kingdom — Student visa",
    official: "gov.uk/student-visa",
    note: "General preparation list only. Fund thresholds and IHS fees are updated regularly — check gov.uk/student-visa before applying.",
    items: [
      { key: "passport", label: "Passport / travel document valid for the stay" },
      { key: "cas", label: "Confirmation of Acceptance for Studies (CAS) from the university" },
      { key: "funds", label: "Proof of funds held for 28+ consecutive days (current amounts: needs verification)" },
      { key: "tb", label: "Tuberculosis (TB) test certificate (if from a listed country)" },
      { key: "atas", label: "ATAS certificate, if the course requires it" },
      { key: "english", label: "English language qualification evidence" },
      { key: "ihs", label: "Immigration Health Surcharge (IHS) paid" },
      { key: "academic", label: "Academic qualifications and transcripts" },
      { key: "photo", label: "Passport-format photos" },
      { key: "consent", label: "Parental consent / birth certificate, if under 18" },
    ],
  },
  CA: {
    key: "CA",
    label: "Canada — Study permit",
    official: "canada.ca/study-permit",
    note: "General preparation list only. PAL/TAL rules and proof-of-funds figures change by province and year — verify on canada.ca.",
    items: [
      { key: "acceptance", label: "Letter of Acceptance from a DLI" },
      { key: "pal", label: "Provincial Attestation Letter (PAL/TAL) if required for the program" },
      { key: "passport", label: "Passport valid for the stay" },
      { key: "finance", label: "Proof of funds (tuition + living; GIC or bank statements)" },
      { key: "medical", label: "Upfront medical exam, if from a listed country (optional otherwise)" },
      { key: "police", label: "Police clearance certificates if requested" },
      { key: "photo", label: "Digital photo meeting specifications" },
      { key: "statement", label: "Letter of explanation / study purpose" },
      { key: "quebec", label: "CAQ, if studying in Quebec" },
      { key: "fee", label: "Study permit application fee paid" },
    ],
  },
  US: {
    key: "US",
    label: "United States — F-1 student visa",
    official: "travel.state.gov",
    note: "General preparation list only. Interview and SEVIS rules are set by the DOS and the school's DSO — verify on travel.state.gov.",
    items: [
      { key: "i20", label: "Form I-20 signed by you and the school official" },
      { key: "sevis", label: "SEVIS I-901 fee paid (receipt)" },
      { key: "ds160", label: "DS-160 confirmation page" },
      { key: "appointment", label: "Interview appointment confirmed at the embassy/consulate" },
      { key: "passport", label: "Passport valid for at least 6 months beyond the program dates" },
      { key: "photo", label: "Visa photo meeting DOS specs" },
      { key: "finance", label: "Financial documents showing funding for at least the first year" },
      { key: "academic", label: "Academic records, test scores and admission letter" },
      { key: "ties", label: "Documents showing ties to the home country (property, family, job offer)" },
      { key: "fee", label: "MRV visa application fee paid" },
    ],
  },
};

const COUNTRY_ALIASES: Record<string, string> = {
  australia: "AU",
  "new zealand": "NZ",
  "united kingdom": "UK",
  uk: "UK",
  canada: "CA",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
};

/** Maps a university country name to a template key, or null if unknown. */
export function visaCountryKey(country?: string | null): string | null {
  if (!country) return null;
  return COUNTRY_ALIASES[country.trim().toLowerCase()] ?? null;
}

export function seedVisaItems(key: string): { id: string; label: string; done: boolean }[] {
  const t = VISA_TEMPLATES[key];
  if (!t) return [];
  return t.items.map((i) => ({ id: i.key, label: i.label, done: false }));
}

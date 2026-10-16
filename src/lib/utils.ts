export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function money(n: number | null | undefined, suffix = "AUD"): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${suffix === "AUD" ? "A$" : ""}${Number(n).toLocaleString("en-AU")}${suffix === "AUD" ? "" : " " + suffix}`;
}

/** Indicative AUD → INR rate; update periodically. */
export const AUD_TO_INR = 55.5;

/**
 * Live AUD → INR with a 12h localStorage cache (free no-key API).
 * Always resolves — falls back to the cached rate, then AUD_TO_INR.
 */
export async function fetchAudToInr(): Promise<{ rate: number; live: boolean; at: number }> {
  const KEY = "sa_fx_aud_inr";
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? "null") as { rate: number; at: number } | null;
    if (cached?.rate && Date.now() - cached.at < 12 * 3600_000) {
      return { rate: cached.rate, live: true, at: cached.at };
    }
  } catch {
    /* ignore */
  }
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/AUD", { signal: AbortSignal.timeout(8000) });
    const data = (await r.json()) as { rates?: { INR?: number } };
    const rate = data?.rates?.INR;
    if (rate && Number.isFinite(rate)) {
      const at = Date.now();
      try {
        localStorage.setItem(KEY, JSON.stringify({ rate, at }));
      } catch {
        /* storage full */
      }
      return { rate, live: true, at };
    }
  } catch {
    /* network blocked — fall through */
  }
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? "null") as { rate: number; at: number } | null;
    if (cached?.rate) return { rate: cached.rate, live: false, at: cached.at };
  } catch {
    /* ignore */
  }
  return { rate: AUD_TO_INR, live: false, at: 0 };
}

/** Approximate INR for an AUD amount ("₹25.0L" above ₹1L). Indicative only. */
export function inr(n: number | null | undefined, rate: number = AUD_TO_INR): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n) * rate;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

export function tierBadge(tier: string): string {
  if (tier === "reach") return "bg-amber-100 text-amber-800 border-amber-200";
  if (tier === "target") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  return "bg-sky-100 text-sky-800 border-sky-200";
}

export const AU_CITIES = [
  "Sydney",
  "Melbourne",
  "Brisbane",
  "Perth",
  "Adelaide",
  "Canberra",
  "Gold Coast",
  "Newcastle",
  "Wollongong",
  "Geelong",
];

export const PRIORITY_OPTIONS = [
  "Low tuition fee",
  "Scholarship availability",
  "High QS ranking",
  "Post-study work rights",
  "Part-time job availability",
  "Safe city & student life",
  "Location near Indian community",
  "Industry / co-op placements",
];

export const MAJOR_OPTIONS = [
  "Computer Science",
  "Information Technology",
  "Software Engineering",
  "Data Science",
  "Artificial Intelligence",
  "Cybersecurity",
  "Business / Management",
  "Engineering (other)",
  "Health Sciences",
  "Other",
];

export const GRADING_OPTIONS = [
  { value: "cbse", label: "CBSE / ICSE (percentage)" },
  { value: "state", label: "State board (percentage)" },
  { value: "ib", label: "IB Diploma" },
  { value: "gpa", label: "GPA (4.0 scale)" },
  { value: "other", label: "Other" },
];

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, PageHeader, Button, Badge, Select } from "../components/ui";
import { cx } from "../lib/utils";

/**
 * Pre-departure hub — everything that must happen between accepting an offer
 * and landing in Australia. Pure client-side (localStorage) so it works even
 * before the database migration is applied.
 */

interface Item {
  id: string;
  label: string;
  detail?: string;
  link?: string;
  linkLabel?: string;
}

interface Section {
  id: string;
  title: string;
  icon: string;
  tone: string;
  deadlineHint: string;
  items: Item[];
}

const SECTIONS: Section[] = [
  {
    id: "housing",
    title: "Housing",
    icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10",
    tone: "bg-sky-50 text-sky-700 ring-sky-200/60",
    deadlineHint: "Book 6–8 weeks before arrival — fills fast in Feb/Jul.",
    items: [
      { id: "h1", label: "University hall / residential college", detail: "Cheapest, meal plan often included, social support built in.", link: "https://www.studyaustralia.gov.au/en/living-in-australia/accommodation", linkLabel: "Study Australia guide" },
      { id: "h2", label: "Private rental (flatshare)", detail: "Use Domain or RealEstate.com.au. Budget 4–8 weeks bond + 2 weeks rent upfront.", link: "https://www.domain.com.au/", linkLabel: "Domain" },
      { id: "h3", label: "Purpose-built student accommodation (PBSA)", detail: "Y Suites, Scape, Urbanest, UniLodge — furnished, bills included, easier for international students." },
      { id: "h4", label: "Short-term arrival stay (Airbnb / hostel)", detail: "Book 1–2 weeks while you inspect rentals in person." },
      { id: "h5", label: "Sign tenancy agreement + pay bond", detail: "Bond is lodged with the state RTBA — never pay cash to a private landlord without a receipt." },
      { id: "h6", label: "Arrange airport pickup", detail: "University welcome bus, Aerocard, or pre-booked transfer." },
    ],
  },
  {
    id: "oshc",
    title: "OSHC insurance",
    icon: "M12 3l8 4v6c0 4.5-3.5 7.8-8 9-4.5-1.2-8-4.5-8-9V7zM9 12l2 2 4-4",
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
    deadlineHint: "Mandatory for the whole visa duration — buy before visa grant.",
    items: [
      { id: "o1", label: "Compare OSHC providers", detail: "Allianz, Medibank, Bupa, NIB, ahm, CBHS. Price differs ~$100–200/yr for equivalent cover.", link: "https://www.studyaustralia.gov.au/en/living-in-australia/insurance", linkLabel: "Compare on Study Australia" },
      { id: "o2", label: "Buy OSHC for full visa duration", detail: "Visa requires cover for course length + 1 extra month. Pay upfront gets a discount." },
      { id: "o3", label: "Save OSHC policy number + card", detail: "You need it at the airport and for Medicare-alternative billing." },
      { id: "o4", label: "Understand what's covered", detail: "Ambulance, GP, hospital, some dental/eye. Emergency is covered; routine dental usually is not." },
    ],
  },
  {
    id: "flights",
    title: "Flights & arrival",
    icon: "M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8l3 3m0-14l-3 3m-8 8l-3 3",
    tone: "bg-violet-50 text-violet-700 ring-violet-200/60",
    deadlineHint: "Book 6–10 weeks out. Student fares often cheaper with STA Travel / StudentUniverse.",
    items: [
      { id: "f1", label: "Book flights + print e-ticket", detail: "Carry printed CoE, OSHC receipt, offer letter in hand luggage for immigration." },
      { id: "f2", label: "Baggage: check airline student allowance", detail: "Many carriers give +5–10 kg for students. Weigh before you leave." },
      { id: "f3", label: "Currency card + AUD cash", detail: "Load a multi-currency card (Wise / Revolut). Carry ~AUD 300–500 cash for the first week." },
      { id: "f4", label: "Download arrival apps", detail: "SkyBus / airport transport, Uber, your OSHC provider app, university orientation app." },
      { id: "f5", label: "eVisitor / ETA if transiting", detail: "Some layovers (Singapore, KL, Dubai) need a transit visa — check before booking." },
    ],
  },
  {
    id: "banking",
    title: "Banking, TFN & phone",
    icon: "M3 7h18v12H3zM3 7l2-3h14l2 3M7 12h4",
    tone: "bg-amber-50 text-amber-700 ring-amber-200/60",
    deadlineHint: "Open a bank account in the first 2 weeks — you need it for rent and pay.",
    items: [
      { id: "b1", label: "Open an Australian bank account", detail: "Commonwealth (CBA), Westpac, ANZ, NIB. Most allow pre-open from overseas with your passport." },
      { id: "b2", label: "Apply for TFN (Tax File Number)", detail: "Free via ATO — needed to avoid being taxed at the highest rate on part-time work.", link: "https://www.ato.gov.au/individuals-and-families/tax-file-number", linkLabel: "ATO TFN" },
      { id: "b3", label: "Get an Australian SIM", detail: "Telstra (best regional coverage), Optus, Vodafone. Prepaid is easiest for the first month." },
      { id: "b4", label: "Set up PayID / PayTo", detail: "Instant bank transfers — standard for rent and splitting bills with flatmates." },
      { id: "b5", label: "Understand part-time work rights", detail: "Student visa: 48 hrs/fortnight during term, unlimited in breaks. TFN lets you claim the correct tax rate." },
    ],
  },
  {
    id: "packing",
    title: "Packing & documents",
    icon: "M4 7h16v13H4zM8 7V5a4 4 0 018 0v2",
    tone: "bg-rose-50 text-rose-700 ring-rose-200/60",
    deadlineHint: "Carry critical documents in hand luggage — never in checked bags.",
    items: [
      { id: "p1", label: "Passport (6+ months validity)", detail: "Plus 4 passport-size photos (Australian specs: white background)." },
      { id: "p2", label: "CoE + offer letter + visa grant notice", detail: "Printed + PDF on your phone. Immigration may ask at the gate." },
      { id: "p3", label: "Academic transcripts + degree certificates", detail: "Originals + 3 photocopies. Some employers and unis ask for certified copies." },
      { id: "p4", label: "English test score report", detail: "IELTS/PTE/TOEFL printed — you may need it for bank or rental applications." },
      { id: "p5", label: "OSHC receipt + policy number", detail: "Printed card in your wallet." },
      { id: "p6", label: "Prescriptions + medical records", detail: "Bring a doctor's letter for any regular medication. Some drugs are restricted in Australia." },
      { id: "p7", label: "Clothing for the season", detail: "Australia's seasons are flipped — Feb/Jul intakes land mid-season." },
      { id: "p8", label: "Adapters (Type I plug)", detail: "Australia uses angled 3-pin. Bring 2 adapters + a power bank." },
      { id: "p9", label: "Small AUD cash + international driving permit", detail: "IDP needed if you plan to drive — get it before you leave." },
    ],
  },
];

const LS_KEY = "sa_predeparture_v1";

function loadChecked(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

export default function PreDeparture() {
  const [checked, setChecked] = useState<Record<string, boolean>>(loadChecked);
  const [openSection, setOpenSection] = useState<string | null>(SECTIONS[0].id);
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all");

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(checked));
    } catch {}
  }, [checked]);

  const stats = useMemo(() => {
    const all = SECTIONS.flatMap((s) => s.items);
    const done = all.filter((i) => checked[i.id]).length;
    return { total: all.length, done, pct: Math.round((done / all.length) * 100) };
  }, [checked]);

  const sectionStats = useMemo(
    () =>
      Object.fromEntries(
        SECTIONS.map((s) => {
          const done = s.items.filter((i) => checked[i.id]).length;
          return [s.id, { done, total: s.items.length }];
        }),
      ),
    [checked],
  );

  function toggle(id: string) {
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }

  const visible = SECTIONS.filter((s) => {
    if (filter === "todo") return s.items.some((i) => !checked[i.id]);
    if (filter === "done") return s.items.some((i) => checked[i.id]);
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Pre-departure"
        subtitle="Everything between accepting your offer and landing in Australia — housing, insurance, flights, banking and documents."
        right={
          <div className="flex gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1">
              {stats.done}/{stats.total} done
            </span>
          </div>
        }
      />

      {/* Progress bar */}
      <Card className="mb-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-slate-700">Overall readiness</span>
          <span className="text-2xl font-extrabold text-emerald-700">{stats.pct}%</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${stats.pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {stats.total - stats.done === 0
            ? "All done — safe travels!"
            : `${stats.total - stats.done} items left. Tick them off as you go.`}
        </p>
      </Card>

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        {(["all", "todo", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cx(
              "rounded-full border px-3.5 py-1.5 text-xs font-bold capitalize transition",
              filter === f
                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-300",
            )}
          >
            {f === "todo" ? "To do" : f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="border-dashed border-slate-300/80 py-10 text-center text-sm text-slate-500">
          Nothing matches this filter.
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((s) => {
            const st = sectionStats[s.id];
            const open = openSection === s.id;
            return (
              <Card key={s.id} className="overflow-hidden">
                <button
                  onClick={() => setOpenSection(open ? null : s.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                  aria-expanded={open}
                >
                  <div className="flex items-center gap-3">
                    <span className={cx("flex size-10 items-center justify-center rounded-xl ring-1", s.tone)}>
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                        <path d={s.icon} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900">{s.title}</h3>
                      <p className="text-xs text-slate-500">
                        {st.done}/{st.total} done — {s.deadlineHint}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cx(
                        st.done === st.total
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600",
                      )}
                    >
                      {st.done === st.total ? "Complete" : `${st.total - st.done} left`}
                    </Badge>
                    <svg
                      viewBox="0 0 24 24"
                      className={cx("size-5 text-slate-400 transition-transform", open && "rotate-180")}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>

                {open ? (
                  <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {s.items.map((item) => {
                      const on = !!checked[item.id];
                      return (
                        <li key={item.id}>
                          <label
                            className={cx(
                              "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 transition",
                              on
                                ? "border-emerald-100 bg-emerald-50/60"
                                : "border-slate-200/80 bg-white/60 hover:border-emerald-200",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggle(item.id)}
                              className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-emerald-600"
                            />
                            <div className="min-w-0">
                              <p className={cx("text-sm font-semibold", on ? "text-slate-500 line-through" : "text-slate-800")}>
                                {item.label}
                              </p>
                              {item.detail ? <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p> : null}
                              {item.link ? (
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                                >
                                  {item.linkLabel ?? "Open"} ↗
                                </a>
                              ) : null}
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-6 border-sky-200/60 bg-gradient-to-r from-sky-50 to-cyan-50/60">
        <h3 className="font-bold text-slate-900">Need a hand with any of this?</h3>
        <p className="mt-1 text-sm text-slate-600">
          Book a counsellor session for housing shortlists, OSHC comparisons or arrival logistics — they do this every intake.
        </p>
        <div className="mt-3 flex gap-2">
          <Link to="/counsellors">
            <Button variant="ghost" className="text-xs">
              Find a counsellor
            </Button>
          </Link>
          <Link to="/bookings">
            <Button variant="ghost" className="text-xs">
              My bookings
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

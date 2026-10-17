/** Rough monthly student living costs per city, in AUD — planning estimates only, not official. */
export interface CityCost {
  city: string;
  country: string;
  /** 1-bed share / room in a shared flat, city area, AUD/month */
  rent: number;
  utilities: number;
  groceries: number;
  transport: number;
  entertainment: number;
  sourceNote: string;
}

export const CITY_COSTS: CityCost[] = [
  { city: "Melbourne", country: "Australia", rent: 1450, utilities: 210, groceries: 460, transport: 170, entertainment: 250, sourceNote: "Estimate — check studyaustralia.gov.au + flatmates.com.au" },
  { city: "Sydney", country: "Australia", rent: 1750, utilities: 220, groceries: 490, transport: 190, entertainment: 280, sourceNote: "Estimate — check studyaustralia.gov.au + flatmates.com.au" },
  { city: "Brisbane", country: "Australia", rent: 1350, utilities: 220, groceries: 450, transport: 160, entertainment: 240, sourceNote: "Estimate — check studyaustralia.gov.au" },
  { city: "Perth", country: "Australia", rent: 1300, utilities: 230, groceries: 470, transport: 170, entertainment: 230, sourceNote: "Estimate — check studyaustralia.gov.au" },
  { city: "Adelaide", country: "Australia", rent: 1150, utilities: 210, groceries: 430, transport: 150, entertainment: 210, sourceNote: "Estimate — check studyaustralia.gov.au" },
  { city: "Auckland", country: "New Zealand", rent: 1400, utilities: 230, groceries: 480, transport: 160, entertainment: 240, sourceNote: "Estimate — check studywithnewzealand.govt.nz" },
  { city: "Wellington", country: "New Zealand", rent: 1350, utilities: 240, groceries: 470, transport: 150, entertainment: 230, sourceNote: "Estimate — check studywithnewzealand.govt.nz" },
  { city: "London", country: "United Kingdom", rent: 2100, utilities: 260, groceries: 520, transport: 250, entertainment: 320, sourceNote: "Estimate — check gov.uk + unipol" },
  { city: "Manchester", country: "United Kingdom", rent: 1350, utilities: 250, groceries: 460, transport: 170, entertainment: 250, sourceNote: "Estimate — check gov.uk + unipol" },
  { city: "Toronto", country: "Canada", rent: 1700, utilities: 230, groceries: 500, transport: 190, entertainment: 260, sourceNote: "Estimate — check canada.ca + school cost pages" },
  { city: "Vancouver", country: "Canada", rent: 1850, utilities: 220, groceries: 520, transport: 180, entertainment: 270, sourceNote: "Estimate — check canada.ca + school cost pages" },
  { city: "Boston", country: "United States", rent: 2200, utilities: 250, groceries: 560, transport: 200, entertainment: 330, sourceNote: "Estimate — check educationusa.state.gov + school cost pages" },
];

export const COST_CATEGORIES = [
  { key: "rent", label: "Rent (shared)" },
  { key: "utilities", label: "Utilities & internet" },
  { key: "groceries", label: "Groceries" },
  { key: "transport", label: "Transport" },
  { key: "entertainment", label: "Everyday & entertainment" },
] as const;

export function cityTotal(c: CityCost): number {
  return c.rent + c.utilities + c.groceries + c.transport + c.entertainment;
}

export type Role = "student" | "counsellor" | "admin";
export type BookingStatus = "pending" | "paid" | "scheduled" | "completed" | "cancelled";

export interface Profile {
  id: string;
  role: Role;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  email_digest_enabled?: boolean;
  reminder_lead_days?: number;
}

export interface StudentProfile {
  user_id: string;
  intended_major: string | null;
  class_10_marks: number | null;
  class_12_marks: number | null;
  grading_system: string | null;
  ielts: number | null;
  toefl: number | null;
  pte: number | null;
  sat: number | null;
  budget_aud_per_year: number | null;
  needs_scholarship: boolean;
  preferred_cities: string[];
  priorities_ranked: string[];
  career_goal: string | null;
  resume_url: string | null;
  share_consent: boolean;
  share_consent_at: string | null;
  shortlist_reviewed_at: string | null;
  shared_with_counsellor_at: string | null;
  is_complete: boolean;
  linkedin_url: string | null;
  community_joined_at: string | null;
  updated_at: string;
}

export interface University {
  id: string;
  name: string;
  country: string;
  city: string | null;
  state: string | null;
  cricos_code: string | null;
  qs_rank: number | null;
  the_rank: number | null;
  cs_subject_rank: number | null;
  tuition_aud: number | null;
  living_cost_aud: number | null;
  ielts_min: number | null;
  toefl_min: number | null;
  pte_min: number | null;
  min_academic_requirement: string | null;
  intakes: string[];
  cs_program_highlights: string | null;
  post_study_work_years: number | null;
  data_year: number | null;
  confidence: string;
  sources: { label?: string; url?: string }[];
  image_url: string | null;
  about: string | null;
  updated_at: string;
}

export interface UniversityReview {
  id: string;
  student_id: string;
  university_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface Scholarship {
  id: string;
  university_id: string;
  name: string;
  amount: string | null;
  coverage: string | null;
  eligibility: string | null;
  international_eligible: boolean;
  deadline: string | null;
  url: string | null;
  study_level: "ug" | "pg" | "both";
  category: "merit" | "need" | "both";
  amount_aud: number | null;
}

export type Tier = "reach" | "target" | "safety";

export interface ShortlistItem {
  university_id: string;
  name: string;
  tier: Tier;
  fit_score: number;
  reasoning: string;
  tuition_aud?: number | null;
  living_cost_aud?: number | null;
  post_study_work_years?: number | null;
  intakes?: string[];
  scholarship_ids?: string[];
}

export interface ShortlistResult {
  model_version?: string;
  generated_at?: string;
  summary?: string;
  items: ShortlistItem[];
  ruled_out?: { name: string; reason: string }[];
}

export interface Shortlist {
  id: string;
  student_id: string;
  generated_at: string;
  result: ShortlistResult;
  model_version: string | null;
}

export interface Counsellor {
  id: string;
  user_id: string;
  bio: string | null;
  specialisation: string | null;
  price_inr: number;
  is_active: boolean;
  display_name: string | null;
  profiles?: Profile | null;
}

export interface Booking {
  id: string;
  student_id: string;
  counsellor_id: string;
  status: BookingStatus;
  scheduled_at: string | null;
  payment_id: string | null;
  razorpay_order_id: string | null;
  amount_inr: number;
  created_at: string;
  student_request?: "cancel" | "reschedule" | null;
  student_request_note?: string | null;
  student_requested_at?: string | null;
  counsellors?: Counsellor | null;
  profiles?: Profile | null;
}

export interface CounsellorNote {
  id: string;
  booking_id: string;
  counsellor_id: string;
  note: string;
  created_at: string;
}

export type ApplicationStatus =
  | "Not Started"
  | "Preparing Documents"
  | "Ready to Apply"
  | "Application Submitted"
  | "Awaiting Decision"
  | "Offer Received"
  | "Waitlisted"
  | "Rejected"
  | "Withdrawn";

export interface ApplicationDocument {
  id: string;
  application_id: string;
  label: string;
  done: boolean;
  created_at: string;
}

export interface StudentChecklistItem {
  id: string;
  student_id: string;
  label: string;
  done: boolean;
  created_at: string;
}

export interface Application {
  id: string;
  student_id: string;
  university_id: string | null;
  program: string | null;
  portal_url: string | null;
  admission_deadline: string | null;
  required_documents: string[];
  application_fee_aud: number | null;
  scholarship_deadline: string | null;
  status: ApplicationStatus;
  submitted_at: string | null;
  interview_notes: string | null;
  admission_decision: string | null;
  fee_paid_aud: number | null;
  fee_paid_on: string | null;
  offer_received_on: string | null;
  offer_accept_by: string | null;
  coe_issued_on: string | null;
  created_at: string;
  updated_at: string;
}

export type DocCategory =
  | "Passport"
  | "Academic"
  | "English test"
  | "Financial"
  | "Offer letter"
  | "LOR"
  | "Identity"
  | "Other";

export interface StudentDocument {
  id: string;
  student_id: string;
  category: DocCategory;
  label: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  doc_date: string | null;
  expires_on: string | null;
  created_at: string;
}

export type LorStatus = "draft" | "requested" | "agreed" | "submitted" | "declined";

export interface LorRequest {
  id: string;
  student_id: string;
  recommender_name: string;
  recommender_email: string | null;
  relationship: string | null;
  due_date: string | null;
  status: LorStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SopVersion {
  id: string;
  student_id: string;
  label: string;
  answers: Record<string, string>;
  word_count: number;
  created_at: string;
}

export interface InterviewPractice {
  id: string;
  student_id: string;
  interview_type: string;
  question: string;
  answer: string;
  score: number | null;
  feedback: string;
  created_at: string;
}

export interface VisaChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface VisaChecklist {
  id: string;
  application_id: string;
  country: string;
  items: VisaChecklistItem[];
  created_at: string;
  updated_at: string;
}

export interface OfferCondition {
  id: string;
  application_id: string;
  label: string;
  met: boolean;
  met_on: string | null;
  created_at: string;
}

export type RoadmapStatus = "pending" | "in_progress" | "done" | "skipped";

export interface RoadmapTaskRow {
  id: string;
  student_id: string;
  title: string;
  description: string | null;
  category: string;
  due_date: string | null;
  start_date: string | null;
  hours_per_week: number | null;
  status: RoadmapStatus;
  completed_at: string | null;
  proof_url: string | null;
  gap_id: string | null;
  intensity: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GapReportRow {
  id: string;
  student_id: string;
  report: unknown;
  created_at: string;
}

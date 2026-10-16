-- AI review + draft artefacts for the SOP questionnaire
alter table public.sop_responses
  add column ai_review jsonb,
  add column ai_reviewed_at timestamptz,
  add column ai_draft text,
  add column ai_draft_at timestamptz;

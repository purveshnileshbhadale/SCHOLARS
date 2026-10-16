-- Structured scholarship fields for profile-based matching on the
-- Scholarships page ("Match my profile"). Backfill is conservative:
-- unknowns stay at the neutral default.

alter table public.scholarships
  add column if not exists study_level text not null default 'both'
    check (study_level in ('ug', 'pg', 'both')),
  add column if not exists category text not null default 'both'
    check (category in ('merit', 'need', 'both')),
  add column if not exists amount_aud integer;

-- Numeric amount (lower bound when a range) from text like "AUD 5,000 – 40,000".
update public.scholarships
set amount_aud = nullif(regexp_replace(substring(amount from 'AUD\s*([0-9,]+)'), ',', '', 'g'), '')::integer
where amount_aud is null
  and amount ~ 'AUD\s*[0-9,]+';

-- Category from wording in the seeded eligibility/coverage text.
update public.scholarships
set category = 'merit'
where category = 'both'
  and (coalesce(eligibility, '') || ' ' || coalesce(coverage, '') || ' ' || name)
      ~* 'merit|academic|high-achiev|top-|top |strong |competitive|first year';

update public.scholarships
set category = 'need'
where category = 'both'
  and (coalesce(eligibility, '') || ' ' || coalesce(coverage, ''))
      ~* 'financial need|need-based|low.income';

-- "Merit + need" wording means both.
update public.scholarships
set category = 'both'
where eligibility ~* '\+| and ';

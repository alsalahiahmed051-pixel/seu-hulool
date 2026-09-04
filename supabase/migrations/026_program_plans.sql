-- The study plan, level by level, for each programme.
--
-- It shipped hard-coded for إدارة أعمال because that is the only plan we had.
-- Every other programme needs the same thing, and only the owner holds those
-- lists — so the plan belongs in the database with an editor, not in a constant
-- that needs a deploy (and a transcription) per programme.
--
-- `levels` is an ordered array rather than an object: level order is meaningful
-- ("المستوى الثالث" before "الرابع") and JSON object key order is not a thing
-- to rely on.
--   [{ "label": "المستوى الثالث", "courses": ["STAT101", ...] }, ...]
create table if not exists public.program_plans (
  program     text primary key,
  levels      jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.program_plans enable row level security;
-- No policy: reached only through the service role, like every other table here.

insert into public.program_plans (program, levels) values (
  'إدارة أعمال',
  '[
    {"label":"المستوى الثالث","courses":["STAT101","LAW101","ECON101","MGT101","ACCT101"]},
    {"label":"المستوى الرابع","courses":["STAT201","FIN101","MGT201","MGT211","ECOM101"]},
    {"label":"المستوى الخامس","courses":["ECON201","MIS201","ECOM201","MGT301","MGT311","MGT312"]},
    {"label":"المستوى السادس","courses":["ACCT301","MGT321","MGT322","MGT323"]},
    {"label":"المستوى السابع","courses":["MGT401","MGT324","MGT402","MGT403"]},
    {"label":"المستوى الثامن","courses":["MGT404","MGT421","MGT422","MGT430"]}
  ]'::jsonb
)
on conflict (program) do nothing;

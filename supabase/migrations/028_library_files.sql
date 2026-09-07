-- The uploaded-files library, as rows.
--
-- It used to be ONE JSON object in blob storage. When that single object became
-- unreadable, a library of thirty-three files reported itself as zero and the
-- whole platform looked empty — there was no partial failure available, only
-- total. Rows remove that failure class: one bad row costs one file.
--
-- It is also free and permanent, which is the point: the blob store reached its
-- plan's usage limit and was SUSPENDED for a month, taking the library offline.
--
-- Named `library_files` and not `files` on purpose: an unused `files` table from
-- the original schema still exists, keyed to a `courses` table the site stopped
-- reading long ago. Reusing that name would put two different meanings on one
-- word in the same database.
create table if not exists public.library_files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  course_name text not null,
  category text not null,
  -- Where the bytes are. `provider` lets the files already sitting in Vercel
  -- keep working while new uploads go to Supabase, so nothing has to move in
  -- one jump — and the old ones can be copied across later without a rewrite.
  provider text not null default 'supabase',
  storage_path text,
  blob_url text,
  size bigint not null default 0,
  uploaded_at timestamptz not null default now(),
  downloads integer not null default 0,
  -- What the assistant can read of it. The extracted text lives here too: it is
  -- what every answer is grounded in, and keeping it beside the record means one
  -- read instead of a second object that can fail on its own.
  indexed boolean,
  indexed_chars integer not null default 0,
  indexed_at timestamptz,
  index_error text,
  extracted_text text,
  recovered boolean not null default false
);

create index if not exists library_files_course_idx on public.library_files (course_name);
create index if not exists library_files_category_idx on public.library_files (category);
create index if not exists library_files_uploaded_idx on public.library_files (uploaded_at desc);

-- Deny-all, matching every other table here: reached only through the service
-- role in route handlers, never from the browser.
alter table public.library_files enable row level security;

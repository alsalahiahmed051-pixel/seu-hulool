-- An approved track change must be spendable exactly once, and that fact has
-- to live on the server: it was recorded only in the browser's own profile
-- (`approvalUsedAt`), so clearing site data — or simply opening the site on a
-- second device — handed the student the same approval again.
alter table public.track_requests
  add column if not exists consumed_at timestamptz;

-- The lookup the identity route runs on every locked save: the newest approved
-- and unspent request for this student.
create index if not exists track_requests_approval_lookup_idx
  on public.track_requests (student_id, status, consumed_at, created_at desc);

create index if not exists track_requests_approval_device_idx
  on public.track_requests (device_id, status, consumed_at, created_at desc);

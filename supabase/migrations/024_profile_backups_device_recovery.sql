-- A student who forgets their SEU-XXXXXX has no way back in: the code is the
-- only key and there is no email to send it to. Recording which device wrote a
-- backup lets that same device ask "which codes are mine?" — the common case of
-- a forgotten code is the phone the student still holds.
alter table public.profile_backups
  add column if not exists device_id text;

create index if not exists profile_backups_device_id_idx
  on public.profile_backups (device_id)
  where device_id is not null;

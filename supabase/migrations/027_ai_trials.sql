-- The assistant's browse trial, counted on the server.
--
-- It used to be a localStorage number, so clearing site data or opening a
-- private window handed out a fresh trial. The count lives here now, keyed by
-- identities the page cannot edit: a signed HttpOnly device cookie, and a
-- hashed caller IP.
--
-- One table, two namespaces in the key:
--   d:<deviceId>        permanent — this is the trial itself
--   i:<ipHash>:<day>    a daily ceiling, not a trial
--
-- Why the IP key is daily and looser: a campus or a mobile carrier puts
-- thousands of students behind one address. A strict per-IP trial would tell
-- the second student on that network that they had used a trial they never
-- saw. The IP bound exists to stop one person farming the trial across
-- devices, not to identify a person.
--
-- Raw IPs are never stored — only an HMAC, matching ipHash in the app.
create table if not exists public.ai_trials (
  key      text primary key,
  used     integer not null default 0,
  first_at timestamptz not null default now(),
  last_at  timestamptz not null default now()
);

-- For pruning the daily IP rows, which are the only ones that ever go stale.
create index if not exists ai_trials_last_at_idx on public.ai_trials (last_at);

-- Deny-all: no policies, so only the service role reaches this. Same posture
-- as quiz_trials.
alter table public.ai_trials enable row level security;

-- Spend one trial question, against every identity at once.
--
-- `p_keys[i]` is allowed `p_limits[i]`. The claim is refused if ANY key has
-- reached its limit, and when allowed every key is incremented — so the device
-- count and the IP ceiling can never drift apart.
--
-- Returns the FIRST key's numbers (the device's), because that is the trial
-- the student is shown.
create or replace function public.claim_ai_trial(p_keys text[], p_limits integer[])
returns table(allowed boolean, used integer, remaining integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  i           integer;
  cur         integer;
  blocked     boolean := false;
  first_used  integer := 0;
  first_limit integer := 0;
begin
  if p_keys is null
     or array_length(p_keys, 1) is null
     or array_length(p_keys, 1) <> coalesce(array_length(p_limits, 1), -1) then
    return query select false, 0, 0;
    return;
  end if;

  -- Serialise per key, taken in sorted order so two callers sharing an IP key
  -- cannot deadlock on each other. Without this, two questions sent together
  -- both read "one left" and both proceed.
  perform pg_advisory_xact_lock(hashtext(k))
  from (select unnest(p_keys) as k order by 1) s;

  for i in 1 .. array_length(p_keys, 1) loop
    select coalesce(t.used, 0) into cur from ai_trials t where t.key = p_keys[i];
    cur := coalesce(cur, 0);
    if i = 1 then
      first_used  := cur;
      first_limit := p_limits[i];
    end if;
    if cur >= p_limits[i] then
      blocked := true;
    end if;
  end loop;

  if blocked then
    return query select false, first_used, 0;
    return;
  end if;

  for i in 1 .. array_length(p_keys, 1) loop
    insert into ai_trials (key, used) values (p_keys[i], 1)
    on conflict (key) do update set used = ai_trials.used + 1, last_at = now();
  end loop;

  return query select true, first_used + 1, greatest(0, first_limit - (first_used + 1));
end;
$$;

-- What is left, without spending anything. Used to render the trial bar.
create or replace function public.peek_ai_trial(p_keys text[], p_limits integer[])
returns table(allowed boolean, used integer, remaining integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  i           integer;
  cur         integer;
  blocked     boolean := false;
  first_used  integer := 0;
  first_limit integer := 0;
begin
  if p_keys is null
     or array_length(p_keys, 1) is null
     or array_length(p_keys, 1) <> coalesce(array_length(p_limits, 1), -1) then
    return query select false, 0, 0;
    return;
  end if;

  for i in 1 .. array_length(p_keys, 1) loop
    select coalesce(t.used, 0) into cur from ai_trials t where t.key = p_keys[i];
    cur := coalesce(cur, 0);
    if i = 1 then
      first_used  := cur;
      first_limit := p_limits[i];
    end if;
    if cur >= p_limits[i] then
      blocked := true;
    end if;
  end loop;

  return query select (not blocked), first_used, greatest(0, first_limit - first_used);
end;
$$;

-- Drop the daily IP rows once they can no longer matter.
create or replace function public.prune_ai_trials()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  delete from ai_trials where key like 'i:%' and last_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

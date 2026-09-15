-- Give back a free quiz that never produced a quiz.
--
-- `claim_quiz_trial` inserts the row BEFORE anything is generated, which is the
-- right shape for the race it guards — two quizzes started together must not
-- both read "no row" and both proceed. But the route then had two ways to end
-- without handing over a single question: the course had no indexed files, or
-- every provider refused. Either way the student's one free quiz was already
-- spent, and the next attempt met «استخدمت اختبارك التجريبي المجاني».
--
-- Half the trials on the live table were burned exactly that way: sources that
-- name uploaded material, on courses that have none. The student saw a quiz
-- that refused and then a site that said they had used their turn.
--
-- So the claim becomes a reservation: kept when a quiz is delivered, released
-- when it is not. The route only calls this for a row it claimed in that same
-- request, so this can never return someone else's spent turn.
create or replace function public.release_quiz_trial(p_owner text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare released boolean;
begin
  delete from quiz_trials where owner_key = p_owner;
  get diagnostics released = row_count;
  return released;
end;
$$;

revoke all on function public.release_quiz_trial(text) from public, anon, authenticated;

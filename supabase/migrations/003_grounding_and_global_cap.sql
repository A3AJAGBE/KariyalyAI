-- 003_grounding_and_global_cap.sql
-- Adds what PROJECT_CONTEXT.md (section 6 and 8) needs on top of 001_init.sql:
--   1. ai_usage.grounded: marks calls that used Gemini search grounding.
--   2. global_ai_usage_today(): shared daily count across all users, so the
--      Netlify function can enforce GLOBAL_DAILY_AI_CAP and
--      GLOBAL_DAILY_GROUNDED_CAP without the service role key.
--
-- Safe to run more than once.

-- 1. Grounding flag on usage rows
alter table public.ai_usage
  add column if not exists grounded boolean not null default false;

-- Speeds up the shared daily count (a scan over today's rows only)
create index if not exists ai_usage_created_at_idx
  on public.ai_usage (created_at);

-- 2. Shared daily usage counter
-- security definer: runs with the owner's rights so it can count every user's
-- rows despite row level security. It returns a single integer and exposes no
-- rows, task names or user ids.
create or replace function public.global_ai_usage_today(grounded_only boolean default false)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.ai_usage
  where created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
    and (not grounded_only or grounded);
$$;

-- Only signed-in users may call it (the function calls it with the user's token)
revoke all on function public.global_ai_usage_today(boolean) from public;
revoke all on function public.global_ai_usage_today(boolean) from anon;
grant execute on function public.global_ai_usage_today(boolean) to authenticated;

-- How the Netlify function uses it (for reference, not executed here):
--   const { data: total }    = await supabase.rpc('global_ai_usage_today', { grounded_only: false });
--   const { data: grounded } = await supabase.rpc('global_ai_usage_today', { grounded_only: true });
--   if (total >= GLOBAL_DAILY_AI_CAP) return BUSY;
--   if (task === 'company_brief' && grounded >= GLOBAL_DAILY_GROUNDED_CAP) -> use the pasted-text fallback.
-- When recording a grounded call, insert the ai_usage row with grounded = true.

-- 3. delete_my_data() must also clear the AI cache (added in 002_ai_cache.sql).
-- ai_cache.response holds AI output derived from the user's CV and jobs, so "Delete my
-- data" has to remove it. 001_init.sql's version of this function predates the table.
create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.ai_cache          where user_id = uid;
  delete from public.generated_outputs where user_id = uid;
  delete from public.matches           where user_id = uid;
  delete from public.applications      where user_id = uid;  -- cascades to status history
  delete from public.jobs              where user_id = uid;
  delete from public.ai_usage          where user_id = uid;
  delete from public.profiles          where user_id = uid;
end;
$$;

revoke execute on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

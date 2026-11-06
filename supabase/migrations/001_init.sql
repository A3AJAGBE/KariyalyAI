-- KariyalyAI: initial schema
-- Run once in the Supabase SQL editor (or via the Supabase CLI as a migration).
-- Contents: extensions, helper functions, tables, indexes, triggers, RLS, RPCs.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Generic updated_at trigger function.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Normalise an organisation name for fuzzy matching:
-- lowercase, non-alphanumerics to spaces, drop company suffixes, collapse spaces.
create or replace function public.normalise_org_name(n text)
returns text
language sql
immutable
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(coalesce(n, '')), '[^a-z0-9]+', ' ', 'g'),
        '\m(limited|ltd|plc|llp|inc|incorporated|corp|corporation)\M', ' ', 'g'),
      '\s+', ' ', 'g')
  );
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per user. user_id is the primary key.
create table public.profiles (
  user_id                  uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  full_name                text not null default '',
  email                    text not null default '',
  summary                  text not null default '',
  skills                   text[] not null default '{}',
  target_roles             text[] not null default '{}',
  experience               jsonb not null default '[]'::jsonb,  -- [{company,title,start,end,bullets[]}]
  education                jsonb not null default '[]'::jsonb,  -- [{institution,degree,year}]
  country_of_residence     text,                                -- asked explicitly, never inferred
  right_to_work_countries  text[] not null default '{}',        -- asked explicitly, never inferred
  raw_cv_text              text,
  cv_file_path             text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.jobs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title             text not null default '',
  company           text not null default '',
  location_text     text not null default '',
  location_country  text,                  -- country name or null, never a guess
  is_remote         boolean,
  description_text  text not null,
  source_url        text,                  -- stored only, never fetched
  created_at        timestamptz not null default now()
);
create index jobs_user_created_idx on public.jobs (user_id, created_at desc);

-- One match per (user, job). Re-running replaces the row.
create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id      uuid not null references public.jobs (id) on delete cascade,
  score       int  not null check (score between 0 and 100),
  verdict     text not null check (verdict in ('strong', 'moderate', 'weak')),
  summary     text not null default '',
  strengths   jsonb not null default '[]'::jsonb,
  gaps        jsonb not null default '[]'::jsonb,   -- [{gap,suggestion}]
  work_auth   jsonb,                                -- WorkAuthResult (see shared/schemas.ts)
  input_hash  text,                                 -- cache key for the match_job task
  created_at  timestamptz not null default now(),
  unique (user_id, job_id)
);
create index matches_user_hash_idx on public.matches (user_id, input_hash);

-- Generated text per job. tailor_application writes two rows (cv_summary and
-- cover_letter) that share the same input_hash.
create table public.generated_outputs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id          uuid references public.jobs (id) on delete cascade,
  kind            text not null check (kind in ('cv_summary', 'cover_letter', 'company_brief', 'outreach')),
  content         jsonb not null,            -- as generated
  edited_content  text,                      -- the user's edits
  meta            jsonb not null default '{}'::jsonb,  -- tone, channel, message_type
  input_hash      text not null,             -- sha256 of task + canonical input
  created_at      timestamptz not null default now(),
  unique (user_id, input_hash, kind)
);
create index generated_outputs_job_idx on public.generated_outputs (user_id, job_id);

create table public.applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id      uuid references public.jobs (id) on delete set null,
  company     text not null,
  role        text not null,
  notes       text not null default '',
  status      text not null default 'saved'
              check (status in ('saved', 'applied', 'interview', 'offer', 'rejected')),
  applied_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index applications_user_status_idx on public.applications (user_id, status);

-- Append-only. Rows are written only by the trigger below, never by the client.
create table public.application_status_history (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications (id) on delete cascade,
  from_status     text check (from_status in ('saved', 'applied', 'interview', 'offer', 'rejected')),
  to_status       text not null check (to_status in ('saved', 'applied', 'interview', 'offer', 'rejected')),
  changed_at      timestamptz not null default now()
);
create index status_history_app_idx on public.application_status_history (application_id, changed_at desc);

-- Used only for rate limiting in the ai function.
create table public.ai_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task        text not null,
  created_at  timestamptz not null default now()
);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

-- UK sponsor register (loaded by scripts/load_sponsors.ts using the service role key).
create table public.sponsor_register (
  id             uuid primary key default gen_random_uuid(),
  org_name       text not null,
  org_name_norm  text generated always as (public.normalise_org_name(org_name)) stored,
  town           text,
  county         text,
  route          text,
  type_rating    text,
  created_at     timestamptz not null default now()
);
create index sponsor_register_name_trgm_idx
  on public.sponsor_register using gin (org_name_norm extensions.gin_trgm_ops);

-- Exactly one row: the date of the register CSV currently loaded.
create table public.sponsor_register_meta (
  id             boolean primary key default true check (id),
  register_date  date not null
);

-- ---------------------------------------------------------------------------
-- Application triggers: applied_at, updated_at and status history
-- ---------------------------------------------------------------------------

create or replace function public.applications_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'applied' and new.applied_at is null then
    new.applied_at := now();
  end if;
  return new;
end;
$$;

create trigger applications_before_write
  before insert or update on public.applications
  for each row execute function public.applications_before_write();

-- security definer so the insert into history is not blocked by RLS.
create or replace function public.applications_log_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (application_id, from_status, to_status)
    values (new.id, null, new.status);
  elsif new.status is distinct from old.status then
    insert into public.application_status_history (application_id, from_status, to_status)
    values (new.id, old.status, new.status);
  end if;
  return null;
end;
$$;

create trigger applications_log_status
  after insert or update of status on public.applications
  for each row execute function public.applications_log_status();

revoke execute on function public.applications_log_status() from public;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles                    enable row level security;
alter table public.jobs                        enable row level security;
alter table public.matches                     enable row level security;
alter table public.generated_outputs           enable row level security;
alter table public.applications                enable row level security;
alter table public.application_status_history  enable row level security;
alter table public.ai_usage                    enable row level security;
alter table public.sponsor_register            enable row level security;
alter table public.sponsor_register_meta       enable row level security;

-- User-owned tables: full access to your own rows only.
create policy "own rows" on public.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.jobs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.matches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.generated_outputs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.applications for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.ai_usage for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Status history: read-only for the owner of the parent application.
-- There is deliberately no insert/update/delete policy: the trigger writes it,
-- and deleting an application cascades to its history.
create policy "read own history" on public.application_status_history for select to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = (select auth.uid())
  ));

-- Sponsor register: read-only for any signed-in user. Writes use the service role key.
create policy "read register" on public.sponsor_register for select to authenticated using (true);
create policy "read register meta" on public.sponsor_register_meta for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Best fuzzy match for a company name. The caller applies the threshold
-- (0.6 or higher means likely_licensed). The % operator only pre-filters at 0.3.
create or replace function public.match_sponsor(q text)
returns table (
  org_name       text,
  town           text,
  route          text,
  similarity     real,
  register_date  date
)
language sql
stable
set search_path = public, extensions
as $$
  select
    s.org_name,
    s.town,
    s.route,
    extensions.similarity(s.org_name_norm, public.normalise_org_name(q)),
    (select m.register_date from public.sponsor_register_meta m limit 1)
  from public.sponsor_register s
  where s.org_name_norm operator(extensions.%) public.normalise_org_name(q)
  order by 4 desc
  limit 1;
$$;

revoke execute on function public.match_sponsor(text) from public, anon;
grant execute on function public.match_sponsor(text) to authenticated;

-- Deletes all of the caller's rows. Account removal is manual on request.
-- Uploaded CV files (if any) must be removed from the client with the Storage API
-- (supabase.storage.from(bucket).remove([path])), because deleting storage rows
-- through SQL leaves the underlying files behind.
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
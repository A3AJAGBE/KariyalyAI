
-- KariyalyAI: general AI response cache

create table public.ai_cache (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  task text not null
    check (
      task in (
        'parse_cv',
        'match_job',
        'tailor_application',
        'company_brief',
        'outreach'
      )
    ),

  input_hash text not null,
  response jsonb not null,

  created_at timestamptz not null default now(),

  unique (user_id, task, input_hash)
);

-- Index for retrieving a user's cached AI responses.
create index ai_cache_user_task_hash_idx
  on public.ai_cache (user_id, task, input_hash);

-- Enable Row Level Security.
alter table public.ai_cache enable row level security;

-- Users can only access their own cached responses.
create policy "own rows"
  on public.ai_cache
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

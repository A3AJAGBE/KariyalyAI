# KariyalyAI: Project Context

Paste this whole file at the start of every AI coding session. Keep it in the repo root and update it in the same PR as any change to the data model, stack or output formats. If the code and this file disagree, this file wins until it is deliberately changed.

Last updated: 6 Nov 2026 (data model now matches `supabase/migrations/001_init.sql`, which is the source of truth for the database). Build ends 15 Nov (feature freeze 13 Nov). Demo day 23 Nov.

## 1. Product

KariyalyAI helps job seekers find relevant jobs, tailor CVs and cover letters, research companies, send personalised cold outreach, and track applications in one place.

Demo flow: profile, then job, then tailored application, then outreach, then tracked.

Constraints: free tiers only (Supabase, Netlify, Gemini). No auto-apply, no scraping of job boards, no email sending or email integration, no payments, no visa checks outside the UK.

## 2. Rules for AI assistants (read first)

1. Work on one feature or one file per request. Do not refactor unrelated code.
2. Use only the tables, columns, task names and JSON shapes in this file. If something is missing, say so and propose an addition instead of inventing one.
3. TypeScript everywhere. Import shared types and zod schemas from `/shared`. Never redefine them locally.
4. The LLM API key must never appear in frontend code, in `VITE_` variables, or in logs.
5. Never log CV text, job descriptions or prompts.
6. Decisions (work authorisation states, score display, status rules) are plain code. The AI only reads text and writes prose.
7. Every AI output shown to users carries the label: `AI-generated, please verify`.
8. Every screen needs loading, empty and error states.
9. Put all user-facing copy in `/src/lib/copy.ts`.

## 3. Stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite, TypeScript, React Router, TanStack Query, Tailwind CSS, react-hook-form + zod (v4, what `npm i zod` installs), supabase-js, pdfjs-dist, mammoth |
| Hosting | Netlify (free) |
| Auth, DB, storage | Supabase (Postgres with Row Level Security, Auth, Storage) |
| AI layer | One Netlify Function, `ai`, calling the Gemini free tier. Model name read from env `GEMINI_MODEL` |
| Fuzzy matching | Postgres `pg_trgm` (UK sponsor register) |

Environment variables
- Netlify (server): `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AI_ENDPOINT` (default `/api/ai`), `VITE_MOCK_AI` (`true` returns fixtures)
- The Supabase service role key is used only by the local sponsor loader script. Never deploy it.

Repo structure
```
/src
  /lib          supabase.ts, ai.ts (callAI), copy.ts, fixtures/
  /features     profile, jobs, tailor, tracker, research, outreach
  /components   Button, Card, Badge, EmptyState, CopyButton
/shared         schemas.ts (zod), workAuth.ts, types.ts
/netlify/functions   ai.ts, prompts/
/supabase/migrations 001_init.sql
/scripts        load_sponsors.ts
```

## 4. Features

### Core MVP (must be demoed)
1. **Profile and CV upload.** Upload PDF or DOCX, or paste text. Text is extracted in the browser. AI parses it into a structured profile. The user reviews and edits. Country of residence and right-to-work countries are asked explicitly and never inferred.
2. **Job matching.** User pastes a job description (links are stored but never fetched). AI extracts job fields and scores fit with strengths and gaps. Work authorisation check runs alongside (section 7).
3. **CV and cover letter tailoring.** Editable CV summary and cover letter. Copy button on each. Regenerate button. Download as .docx or PDF is a stretch item.
4. **Application tracker.** Statuses: Saved, Applied, Interview, Offer, Rejected. One-click status change (dropdown), no confirmation, optimistic update, timestamped history, Undo toast (about 8 seconds). Deleting an application asks for confirmation.

### Thin features (one form, one prompt each, shown as tabs on the job page)
5. **Company research.** Inputs: company, role, pasted About text (URL optional, stored only). Output: brief with talking points. Label: `AI-generated, please verify`. No live web access, so no recent news.
6. **Cold outreach generator.** Inputs: recruiter name, role, company, channel (LinkedIn or email), tone, message type (first, follow-up 1, follow-up 2). Output: message with Copy button.

### Proposed (pending team agreement)
7. **Work authorisation check.** Tier 1: location mismatch warning plus phrase scan of the job description. Tier 2: UK sponsor register lookup.

## 5. Routes

- `/login`, `/signup`
- `/onboarding`: CV import, profile review, work authorisation fields
- `/app/profile`
- `/app/jobs/new`: paste job description and analyse
- `/app/jobs/:id`: match result and work authorisation card, tabs for Tailor, Company research, Outreach
- `/app/tracker`

## 6. Data model (Postgres on Supabase)

Source of truth: `supabase/migrations/001_init.sql`. If this section and the SQL disagree, the SQL wins.

Every table has `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()` and, unless noted, `user_id uuid not null default auth.uid() references auth.users on delete cascade`. **`user_id` defaults to the signed-in user, so the frontend never sends it on insert.** Row Level Security is on for every table. User-owned tables have one policy: full access where `user_id = auth.uid()`. Exceptions are `application_status_history` and the two sponsor tables (below). The `anon` role has no access to anything.

**profiles** (primary key is `user_id`, no separate id)
- full_name text, email text, summary text
- skills text[], target_roles text[]
- experience jsonb: `[{company, title, start, end, bullets[]}]`
- education jsonb: `[{institution, degree, year}]`
- country_of_residence text, right_to_work_countries text[]
- raw_cv_text text, cv_file_path text (optional; no storage bucket exists yet), updated_at timestamptz (set by trigger)
- Client saves with an upsert on `user_id`.

**jobs**
- title text, company text, location_text text, location_country text (nullable), is_remote boolean (nullable)
- description_text text, source_url text (stored only)

**matches** (unique on user_id + job_id; re-running replaces the row)
- job_id uuid references jobs on delete cascade
- score int (0 to 100), verdict text (`strong` | `moderate` | `weak`), summary text
- strengths jsonb, gaps jsonb, work_auth jsonb (a `WorkAuthResult`, see `shared/schemas.ts`)
- input_hash text (cache key for `match_job`)

**generated_outputs**
- job_id uuid references jobs on delete cascade
- kind text (`cv_summary` | `cover_letter` | `company_brief` | `outreach`)
- content jsonb (as generated), edited_content text (nullable, the user's edits)
- meta jsonb (tone, channel, message_type), input_hash text (sha256 of task + canonical input)
- Unique on `(user_id, input_hash, kind)`. `tailor_application` writes **two rows** (`cv_summary` and `cover_letter`) that share one `input_hash`.

**applications**
- job_id uuid references jobs on delete set null (nullable), company text, role text, notes text
- status text, default `saved` (`saved` | `applied` | `interview` | `offer` | `rejected`), applied_at timestamptz, updated_at timestamptz
- **Triggers do the bookkeeping.** The client only inserts rows and updates `status`. On insert and on every status change the database writes the history row, sets `updated_at`, and sets `applied_at` the first time status becomes `applied`.

**application_status_history** (append-only, no user_id)
- application_id uuid references applications on delete cascade
- from_status text (nullable, null on the first row), to_status text, changed_at timestamptz default now()
- **Read-only for clients** (select policy via the parent application's owner). Written only by the database trigger. The frontend never inserts, updates or deletes history.
- **Undo** = update the application's `status` back to the previous row's `from_status`. The trigger then appends the reversal as a new history row.

**ai_usage**
- task text. Used only for rate limiting (index on `user_id, created_at`).

**sponsor_register** (no user_id; select allowed for authenticated users only)
- org_name text, org_name_norm text (**generated by the database** from `org_name`, GIN trigram index), town text, county text, route text, type_rating text
- The loader inserts only `org_name`, `town`, `county`, `route`, `type_rating`, using the service role key. Clients cannot write.
- Companion table `sponsor_register_meta(id boolean primary key default true, register_date date)`: exactly one row, the date of the loaded CSV. The loader upserts it.

RPCs (callable by signed-in users only):
- `match_sponsor(q text)` returns the single best fuzzy match as `(org_name, town, route, similarity, register_date)`, or no rows. It does not apply a threshold: the caller treats `similarity >= 0.6` as `likely_licensed`.
- `delete_my_data()` deletes all of the caller's database rows (history cascades). It cannot delete uploaded files: if CV files are ever stored, remove them from the client with the Storage API.
- `normalise_org_name(text)` is the shared normaliser (lowercase, strip punctuation and company suffixes). `match_sponsor` and `org_name_norm` both use it, so never normalise names in the loader.

## 7. Work authorisation logic (`/shared/workAuth.ts`, pure function, unit tested)

Inputs: `country_of_residence`, `right_to_work_countries` (profile, explicit), `location_country`, `is_remote`, job description text, and optionally the sponsor match.

Phrase scan (case-insensitive, in code): right to work, no sponsorship, unable to sponsor, not able to offer visa sponsorship, must be eligible to work, and similar. The AI field `no_sponsorship_phrases` is only a backup.

Decision order, first match wins:
1. Job country is in the user's right-to-work list: `no_visa_needed`
2. Job is remote and no restriction phrase found: `no_visa_needed` (note: check the posting for country restrictions)
3. Job country outside the list and a no-sponsorship phrase found: `no_sponsorship`
4. Job country is the UK and Tier 2 is built: `likely_licensed` (similarity 0.6 or higher) or `not_found`
5. Job country outside the list, not the UK or Tier 2 not built: `not_checked`
6. Job country unknown: `unknown_location`

Wording rules: say "licensed to sponsor", never "will sponsor you for this role". Show the matched name, town and register date. If not confirmed, show general tips and link to official GOV.UK pages without hardcoding rules or salary thresholds. Always show: `General information, not immigration advice. Verify on GOV.UK.`

## 8. AI layer contract

Endpoint: `POST /api/ai` (redirected to the Netlify function). Header: `Authorization: Bearer <supabase access token>`.

Request: `{ "task": string, "input": object, "force"?: boolean }`

Response:
```
{ "ok": true, "data": <task output>, "cached": boolean }
{ "ok": false, "error": { "code": string, "message": string } }
```
Error codes: `UNAUTHENTICATED`, `INVALID_INPUT`, `RATE_LIMITED`, `MODEL_ERROR`, `BAD_OUTPUT`, `TIMEOUT`.

Function behaviour: verify token, validate input, check cache by `input_hash` (skip if `force`), check rate limit (6 per minute, 60 per day per user), call Gemini, validate output with zod, retry once on invalid JSON, store result. Input caps: cv_text 12,000 characters, job description 8,000, about_text 4,000.

Frontend calls only `callAI(task, input, { force })` from `/src/lib/ai.ts`.

## 9. Output formats (JSON shapes, source of truth is `/shared/schemas.ts`)

**parse_cv**
- input: `{ cv_text }`
- output: `{ full_name, email, summary, skills[], experience[{company, title, start, end, bullets[]}], education[{institution, degree, year}], suggested_target_roles[] }`
- must not guess country or work authorisation

**match_job**
- input: `{ profile, job: { title?, company?, location?, description } }`
- output: `{ job: { title, company, location_text, location_country, is_remote, no_sponsorship_phrases[] }, score, verdict, summary, strengths[], gaps[{ gap, suggestion }] }`
- `location_country` is a country name or null, never a guess

**tailor_application**
- input: `{ profile, job, tone? }`
- output: `{ cv_summary, cover_letter, key_changes[] }`
- uses only facts present in the profile

**company_brief**
- input: `{ company, role, about_text?, url? }`
- output: `{ what_they_do, values[], talking_points[], questions_to_ask[], confidence }` where confidence is `low` | `medium`
- paste-in text only; a bare company name gives `low`

**outreach**
- input: `{ profile, recruiter_name, role, company, channel, tone, message_type }` with channel `linkedin` | `email`, message_type `first` | `follow_up_1` | `follow_up_2`
- output: `{ subject, message }` where subject is null for LinkedIn

All prompts: use only facts from the provided input, never invent employers, dates or metrics, return JSON only.

## 10. Conventions

- Branch per feature, small pull requests, quick review. Lead merges.
- Commit the migration file; never edit the live database by hand without adding it to a migration.
- Copy buttons use the clipboard API and show a toast.
- AI-generated text is editable; edits autosave (debounced) to `generated_outputs.edited_content`.
- Tracker code never writes `application_status_history` or `applied_at`; it only changes `status`.
- Frontend inserts omit `user_id` (the database fills it).
- Privacy: short note on the upload screen, RLS on every table, no CV content in logs, Delete my data button on the Profile page.

## 11. Open decisions (update when settled)

1. Final stack: this file assumes Supabase, Netlify Functions and Gemini.
2. Work authorisation in scope, and whether Tier 2 is built.
3. Job links: paste-only for the MVP.
4. Company brief: paste-in text only, or a search-grounded API.
5. Owner and freeze date for prompts and `schemas.ts` (proposed: Sat 7 Nov).
6. Submission and judging requirements for 23 Nov.

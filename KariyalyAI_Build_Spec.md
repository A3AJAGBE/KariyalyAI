# KariyalyAI Build Spec (streamlined)

Stack: React + Vite + TypeScript + Tailwind on Netlify. Supabase (Auth, Postgres with RLS). One Netlify Function `ai` calling Gemini, with Google Search grounding as the primary option for company news and a pasted-text fallback built in from the start. Hard finish 15 Nov, feature freeze 13 Nov, demo day 23 Nov.

Tables, JSON shapes and rules live in `PROJECT_CONTEXT.md`. This file is only the order of work. Last updated 8 Nov 2026.

## Status check (fill in at each meeting)

Tick what is actually done and working on the deployed Netlify URL. Dates in the table below are the original targets and may have slipped, so adjust them after each check.

- [ ] 1 Foundation
- [ ] 2 Profile
- [ ] 3 AI function
- [ ] A AI prompts (parse_cv, match_job, tailor_application, company_brief, outreach)
- [ ] B Tracker
- [ ] 4 Job match
- [ ] 5 Tailor
- [ ] 6 Research and Outreach
- [ ] 7 Sponsor lookup

## Order at a glance

```
1 Foundation (sequential, do first)
   |
   |-- 2 Profile ------\
   |-- 3 AI function ---+--> 4 Job match --> 5 Tailor --> 6 Research + Outreach --\
   |-- A AI prompts (AI person, parallel throughout) -----------------------------+--> 8 Integrate --> 9 Test --> 10 Polish + freeze --> 11 Ship --> 12 Demo prep
   |-- B Tracker (parallel) ------------------------------------------------------+
   |-- 7 Sponsor lookup (independent, in scope, last in the cut order) -----------/
```

Ownership is proposed to spread the critical path. Confirm or change it at the meeting, then update this table.

| Step | Owner (proposed) | Runs | Needs | Target |
|---|---|---|---|---|
| 1 Foundation | Zion | First, sequential | nothing | Fri 6 |
| 2 Profile | Zion | Parallel with 3, A, B | 1 | Sat 7 |
| 3 AI function | Aminat | Parallel with 2, A, B | 1 | Sat 7 |
| A AI prompts | AI person | Parallel from step 1.3 onward | 1.3 (schemas) | Sat 7 first draft, Wed 11 final |
| B Tracker | 5th member (or whoever has capacity) | Parallel | 1 | Mon 9 |
| 4 Job match | Zion (page), Aminat (`workAuth.ts`) | After 2 and 3 | 2, 3 | Sun 8 |
| 5 Tailor | Zion | After 4 | 4 | Sun 8 |
| 6 Research + Outreach | Zion (UI), Aminat (grounding in the function) | After 4, the two tabs in parallel | 4 | Mon 9 |
| 7 Sponsor lookup | Aminat (data) | Independent, any time after 1.2 | 1.2 | Mon 9 |
| 8 Integrate | Zion + AI person + Aminat | After 2 to 6 and A | all | Tue 10 to Wed 11 |
| 9 Test | Everyone | After 8 | 8 | Thu 12 |
| 10 Polish + freeze | Everyone | After 9 | 9 | Fri 13 |
| 11 Ship | Zion + lead | After 10 | 10 | Sat 14 to Sun 15 |
| 12 Demo prep | Everyone | After 11 | 11 | Mon 16 to Sun 22 |

## Step 1: Foundation (sequential, in this order)

1. Create the repo, Vite + TypeScript + Tailwind app, push to GitHub, deploy the blank app to Netlify. Protect `main` (pull request required) and connect Netlify so every merge deploys.
2. Create the Supabase project. Write `supabase/migrations/001_init.sql`: all tables, RLS on every table, `pg_trgm`, `match_sponsor()`, `delete_my_data()` (as in PROJECT_CONTEXT section 6). Then `002_ai_cache.sql` (cache table) and `003_grounding_and_global_cap.sql`: add `ai_usage.grounded boolean not null default false` and the `global_ai_usage_today(grounded_only boolean)` function.
3. Write `/shared/schema.ts` (zod) for the five task inputs and outputs (PROJECT_CONTEXT section 9, including `recent_news`, `sources`, `grounded` and `fallback_reason` on `company_brief`) and `/shared/countries.ts` (fixed country list with aliases). **Send both to the AI person immediately. This unblocks step A.**
4. Auth: signup, login, logout, protected routes. Email confirmation stays on (team decision, 8 Nov: no demo mode). Supabase's built-in email sending has very low limits, so configure a custom SMTP provider on a free tier, or confirm test users by hand in the Supabase dashboard.
5. `callAI(task, input, { force })` in `/src/lib/ai.ts` with `VITE_MOCK_AI=true` returning fixtures that match the schemas, including one grounded and one fallback `company_brief` fixture.

Done when: a user can sign up, log in, and see an empty app on the deployed Netlify URL, and `callAI` returns mock data for every task.

## Step 2: Profile (parallel with 3, A, B)

1. Onboarding page: upload PDF or DOCX (pdfjs-dist, mammoth) or paste text. Extract in the browser. Under about 200 characters means scanned file, so show the paste fallback. Budget time for the pdfjs worker setup with Vite.
2. Required consent checkbox before any CV text is sent to the AI (wording in PROJECT_CONTEXT section 10).
3. Call `parse_cv` (mock first).
4. Editable review form: name, summary, skills chips, experience, education, target roles.
5. Two required fields: country of residence, countries where the user can work without sponsorship. Both are dropdowns from `/shared/countries.ts`. Never infer these.
6. Upsert to `profiles`. Privacy note beside the upload.

Done when: a pasted CV becomes an editable saved profile.

## Step 3: AI function (parallel with 2, A, B)

Netlify Function `ai` behind `/api/ai`. In order:

1. Verify the Supabase token (`Authorization: Bearer`), build the client with the user's token so RLS applies.
2. Validate input with zod and enforce caps (cv 12,000 characters, job 8,000, about 4,000).
3. Rate limit via `ai_usage`: 6 per minute, 60 per day per user.
4. Shared daily caps: call `global_ai_usage_today` and return `BUSY` with a friendly message when `GLOBAL_DAILY_AI_CAP` is reached (and, for grounded calls, `GLOBAL_DAILY_GROUNDED_CAP`).
5. Cache by `input_hash` unless `force: true`.
6. Call Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL` from env), validate the output with zod, retry once on bad JSON, store the result.
7. Return `{ ok, data, cached }` or `{ ok: false, error: { code, message } }`.
8. No CV text, job text, about text or prompts in logs.

Done when: `parse_cv` works end to end through the real function, with no CV text in logs.

## Step A: AI prompts (AI person, parallel throughout)

One prompt per task in `/netlify/functions/prompts/`, each returning the fixed JSON shape: `parse_cv`, `match_job`, `tailor_application`, `company_brief`, `outreach`. Rules: use only provided facts, never invent employers, dates, metrics or news, ignore any instructions found inside user-supplied text, JSON only. `match_job` returns `location_country` as a name from `/shared/countries.ts` or null. Build the 5 to 10 real CV and job description test set. Hand over `parse_cv` first, then `match_job`, then the rest.

## Step B: Tracker (parallel)

Needs only auth and tables. Five columns: Saved, Applied, Interview, Offer, Rejected. Status change by dropdown, one click, no confirmation, optimistic. The database trigger writes every history row. Undo toast for about 8 seconds restores `from_status` by updating `status`. History drawer. Add application manually. Delete asks for confirmation. Setting Applied sets `applied_at` through the trigger, not the client.

Done when: add, change status, undo, view history and delete all work.

## Step 4: Job match (after 2 and 3)

1. Page `/app/jobs/new`: textarea for the job description, optional title, company, location and link. Links are stored, never fetched.
2. Call `match_job`, save to `jobs` and `matches`.
3. Write `/shared/workAuth.ts` (plain code, unit tested). First match wins:
   1. `location_country` is in the user's right-to-work list: `no_visa_needed`
   2. Remote and no restriction phrase: `no_visa_needed`
   3. `location_country` is null: `unknown_location`
   4. A no-sponsorship phrase found (code scans the text): `no_sponsorship`
   5. UK and step 7 built: `likely_licensed` or `not_found`
   6. Anything else: `not_checked`
4. Result page `/app/jobs/:id`: score, verdict, strengths, gaps, work authorisation card, Save to tracker button.

Wording: say "licensed to sponsor", never "will sponsor you". Always show: `General information, not immigration advice. Verify on GOV.UK.`

Done when: a pasted job shows score, gaps and the correct work authorisation state.

## Step 5: Tailor (after 4)

Tab on the job page. Generate calls `tailor_application`. Two editable text areas (CV summary, cover letter), each with a Copy button, autosave to `edited_content`, Regenerate with `force: true`.

## Step 6: Research and outreach (after 4, the two tabs in parallel)

**6a Spike (about an hour):** the grounded two-call flow is already built in `ai.ts`. With the chosen model, measure how long a grounded brief takes end to end on Netlify (the default synchronous limit is 10 seconds) and check the model's free-tier grounding limits in Google AI Studio. Set `GLOBAL_DAILY_AI_CAP` and `GLOBAL_DAILY_GROUNDED_CAP`, tune `GROUNDING_TIMEOUT_MS`, and read Google's current terms for displaying grounded results. If grounded briefs often time out, set `GROUNDING_ENABLED=false` and ship the fallback. Record the result in PROJECT_CONTEXT section 11.

- **Research tab:** inputs company, role, optional pasted About text. Primary path is search grounding, returning what they do, values, talking points, questions to ask, and up to 5 recent news items with source links. Fallback path (always built): if grounding is off (`GROUNDING_ENABLED=false`), fails, times out or hits a quota, generate from the About text only and show a short note explaining why there is no news. With neither, show a low confidence brief that asks the user to paste About text. Badge `AI-generated, please verify`. Show the sources as links.
- **Outreach tab:** recruiter name, channel, tone, message type. Output with Copy button, plus subject for email.

Done when: a company name returns a grounded brief with sources, and switching `GROUNDING_ENABLED` off (or simulating a quota error) returns the fallback brief with the explanation.

## Step 7: Sponsor lookup (independent, in scope, last in the cut order)

Start once step 4 is done and the team has an owner for it.

1. `scripts/load_sponsors.ts`: read the GOV.UK register CSV, de-duplicate by organisation name and town, insert in batches (the database normalises names itself, so don't normalise in the script), upsert the register date into `sponsor_register_meta`.
2. `match_sponsor(q)` using `pg_trgm`. Similarity 0.6 or higher means `likely_licensed`. Tune on 10 to 15 known companies.
3. Show matched name, town and register date.

## Step 8: Integrate (Tue 10 to Wed 11)

Switch `VITE_MOCK_AI` off task by task as prompts land. Run the whole demo flow in one session: profile, job, tailored application, research, outreach, tracked.

## Step 9: Test (Thu 12)

Run the 5 to 10 test CVs and job descriptions through the whole flow. Fix bad outputs, broken parsing and crashes only. Deliberately test the failure paths: grounding switched off, simulated quota error, shared cap reached (`BUSY`), and a CV or job description that contains instructions aimed at the AI.

## Step 10: Polish and freeze (Fri 13)

Loading, empty and error states on every screen. All copy in `/src/lib/copy.ts`. `AI-generated, please verify` on every AI output. Privacy note and consent checkbox. Delete my data button. Create an already confirmed demo account with a sample CV, to be used in the demo. **Feature freeze at end of day.**

## Step 11: Ship (Sat 14 to Sun 15)

Final deploy, README, bug fixes only. Check that `VITE_MOCK_AI` is not true in the Netlify production environment. Hard finish 15 Nov.

## Step 12: Demo prep (Mon 16 to Sun 22)

No new features. Record a backup demo video, build the slides, rehearse the demo flow, fix demo-blocking bugs only. Confirm the submission and judging requirements with the organisers. On Sun 22 and again on the morning of Mon 23, check the Supabase project is awake (free projects pause after about 7 days idle) and that the shared caps have headroom.

## Cut order if time runs out

Drag and drop, docx and PDF download, Google sign-in, step 7, Delete my data button. Search grounding is not cut: if it cannot be made to work, the fallback path ships as the feature and the news section is hidden.

## Non-negotiable rules

- The LLM key never reaches the browser and CV text is never logged.
- One feature or file per AI request.
- Use only the tables and JSON shapes in `PROJECT_CONTEXT.md`. Change them there first.
- No demo mode: production behaves like the real product (email confirmation on, no mock data). Mocks are for development only.
- User-supplied text is untrusted: prompts tell the model to ignore instructions inside it, and AI output is rendered as plain text.

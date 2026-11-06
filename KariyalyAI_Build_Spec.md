# KariyalyAI Build Spec (streamlined)

Stack: React + Vite + TypeScript + Tailwind on Netlify. Supabase (Auth, Postgres with RLS). One Netlify Function `ai` calling Gemini. Hard finish 15 Nov, feature freeze 13 Nov.

Tables, JSON shapes and rules live in `PROJECT_CONTEXT.md`. This file is only the order of work.

## Order at a glance

```
1 Foundation (sequential, do first)
   |
   |-- 2 Profile ------\
   |-- 3 AI function ---+--> 4 Job match --> 5 Tailor --> 6 Research + Outreach --\
   |-- A AI prompts (AI person, parallel throughout) -----------------------------+--> 8 Integrate --> 9 Test --> 10 Polish + freeze --> 11 Ship
   |-- B Tracker (Aminat or 5th member, parallel) --------------------------------+
   |-- 7 Sponsor lookup (independent, optional) ----------------------------------/
```

| Step | Who | Runs | Needs | Target |
|---|---|---|---|---|
| 1 Foundation | Zion | First, sequential | nothing | Fri 6 |
| 2 Profile | Zion | Parallel with 3, A, B | 1 | Sat 7 |
| 3 AI function | Zion | Parallel with 2, A, B | 1 | Sat 7 |
| A AI prompts | AI person | Parallel from step 1.3 onward | 1.3 (schemas) | Sat 7 first draft, Wed 11 final |
| B Tracker | Aminat or 5th member | Parallel | 1 | Mon 9 |
| 4 Job match | Zion | After 2 and 3 | 2, 3 | Sun 8 |
| 5 Tailor | Zion | After 4 | 4 | Sun 8 |
| 6 Research + Outreach | Zion | After 4, the two tabs in parallel | 4 | Mon 9 |
| 7 Sponsor lookup | Zion (data) | Independent, any time after 1.2 | 1.2 | Mon 9, optional |
| 8 Integrate | Zion + AI person | After 2 to 6 and A | all | Tue 10 to Wed 11 |
| 9 Test | Everyone | After 8 | 8 | Thu 12 |
| 10 Polish + freeze | Everyone | After 9 | 9 | Fri 13 |
| 11 Ship | Zion + lead | After 10 | 10 | Sat 14 to Sun 15 |

## Step 1: Foundation (sequential, in this order)

1. Create the repo, Vite + TypeScript + Tailwind app, push to GitHub, deploy the blank app to Netlify.
2. Create the Supabase project. Write `supabase/migrations/001_init.sql`: all tables, RLS on every table, `pg_trgm`, `match_sponsor()`, `delete_my_data()` (as in PROJECT_CONTEXT section 6).
3. Write `/shared/schemas.ts` (zod) for the five task inputs and outputs (PROJECT_CONTEXT section 9). **Send to the AI person immediately. This unblocks step A.**
4. Auth: signup, login, logout, protected routes. Email confirmation off for the demo.
5. `callAI(task, input, { force })` in `/src/lib/ai.ts` with `VITE_MOCK_AI=true` returning fixtures that match the schemas.

Done when: a user can sign up, log in, and see an empty app on the deployed Netlify URL, and `callAI` returns mock data for every task.

## Step 2: Profile (parallel with 3, A, B)

1. Onboarding page: upload PDF or DOCX (pdfjs-dist, mammoth) or paste text. Extract in the browser. Under about 200 characters means scanned file, so show the paste fallback.
2. Call `parse_cv` (mock first).
3. Editable review form: name, summary, skills chips, experience, education, target roles.
4. Two required fields: country of residence, countries where the user can work without sponsorship. Never infer these.
5. Upsert to `profiles`. Privacy note beside the upload.

Done when: a pasted CV becomes an editable saved profile.

## Step 3: AI function (parallel with 2, A, B)

Netlify Function `ai` behind `/api/ai`. In order:

1. Verify the Supabase token (`Authorization: Bearer`), build the client with the user's token so RLS applies.
2. Validate input with zod and enforce caps (cv 12,000 characters, job 8,000, about 4,000).
3. Rate limit via `ai_usage`: 6 per minute, 60 per day.
4. Cache by `input_hash` unless `force: true`.
5. Call Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL` from env), validate the output with zod, retry once on bad JSON, store the result.
6. Return `{ ok, data, cached }` or `{ ok: false, error: { code, message } }`.

Done when: `parse_cv` works end to end through the real function, with no CV text in logs.

## Step A: AI prompts (AI person, parallel throughout)

One prompt per task in `/netlify/functions/prompts/`, each returning the fixed JSON shape: `parse_cv`, `match_job`, `tailor_application`, `company_brief`, `outreach`. Rules: use only provided facts, never invent employers, dates or metrics, JSON only. Build the 5 to 10 real CV and job description test set. Hand over `parse_cv` first, then `match_job`, then the rest.

## Step B: Tracker (Aminat or 5th member, parallel)

Needs only auth and tables. Five columns: Saved, Applied, Interview, Offer, Rejected. Status change by dropdown, one click, no confirmation, optimistic. Every change writes a row to `application_status_history`. Undo toast for about 8 seconds restores `from_status`. History drawer. Add application manually. Delete asks for confirmation. Setting Applied sets `applied_at`.

Done when: add, change status, undo, view history and delete all work.

## Step 4: Job match (after 2 and 3)

1. Page `/app/jobs/new`: textarea for the job description, optional title, company, location and link. Links are stored, never fetched.
2. Call `match_job`, save to `jobs` and `matches`.
3. Write `/shared/workAuth.ts` (plain code, unit tested). First match wins:
   1. Job country is in the user's right-to-work list: `no_visa_needed`
   2. Remote and no restriction phrase: `no_visa_needed`
   3. Outside the list and a no-sponsorship phrase found (code scans the text): `no_sponsorship`
   4. UK and step 7 built: `likely_licensed` or `not_found`
   5. Outside the list, not UK (or step 7 not built): `not_checked`
   6. Country unknown: `unknown_location`
4. Result page `/app/jobs/:id`: score, verdict, strengths, gaps, work authorisation card, Save to tracker button.

Wording: say "licensed to sponsor", never "will sponsor you". Always show: `General information, not immigration advice. Verify on GOV.UK.`

Done when: a pasted job shows score, gaps and the correct work authorisation state.

## Step 5: Tailor (after 4)

Tab on the job page. Generate calls `tailor_application`. Two editable text areas (CV summary, cover letter), each with a Copy button, autosave to `edited_content`, Regenerate with `force: true`.

## Step 6: Research and outreach (after 4, the two tabs in parallel)

- **Research tab:** company, role, pasted About text. Output: what they do, values, talking points, questions to ask. Badge `AI-generated, please verify`. No About text shows a low confidence note.
- **Outreach tab:** recruiter name, channel, tone, message type. Output with Copy button, plus subject for email.

## Step 7: Sponsor lookup (independent, optional)

Only if step 4 is done by Mon 9 and the team agrees.

1. `scripts/load_sponsors.ts`: read the GOV.UK register CSV, de-duplicate by organisation name and town, insert in batches (the database normalises names itself, so don't normalise in the script), upsert the register date into `sponsor_register_meta`.
2. `match_sponsor(q)` using `pg_trgm`. Similarity 0.6 or higher means `likely_licensed`. Tune on 10 to 15 known companies.
3. Show matched name, town and register date.

## Step 8: Integrate (Tue 10 to Wed 11)

Switch `VITE_MOCK_AI` off task by task as prompts land. Run the whole demo flow in one session: profile, job, tailored application, outreach, tracked. Fix breakages.

## Step 9: Test (Thu 12)

Run the 5 to 10 test CVs and job descriptions through the whole flow. Fix bad outputs, broken parsing and crashes only.

## Step 10: Polish and freeze (Fri 13)

Loading, empty and error states on every screen. All copy in `/src/lib/copy.ts`. `AI-generated, please verify` on every AI output. Privacy note. Delete my data button. **Feature freeze at end of day.**

## Step 11: Ship (Sat 14 to Sun 15)

Final deploy, README, check the Supabase project is awake, bug fixes only. Hard finish 15 Nov. Check again the morning of 23 Nov, because free Supabase projects pause after about 7 days idle.

## Cut order if time runs out

Drag and drop, docx and PDF download, Google sign-in, step 7, Delete my data button.

## Non-negotiable rules

- The LLM key never reaches the browser and CV text is never logged.
- One feature or file per AI request.
- Use only the tables and JSON shapes in `PROJECT_CONTEXT.md`. Change them there first.

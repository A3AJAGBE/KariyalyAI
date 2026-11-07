/**
 * KariyalyAI shared schemas: single source of truth for AI task inputs and outputs.
 * Imported by BOTH the Netlify function (validation) and the frontend (types, forms).
 * Do not redefine these shapes anywhere else. Change them here first, then update
 * PROJECT_CONTEXT.md in the same PR.
 *
 * Conventions for prompts:
 *  - Strings that are unknown are returned as '' (empty string), never null.
 *  - Arrays that are empty are returned as [], never null.
 *  - Only the fields marked nullable below may be null.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum input sizes (characters). The ai function rejects anything longer. */
export const INPUT_CAPS = {
  cv_text: 12_000,
  job_description: 8_000,
  about_text: 4_000,
} as const;

/** Rate limits per user, enforced by the ai function using the ai_usage table. */
export const RATE_LIMITS = { perMinute: 6, perDay: 60 } as const;

export const AI_LABEL = 'AI-generated, please verify';

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export const ApplicationStatus = z.enum(['saved', 'applied', 'interview', 'offer', 'rejected']);
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

export const Verdict = z.enum(['strong', 'moderate', 'weak']);
export type Verdict = z.infer<typeof Verdict>;

export const Tone = z.enum(['professional', 'friendly', 'concise']);
export type Tone = z.infer<typeof Tone>;

export const Channel = z.enum(['linkedin', 'email']);
export type Channel = z.infer<typeof Channel>;

export const MessageType = z.enum(['first', 'follow_up_1', 'follow_up_2']);
export type MessageType = z.infer<typeof MessageType>;

export const Confidence = z.enum(['low', 'medium']);
export type Confidence = z.infer<typeof Confidence>;

// ---------------------------------------------------------------------------
// Profile building blocks
// ---------------------------------------------------------------------------

export const ExperienceItem = z.object({
  company: z.string(),
  title: z.string(),
  start: z.string(), // free text, e.g. 'Jan 2023'; '' if unknown
  end: z.string(), // free text, e.g. 'Present'; '' if unknown
  bullets: z.array(z.string()),
});
export type ExperienceItem = z.infer<typeof ExperienceItem>;

export const EducationItem = z.object({
  institution: z.string(),
  degree: z.string(),
  year: z.string(), // '' if unknown
});
export type EducationItem = z.infer<typeof EducationItem>;

/** The profile as the app stores it and sends it to the AI tasks. */
export const Profile = z.object({
  full_name: z.string(),
  email: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(ExperienceItem),
  education: z.array(EducationItem),
  target_roles: z.array(z.string()),
  country_of_residence: z.string().nullable(),
  right_to_work_countries: z.array(z.string()),
});
export type Profile = z.infer<typeof Profile>;

/** Subset of the profile sent to the AI. Excludes contact details and work authorisation. */
export const ProfileForAI = Profile.pick({
  full_name: true,
  summary: true,
  skills: true,
  experience: true,
  education: true,
  target_roles: true,
});
export type ProfileForAI = z.infer<typeof ProfileForAI>;

// ---------------------------------------------------------------------------
// Task: parse_cv
// ---------------------------------------------------------------------------

export const ParseCvInput = z.object({
  cv_text: z.string().min(1).max(INPUT_CAPS.cv_text),
});

/** Must NOT guess country or work authorisation. */
export const ParseCvOutput = z.object({
  full_name: z.string(),
  email: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(ExperienceItem),
  education: z.array(EducationItem),
  suggested_target_roles: z.array(z.string()),
});
export type ParseCvOutput = z.infer<typeof ParseCvOutput>;

// ---------------------------------------------------------------------------
// Task: match_job
// ---------------------------------------------------------------------------

export const MatchJobInput = z.object({
  profile: ProfileForAI,
  job: z.object({
    title: z.string().optional(),
    company: z.string().optional(),
    location: z.string().optional(),
    description: z.string().min(1).max(INPUT_CAPS.job_description),
  }),
});

export const MatchJobOutput = z.object({
  job: z.object({
    title: z.string(),
    company: z.string(),
    location_text: z.string(),
    /** Country name, or null if not stated. Never a guess. */
    location_country: z.string().nullable(),
    /** null if the posting does not say. */
    is_remote: z.boolean().nullable(),
    /** Phrases quoted from the posting that restrict sponsorship or right to work. */
    no_sponsorship_phrases: z.array(z.string()),
  }),
  score: z.number().int().min(0).max(100),
  verdict: Verdict,
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.object({ gap: z.string(), suggestion: z.string() })),
});

// ---------------------------------------------------------------------------
// Task: tailor_application
// ---------------------------------------------------------------------------

export const TailorApplicationInput = z.object({
  profile: ProfileForAI,
  job: z.object({
    title: z.string(),
    company: z.string(),
    description: z.string().min(1).max(INPUT_CAPS.job_description),
  }),
  tone: Tone.optional(),
});

/** Use only facts present in the profile. */
export const TailorApplicationOutput = z.object({
  cv_summary: z.string(),
  cover_letter: z.string(),
  key_changes: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Task: company_brief
// ---------------------------------------------------------------------------

export const CompanyBriefInput = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  about_text: z.string().max(INPUT_CAPS.about_text).optional(),
  /** Stored only. The AI has no web access and the URL is never fetched. */
  url: z.string().optional(),
});

/** A bare company name (no about_text) must return confidence 'low'. */
export const CompanyBriefOutput = z.object({
  what_they_do: z.string(),
  values: z.array(z.string()),
  talking_points: z.array(z.string()),
  questions_to_ask: z.array(z.string()),
  confidence: Confidence,
});

// ---------------------------------------------------------------------------
// Task: outreach
// ---------------------------------------------------------------------------

export const OutreachInput = z.object({
  profile: ProfileForAI,
  recruiter_name: z.string().min(1),
  role: z.string().min(1),
  company: z.string().min(1),
  channel: Channel,
  tone: Tone,
  message_type: MessageType,
});

export const OutreachOutput = z.object({
  /** Email only. Must be null for LinkedIn. */
  subject: z.string().nullable(),
  message: z.string(),
});

// ---------------------------------------------------------------------------
// Task registry and API envelope
// ---------------------------------------------------------------------------

export const aiTasks = {
  parse_cv: { input: ParseCvInput, output: ParseCvOutput },
  match_job: { input: MatchJobInput, output: MatchJobOutput },
  tailor_application: { input: TailorApplicationInput, output: TailorApplicationOutput },
  company_brief: { input: CompanyBriefInput, output: CompanyBriefOutput },
  outreach: { input: OutreachInput, output: OutreachOutput },
} as const;

export type TaskName = keyof typeof aiTasks;
export const TASK_NAMES = Object.keys(aiTasks) as [TaskName, ...TaskName[]];

export type TaskInput<T extends TaskName> = z.infer<(typeof aiTasks)[T]['input']>;
export type TaskOutput<T extends TaskName> = z.infer<(typeof aiTasks)[T]['output']>;

/** The request body of POST /api/ai. `input` is validated per task with aiTasks[task].input. */
export const AiRequest = z.object({
  task: z.enum(TASK_NAMES),
  input: z.unknown(),
  force: z.boolean().optional(),
});
export type AiRequest = z.infer<typeof AiRequest>;

export const AI_ERROR_CODES = [
  'UNAUTHENTICATED',
  'INVALID_INPUT',
  'RATE_LIMITED',
  'MODEL_ERROR',
  'BAD_OUTPUT',
  'TIMEOUT',
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export type AiResponse<T> =
  | { ok: true; data: T; cached: boolean }
  | { ok: false; error: { code: AiErrorCode; message: string } };

// ---------------------------------------------------------------------------
// Work authorisation result (stored in matches.work_auth, produced by shared/workAuth.ts)
// ---------------------------------------------------------------------------

export const WorkAuthState = z.enum([
  'no_visa_needed',
  'no_sponsorship',
  'likely_licensed',
  'not_found',
  'not_checked',
  'unknown_location',
]);
export type WorkAuthState = z.infer<typeof WorkAuthState>;

export const WorkAuthResult = z.object({
  state: WorkAuthState,
  /** Present only for likely_licensed / not_found (Tier 2). */
  matched_org: z.string().nullable().optional(),
  matched_town: z.string().nullable().optional(),
  register_date: z.string().nullable().optional(), // ISO date of the loaded register CSV
  similarity: z.number().nullable().optional(),
  /** Short extra note, e.g. 'Check the posting for country restrictions.' */
  note: z.string().optional(),
});
export type WorkAuthResult = z.infer<typeof WorkAuthResult>;
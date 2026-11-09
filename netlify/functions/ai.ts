import type { Handler } from '@netlify/functions'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { z } from 'zod'

import {
  aiTasks,
  CompanyBriefInput,
  CompanyBriefOutput,
  RATE_LIMITS,
  type AiErrorCode,
  type FallbackReason,
  type TaskName,
} from '../../shared/schema'

import {
  buildNews,
  extractSources,
  getText,
  GroundedBriefModel,
  type GeminiBody,
} from './lib/grounding'

import { parseCvPrompt } from './prompts/parse_cv'
import { matchJobPrompt } from './prompts/match_job'
import { tailorApplicationPrompt } from './prompts/tailor_application'
import {
  companyBriefPrompt,
  companyBriefResearchPrompt,
  companyBriefStructurePrompt,
} from './prompts/company_brief'
import { outreachPrompt } from './prompts/outreach'

const TASK_PROMPTS: Record<TaskName, string> = {
  parse_cv: parseCvPrompt,
  match_job: matchJobPrompt,
  tailor_application: tailorApplicationPrompt,
  company_brief: companyBriefPrompt,
  outreach: outreachPrompt,
}

// ---------------------------------------------------------------------------
// Configuration (all overridable from Netlify environment variables)
// ---------------------------------------------------------------------------

function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * Shared daily caps across ALL users. The defaults are placeholders: set
 * GLOBAL_DAILY_AI_CAP and GLOBAL_DAILY_GROUNDED_CAP from the limits shown in Google AI
 * Studio for the chosen model, with a safety margin. One request can use several Gemini
 * calls (a retry, or grounding plus structuring), so keep the caps well below the quota.
 */
const GLOBAL_DAILY_AI_CAP = () => envInt('GLOBAL_DAILY_AI_CAP', 250)
const GLOBAL_DAILY_GROUNDED_CAP = () => envInt('GLOBAL_DAILY_GROUNDED_CAP', 100)

/** Search grounding is on unless GROUNDING_ENABLED is exactly "false". */
const groundingEnabled = () => process.env.GROUNDING_ENABLED !== 'false'

/**
 * Netlify synchronous functions time out after 10 seconds by default, so the grounded
 * path has its own, shorter timeouts. Tune them after measuring real latency.
 */
const GROUNDING_TIMEOUT_MS = () => envInt('GROUNDING_TIMEOUT_MS', 6000)
const STRUCTURE_TIMEOUT_MS = () => envInt('STRUCTURE_TIMEOUT_MS', 3500)

/** Grounded briefs contain news, so a cached one is only reused for this long. */
const COMPANY_BRIEF_CACHE_HOURS = 24

// ---------------------------------------------------------------------------
// Errors and helpers
// ---------------------------------------------------------------------------

class GeminiProviderError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GeminiProviderError'
    this.status = status
  }
}

/** An error that maps directly to a response for the caller. */
class AiFailure extends Error {
  code: AiErrorCode
  status: number

  constructor(code: AiErrorCode, status: number, message: string) {
    super(message)
    this.name = 'AiFailure'
    this.code = code
    this.status = status
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>

    return `{${Object.keys(object)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify(object[key])}`,
      )
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function response(
  statusCode: number,
  payload: Record<string, unknown>,
) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }
}

function failure(code: AiErrorCode, statusCode: number, message: string) {
  return response(statusCode, { ok: false, error: { code, message } })
}

// ---------------------------------------------------------------------------
// Gemini calls
// ---------------------------------------------------------------------------

interface GeminiCall {
  system: string
  user: string
  /** true: ask for JSON output. Must be false when search is true. */
  json: boolean
  /** true: enable Google Search grounding. */
  search?: boolean
  timeoutMs?: number
}

async function callGemini(call: GeminiCall): Promise<GeminiBody> {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL

  if (!apiKey || !model) {
    throw new Error('AI environment variables are missing.')
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${model}:generateContent?key=${apiKey}`

  const result = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: call.system }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: call.user }],
        },
      ],
      ...(call.search ? { tools: [{ google_search: {} }] } : {}),
      ...(call.json
        ? { generationConfig: { responseMimeType: 'application/json' } }
        : {}),
    }),
    signal: AbortSignal.timeout(call.timeoutMs ?? 60000),
  })

  if (!result.ok) {
    throw new GeminiProviderError(
      result.status,
      `Gemini returned HTTP ${result.status}.`,
    )
  }

  return (await result.json()) as GeminiBody
}

function withBase(prompt: string, retryFeedback?: string): string {
  const retryInstruction = retryFeedback
    ? `\n\nYour previous response was invalid.
Correct these issues and return a completely valid JSON object:
${retryFeedback}`
    : ''

  return (
    'You are KariyalyAI, an AI-powered career assistant.\n\n' +
    prompt +
    '\n\nReturn valid JSON only. No Markdown or explanations.' +
    retryInstruction
  )
}

/**
 * Calls Gemini in JSON mode, validates the output with `schema`, and retries once
 * (with the validation errors as feedback) if the output is invalid.
 * Provider errors (HTTP failures) are thrown immediately without a retry.
 */
async function generateValidated<T>(
  systemPrompt: string,
  input: unknown,
  schema: z.ZodType<T>,
  timeoutMs = 60000,
): Promise<T> {
  let feedback = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    let generated: unknown

    try {
      const body = await callGemini({
        system: withBase(systemPrompt, feedback || undefined),
        user: JSON.stringify(input),
        json: true,
        timeoutMs,
      })

      const text = getText(body)
      if (!text) throw new Error('Gemini returned an empty response.')

      try {
        generated = JSON.parse(text)
      } catch {
        throw new Error('Gemini returned invalid JSON.')
      }
    } catch (error) {
      if (error instanceof GeminiProviderError) throw error

      console.error(
        '[AI] Gemini generation error:',
        error instanceof Error ? error.message : 'Unknown error',
      )

      feedback =
        error instanceof Error
          ? error.message
          : 'Gemini returned an invalid response.'

      continue
    }

    const outputResult = schema.safeParse(generated)

    if (outputResult.success) {
      return outputResult.data
    }

    feedback = outputResult.error.issues
      .map((issue) => {
        const field = issue.path.join('.')
        return `${field || 'response'}: ${issue.message}`
      })
      .join('\n')

    // Log field paths only, never values.
    console.error(
      '[AI] Gemini output failed schema validation at:',
      outputResult.error.issues
        .map((issue) => issue.path.join('.') || 'response')
        .join(', '),
    )
  }

  throw new AiFailure(
    'BAD_OUTPUT',
    502,
    'The AI could not produce a valid response. Please try again.',
  )
}

// ---------------------------------------------------------------------------
// company_brief: grounded path with a pasted-text fallback
// ---------------------------------------------------------------------------

type CompanyBriefInputData = z.infer<typeof CompanyBriefInput>
type CompanyBriefResult = z.infer<typeof CompanyBriefOutput>

const CompanyBriefCore = CompanyBriefOutput.pick({
  what_they_do: true,
  values: true,
  talking_points: true,
  questions_to_ask: true,
  confidence: true,
})

type GroundingAttempt =
  | { ok: true; data: CompanyBriefResult }
  | { ok: false; reason: FallbackReason }

/**
 * Two Gemini calls: (1) search grounding, plain text; (2) JSON structuring without
 * search. Gemini does not accept the search tool together with JSON output on every
 * model, so this works on all of them. News URLs always come from the grounding
 * metadata, never from the model.
 */
async function tryGroundedBrief(
  input: CompanyBriefInputData,
): Promise<GroundingAttempt> {
  try {
    const research = await callGemini({
      system: companyBriefResearchPrompt,
      user: JSON.stringify({
        company: input.company,
        role: input.role,
        about_text: input.about_text ?? '',
      }),
      json: false,
      search: true,
      timeoutMs: GROUNDING_TIMEOUT_MS(),
    })

    const researchText = getText(research).trim()
    const sources = extractSources(research)

    if (!researchText || sources.length === 0) {
      return { ok: false, reason: 'no_results' }
    }

    const structured = await generateValidated(
      companyBriefStructurePrompt,
      {
        company: input.company,
        role: input.role,
        about_text: input.about_text ?? '',
        research_text: researchText.slice(0, 12_000),
        sources: sources.map((source, index) => ({
          index,
          title: source.title,
        })),
      },
      GroundedBriefModel,
      STRUCTURE_TIMEOUT_MS(),
    )

    const data = CompanyBriefOutput.parse({
      what_they_do: structured.what_they_do,
      values: structured.values,
      talking_points: structured.talking_points,
      questions_to_ask: structured.questions_to_ask,
      recent_news: buildNews(structured.recent_news, sources),
      sources,
      grounded: true,
      fallback_reason: null,
      confidence: 'medium',
    })

    return { ok: true, data }
  } catch (error) {
    if (error instanceof GeminiProviderError) {
      console.error('[AI] Grounded brief failed. HTTP status:', error.status)
      return { ok: false, reason: error.status === 429 ? 'quota' : 'error' }
    }

    console.error(
      '[AI] Grounded brief failed:',
      error instanceof Error ? error.name : 'Unknown error',
    )
    return { ok: false, reason: 'error' }
  }
}

/** No search. Builds the brief from the pasted About text only. */
async function fallbackBrief(
  input: CompanyBriefInputData,
  reason: FallbackReason,
): Promise<CompanyBriefResult> {
  const core = await generateValidated(
    companyBriefPrompt,
    {
      company: input.company,
      role: input.role,
      about_text: input.about_text ?? '',
    },
    CompanyBriefCore,
  )

  const hasAboutText = Boolean(input.about_text?.trim())

  return CompanyBriefOutput.parse({
    ...core,
    // Plain code decides confidence: no search and no pasted text means low.
    confidence: hasAboutText ? core.confidence : 'low',
    recent_news: [],
    sources: [],
    grounded: false,
    fallback_reason: reason,
  })
}

async function runCompanyBrief(
  input: CompanyBriefInputData,
  grounding: { attempt: boolean; reason: FallbackReason },
): Promise<CompanyBriefResult> {
  let reason = grounding.reason

  if (grounding.attempt) {
    const attempt = await tryGroundedBrief(input)
    if (attempt.ok) return attempt.data
    reason = attempt.reason
  }

  return fallbackBrief(input, reason)
}

// ---------------------------------------------------------------------------
// Usage limits
// ---------------------------------------------------------------------------

async function globalUsageToday(
  supabase: SupabaseClient,
  groundedOnly: boolean,
): Promise<number> {
  const { data, error } = await supabase.rpc('global_ai_usage_today', {
    grounded_only: groundedOnly,
  })

  if (error || typeof data !== 'number') {
    throw new Error('Unable to check shared AI usage.')
  }

  return data
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return failure('INVALID_INPUT', 405, 'Only POST requests are supported.')
  }

  try {
    const authorization = event.headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
      return failure('UNAUTHENTICATED', 401, 'Please log in to continue.')
    }

    const token = authorization.slice(7)

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are missing.')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data: authData, error: authError } =
      await supabase.auth.getUser(token)

    if (authError || !authData.user) {
      return failure(
        'UNAUTHENTICATED',
        401,
        'Your session is invalid. Please log in again.',
      )
    }

    let body: Record<string, unknown>

    try {
      body = JSON.parse(event.body ?? '')
    } catch {
      return failure('INVALID_INPUT', 400, 'Invalid request body.')
    }

    const task = body.task

    if (
      typeof task !== 'string' ||
      !Object.prototype.hasOwnProperty.call(aiTasks, task)
    ) {
      return failure('INVALID_INPUT', 400, 'Unsupported AI task.')
    }

    const taskName = task as TaskName
    const config = aiTasks[taskName]
    const inputResult = config.input.safeParse(body.input)

    if (!inputResult.success) {
      return failure('INVALID_INPUT', 400, 'The supplied input is invalid.')
    }

    const input = inputResult.data
    const force = body.force === true
    const userId = authData.user.id

    const inputHash = createHash('sha256')
      .update(`${taskName}:${stableStringify(input)}`)
      .digest('hex')

    // 1. Cache. A hit costs no usage and no Gemini call.
    if (!force) {
      const { data: cached, error: cacheError } = await supabase
        .from('ai_cache')
        .select('response, created_at')
        .eq('task', taskName)
        .eq('input_hash', inputHash)
        .maybeSingle()

      if (cacheError) {
        // A broken cache must not block generation.
        console.error('[AI] Cache lookup failed.')
      } else if (cached) {
        const ageHours =
          (Date.now() - new Date(cached.created_at as string).getTime()) /
          3_600_000
        const stale =
          taskName === 'company_brief' && ageHours > COMPANY_BRIEF_CACHE_HOURS

        if (!stale) {
          const cachedResult = config.output.safeParse(cached.response)

          if (cachedResult.success) {
            return response(200, {
              ok: true,
              data: cachedResult.data,
              cached: true,
            })
          }
        }
      }
    }

    // 2. Per-user limits (see RATE_LIMITS in shared/schema.ts).
    const now = Date.now()
    const oneMinuteAgo = new Date(now - 60_000).toISOString()
    const oneDayAgo = new Date(now - 86_400_000).toISOString()

    const [minuteUsage, dailyUsage] = await Promise.all([
      supabase
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneMinuteAgo),

      supabase
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', oneDayAgo),
    ])

    if (minuteUsage.error || dailyUsage.error) {
      throw new Error('Unable to check AI usage limits.')
    }

    if (
      (minuteUsage.count ?? 0) >= RATE_LIMITS.perMinute ||
      (dailyUsage.count ?? 0) >= RATE_LIMITS.perDay
    ) {
      return failure(
        'RATE_LIMITED',
        429,
        'You have reached your AI usage limit. Please try again later.',
      )
    }

    // 3. Shared daily cap across all users. The project's Gemini quota is shared, so a
    // few testers could otherwise use it up for everyone.
    if ((await globalUsageToday(supabase, false)) >= GLOBAL_DAILY_AI_CAP()) {
      return failure(
        'BUSY',
        503,
        'KariyalyAI is very busy right now. Please try again shortly.',
      )
    }

    // 4. Decide whether this request may use search grounding.
    let grounding: { attempt: boolean; reason: FallbackReason } = {
      attempt: false,
      reason: 'disabled',
    }

    if (taskName === 'company_brief') {
      if (!groundingEnabled()) {
        grounding = { attempt: false, reason: 'disabled' }
      } else if (
        (await globalUsageToday(supabase, true)) >= GLOBAL_DAILY_GROUNDED_CAP()
      ) {
        grounding = { attempt: false, reason: 'quota' }
      } else {
        grounding = { attempt: true, reason: 'error' }
      }
    }

    // 5. Record usage, including whether this request used grounding.
    const { error: usageError } = await supabase
      .from('ai_usage')
      .insert({ task: taskName, grounded: grounding.attempt })

    if (usageError) {
      throw new Error('Unable to record AI usage.')
    }

    // 6. Generate and validate.
    let validatedOutput: unknown

    if (taskName === 'company_brief') {
      validatedOutput = await runCompanyBrief(
        input as CompanyBriefInputData,
        grounding,
      )
    } else {
      validatedOutput = await generateValidated(
        TASK_PROMPTS[taskName],
        input,
        config.output as z.ZodType<unknown>,
      )
    }

    // Plain-code rule: LinkedIn messages never have a subject line.
    if (taskName === 'outreach') {
      const outreachInput = input as { channel: string }
      if (outreachInput.channel === 'linkedin') {
        validatedOutput = {
          ...(validatedOutput as Record<string, unknown>),
          subject: null,
        }
      }
    }

    // 7. Cache. Briefs that fell back are not cached, so the next request tries grounding
    // again instead of serving a brief with no news.
    const cacheable =
      taskName !== 'company_brief' ||
      (validatedOutput as CompanyBriefResult).grounded

    if (cacheable) {
      const { error: saveCacheError } = await supabase.from('ai_cache').upsert(
        {
          task: taskName,
          input_hash: inputHash,
          response: validatedOutput,
        },
        { onConflict: 'user_id,task,input_hash' },
      )

      if (saveCacheError) {
        // The user already has a good result. Do not fail the request over the cache.
        console.error('[AI] Unable to save the AI cache.')
      }
    }

    return response(200, {
      ok: true,
      data: validatedOutput,
      cached: false,
    })
  } catch (error) {
    if (error instanceof AiFailure) {
      return failure(error.code, error.status, error.message)
    }

    if (error instanceof GeminiProviderError) {
      console.error(
        '[AI] Gemini API request failed. HTTP status:',
        error.status,
      )

      const message =
        error.status === 429
          ? 'Gemini usage limit reached. Please try again later.'
          : `Gemini rejected the request (HTTP ${error.status}). Check your model and API configuration.`

      return failure('MODEL_ERROR', 502, message)
    }

    console.error(
      '[AI] Function error:',
      error instanceof Error ? error.message : 'Unknown error',
    )

    return failure(
      'MODEL_ERROR',
      500,
      'Something went wrong while processing your request.',
    )
  }
}

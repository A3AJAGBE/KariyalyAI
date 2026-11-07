
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

import { aiTasks, type TaskName } from '../../shared/schema'

import { parseCvPrompt } from './prompts/parse_cv'
import { matchJobPrompt } from './prompts/match_job'
import { tailorApplicationPrompt } from './prompts/tailor_application'
import { companyBriefPrompt } from './prompts/company_brief'
import { outreachPrompt } from './prompts/outreach'

const TASK_PROMPTS: Record<TaskName, string> = {
  parse_cv: parseCvPrompt,
  match_job: matchJobPrompt,
  tailor_application: tailorApplicationPrompt,
  company_brief: companyBriefPrompt,
  outreach: outreachPrompt,
}

class GeminiProviderError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GeminiProviderError'
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

async function generateWithGemini(
  task: TaskName,
  input: unknown,
  validationFeedback?: string,
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL

  if (!apiKey || !model) {
    throw new Error('AI environment variables are missing.')
  }

  const retryInstruction = validationFeedback
    ? `\n\nYour previous response was invalid.
Correct these issues and return a completely valid JSON object:
${validationFeedback}`
    : ''

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
        parts: [
          {
            text:
              'You are KariyalyAI, an AI-powered career assistant.\n\n' +
              TASK_PROMPTS[task] +
              '\n\nReturn valid JSON only. No Markdown or explanations.' +
              retryInstruction,
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: JSON.stringify(input),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!result.ok) {
    throw new GeminiProviderError(
      result.status,
      `Gemini returned HTTP ${result.status}.`,
    )
  }

  const body = await result.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
        }>
      }
    }>
  }

  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')

  if (!text) {
    throw new Error('Gemini returned an empty response.')
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Gemini returned invalid JSON.')
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return response(405, {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Only POST requests are supported.',
      },
    })
  }

  try {
    const authorization = event.headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
      return response(401, {
        ok: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Please log in to continue.',
        },
      })
    }

    const token = authorization.slice(7)

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are missing.')
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    const { data: authData, error: authError } =
      await supabase.auth.getUser(token)

    if (authError || !authData.user) {
      return response(401, {
        ok: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Your session is invalid. Please log in again.',
        },
      })
    }

    let body: Record<string, unknown>

    try {
      body = JSON.parse(event.body ?? '')
    } catch {
      return response(400, {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid request body.',
        },
      })
    }

    const task = body.task

    if (
      typeof task !== 'string' ||
      !Object.prototype.hasOwnProperty.call(aiTasks, task)
    ) {
      return response(400, {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Unsupported AI task.',
        },
      })
    }

    const config = aiTasks[task as TaskName]
    const inputResult = config.input.safeParse(body.input)

    if (!inputResult.success) {
      return response(400, {
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'The supplied input is invalid.',
        },
      })
    }

    const input = inputResult.data
    const force = body.force === true
    const userId = authData.user.id

    const inputHash = createHash('sha256')
      .update(`${task}:${stableStringify(input)}`)
      .digest('hex')

    // Check cache before applying generation limits.
    if (!force) {
      const { data: cached, error: cacheError } = await supabase
        .from('ai_cache')
        .select('response')
        .eq('task', task)
        .eq('input_hash', inputHash)
        .maybeSingle()

      if (cacheError) {
        throw new Error('Unable to check the AI cache.')
      }

      if (cached) {
        const cachedResult = config.output.safeParse(
          cached.response,
        )

        if (cachedResult.success) {
          return response(200, {
            ok: true,
            data: cachedResult.data,
            cached: true,
          })
        }
      }
    }

    // Rate limits: 6 generations per minute and 60 per day.
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
      (minuteUsage.count ?? 0) >= 6 ||
      (dailyUsage.count ?? 0) >= 60
    ) {
      return response(429, {
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'You have reached your AI usage limit. Please try again later.',
        },
      })
    }

    const { error: usageError } = await supabase
      .from('ai_usage')
      .insert({ task })

    if (usageError) {
      throw new Error('Unable to record AI usage.')
    }

    // Generate and validate. Retry once for invalid output.
    let validatedOutput: unknown = null
    let validationFeedback = ''

    for (let attempt = 0; attempt < 2; attempt++) {
      let generated: unknown

      try {
        generated = await generateWithGemini(
          task as TaskName,
          input,
          validationFeedback || undefined,
        )
      } catch (error) {
        if (error instanceof GeminiProviderError) {
          console.error(
            '[AI] Gemini API request failed. HTTP status:',
            error.status,
          )

          const message =
            error.status === 429
              ? 'Gemini usage limit reached. Please try again later.'
              : `Gemini rejected the request (HTTP ${error.status}). Check your model and API configuration.`

          return response(502, {
            ok: false,
            error: {
              code: 'MODEL_ERROR',
              message,
            },
          })
        }

        console.error(
          '[AI] Gemini generation error:',
          error instanceof Error ? error.message : 'Unknown error',
        )

        validationFeedback =
          error instanceof Error
            ? error.message
            : 'Gemini returned an invalid response.'

        continue
      }

      const outputResult = config.output.safeParse(generated)

      if (outputResult.success) {
        validatedOutput = outputResult.data
        break
      }

      validationFeedback = outputResult.error.issues
        .map((issue) => {
          const field = issue.path.join('.')
          return `${field || 'response'}: ${issue.message}`
        })
        .join('\n')

      console.error(
        '[AI] Gemini output failed schema validation:',
        validationFeedback,
      )
    }

    if (!validatedOutput) {
      return response(502, {
        ok: false,
        error: {
          code: 'BAD_OUTPUT',
          message: 'The AI could not produce a valid response. Please try again.',
        },
      })
    }

    // Save validated response in the general cache.
    const { error: saveCacheError } = await supabase
      .from('ai_cache')
      .upsert(
        {
          task,
          input_hash: inputHash,
          response: validatedOutput,
        },
        {
          onConflict: 'user_id,task,input_hash',
        },
      )

    if (saveCacheError) {
      throw new Error('Unable to save the AI cache.')
    }

    return response(200, {
      ok: true,
      data: validatedOutput,
      cached: false,
    })
  } catch (error) {
    console.error(
      '[AI] Function error:',
      error instanceof Error ? error.message : 'Unknown error',
    )

    return response(500, {
      ok: false,
      error: {
        code: 'MODEL_ERROR',
        message: 'Something went wrong while processing your request.',
      },
    })
  }
}

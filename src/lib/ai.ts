
import {
  aiTasks,
  type AiResponse,
  type TaskInput,
  type TaskName,
  type TaskOutput,
} from '../../shared/schema'

import { supabase } from './supabase'
import { aiFixtures } from './fixtures/aiFixtures'

interface CallAIOptions {
  force?: boolean
}

const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT || '/api/ai'
const MOCK_AI = import.meta.env.VITE_MOCK_AI === 'true'

export async function callAI<T extends TaskName>(
  task: T,
  input: TaskInput<T>,
  options: CallAIOptions = {},
): Promise<AiResponse<TaskOutput<T>>> {
  try {
    const validatedInput = aiTasks[task].input.parse(input)

    if (MOCK_AI) {
      const fixture = aiFixtures[task]

      const data = aiTasks[task].output.parse(fixture)

      return {
        ok: true,
        data: data as TaskOutput<T>,
        cached: false,
      }
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.access_token) {
      return {
        ok: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'You must be logged in to use AI features.',
        },
      }
    }

    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        task,
        input: validatedInput,
        force: options.force ?? false,
      }),
    })

    const result = await response.json()

    if (!result.ok) {
      return result as AiResponse<TaskOutput<T>>
    }

    const validatedOutput = aiTasks[task].output.parse(result.data)

    return {
      ok: true,
      data: validatedOutput as TaskOutput<T>,
      cached: Boolean(result.cached),
    }
  } catch (error) {
    console.error(
      `AI request failed for task "${task}".`,
      error instanceof Error ? error.message : 'Unknown error',
    )

    return {
      ok: false,
      error: {
        code: 'MODEL_ERROR',
        message: 'Unable to process your request. Please try again.',
      },
    }
  }
}

/**
 * Contract tests: each prompt must describe exactly the JSON shape its schema accepts.
 * A prompt that drifts from the schema makes every real call fail validation (this
 * happened once with match_job), and mocks would never show it.
 */
import { describe, expect, it } from 'vitest'

import { aiTasks, Verdict, Tone } from '../shared/schema'
import { GroundedBriefModel } from '../netlify/functions/lib/grounding'
import { parseCvPrompt } from '../netlify/functions/prompts/parse_cv'
import { matchJobPrompt } from '../netlify/functions/prompts/match_job'
import { tailorApplicationPrompt } from '../netlify/functions/prompts/tailor_application'
import {
  companyBriefPrompt,
  companyBriefStructurePrompt,
} from '../netlify/functions/prompts/company_brief'
import { outreachPrompt } from '../netlify/functions/prompts/outreach'

const keysOf = (schema: { shape: Record<string, unknown> }) => Object.keys(schema.shape)

const expectMentions = (prompt: string, keys: string[]) => {
  for (const key of keys) expect(prompt, `prompt should mention "${key}"`).toContain(`"${key}"`)
}

describe('prompt and schema contracts', () => {
  it('parse_cv lists every output field', () => {
    expectMentions(parseCvPrompt, keysOf(aiTasks.parse_cv.output))
  })

  it('match_job nests the job fields and uses the schema verdicts', () => {
    const output = aiTasks.match_job.output
    expectMentions(matchJobPrompt, keysOf(output))
    expectMentions(matchJobPrompt, keysOf(output.shape.job))
    for (const verdict of Verdict.options) expect(matchJobPrompt).toContain(verdict)
    expect(matchJobPrompt).not.toMatch(/strong_match|partial_match|weak_match/)
    expect(matchJobPrompt).not.toContain('"job_title"')
  })

  it('tailor_application lists every output field', () => {
    expectMentions(tailorApplicationPrompt, keysOf(aiTasks.tailor_application.output))
  })

  it('the company brief fallback prompt asks only for the fields the model writes', () => {
    expectMentions(companyBriefPrompt, ['what_they_do', 'values', 'talking_points', 'questions_to_ask', 'confidence'])
    // The application adds these, not the model.
    expect(companyBriefPrompt).not.toContain('"recent_news"')
    expect(companyBriefPrompt).not.toContain('"grounded"')
  })

  it('the structuring prompt matches the grounded model shape and uses source indexes', () => {
    expectMentions(companyBriefStructurePrompt, keysOf(GroundedBriefModel))
    expect(companyBriefStructurePrompt).toContain('"source_index"')
    expect(companyBriefStructurePrompt).not.toContain('"url"')
  })

  it('outreach lists every output field and every tone', () => {
    expectMentions(outreachPrompt, keysOf(aiTasks.outreach.output))
    for (const tone of Tone.options) expect(outreachPrompt.toLowerCase()).toContain(tone)
  })

  it.each([
    ['parse_cv', parseCvPrompt],
    ['match_job', matchJobPrompt],
    ['tailor_application', tailorApplicationPrompt],
    ['company_brief', companyBriefPrompt],
    ['outreach', outreachPrompt],
  ])('%s tells the model to ignore instructions inside user text', (_name, prompt) => {
    expect(prompt.toLowerCase()).toMatch(/ignore\s+(any\s+)?instructions/)
  })
})

import { describe, expect, it } from 'vitest'

import {
  AI_ERROR_CODES,
  aiTasks,
  CompanyBriefOutput,
  MatchJobOutput,
  Profile,
  ProfileFromDb,
  type TaskName,
} from '../shared/schema'
import { aiFixtures, companyBriefGroundedFixture } from '../src/lib/fixtures/aiFixtures'

const baseProfile = {
  full_name: 'A',
  email: '',
  summary: '',
  skills: [],
  experience: [],
  education: [],
  target_roles: [],
}

describe('fixtures (used when VITE_MOCK_AI is true)', () => {
  it.each(Object.keys(aiTasks) as TaskName[])('%s fixture matches its output schema', (task) => {
    expect(aiTasks[task].output.safeParse(aiFixtures[task]).success).toBe(true)
  })

  it('the grounded company brief fixture matches the schema', () => {
    expect(CompanyBriefOutput.safeParse(companyBriefGroundedFixture).success).toBe(true)
  })
})

describe('profiles', () => {
  it('the strict Profile rejects free-text countries', () => {
    const result = Profile.safeParse({ ...baseProfile, country_of_residence: 'UK', right_to_work_countries: [] })
    expect(result.success).toBe(false)
  })

  it('ProfileFromDb loads old free-text countries and cleans them', () => {
    const result = ProfileFromDb.parse({
      ...baseProfile,
      country_of_residence: 'Lagos, Nigeria',
      right_to_work_countries: ['UK', 'Nigeria', 'U.K.', 'Narnia'],
    })
    expect(result.country_of_residence).toBeNull()
    expect(result.right_to_work_countries).toEqual(['United Kingdom', 'Nigeria'])
  })
})

describe('AI output shapes', () => {
  const brief = {
    what_they_do: 'x',
    values: [],
    talking_points: [],
    questions_to_ask: [],
    sources: [],
    grounded: true,
    fallback_reason: null,
    confidence: 'medium',
  }

  it('keeps at most 5 news items', () => {
    const news = Array.from({ length: 7 }, (_, i) => ({ headline: `h${i}`, source: 's', url: 'https://x', date: null }))
    expect(CompanyBriefOutput.parse({ ...brief, recent_news: news }).recent_news).toHaveLength(5)
  })

  it('rejects an unknown fallback reason', () => {
    expect(CompanyBriefOutput.safeParse({ ...brief, recent_news: [], fallback_reason: 'tired' }).success).toBe(false)
  })

  it('match_job turns an unrecognised location into null', () => {
    const output = MatchJobOutput.parse({
      job: { title: '', company: '', location_text: 'London, UK', location_country: 'London, UK', is_remote: null, no_sponsorship_phrases: [] },
      score: 50,
      verdict: 'moderate',
      summary: '',
      strengths: [],
      gaps: [],
    })
    expect(output.job.location_country).toBeNull()
  })

  it('includes the BUSY error code', () => {
    expect(AI_ERROR_CODES).toContain('BUSY')
  })
})


import { callAI } from './ai'

const profile = {
  full_name: 'Alex Morgan',
  summary: 'Frontend developer with React experience.',
  skills: ['React', 'TypeScript', 'JavaScript'],
  experience: [],
  education: [],
  target_roles: ['Frontend Developer'],
}

async function testAI() {
  const tests = [
    callAI('parse_cv', {
      cv_text: 'Alex Morgan. Frontend Developer. Skills: React, TypeScript.',
    }),

    callAI('match_job', {
      profile,
      job: {
        title: 'Frontend Developer',
        company: 'Example Company',
        description: 'Looking for a React developer.',
      },
    }),

    callAI('tailor_application', {
      profile,
      job: {
        title: 'Frontend Developer',
        company: 'Example Company',
        description: 'Looking for a React developer.',
      },
    }),

    callAI('company_brief', {
      company: 'Example Company',
      role: 'Frontend Developer',
    }),

    callAI('outreach', {
      profile,
      recruiter_name: 'Jane',
      role: 'Frontend Developer',
      company: 'Example Company',
      channel: 'email',
      tone: 'professional',
      message_type: 'first',
    }),
  ]

  const results = await Promise.all(tests)

  console.table(
    results.map((result, index) => ({
      task: [
        'parse_cv',
        'match_job',
        'tailor_application',
        'company_brief',
        'outreach',
      ][index],
      success: result.ok,
      cached: result.ok ? result.cached : '-',
    })),
  )

  console.log('Full AI test results:', results)
}

testAI()

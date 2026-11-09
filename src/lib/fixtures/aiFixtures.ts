
import type { TaskName, TaskOutput } from '../../../shared/schema.ts'
export const aiFixtures = {
  parse_cv: {
    full_name: 'Alex Morgan',
    email: 'alex@example.com',
    summary: 'A motivated professional with experience in software development.',
    skills: ['JavaScript', 'React', 'TypeScript', 'Python'],
    experience: [
      {
        company: 'Example Technologies',
        title: 'Frontend Developer',
        start: 'Jan 2024',
        end: 'Present',
        bullets: [
          'Built responsive web interfaces using React.',
          'Collaborated with developers to deliver application features.',
        ],
      },
    ],
    education: [
      {
        institution: 'Example University',
        degree: 'BSc Computer Science',
        year: '2023',
      },
    ],
    suggested_target_roles: ['Frontend Developer', 'Software Engineer'],
  },

  match_job: {
    job: {
      title: 'Frontend Developer',
      company: 'Example Company',
      location_text: 'Remote',
      location_country: null,
      is_remote: true,
      no_sponsorship_phrases: [],
    },
    score: 82,
    verdict: 'strong',
    summary: 'The candidate demonstrates good alignment with the role requirements.',
    strengths: [
      'Experience with React.',
      'Knowledge of TypeScript.',
      'Frontend development experience.',
    ],
    gaps: [
      {
        gap: 'Limited experience with automated testing.',
        suggestion: 'Build a project demonstrating unit and integration testing.',
      },
    ],
  },

  tailor_application: {
    cv_summary: 'Frontend developer with experience building responsive applications using React and TypeScript.',
    cover_letter: 'Dear Hiring Manager,\n\nI am interested in the opportunity to contribute my frontend development skills to your team.\n\nKind regards,\nAlex Morgan',
    key_changes: [
      'Emphasised relevant frontend development experience.',
      'Highlighted React and TypeScript skills.',
    ],
  },

  // Fallback brief: no search grounding and no pasted About text.
  // See companyBriefGroundedFixture below for the grounded shape.
  company_brief: {
    what_they_do: 'The company information has not been provided. More research is needed.',
    values: [],
    talking_points: [],
    questions_to_ask: [
      'What does success look like in this role?',
      'What technologies does the team currently use?',
    ],
    recent_news: [],
    sources: [],
    grounded: false,
    fallback_reason: 'disabled',
    confidence: 'low',
  },

  outreach: {
    subject: 'Interest in the Frontend Developer opportunity',
    message: 'Hello,\n\nI am interested in the Frontend Developer opportunity at your company and would appreciate the opportunity to learn more about the role.\n\nKind regards,\nAlex Morgan',
  },
} satisfies {
  [T in TaskName]: TaskOutput<T>
}

/** A grounded company brief, for building and testing the Research tab's news and sources. */
export const companyBriefGroundedFixture = {
  what_they_do: 'Example Company builds scheduling software for clinics.',
  values: ['Customer focus', 'Reliability'],
  talking_points: [
    'Its recent expansion into new markets and what that means for the frontend team.',
  ],
  questions_to_ask: ['How does the team decide which features to build next?'],
  recent_news: [
    {
      headline: 'Example Company opens a new office',
      source: 'example-news.com',
      url: 'https://example-news.com/example-company-office',
      date: '2026-10-01',
    },
  ],
  sources: [
    { title: 'example-news.com', url: 'https://example-news.com/example-company-office' },
  ],
  grounded: true,
  fallback_reason: null,
  confidence: 'medium',
} satisfies TaskOutput<'company_brief'>

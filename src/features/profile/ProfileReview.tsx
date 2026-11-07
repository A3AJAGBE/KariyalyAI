
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { ParseCvOutput } from '../../../shared/schema'
import { copy } from '../../lib/copy'

interface ProfileReviewProps {
  parsedCv: ParseCvOutput
  onBack: () => void
  onSave: (profile: ProfileDraft) => Promise<void>
}

type ExperienceItem = ParseCvOutput['experience'][number]
type EducationItem = ParseCvOutput['education'][number]
type ExperienceTextField = Exclude<keyof ExperienceItem, 'bullets'>

export interface ProfileDraft {
  full_name: string
  email: string
  summary: string
  skills: string[]
  experience: ExperienceItem[]
  education: EducationItem[]
  target_roles: string[]
  country_of_residence: string
  right_to_work_countries: string[]
}

export default function ProfileReview({
  parsedCv,
  onBack,
  onSave,
}: ProfileReviewProps) {
  const [fullName, setFullName] = useState(parsedCv.full_name ?? '')
  const [email, setEmail] = useState(parsedCv.email ?? '')
  const [summary, setSummary] = useState(parsedCv.summary ?? '')
  const [skills, setSkills] = useState<string[]>(
    parsedCv.skills ?? [],
  )
  const [skillInput, setSkillInput] = useState('')
  const [targetRoles, setTargetRoles] = useState(
    parsedCv.suggested_target_roles.join(', '),
  )
  const [experience, setExperience] = useState<ExperienceItem[]>(
    parsedCv.experience ?? [],
  )
  const [education, setEducation] = useState<EducationItem[]>(
    parsedCv.education ?? [],
  )
  const [country, setCountry] = useState('')
  const [rightToWork, setRightToWork] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addSkill(value: string) {
    const newSkill = value.trim()

    if (
      newSkill &&
      !skills.some(
        (skill) => skill.toLowerCase() === newSkill.toLowerCase(),
      )
    ) {
      setSkills((current) => [...current, newSkill])
    }

    setSkillInput('')
  }

  function handleSkillKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addSkill(skillInput)
    }
  }

  function updateExperienceField(
    index: number,
    field: ExperienceTextField,
    value: string,
  ) {
    setExperience((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item,
      ),
    )
  }

  function updateExperienceBullets(index: number, value: string) {
    setExperience((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              bullets: value
                .split('\n')
                .map((bullet) => bullet.trim())
                .filter(Boolean),
            }
          : item,
      ),
    )
  }

  function updateEducationField(
    index: number,
    field: keyof EducationItem,
    value: string,
  ) {
    setEducation((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item,
      ),
    )
  }

  function addExperience() {
    setExperience((current) => [
      ...current,
      {
        company: '',
        title: '',
        start: '',
        end: '',
        bullets: [],
      },
    ])
  }

  function addEducation() {
    setEducation((current) => [
      ...current,
      {
        institution: '',
        degree: '',
        year: '',
      },
    ])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!country.trim() || !rightToWork.trim()) {
      setError(
        'Please provide your country of residence and countries where you can work without sponsorship.',
      )
      return
    }

    setLoading(true)

    try {
      await onSave({
        full_name: fullName.trim(),
        email: email.trim(),
        summary: summary.trim(),
        skills,
        experience,
        education,
        target_roles: targetRoles
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        country_of_residence: country.trim(),
        right_to_work_countries: rightToWork
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save your profile.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <section className="mx-auto max-w-2xl rounded-xl bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          AI-generated, please verify
        </p>

        <h1 className="mt-2 text-2xl font-bold">
          {copy.onboarding.reviewTitle}
        </h1>

        <p className="mt-2 text-gray-600">
          {copy.onboarding.reviewDescription}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          <section className="space-y-5">
            <h2 className="text-lg font-semibold">Personal information</h2>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Full name
              </label>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-gray-300 p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Professional summary
              </label>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 p-3"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Skills</h2>

            <div className="flex flex-wrap gap-2">
              {skills.map((skill, index) => (
                <span
                  key={`${skill}-${index}`}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-sm text-blue-800"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() =>
                      setSkills((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                    aria-label={`Remove ${skill}`}
                    className="font-bold text-blue-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={skillInput}
                onChange={(event) => setSkillInput(event.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="Add a skill, then press Enter"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 p-3"
              />
              <button
                type="button"
                onClick={() => addSkill(skillInput)}
                className="rounded-lg bg-gray-900 px-4 text-sm font-medium text-white"
              >
                Add
              </button>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Experience</h2>
              <button
                type="button"
                onClick={addExperience}
                className="text-sm font-medium text-blue-600"
              >
                + Add experience
              </button>
            </div>

            {experience.length === 0 && (
              <p className="text-sm text-gray-500">
                No experience added yet.
              </p>
            )}

            <div className="space-y-4">
              {experience.map((item, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex justify-between">
                    <h3 className="font-medium">
                      Experience {index + 1}
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setExperience((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      className="text-sm text-red-600"
                    >
                      Remove
                    </button>
                  </div>

                  <input
                    value={item.title}
                    onChange={(event) =>
                      updateExperienceField(index, 'title', event.target.value)
                    }
                    placeholder="Job title"
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />

                  <input
                    value={item.company}
                    onChange={(event) =>
                      updateExperienceField(index, 'company', event.target.value)
                    }
                    placeholder="Company"
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={item.start}
                      onChange={(event) =>
                        updateExperienceField(index, 'start', event.target.value)
                      }
                      placeholder="Start date"
                      className="w-full rounded-lg border border-gray-300 p-3"
                    />

                    <input
                      value={item.end}
                      onChange={(event) =>
                        updateExperienceField(index, 'end', event.target.value)
                      }
                      placeholder="End date"
                      className="w-full rounded-lg border border-gray-300 p-3"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Responsibilities and achievements
                    </label>
                    <textarea
                      value={item.bullets.join('\n')}
                      onChange={(event) =>
                        updateExperienceBullets(index, event.target.value)
                      }
                      rows={4}
                      placeholder={'Enter one responsibility per line'}
                      className="w-full rounded-lg border border-gray-300 p-3"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Education</h2>
              <button
                type="button"
                onClick={addEducation}
                className="text-sm font-medium text-blue-600"
              >
                + Add education
              </button>
            </div>

            {education.length === 0 && (
              <p className="text-sm text-gray-500">
                No education added yet.
              </p>
            )}

            <div className="space-y-4">
              {education.map((item, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex justify-between">
                    <h3 className="font-medium">
                      Education {index + 1}
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setEducation((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      className="text-sm text-red-600"
                    >
                      Remove
                    </button>
                  </div>

                  <input
                    value={item.institution}
                    onChange={(event) =>
                      updateEducationField(
                        index,
                        'institution',
                        event.target.value,
                      )
                    }
                    placeholder="Institution"
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />

                  <input
                    value={item.degree}
                    onChange={(event) =>
                      updateEducationField(index, 'degree', event.target.value)
                    }
                    placeholder="Degree or qualification"
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />

                  <input
                    value={item.year}
                    onChange={(event) =>
                      updateEducationField(index, 'year', event.target.value)
                    }
                    placeholder="Year"
                    className="w-full rounded-lg border border-gray-300 p-3"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <h2 className="text-lg font-semibold">Career preferences</h2>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Target roles
              </label>
              <input
                value={targetRoles}
                onChange={(event) => setTargetRoles(event.target.value)}
                placeholder="Data Analyst, Frontend Developer"
                className="w-full rounded-lg border border-gray-300 p-3"
              />
              <p className="mt-1 text-xs text-gray-500">
                Separate roles with commas.
              </p>
            </div>
          </section>

          <section className="space-y-5">
            <h2 className="text-lg font-semibold">Work authorisation</h2>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {copy.onboarding.countryLabel}
              </label>
              <input
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="e.g. Nigeria"
                required
                className="w-full rounded-lg border border-gray-300 p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {copy.onboarding.rightToWorkLabel}
              </label>
              <input
                value={rightToWork}
                onChange={(event) => setRightToWork(event.target.value)}
                placeholder="e.g. Nigeria, United Kingdom"
                required
                className="w-full rounded-lg border border-gray-300 p-3"
              />
              <p className="mt-1 text-xs text-gray-500">
                List countries separated by commas. Only include countries
                where you are legally authorised to work without sponsorship.
              </p>
            </div>
          </section>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={loading}
              className="w-1/3 rounded-lg border border-gray-300 px-4 py-3 font-medium"
            >
              Back
            </button>

            <button
              type="submit"
              disabled={loading}
              className="w-2/3 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white disabled:opacity-60"
            >
              {loading ? copy.onboarding.saving : copy.onboarding.saveButton}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

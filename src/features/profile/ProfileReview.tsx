import { useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  User,
  Briefcase,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Plus,
  Trash2,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  X,
  Target,
} from 'lucide-react'
import { AI_LABEL, type ParseCvOutput } from '../../../shared/schema'
import {
  COUNTRIES,
  normaliseCountry,
  type Country,
} from '../../../shared/countries'
import { copy } from '../../lib/copy'
import { Badge } from '../../components/Badge'

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
  country_of_residence: Country
  right_to_work_countries: Country[]
}

export default function ProfileReview({
  parsedCv,
  onBack,
  onSave,
}: ProfileReviewProps) {
  const [fullName, setFullName] = useState(parsedCv.full_name ?? '')
  const [email, setEmail] = useState(parsedCv.email ?? '')
  const [summary, setSummary] = useState(parsedCv.summary ?? '')
  const [skills, setSkills] = useState<string[]>(parsedCv.skills ?? [])
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
  const [country, setCountry] = useState<Country | ''>('')
  const [rightToWork, setRightToWork] = useState<Country[]>([])
  const [rightToWorkInput, setRightToWorkInput] = useState('')
  const [rightToWorkError, setRightToWorkError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addSkill(value: string) {
    const newSkill = value.trim()

    if (
      newSkill &&
      !skills.some((skill) => skill.toLowerCase() === newSkill.toLowerCase())
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

  function addRightToWork(value: string) {
    if (!value.trim()) return

    const match = normaliseCountry(value)

    if (!match) {
      setRightToWorkError('Choose a recognized country from the list.')
      return
    }

    setRightToWorkError('')
    setRightToWork((current) =>
      current.includes(match) ? current : [...current, match],
    )
    setRightToWorkInput('')
  }

  function handleRightToWorkKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addRightToWork(rightToWorkInput)
    }
  }

  function updateExperienceField(
    index: number,
    field: ExperienceTextField,
    value: string,
  ) {
    setExperience((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
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
        itemIndex === index ? { ...item, [field]: value } : item,
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

    if (!country || rightToWork.length === 0) {
      setError(
        'Please specify your country of residence and at least one country where you can work without visa sponsorship.',
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
        country_of_residence: country,
        right_to_work_countries: rightToWork,
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
    <main className="min-h-screen bg-slate-50/70 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Step Indicator Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            <span>Step 2 of 2</span>
            <span>Review & Verify Information</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full w-full rounded-full bg-blue-600 transition-all duration-300" />
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-100">
            <div>
              <Badge variant="ai" size="sm">
                {AI_LABEL}
              </Badge>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {copy.onboarding.reviewTitle}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {copy.onboarding.reviewDescription}
              </p>
            </div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Upload</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-10">
            {/* Section 1: Personal Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <User className="h-4.5 w-4.5 text-blue-600" />
                <h2>Personal Details</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Full name *
                  </label>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    placeholder="e.g. Jane Doe"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Contact email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="jane@example.com"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Professional summary
                </label>
                <textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  rows={4}
                  placeholder="Summarise your background, core strengths, and domain expertise..."
                  className="w-full rounded-xl border border-slate-300 p-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors leading-relaxed"
                />
              </div>
            </div>

            {/* Section 2: Skills Cloud */}
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Sparkles className="h-4.5 w-4.5 text-blue-600" />
                  <h2>Skills Cloud</h2>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {skills.length} skills listed
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <span
                    key={`${skill}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-medium text-blue-900 shadow-2xs"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSkills((current) => current.filter((_, i) => i !== index))
                      }
                      aria-label={`Remove ${skill}`}
                      className="rounded p-0.5 text-blue-600 hover:bg-blue-200 hover:text-blue-900 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  placeholder="Type a skill and press Enter or comma..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => addSkill(skillInput)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Skill</span>
                </button>
              </div>
            </div>

            {/* Section 3: Experience */}
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Briefcase className="h-4.5 w-4.5 text-blue-600" />
                  <h2>Work Experience</h2>
                </div>
                <button
                  type="button"
                  onClick={addExperience}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Role</span>
                </button>
              </div>

              {experience.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No experience added yet.</p>
              ) : (
                <div className="space-y-4">
                  {experience.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5 space-y-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Role #{index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExperience((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={item.title}
                          onChange={(event) =>
                            updateExperienceField(index, 'title', event.target.value)
                          }
                          placeholder="Job title (e.g. Senior Software Engineer)"
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"
                        />
                        <input
                          value={item.company}
                          onChange={(event) =>
                            updateExperienceField(index, 'company', event.target.value)
                          }
                          placeholder="Company name"
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={item.start}
                          onChange={(event) =>
                            updateExperienceField(index, 'start', event.target.value)
                          }
                          placeholder="Start date (e.g. Jan 2021)"
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"
                        />
                        <input
                          value={item.end}
                          onChange={(event) =>
                            updateExperienceField(index, 'end', event.target.value)
                          }
                          placeholder="End date (or Present)"
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                          Key Responsibilities & Highlights (one per line)
                        </label>
                        <textarea
                          value={item.bullets.join('\n')}
                          onChange={(event) =>
                            updateExperienceBullets(index, event.target.value)
                          }
                          rows={3}
                          placeholder="Enter one achievement or responsibility per line"
                          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 leading-relaxed font-sans"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Education */}
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <GraduationCap className="h-4.5 w-4.5 text-blue-600" />
                  <h2>Education & Certifications</h2>
                </div>
                <button
                  type="button"
                  onClick={addEducation}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Education</span>
                </button>
              </div>

              {education.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No education added yet.</p>
              ) : (
                <div className="space-y-3">
                  {education.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Qualification #{index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setEducation((current) =>
                              current.filter((_, i) => i !== index),
                            )
                          }
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <input
                          value={item.degree}
                          onChange={(event) =>
                            updateEducationField(index, 'degree', event.target.value)
                          }
                          placeholder="Degree (e.g. BSc Computer Science)"
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none sm:col-span-1"
                        />
                        <input
                          value={item.institution}
                          onChange={(event) =>
                            updateEducationField(index, 'institution', event.target.value)
                          }
                          placeholder="Institution or University"
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none sm:col-span-1"
                        />
                        <input
                          value={item.year}
                          onChange={(event) =>
                            updateEducationField(index, 'year', event.target.value)
                          }
                          placeholder="Graduation Year (e.g. 2022)"
                          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none sm:col-span-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 5: Target Roles & Preferences */}
            <div className="space-y-4 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Target className="h-4.5 w-4.5 text-blue-600" />
                <h2>Career Target Roles</h2>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Target roles (comma-separated)
                </label>
                <input
                  value={targetRoles}
                  onChange={(event) => setTargetRoles(event.target.value)}
                  placeholder="Data Analyst, Frontend Developer, Product Manager"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Used by AI when generating targeted outreach and customising applications.
                </p>
              </div>
            </div>

            {/* Section 6: Work Authorisation */}
            <div className="space-y-5 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
                <h2>Work Authorisation & Eligibility</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Work authorisation is never guessed by AI. Select your exact country of residence and the countries where you hold legal right to work without needing employer sponsorship.
              </p>

              <div>
                <label
                  htmlFor="country-of-residence"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  {copy.onboarding.countryLabel} *
                </label>
                <select
                  id="country-of-residence"
                  value={country}
                  onChange={(event) =>
                    setCountry(event.target.value as Country | '')
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
                >
                  <option value="">Select country of residence</option>
                  {COUNTRIES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="right-to-work"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  {copy.onboarding.rightToWorkLabel} *
                </label>

                {rightToWork.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {rightToWork.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setRightToWork((current) =>
                              current.filter((item) => item !== name),
                            )
                          }
                          aria-label={`Remove ${name}`}
                          className="rounded p-0.5 text-emerald-700 hover:bg-emerald-200 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    id="right-to-work"
                    list="kariyaly-country-list"
                    value={rightToWorkInput}
                    onChange={(event) => {
                      setRightToWorkInput(event.target.value)
                      setRightToWorkError('')
                    }}
                    onKeyDown={handleRightToWorkKeyDown}
                    placeholder="Type country name (e.g. United Kingdom, Nigeria, Canada)..."
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => addRightToWork(rightToWorkInput)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <datalist id="kariyaly-country-list">
                  {COUNTRIES.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>

                {country && !rightToWork.includes(country) && (
                  <button
                    type="button"
                    onClick={() => addRightToWork(country)}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    + Add residence country ({country}) to right-to-work list
                  </button>
                )}

                {rightToWorkError && (
                  <p role="alert" className="mt-1.5 text-xs font-semibold text-rose-600">
                    {rightToWorkError}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {/* Submit Actions */}
            <div className="flex items-center gap-4 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={onBack}
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Back to Upload
              </button>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{copy.onboarding.saving}</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{copy.onboarding.saveButton} & Launch Workspace</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}

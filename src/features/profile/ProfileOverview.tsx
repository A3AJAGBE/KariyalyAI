import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  User,
  Briefcase,
  GraduationCap,
  Sparkles,
  MapPin,
  ShieldCheck,
  Trash2,
  Upload,
  Kanban,
  Calendar,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabase'
import { Badge } from '../../components/Badge'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'

interface ExperienceItem {
  company: string
  title: string
  start: string
  end: string
  bullets: string[]
}

interface EducationItem {
  institution: string
  degree: string
  year: string
}

interface ProfileRecord {
  full_name: string
  email: string
  summary: string
  skills: string[]
  target_roles: string[]
  experience: ExperienceItem[]
  education: EducationItem[]
  country_of_residence: string | null
  right_to_work_countries: string[]
  updated_at?: string
}

export default function ProfileOverview() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError('')

      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select(
            'full_name, email, summary, skills, target_roles, experience, education, country_of_residence, right_to_work_countries, updated_at',
          )
          .maybeSingle()

        if (fetchError) {
          setError('Unable to load your profile details.')
          return
        }

        if (data) {
          setProfile({
            full_name: data.full_name || '',
            email: data.email || user?.email || '',
            summary: data.summary || '',
            skills: Array.isArray(data.skills) ? data.skills : [],
            target_roles: Array.isArray(data.target_roles) ? data.target_roles : [],
            experience: Array.isArray(data.experience) ? (data.experience as ExperienceItem[]) : [],
            education: Array.isArray(data.education) ? (data.education as EducationItem[]) : [],
            country_of_residence: data.country_of_residence || null,
            right_to_work_countries: Array.isArray(data.right_to_work_countries)
              ? data.right_to_work_countries
              : [],
            updated_at: data.updated_at,
          })
        }
      } catch {
        setError('Error loading profile.')
      } finally {
        setLoading(false)
      }
    }

    void loadProfile()
  }, [user])

  async function handleDeleteData() {
    setDeleting(true)
    setDeleteError('')

    try {
      const { error: rpcError } = await supabase.rpc('delete_my_data')
      if (rpcError) throw rpcError

      await signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Unable to complete data deletion request.',
      )
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-500">Loading your profile workspace...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-10">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-900/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-200">
              <Sparkles className="h-3.5 w-3.5 text-blue-300" />
              <span>Executive Career Workspace</span>
            </div>

            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
              {profile?.full_name ? `Welcome back, ${profile.full_name}` : 'Ready for your next career move?'}
            </h1>

            <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
              Match jobs against your structured profile, check UK sponsor licenses, craft tailored applications, and track progress effortlessly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/app/jobs/new')}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-[0.99] cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Analyse a Job</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/tracker')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 transition-all cursor-pointer"
            >
              <Kanban className="h-4 w-4 text-slate-300" />
              <span>Open Tracker</span>
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Main Profile Content or Empty State */}
      {!profile ? (
        <EmptyState
          icon={<User className="h-7 w-7 text-blue-600" />}
          title="No profile created yet"
          description="Upload your CV or paste its text to build your structured profile and unlock intelligent job matching."
          action={
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" />
              <span>Import CV & Create Profile</span>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Summary, Target Roles, Work Authorisation */}
          <div className="space-y-6 lg:col-span-1">
            {/* Identity Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 font-bold text-white text-lg shadow-sm">
                  {profile.full_name.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{profile.full_name || 'Anonymous User'}</h2>
                  <p className="text-xs text-slate-500">{profile.email || user?.email}</p>
                </div>
              </div>

              {profile.summary && (
                <div className="pt-4 border-t border-slate-100">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Executive Summary
                  </span>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {profile.summary}
                  </p>
                </div>
              )}

              {/* Target Roles */}
              {profile.target_roles.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Target Roles
                  </span>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {profile.target_roles.map((role, idx) => (
                      <Badge key={idx} variant="primary" size="sm">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-100">
                <Link
                  to="/onboarding"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Update Profile / Re-upload CV</span>
                </Link>
              </div>
            </div>

            {/* Work Authorisation Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">Work Authorisation Details</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Used to evaluate visa requirements and UK sponsor register checks for every analysed job.
              </p>

              <div className="space-y-3.5 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-400 block mb-1">Country of residence</span>
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <MapPin className="h-3.5 w-3.5 text-slate-500" />
                    <span>{profile.country_of_residence || 'Not specified'}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-400 block mb-1.5">Right-to-work countries (no visa needed)</span>
                  {profile.right_to_work_countries.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.right_to_work_countries.map((c, idx) => (
                        <Badge key={idx} variant="success" size="sm">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">None specified</span>
                  )}
                </div>
              </div>
            </div>

            {/* Privacy & Data Management */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Privacy & Control</h2>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                You own your data. Deleting your data removes all uploaded CV text, parsed information, jobs, matches, and application tracker records from our database.
              </p>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete my data</span>
              </button>
            </div>
          </div>

          {/* Right Column: Skills, Experience, Education */}
          <div className="space-y-6 lg:col-span-2">
            {/* Skills Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4.5 w-4.5 text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">Extracted Skills</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                  {profile.skills.length} skills
                </span>
              </div>

              {profile.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-2xs hover:bg-white hover:border-blue-300 transition-colors"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No skills listed yet.</p>
              )}
            </div>

            {/* Experience Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-6">
                <Briefcase className="h-4.5 w-4.5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Work Experience</h2>
              </div>

              {profile.experience.length > 0 ? (
                <div className="space-y-6">
                  {profile.experience.map((exp, index) => (
                    <div
                      key={index}
                      className="relative pl-6 pb-6 border-l-2 border-slate-200 last:border-l-transparent last:pb-0"
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-1.5 top-0.5 h-3 w-3 rounded-full bg-blue-600 border-2 border-white" />

                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{exp.title}</h3>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                          <Calendar className="h-3 w-3" />
                          {exp.start} — {exp.end || 'Present'}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-blue-700 mt-0.5">{exp.company}</p>

                      {exp.bullets && exp.bullets.length > 0 && (
                        <ul className="mt-3 space-y-1.5 text-xs text-slate-600 list-disc list-inside">
                          {exp.bullets.map((bullet, bIdx) => (
                            <li key={bIdx} className="leading-relaxed">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No experience records found.</p>
              )}
            </div>

            {/* Education Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="h-4.5 w-4.5 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Education & Qualifications</h2>
              </div>

              {profile.education.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {profile.education.map((edu, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                      <h3 className="text-sm font-bold text-slate-900">{edu.degree}</h3>
                      <p className="text-xs text-slate-600 mt-1">{edu.institution}</p>
                      {edu.year && (
                        <span className="mt-2 inline-block text-[11px] font-semibold text-slate-500">
                          Class of {edu.year}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No education records found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleting && setDeleteModalOpen(false)}
        title="Delete All My Data"
        description="Permanently remove your profile, CV text, applications, and saved outputs."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>This action cannot be undone</span>
            </div>
            <p className="mt-1 leading-relaxed">
              All your profile data, matched jobs, tailored outputs, and tracker applications will be deleted immediately from the database. Note that free-tier API data already processed by Google's Gemini cannot be deleted retroactively.
            </p>
          </div>

          {deleteError && (
            <p className="text-xs font-semibold text-rose-600">{deleteError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDeleteData()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

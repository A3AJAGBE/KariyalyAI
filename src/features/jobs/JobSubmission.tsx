import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Building2,
  Briefcase,
  MapPin,
  Globe,
  FileText,
  Loader2,
  AlertCircle,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import type { ProfileForAI } from '../../../shared/schema'
import { callAI } from '../../lib/ai'
import { copy } from '../../lib/copy'
import { supabase } from '../../lib/supabase'

export default function JobSubmission() {
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfileForAI | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profileError, setProfileError] = useState('')

  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [description, setDescription] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadProfile() {
      setLoadingProfile(true)
      setProfileError('')

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('full_name, summary, skills, experience, education, target_roles')
        .maybeSingle()

      if (fetchError) {
        setProfileError(copy.jobs.profileError)
        setLoadingProfile(false)
        return
      }

      if (!data) {
        setProfile(null)
        setLoadingProfile(false)
        return
      }

      setProfile({
        full_name: data.full_name ?? '',
        summary: data.summary ?? '',
        skills: data.skills ?? [],
        experience: data.experience ?? [],
        education: data.education ?? [],
        target_roles: data.target_roles ?? [],
      })

      setLoadingProfile(false)
    }

    void loadProfile()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const trimmedDescription = description.trim()

    if (!trimmedDescription) {
      setError(copy.jobs.missingDescription)
      return
    }

    if (trimmedDescription.length > 8000) {
      setError(copy.jobs.descriptionTooLong)
      return
    }

    if (!profile) {
      setError(copy.jobs.missingProfile)
      return
    }

    setLoading(true)

    try {
      const aiResult = await callAI('match_job', {
        profile,
        job: {
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(company.trim() ? { company: company.trim() } : {}),
          ...(location.trim() ? { location: location.trim() } : {}),
          description: trimmedDescription,
        },
      })

      if (!aiResult.ok) {
        setError(aiResult.error.message)
        return
      }

      const { data: savedJob, error: jobError } = await supabase
        .from('jobs')
        .insert({
          title: aiResult.data.job.title || title.trim(),
          company: aiResult.data.job.company || company.trim(),
          location_text: aiResult.data.job.location_text || location.trim(),
          location_country: aiResult.data.job.location_country,
          is_remote: aiResult.data.job.is_remote,
          description_text: trimmedDescription,
          source_url: sourceUrl.trim() || null,
        })
        .select('id')
        .single()

      if (jobError || !savedJob) {
        setError(copy.jobs.saveError)
        return
      }

      const { error: matchError } = await supabase.from('matches').insert({
        job_id: savedJob.id,
        score: aiResult.data.score,
        verdict: aiResult.data.verdict,
        summary: aiResult.data.summary,
        strengths: aiResult.data.strengths,
        gaps: aiResult.data.gaps,
      })

      if (matchError) {
        await supabase.from('jobs').delete().eq('id', savedJob.id)
        setError(copy.jobs.saveError)
        return
      }

      navigate(`/app/jobs/${savedJob.id}`)
    } catch {
      setError(copy.jobs.analysisError)
    } finally {
      setLoading(false)
    }
  }

  if (loadingProfile) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-500">
          {copy.jobs.loadingProfile}
        </p>
      </div>
    )
  }

  if (profileError) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-600 mb-2" />
        <h2 className="text-sm font-bold text-rose-900">Profile Loading Issue</h2>
        <p className="mt-1 text-xs text-rose-700">{profileError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 mb-4">
          <User className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Candidate Profile Required</h1>
        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
          {copy.jobs.missingProfile}
        </p>
        <button
          type="button"
          onClick={() => navigate('/onboarding')}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700"
        >
          <span>Create your profile</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const charPercentage = Math.min(100, Math.round((description.length / 8000) * 100))

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              AI Match & Visa Eligibility Check
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {copy.jobs.title}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            {copy.jobs.description}
          </p>
        </div>

        {/* Profile Active Badge */}
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-xs">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
            {profile.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="text-left text-xs">
            <span className="block font-semibold text-slate-800">
              {profile.full_name || 'Candidate Profile'}
            </span>
            <span className="block text-[10px] text-slate-400">
              Active Candidate Profile
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job Metadata Grid */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-600" />
            <span>Job Details (Optional — AI can infer from posting)</span>
          </h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="job-title"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                {copy.jobs.jobTitleLabel}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Briefcase className="h-4 w-4" />
                </div>
                <input
                  id="job-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={copy.jobs.jobTitlePlaceholder}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="company"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                {copy.jobs.companyLabel}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Building2 className="h-4 w-4" />
                </div>
                <input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder={copy.jobs.companyPlaceholder}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="location"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                {copy.jobs.locationLabel}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <MapPin className="h-4 w-4" />
                </div>
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder={copy.jobs.locationPlaceholder}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="source-url"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                {copy.jobs.urlLabel}
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Globe className="h-4 w-4" />
                </div>
                <input
                  id="source-url"
                  type="url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder={copy.jobs.urlPlaceholder}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Job Description Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <label
              htmlFor="job-description"
              className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2"
            >
              <FileText className="h-4 w-4 text-blue-600" />
              <span>Full Job Description *</span>
            </label>
            <span
              className={`text-xs font-medium ${
                description.length > 8000 ? 'text-rose-600 font-bold' : 'text-slate-400'
              }`}
            >
              {description.length.toLocaleString()} / 8,000 characters
            </span>
          </div>

          <textarea
            id="job-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={copy.jobs.descriptionPlaceholder}
            maxLength={8000}
            rows={12}
            required
            className="w-full rounded-2xl border border-slate-300 p-4 text-xs font-mono text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors leading-relaxed"
          />

          <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full transition-all ${
                charPercentage > 90 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${charPercentage}%` }}
            />
          </div>

          <p className="text-xs text-slate-500">
            {copy.jobs.descriptionHint} Paste requirements, qualifications, and role responsibilities.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <p className="font-medium leading-relaxed">{error}</p>
          </div>
        )}

        {/* Action Button & Loading Steps */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <button
            type="submit"
            disabled={loading || !description.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-sm font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{copy.jobs.submitting}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>{copy.jobs.submitButton}</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </button>

          {loading && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
                Extracting job requirements
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
                Scoring candidate match
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                Verifying UK sponsor register
              </span>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}

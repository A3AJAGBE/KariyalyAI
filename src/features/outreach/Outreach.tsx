import { useEffect, useState } from 'react'
import {
  Send,
  Mail,
  Sparkles,
  User,
  Loader2,
  AlertCircle,
  Shield,
} from 'lucide-react'
import type {
  Channel,
  MessageType,
  ProfileForAI,
  Tone,
} from '../../../shared/schema'
import { callAI } from '../../lib/ai'
import { supabase } from '../../lib/supabase'
import { Badge } from '../../components/Badge'
import { CopyButton } from '../../components/CopyButton'

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
    </svg>
  )
}

interface OutreachProps {
  jobId: string
  company: string
  role: string
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

async function inputHash(input: unknown) {
  const encoded = new TextEncoder().encode(`outreach:${stableStringify(input)}`)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export default function Outreach({ jobId, company, role }: OutreachProps) {
  const [profile, setProfile] = useState<ProfileForAI | null>(null)
  const [recruiterName, setRecruiterName] = useState('')
  const [channel, setChannel] = useState<Channel>('email')
  const [tone, setTone] = useState<Tone>('professional')
  const [messageType, setMessageType] = useState<MessageType>('first')
  const [subject, setSubject] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select(
          'full_name, summary, skills, experience, education, target_roles',
        )
        .maybeSingle()

      if (!active) return

      if (profileError || !data) {
        setError('Create your professional profile before generating outreach.')
      } else {
        const loadedProfile = {
          full_name: data.full_name ?? '',
          summary: data.summary ?? '',
          skills: data.skills ?? [],
          experience: data.experience ?? [],
          education: data.education ?? [],
          target_roles: data.target_roles ?? [],
        }
        setProfile(loadedProfile)
      }
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!profile || !recruiterName.trim()) return

    let active = true
    async function loadSaved() {
      const input = {
        profile,
        recruiter_name: recruiterName.trim(),
        role,
        company,
        channel,
        tone,
        message_type: messageType,
      }
      const hash = await inputHash(input)
      const { data } = await supabase
        .from('generated_outputs')
        .select('content')
        .eq('job_id', jobId)
        .eq('kind', 'outreach')
        .eq('input_hash', hash)
        .maybeSingle()

      if (active && data?.content && typeof data.content === 'object') {
        const content = data.content as { subject?: unknown; message?: unknown }
        setSubject(typeof content.subject === 'string' ? content.subject : null)
        setMessage(typeof content.message === 'string' ? content.message : '')
      }
    }

    void loadSaved()
    return () => {
      active = false
    }
  }, [channel, company, jobId, messageType, profile, recruiterName, role, tone])

  async function generate() {
    if (!profile || !recruiterName.trim()) {
      setError('Please provide the recruiter or hiring manager name.')
      return
    }

    setGenerating(true)
    setError('')
    setFeedback('')

    const input = {
      profile,
      recruiter_name: recruiterName.trim(),
      role,
      company,
      channel,
      tone,
      message_type: messageType,
    }

    try {
      const result = await callAI('outreach', input, { force: true })
      if (!result.ok) throw new Error(result.error.message)

      const hash = await inputHash(input)
      const { error: saveError } = await supabase.from('generated_outputs').upsert(
        {
          job_id: jobId,
          kind: 'outreach',
          content: result.data,
          input_hash: hash,
          meta: { channel, tone, message_type: messageType },
        },
        { onConflict: 'user_id,input_hash,kind' },
      )

      if (saveError) throw saveError
      setSubject(result.data.subject)
      setMessage(result.data.message)
      setFeedback('Outreach draft generated successfully.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to generate outreach.',
      )
    } finally {
      setGenerating(false)
    }
  }

  const fullTextToCopy = subject ? `Subject: ${subject}\n\n${message}` : message

  if (loading) {
    return (
      <div className="flex min-h-[250px] flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-500">Loading profile data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Configuration Card */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Send className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Personalised Outreach Generator
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">
              Contact Recruiter or Hiring Manager
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Craft targeted messages referencing your specific strengths for {role} at {company}.
            </p>
          </div>

          <Badge variant="ai" size="sm">
            AI-generated, please verify
          </Badge>
        </div>

        {/* Inputs Form */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Recruiter Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Contact Name (Recruiter or Team Lead) *
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={recruiterName}
                onChange={(event) => {
                  setRecruiterName(event.target.value)
                  setError('')
                }}
                placeholder="e.g. Sarah Jenkins or Hiring Team"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
              />
            </div>
          </div>

          {/* Channel Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Communication Channel
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/60">
              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                  channel === 'email'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Email</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('linkedin')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                  channel === 'linkedin'
                    ? 'bg-white text-[#0a66c2] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LinkedInIcon className="h-3.5 w-3.5" />
                <span>LinkedIn</span>
              </button>
            </div>
          </div>

          {/* Tone Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Tone of Voice
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/60">
              {(['professional', 'friendly', 'concise'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-all cursor-pointer ${
                    tone === t
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Message Type Selector */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Message Sequence
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'first', label: '1. Initial Contact', desc: 'First introduction' },
                { id: 'follow_up_1', label: '2. Follow-Up #1', desc: 'Friendly nudge' },
                { id: 'follow_up_2', label: '3. Follow-Up #2', desc: 'Final check-in' },
              ].map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setMessageType(step.id as MessageType)}
                  className={`rounded-2xl border p-3 text-left transition-all cursor-pointer ${
                    messageType === step.id
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-xs font-bold">{step.label}</span>
                  <span className="block text-[11px] text-slate-400 mt-0.5">{step.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {feedback && (
          <p className="text-xs font-semibold text-emerald-700 animate-in fade-in">
            {feedback}
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating || !recruiterName.trim()}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Crafting Outreach Message...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Generate Outreach Draft</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Generated Message Simulator Preview */}
      {message && (
        <article className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden animate-in fade-in duration-300">
          {/* Simulated Composer Header */}
          <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {channel === 'email' ? (
                <Mail className="h-4 w-4 text-blue-400" />
              ) : (
                <LinkedInIcon className="h-4 w-4 text-[#0a66c2]" />
              )}
              <span className="text-xs font-bold tracking-wide">
                {channel === 'email' ? 'Draft Email' : 'LinkedIn Message Draft'}
              </span>
            </div>

            <CopyButton
              text={fullTextToCopy}
              size="sm"
              label="Copy Entire Message"
              className="!bg-white/10 !border-white/20 !text-white hover:!bg-white/20"
            />
          </div>

          <div className="p-6 sm:p-8 space-y-4">
            {channel === 'email' && subject && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Subject Line:
                </span>
                <span className="text-sm font-semibold text-slate-900">{subject}</span>
              </div>
            )}

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Message Body:
              </span>
              <div className="whitespace-pre-line rounded-2xl border border-slate-200 bg-slate-50/30 p-5 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans">
                {message}
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
              <Shield className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span>
                KariyalyAI never sends messages on your behalf. Copy the text and send it through your preferred client.
              </span>
            </div>
          </div>
        </article>
      )}
    </div>
  )
}

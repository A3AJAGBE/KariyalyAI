import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileCheck,
  Shield,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { extractCvText } from '../../lib/extractCvText'
import { callAI } from '../../lib/ai'
import { copy } from '../../lib/copy'
import { supabase } from '../../lib/supabase'
import {
  AI_LABEL,
  INPUT_CAPS,
  type ParseCvOutput,
} from '../../../shared/schema'
import ProfileReview, {
  type ProfileDraft,
} from './ProfileReview'
import { Badge } from '../../components/Badge'

export default function Onboarding() {
  const navigate = useNavigate()

  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload')
  const [cvText, setCvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState<string>('')
  const [parsedCv, setParsedCv] = useState<ParseCvOutput | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [consent, setConsent] = useState(false)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    setError('')
    setParsedCv(null)
    setShowReview(false)
    setFileName(file.name)
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`)
    setExtracting(true)

    try {
      const result = await extractCvText(file)
      setCvText(result.text)

      if (result.needsManualInput) {
        setError(result.message ?? copy.onboarding.manualInput)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to read this file. Please check format or paste text.',
      )
    } finally {
      setExtracting(false)
    }
  }

  async function handleParseCv() {
    setError('')
    setParsedCv(null)

    const trimmedText = cvText.trim()

    if (!trimmedText) {
      setError('Please upload your CV document or paste its text.')
      return
    }

    if (trimmedText.length > INPUT_CAPS.cv_text) {
      setError(
        `Your CV text must not exceed ${INPUT_CAPS.cv_text.toLocaleString()} characters.`,
      )
      return
    }

    if (!consent) {
      setError('Please confirm the consent checkbox before analysing your CV.')
      return
    }

    setLoading(true)

    try {
      const result = await callAI('parse_cv', {
        cv_text: trimmedText,
      })

      if (!result.ok) {
        setError(result.error.message)
        return
      }

      setParsedCv(result.data)
    } catch {
      setError('Unable to analyse your CV. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleProfileSave(profile: ProfileDraft) {
    setError('')

    const { error: saveError } = await supabase
      .from('profiles')
      .upsert(
        {
          ...profile,
          raw_cv_text: cvText.trim(),
        },
        {
          onConflict: 'user_id',
        },
      )

    if (saveError) {
      throw new Error(saveError.message)
    }

    navigate('/app/profile', { replace: true })
  }

  if (showReview && parsedCv) {
    return (
      <ProfileReview
        parsedCv={parsedCv}
        onBack={() => setShowReview(false)}
        onSave={handleProfileSave}
      />
    )
  }

  const charPercentage = Math.min(
    100,
    Math.round((cvText.length / INPUT_CAPS.cv_text) * 100),
  )

  return (
    <main className="min-h-screen bg-slate-50/70 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Step Indicator Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            <span>Step 1 of 2</span>
            <span>Profile Setup</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-blue-600 transition-all duration-300" />
          </div>
        </div>

        {/* Card */}
        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {copy.onboarding.title}
              </h1>
              <p className="text-sm text-slate-500">
                {copy.onboarding.description}
              </p>
            </div>
          </div>

          {/* Mode Tabs: Upload vs Paste */}
          <div className="mt-8 flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setInputMode('upload')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                inputMode === 'upload'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Document (.pdf, .docx)</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('paste')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                inputMode === 'paste'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Paste Text Directly</span>
            </button>
          </div>

          {/* Mode 1: File Upload */}
          {inputMode === 'upload' && (
            <div className="mt-6">
              <label
                htmlFor="cv-upload-input"
                className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/30 cursor-pointer"
              >
                <input
                  id="cv-upload-input"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="sr-only"
                />

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/60 mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6" />
                </div>

                <p className="text-sm font-semibold text-slate-800">
                  {fileName ? 'Replace CV document' : 'Click to select or drag and drop your CV'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Supported formats: PDF or Microsoft Word (.docx)
                </p>

                {fileName && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-medium text-slate-700">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold">{fileName}</span>
                    <span className="text-slate-400">({fileSize})</span>
                    <span className="ml-2 text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Extracted
                    </span>
                  </div>
                )}
              </label>

              {extracting && (
                <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Extracting document text in browser...</span>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Paste Text or Text Preview */}
          {(inputMode === 'paste' || cvText.length > 0) && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="cv-text-input"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  CV Content Preview & Editor
                </label>
                <span
                  className={`text-xs font-medium ${
                    cvText.length > INPUT_CAPS.cv_text
                      ? 'text-rose-600 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {cvText.length.toLocaleString()} / {INPUT_CAPS.cv_text.toLocaleString()} chars
                </span>
              </div>

              <textarea
                id="cv-text-input"
                value={cvText}
                onChange={(event) => {
                  setCvText(event.target.value)
                  setParsedCv(null)
                  setShowReview(false)
                  setError('')
                }}
                placeholder={copy.onboarding.pastePlaceholder}
                rows={10}
                maxLength={INPUT_CAPS.cv_text}
                className="w-full rounded-2xl border border-slate-300 p-4 text-xs font-mono text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-colors"
              />

              <div className="mt-1 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    charPercentage > 90 ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${charPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Privacy & Consent Card */}
          <div className="mt-8 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span>Data Protection & AI Consent</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {copy.onboarding.privacyNote}
            </p>

            <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700 cursor-pointer hover:bg-slate-50/80 transition-colors">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked)
                  setError('')
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="leading-relaxed">
                My CV text will be sent to Google's Gemini API to build my profile.
                On the free tier, Google may use submitted data to improve its
                products. Deleting my data in KariyalyAI does not delete anything
                Google may have kept.
              </span>
            </label>
          </div>

          {/* Error Notice */}
          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 animate-in fade-in"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <p className="font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {/* Parse Button */}
          <button
            type="button"
            onClick={() => void handleParseCv()}
            disabled={loading || !consent || !cvText.trim()}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{copy.onboarding.parsing}</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>{copy.onboarding.parseButton}</span>
              </>
            )}
          </button>

          {/* Success Result Card */}
          {parsedCv && (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <Badge variant="ai" size="sm">
                  {AI_LABEL}
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Ready to review
                </span>
              </div>

              <h2 className="mt-3 text-lg font-bold text-slate-900">
                CV successfully parsed
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                We extracted details for{' '}
                <span className="font-semibold text-slate-900">
                  {parsedCv.full_name || 'your profile'}
                </span>
                . In the next step, verify the parsed skills, experience, and set your work authorisation countries.
              </p>

              <button
                type="button"
                onClick={() => setShowReview(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span>Continue to Profile Review</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

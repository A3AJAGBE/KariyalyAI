
import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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

export default function Onboarding() {
  const navigate = useNavigate()

  const [cvText, setCvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsedCv, setParsedCv] = useState<ParseCvOutput | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [consent, setConsent] = useState(false)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    setError('')
    setParsedCv(null)
    setShowReview(false)
    setFileName(file.name)

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
          : 'Unable to read this file.',
      )
    }
  }

  async function handleParseCv() {
    setError('')
    setParsedCv(null)

    const trimmedText = cvText.trim()

    if (!trimmedText) {
      setError('Please upload your CV or paste its text.')
      return
    }

    if (trimmedText.length > INPUT_CAPS.cv_text) {
      setError(
        `Your CV text must not exceed ${INPUT_CAPS.cv_text.toLocaleString()} characters.`,
      )
      return
    }

    if (!consent) {
      setError('Please confirm the consent box before analysing your CV.')
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

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <section className="mx-auto max-w-2xl rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">
          {copy.onboarding.title}
        </h1>

        <p className="mt-2 text-gray-600">
          {copy.onboarding.description}
        </p>

        <div className="mt-8">
          <h2 className="font-semibold">
            {copy.onboarding.uploadTitle}
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {copy.onboarding.uploadDescription}
          </p>

          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileChange}
            className="mt-3 block w-full rounded-lg border border-gray-300 p-3 text-sm"
          />

          {fileName && (
            <p className="mt-2 text-sm text-gray-600">
              Selected file: {fileName}
            </p>
          )}
        </div>

        <div className="my-6 border-t border-gray-200" />

        <div>
          <h2 className="font-semibold">
            {copy.onboarding.pasteTitle}
          </h2>

          <textarea
            value={cvText}
            onChange={(event) => {
              setCvText(event.target.value)
              setParsedCv(null)
              setShowReview(false)
              setError('')
            }}
            placeholder={copy.onboarding.pastePlaceholder}
            rows={12}
            maxLength={INPUT_CAPS.cv_text}
            className="mt-3 w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-blue-500"
          />

          <p className="mt-1 text-right text-xs text-gray-500">
            {cvText.length}/{INPUT_CAPS.cv_text.toLocaleString()} characters
          </p>
        </div>

        <p className="mt-5 text-sm text-gray-500">
          {copy.onboarding.privacyNote}
        </p>

        <label className="mt-4 flex items-start gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => {
              setConsent(event.target.checked)
              setError('')
            }}
            className="mt-1 h-4 w-4"
          />
          <span>
            My CV text will be sent to Google's Gemini API to build my profile.
            On the free tier, Google may use submitted data to improve its
            products. Deleting my data in KariyalyAI does not delete anything
            Google may have kept.
          </span>
        </label>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleParseCv}
          disabled={loading || !consent}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading
            ? copy.onboarding.parsing
            : copy.onboarding.parseButton}
        </button>

        {parsedCv && (
          <div className="mt-8 rounded-lg border border-gray-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              {AI_LABEL}
            </p>

            <h2 className="mt-2 text-lg font-semibold">
              CV successfully analysed
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              We extracted information for{' '}
              {parsedCv.full_name || 'your profile'}. Review the
              extracted information before saving.
            </p>

            <button
              type="button"
              onClick={() => setShowReview(true)}
              className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
            >
              Continue
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

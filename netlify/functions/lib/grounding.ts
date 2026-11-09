/**
 * Pure helpers for Gemini search grounding (company_brief). No network, no secrets.
 * Kept separate from ai.ts so they can be unit tested.
 */
import { z } from 'zod'
import type { GroundingSource, NewsItem } from '../../../shared/schema'

/** The parts of a Gemini generateContent response that the ai function reads. */
export interface GeminiBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
    }
  }>
}

export function getText(body: GeminiBody): string {
  return (body.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
}

/** Web sources Gemini actually used, de-duplicated, https only, at most 10. */
export function extractSources(body: GeminiBody): GroundingSource[] {
  const chunks = body.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
  const seen = new Set<string>()
  const sources: GroundingSource[] = []

  for (const chunk of chunks) {
    const url = chunk.web?.uri
    if (!url || !/^https:\/\//i.test(url) || seen.has(url)) continue

    let fallbackTitle: string
    try {
      fallbackTitle = new URL(url).hostname
    } catch {
      continue // not a parseable URL
    }

    seen.add(url)
    sources.push({ title: chunk.web?.title?.trim() || fallbackTitle, url })
  }

  return sources.slice(0, 10)
}

/** What the second (structuring) Gemini call returns for a grounded brief. */
export const GroundedBriefModel = z.object({
  what_they_do: z.string(),
  values: z.array(z.string()),
  talking_points: z.array(z.string()),
  questions_to_ask: z.array(z.string()),
  recent_news: z.array(
    z.object({
      headline: z.string(),
      /** Index into the numbered sources list given to the model. */
      source_index: z.number().int(),
      date: z.string().nullable(),
    }),
  ),
})
export type GroundedBriefModel = z.infer<typeof GroundedBriefModel>

/**
 * Turns model-proposed news into NewsItems. The URL always comes from the grounding
 * metadata (never from the model). An item whose source_index points at nothing is
 * dropped, so every news item returned has a real source link. At most 5 items.
 */
export function buildNews(
  items: GroundedBriefModel['recent_news'],
  sources: GroundingSource[],
): NewsItem[] {
  const news: NewsItem[] = []
  const seenHeadlines = new Set<string>()

  for (const item of items) {
    const source = sources[item.source_index]
    const headline = item.headline.trim()
    if (!source || !headline || seenHeadlines.has(headline.toLowerCase())) continue

    seenHeadlines.add(headline.toLowerCase())
    news.push({
      headline,
      source: source.title,
      url: source.url,
      date: item.date?.trim() ? item.date.trim() : null,
    })
  }

  return news.slice(0, 5)
}

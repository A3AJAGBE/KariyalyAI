import { describe, expect, it } from 'vitest'

import { buildNews, extractSources, getText, type GeminiBody } from '../netlify/functions/lib/grounding'

const body = (chunks: Array<{ uri?: string; title?: string }>): GeminiBody => ({
  candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] }, groundingMetadata: { groundingChunks: chunks.map((web) => ({ web })) } }],
})

describe('getText', () => {
  it('joins all text parts', () => {
    expect(getText(body([]))).toBe('ab')
  })

  it('returns an empty string for an empty response', () => {
    expect(getText({})).toBe('')
  })
})

describe('extractSources', () => {
  it('keeps https sources, drops duplicates and non-https links', () => {
    const sources = extractSources(
      body([
        { uri: 'https://a.example/1', title: 'a.example' },
        { uri: 'https://a.example/1', title: 'duplicate' },
        { uri: 'http://insecure.example', title: 'insecure' },
        { uri: 'javascript:alert(1)', title: 'script' },
        { title: 'no link' },
      ]),
    )
    expect(sources).toEqual([{ title: 'a.example', url: 'https://a.example/1' }])
  })

  it('uses the host name when a source has no title', () => {
    expect(extractSources(body([{ uri: 'https://news.example/x' }]))[0].title).toBe('news.example')
  })

  it('keeps at most 10 sources', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ uri: `https://s.example/${i}`, title: `s${i}` }))
    expect(extractSources(body(many))).toHaveLength(10)
  })
})

describe('buildNews', () => {
  const sources = [
    { title: 'reuters.com', url: 'https://r.example' },
    { title: 'bbc.co.uk', url: 'https://b.example' },
  ]

  it('takes the link from the indexed source, never from the model', () => {
    expect(buildNews([{ headline: 'Plant opens', source_index: 1, date: '2026-10-01' }], sources)).toEqual([
      { headline: 'Plant opens', source: 'bbc.co.uk', url: 'https://b.example', date: '2026-10-01' },
    ])
  })

  it('drops items that point at no source, blank headlines and repeated headlines', () => {
    const news = buildNews(
      [
        { headline: 'Made up', source_index: 5, date: null },
        { headline: '  ', source_index: 0, date: null },
        { headline: 'Real', source_index: 0, date: null },
        { headline: 'real', source_index: 1, date: null },
      ],
      sources,
    )
    expect(news.map((n) => n.headline)).toEqual(['Real'])
  })

  it('turns an empty date into null and keeps at most 5 items', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ headline: `h${i}`, source_index: 0, date: '' }))
    const news = buildNews(items, sources)
    expect(news).toHaveLength(5)
    expect(news[0].date).toBeNull()
  })
})

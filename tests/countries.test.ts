import { describe, expect, it } from 'vitest'

import { COUNTRIES, isCountry, normaliseCountry } from '../shared/countries'

describe('normaliseCountry', () => {
  it.each([
    ['UK', 'United Kingdom'],
    ['U.K.', 'United Kingdom'],
    ['england', 'United Kingdom'],
    ['Northern Ireland', 'United Kingdom'],
    ['USA', 'United States'],
    ['U.S.A.', 'United States'],
    ['Ivory Coast', "Côte d'Ivoire"],
    ['Cote d Ivoire', "Côte d'Ivoire"],
    ['Turkey', 'Türkiye'],
    ['Czech Republic', 'Czechia'],
    ['Macau', 'Macao'],
    ['  nigeria  ', 'Nigeria'],
    ['Georgia', 'Georgia'],
  ])('maps %s to %s', (input, expected) => {
    expect(normaliseCountry(input)).toBe(expected)
  })

  it.each(['Remote', 'Europe', 'EMEA', 'London, UK', 'Narnia', '', null, undefined])(
    'returns null for %s instead of guessing',
    (input) => {
      expect(normaliseCountry(input)).toBeNull()
    },
  )

  it('maps every listed country to itself', () => {
    for (const country of COUNTRIES) expect(normaliseCountry(country)).toBe(country)
  })
})

describe('COUNTRIES', () => {
  it('has no duplicates', () => {
    expect(new Set(COUNTRIES).size).toBe(COUNTRIES.length)
  })

  it('is recognised by isCountry, and spellings are not', () => {
    expect(isCountry('United Kingdom')).toBe(true)
    expect(isCountry('UK')).toBe(false)
  })
})

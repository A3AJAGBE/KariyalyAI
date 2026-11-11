import { describe, expect, it } from 'vitest'

import { parseCsv, registerDateFrom, toSponsorRows } from '../scripts/load_sponsors'

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and line breaks inside quotes', () => {
    const rows = parseCsv('a,"b, c","say ""hi""","line\nbreak"\r\n1,2,3,4\n')
    expect(rows).toEqual([
      ['a', 'b, c', 'say "hi"', 'line\nbreak'],
      ['1', '2', '3', '4'],
    ])
  })

  it('strips a byte order mark and skips blank rows', () => {
    expect(parseCsv('﻿name\n\n,,\nAcme\n')).toEqual([['name'], ['Acme']])
  })
})

describe('toSponsorRows', () => {
  const header = ['Organisation Name', 'Town/City', 'County', 'Type & Rating', 'Route']

  it('merges one organisation and town across routes', () => {
    const rows = toSponsorRows([
      header,
      ['Acme Ltd', 'London', 'Greater London', 'Worker (A rating)', 'Skilled Worker'],
      ['Acme Ltd', 'London', 'Greater London', 'Worker (A rating)', 'Global Business Mobility'],
      ['Acme Ltd', 'Leeds', '', 'Worker (A rating)', 'Skilled Worker'],
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      org_name: 'Acme Ltd',
      town: 'London',
      county: 'Greater London',
      type_rating: 'Worker (A rating)',
      route: 'Skilled Worker; Global Business Mobility',
    })
    expect(rows[1].county).toBeNull()
  })

  it('finds columns by name, in any order', () => {
    const rows = toSponsorRows([
      ['route', 'organisation name', 'town/city'],
      ['Skilled Worker', 'Acme Ltd', 'London'],
    ])
    expect(rows[0]).toMatchObject({ org_name: 'Acme Ltd', town: 'London', route: 'Skilled Worker' })
  })

  it('keeps organisation names exactly as written (the database normalises them)', () => {
    expect(toSponsorRows([header, ['ACME Limited.', 'London', '', '', '']])[0].org_name).toBe('ACME Limited.')
  })

  it('fails clearly when the organisation column is missing', () => {
    expect(() => toSponsorRows([['Company', 'Town'], ['Acme', 'London']])).toThrow(/Organisation Name/)
  })
})

describe('registerDateFrom', () => {
  it('reads the date from the GOV.UK file name', () => {
    expect(registerDateFrom('2026-11-10_-_Worker_and_Temporary_Worker.csv')).toBe('2026-11-10')
  })

  it('prefers an explicit date', () => {
    expect(registerDateFrom('register.csv', '2026-11-01')).toBe('2026-11-01')
  })

  it('fails clearly when there is no date', () => {
    expect(() => registerDateFrom('register.csv')).toThrow(/--date/)
  })
})

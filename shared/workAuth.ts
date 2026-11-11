import { normaliseCountry, type Country } from './countries'

export type WorkAuthState =
  | 'no_visa_needed'
  | 'no_sponsorship'
  | 'likely_licensed'
  | 'not_found'
  | 'not_checked'
  | 'unknown_location'

export interface WorkAuthResult {
  state: WorkAuthState
  matched_org?: string | null
  matched_town?: string | null
  register_date?: string | null
  similarity?: number | null
  note?: string
}

export interface WorkAuthInput {
  locationCountry: string | null
  isRemote: boolean | null
  rightToWorkCountries: string[]
  description: string
  noSponsorshipPhrases?: string[]
}

export function hasNoSponsorshipPhrase(
  description: string,
  phrases: string[] = [],
): boolean {
  const text = description.toLowerCase()
  const configuredPhrases = [
    'no sponsorship',
    'does not sponsor',
    'do not sponsor',
    'will not sponsor',
    'unable to sponsor',
    'must have the right to work',
    'must be authorised to work',
    'without sponsorship',
  ]

  return [...phrases, ...configuredPhrases].some((phrase) =>
    text.includes(phrase.toLowerCase()),
  )
}

export function evaluateWorkAuth(input: WorkAuthInput): WorkAuthResult {
  const location = normaliseCountry(input.locationCountry)
  const rightToWork = new Set(
    input.rightToWorkCountries
      .map((country) => normaliseCountry(country))
      .filter((country): country is Country => country !== null),
  )

  if (location && rightToWork.has(location)) {
    return {
      state: 'no_visa_needed',
      note: 'Your profile says you can work in this country without sponsorship.',
    }
  }

  if (
    input.isRemote === true &&
    !hasNoSponsorshipPhrase(input.description, input.noSponsorshipPhrases)
  ) {
    return {
      state: 'no_visa_needed',
      note: 'This role is marked remote and no sponsorship restriction was found.',
    }
  }

  if (!location) {
    return {
      state: 'unknown_location',
      note: 'The job location was not identified as a country.',
    }
  }

  if (hasNoSponsorshipPhrase(input.description, input.noSponsorshipPhrases)) {
    return {
      state: 'no_sponsorship',
      note: 'The posting contains language restricting sponsorship or work authorisation.',
    }
  }

  if (location === 'United Kingdom') {
    return {
      state: 'not_checked',
      note: 'The UK sponsor register is being checked.',
    }
  }

  return {
    state: 'not_checked',
    note: 'No sponsor-register lookup is available for this country.',
  }
}

export async function lookupUkSponsor(
  company: string,
  runLookup: (company: string) => Promise<{
      data: Array<{
        org_name: string
        town: string | null
        similarity: number
        register_date: string | null
      }> | null
      error: { message: string } | null
    }>,
): Promise<WorkAuthResult> {
  const { data, error } = await runLookup(company)

  if (error) throw new Error(error.message)

  const match = data?.[0]
  if (!match || match.similarity < 0.6) {
    return {
      state: 'not_found',
      matched_org: match?.org_name ?? null,
      matched_town: match?.town ?? null,
      register_date: match?.register_date ?? null,
      similarity: match?.similarity ?? null,
      note: 'No close match was found in the UK sponsor register.',
    }
  }

  return {
    state: 'likely_licensed',
    matched_org: match.org_name,
    matched_town: match.town,
    register_date: match.register_date,
    similarity: match.similarity,
    note: 'A close match was found in the UK sponsor register.',
  }
}

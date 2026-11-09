// /shared/countries.ts
//
// The one fixed list of country names for KariyalyAI.
// Used by: the profile dropdowns (country_of_residence, right_to_work_countries),
// the match_job output (location_country) and /shared/workAuth.ts.
// Because every comparison goes through this list, "UK", "U.K." and "England"
// can never fail to match "United Kingdom".
//
// Usage:
//   import { COUNTRIES, normaliseCountry } from './countries';
//   normaliseCountry('UK')            // 'United Kingdom'
//   normaliseCountry('England')       // 'United Kingdom'
//   normaliseCountry('Remote')        // null (not a country)
//   normaliseCountry(undefined)       // null
//
// With zod v4 (see /shared/schema.ts):
//   const CountrySchema = z.enum(COUNTRIES);                       // strict, for the profile form
//   const AiCountrySchema = z.string().nullable()
//     .transform((v) => normaliseCountry(v));                      // lenient, for AI output

export const COUNTRIES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cabo Verde',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  "Côte d'Ivoire",
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czechia',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hong Kong',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kosovo',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Macao',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Türkiye',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
] as const;

export type Country = (typeof COUNTRIES)[number];

// Common alternative spellings and sub-national names, mapped to one canonical
// entry. Keys are matched after normalisation (see normaliseKey), so case,
// accents and punctuation do not matter.
// Add entries here when the AI or a user produces a spelling that fails to match.
const ALIASES: Record<string, Country> = {
  // United Kingdom
  uk: 'United Kingdom',
  gb: 'United Kingdom',
  gbr: 'United Kingdom',
  'great britain': 'United Kingdom',
  britain: 'United Kingdom',
  england: 'United Kingdom',
  scotland: 'United Kingdom',
  wales: 'United Kingdom',
  'northern ireland': 'United Kingdom',
  'united kingdom of great britain and northern ireland': 'United Kingdom',
  // United States
  us: 'United States',
  usa: 'United States',
  america: 'United States',
  'united states of america': 'United States',
  // Ireland
  eire: 'Ireland',
  'republic of ireland': 'Ireland',
  // Gulf and Middle East
  uae: 'United Arab Emirates',
  emirates: 'United Arab Emirates',
  ksa: 'Saudi Arabia',
  // Europe
  'czech republic': 'Czechia',
  holland: 'Netherlands',
  'the netherlands': 'Netherlands',
  turkey: 'Türkiye',
  turkiye: 'Türkiye',
  macedonia: 'North Macedonia',
  swaziland: 'Eswatini',
  'vatican city state': 'Vatican City',
  'holy see': 'Vatican City',
  // Asia and Pacific
  korea: 'South Korea',
  'republic of korea': 'South Korea',
  'korea republic of': 'South Korea',
  'democratic peoples republic of korea': 'North Korea',
  'peoples republic of china': 'China',
  prc: 'China',
  'hong kong sar': 'Hong Kong',
  'macau': 'Macao',
  'macau sar': 'Macao',
  'viet nam': 'Vietnam',
  burma: 'Myanmar',
  'east timor': 'Timor-Leste',
  'lao pdr': 'Laos',
  'russian federation': 'Russia',
  // Africa
  'ivory coast': "Côte d'Ivoire",
  'cote divoire': "Côte d'Ivoire",
  'cape verde': 'Cabo Verde',
  'republic of the congo': 'Congo',
  'congo brazzaville': 'Congo',
  drc: 'Democratic Republic of the Congo',
  'dr congo': 'Democratic Republic of the Congo',
  'congo kinshasa': 'Democratic Republic of the Congo',
  'the gambia': 'Gambia',
  'the bahamas': 'Bahamas',
  // Americas
  'trinidad': 'Trinidad and Tobago',
  'st lucia': 'Saint Lucia',
  'st kitts and nevis': 'Saint Kitts and Nevis',
  'st vincent and the grenadines': 'Saint Vincent and the Grenadines',
};

// Lowercase, strip accents, replace punctuation with spaces, collapse spaces.
// "Côte d'Ivoire" -> "cote d ivoire" and "U.K." -> "u k" -> handled below.
function normaliseKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Collapse dotted abbreviations such as "u k" or "u s a" into "uk" or "usa".
function collapseInitials(key: string): string {
  return /^([a-z] )+[a-z]$/.test(key) ? key.replace(/ /g, '') : key;
}

const LOOKUP: Map<string, Country> = (() => {
  const map = new Map<string, Country>();
  for (const name of COUNTRIES) map.set(collapseInitials(normaliseKey(name)), name);
  for (const [alias, name] of Object.entries(ALIASES)) {
    map.set(collapseInitials(normaliseKey(alias)), name);
  }
  return map;
})();

export function isCountry(value: unknown): value is Country {
  return typeof value === 'string' && (COUNTRIES as readonly string[]).includes(value);
}

// Returns the canonical country name, or null when the input is empty, is not a
// country ("Remote", "Europe", "Worldwide") or is not recognised.
// Never guesses: an unrecognised value returns null, and workAuth.ts then
// treats the job location as unknown.
export function normaliseCountry(input: string | null | undefined): Country | null {
  if (!input) return null;
  const key = collapseInitials(normaliseKey(input));
  if (!key) return null;
  return LOOKUP.get(key) ?? null;
}

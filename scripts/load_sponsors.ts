/**
 * Loads the UK Home Office register of licensed sponsors into Supabase.
 *
 * 1. Download the latest "Worker and Temporary Worker" CSV from
 *    https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers
 * 2. Check it without touching the database:
 *      npx tsx scripts/load_sponsors.ts ~/Downloads/2026-11-10_-_Worker_and_Temporary_Worker.csv --dry-run
 * 3. Load it (replaces everything currently in sponsor_register):
 *      SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *        npx tsx scripts/load_sponsors.ts ~/Downloads/2026-11-10_-_Worker_and_Temporary_Worker.csv
 *
 * The register date is read from the file name (YYYY-MM-DD). Pass --date=YYYY-MM-DD if
 * the file was renamed.
 *
 * The service role key bypasses row level security. Use it only on your own machine:
 * never commit it, never put it in Netlify, never put it in a VITE_ variable.
 *
 * Organisation names are inserted as they appear. The database normalises them itself
 * (sponsor_register.org_name_norm), so this script must not.
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { createClient } from '@supabase/supabase-js'

export interface SponsorRow {
  org_name: string
  town: string | null
  county: string | null
  route: string | null
  type_rating: string | null
}

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, commas and newlines in quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const input = text.replace(/^\uFEFF/, '') // strip a byte order mark

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  row.push(field)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  return rows
}

const clean = (value: string | undefined) => {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Maps CSV rows to table rows by header name (case-insensitive), so a reordered or
 * slightly renamed column still works. One organisation and town can appear once per
 * visa route; those rows are merged and their routes joined with "; ".
 */
export function toSponsorRows(rows: string[][]): SponsorRow[] {
  const [header, ...body] = rows
  if (!header) throw new Error('The CSV file is empty.')

  const names = header.map((name) => name.trim().toLowerCase())
  const find = (...candidates: string[]) =>
    names.findIndex((name) => candidates.some((candidate) => name.includes(candidate)))

  const col = {
    org: find('organisation name', 'organization name'),
    town: find('town'),
    county: find('county'),
    rating: find('type & rating', 'type and rating', 'rating'),
    route: find('route'),
  }

  if (col.org === -1) {
    throw new Error(
      `No "Organisation Name" column found. Columns were: ${header.join(', ')}`,
    )
  }

  const merged = new Map<string, SponsorRow & { routes: Set<string> }>()

  for (const cells of body) {
    const orgName = clean(cells[col.org])
    if (!orgName) continue

    const town = col.town === -1 ? null : clean(cells[col.town])
    const key = `${orgName.toLowerCase()}|${(town ?? '').toLowerCase()}`
    const route = col.route === -1 ? null : clean(cells[col.route])

    let entry = merged.get(key)
    if (!entry) {
      entry = {
        org_name: orgName,
        town,
        county: col.county === -1 ? null : clean(cells[col.county]),
        type_rating: col.rating === -1 ? null : clean(cells[col.rating]),
        route: null,
        routes: new Set<string>(),
      }
      merged.set(key, entry)
    }
    if (route) entry.routes.add(route)
  }

  return [...merged.values()].map(({ routes, ...row }) => ({
    ...row,
    route: routes.size ? [...routes].join('; ') : null,
  }))
}

export function registerDateFrom(fileName: string, override?: string): string {
  const value = override ?? fileName.match(/\d{4}-\d{2}-\d{2}/)?.[0]
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error(
      'Could not find the register date in the file name. Pass it as --date=YYYY-MM-DD.',
    )
  }
  return value
}

async function main() {
  const args = process.argv.slice(2)
  const filePath = args.find((arg) => !arg.startsWith('--'))
  const dryRun = args.includes('--dry-run')
  const dateArg = args.find((arg) => arg.startsWith('--date='))?.slice('--date='.length)

  if (!filePath) {
    console.error('Usage: npx tsx scripts/load_sponsors.ts <register.csv> [--dry-run] [--date=YYYY-MM-DD]')
    process.exit(1)
  }

  const registerDate = registerDateFrom(basename(filePath), dateArg)
  const rows = toSponsorRows(parseCsv(readFileSync(filePath, 'utf8')))

  console.log(`Register date: ${registerDate}`)
  console.log(`Organisations to load: ${rows.length}`)
  console.log('First three:', rows.slice(0, 3))

  if (dryRun) {
    console.log('Dry run: nothing was written.')
    return
  }

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the shell first.')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Replace the whole register. A filter is required for deletes, so match every row.
  const { error: deleteError } = await supabase
    .from('sponsor_register')
    .delete()
    .not('id', 'is', null)
  if (deleteError) throw new Error(`Clearing the old register failed: ${deleteError.message}`)

  const batchSize = 1000
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize)
    const { error } = await supabase.from('sponsor_register').insert(batch)
    if (error) {
      throw new Error(
        `Insert failed at row ${start}: ${error.message}. The register is partly loaded; run the script again.`,
      )
    }
    console.log(`Inserted ${Math.min(start + batchSize, rows.length)} / ${rows.length}`)
  }

  const { error: metaError } = await supabase
    .from('sponsor_register_meta')
    .upsert({ id: true, register_date: registerDate })
  if (metaError) throw new Error(`Saving the register date failed: ${metaError.message}`)

  console.log(`Done. ${rows.length} organisations loaded, register dated ${registerDate}.`)
}

// Run only when executed directly, so the helpers can be imported by tests.
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}

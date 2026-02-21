import { NextResponse } from 'next/server'

const BASE = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Leads`
const hdrs = () => ({ Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` })

async function fetchAllRecords() {
  const records: { id: string; username: string }[] = []
  let offset: string | undefined

  do {
    const url = new URL(BASE)
    url.searchParams.set('fields[]', 'Username')
    url.searchParams.set('pageSize', '100')
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url.toString(), { headers: hdrs() })
    const data = await res.json()

    for (const rec of data.records ?? []) {
      records.push({ id: rec.id, username: rec.fields?.Username ?? '' })
    }
    offset = data.offset
  } while (offset)

  return records
}

export async function GET() {
  const records = await fetchAllRecords()

  // Group by username, keep first (oldest), mark rest as duplicates
  const seen = new Map<string, string>()
  const toDelete: string[] = []

  for (const rec of records) {
    const key = rec.username.toLowerCase().trim()
    if (!key) continue
    if (seen.has(key)) {
      toDelete.push(rec.id)
    } else {
      seen.set(key, rec.id)
    }
  }

  if (toDelete.length === 0) {
    return NextResponse.json({ message: 'Keine Duplikate gefunden', total: records.length })
  }

  // Delete in batches of 10 (Airtable limit per request)
  let deleted = 0
  for (let i = 0; i < toDelete.length; i += 10) {
    const chunk = toDelete.slice(i, i + 10)
    const params = chunk.map(id => `records[]=${id}`).join('&')
    await fetch(`${BASE}?${params}`, { method: 'DELETE', headers: hdrs() })
    deleted += chunk.length
    await new Promise(r => setTimeout(r, 200))
  }

  return NextResponse.json({
    message: `${deleted} Duplikate gelöscht`,
    total: records.length,
    kept: records.length - deleted,
  })
}

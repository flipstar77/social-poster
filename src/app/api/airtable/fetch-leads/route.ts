import { NextResponse } from 'next/server'

const BASE = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Leads`
const hdrs = () => ({ Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` })

export async function GET() {
  const fields = ['Username', 'Full Name', 'Caption', 'Likes', 'Post URL', 'Profile URL', 'Score', 'Recommendation', 'Status', 'Bio', 'Website', 'Followers', 'Email', 'Phone']
  const records: Record<string, unknown>[] = []
  let offset: string | undefined

  do {
    const url = new URL(BASE)
    fields.forEach(f => url.searchParams.append('fields[]', f))
    url.searchParams.set('pageSize', '100')
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url.toString(), { headers: hdrs() })
    const data = await res.json()
    if (data.error) return NextResponse.json({ error: data.error }, { status: 400 })

    for (const rec of data.records ?? []) {
      records.push({ id: rec.id, ...rec.fields })
    }
    offset = data.offset
  } while (offset)

  return NextResponse.json({ records })
}

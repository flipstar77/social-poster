import { NextRequest, NextResponse } from 'next/server'

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const PHONE_RE = /(?:\+49|0049|0)[\s\-./]?(?:\(?\d{2,5}\)?[\s\-./]?)\d[\d\s\-./]{6,18}\d/g
const EMAIL_IGNORE = ['example', 'sentry', 'wix', 'domain.', '@2x', '.png', '.jpg', '.svg', 'noreply', 'no-reply', 'schema.org', 'w3.org']

function cleanPhone(p: string) { return p.replace(/\s+/g, ' ').trim() }
function cleanEmail(e: string) { return e.toLowerCase().trim() }
function isValidEmail(e: string) { return !EMAIL_IGNORE.some(bad => e.includes(bad)) }

interface NominatimResult {
  display_name?: string
  extratags?: Record<string, string>
  lat?: string
  lon?: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username') ?? ''
  const fullName = searchParams.get('fullName') ?? ''
  const debug = searchParams.get('debug') === '1'

  if (!username) return NextResponse.json({ emails: [], phones: [], website: '' })

  const searchName = fullName || username

  try {
    // ── OpenStreetMap Nominatim ───────────────────────────────────
    // Free, no API key, works from servers, has email/phone/website in extratags
    const nominatimUrl = `https://nominatim.openstreetmap.org/search.php?q=${encodeURIComponent(searchName + ' Frankfurt')}&format=json&limit=5&addressdetails=0&extratags=1`

    const res = await fetch(nominatimUrl, {
      headers: {
        // Nominatim requires a descriptive User-Agent with contact info
        'User-Agent': 'SocialPosterLeadTool/1.0 (github.com/flipstar77/social-poster)',
        'Accept-Language': 'de-DE,de;q=0.9',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      if (debug) return NextResponse.json({ debug: `Nominatim HTTP ${res.status}` })
      return NextResponse.json({ emails: [], phones: [], website: '' })
    }

    const results: NominatimResult[] = await res.json()

    if (debug) return NextResponse.json({ debug_results: results.slice(0, 3), query: searchName + ' Frankfurt' })

    const emails: string[] = []
    const phones: string[] = []
    let website = ''

    // Pull contact info from OSM tags across all results
    for (const r of results) {
      const t = r.extratags ?? {}

      // Website
      const w = t['website'] || t['contact:website'] || t['url'] || ''
      if (w && !website) website = w.startsWith('http') ? w : `https://${w}`

      // Email
      for (const key of ['email', 'contact:email']) {
        const e = t[key]
        if (e) {
          const found = e.match(EMAIL_RE) ?? []
          found.map(cleanEmail).filter(isValidEmail).forEach(em => { if (!emails.includes(em)) emails.push(em) })
        }
      }

      // Phone
      for (const key of ['phone', 'contact:phone', 'contact:mobile']) {
        const p = t[key]
        if (p) {
          const cleaned = cleanPhone(p)
          if (!phones.includes(cleaned)) phones.push(cleaned)
        }
      }
    }

    return NextResponse.json({
      emails: emails.slice(0, 5),
      phones: phones.slice(0, 4),
      website,
    })
  } catch {
    return NextResponse.json({ emails: [], phones: [], website: '' })
  }
}

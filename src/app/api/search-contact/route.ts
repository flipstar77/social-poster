import { NextRequest, NextResponse } from 'next/server'

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const PHONE_RE = /(?:\+49|0049|0)[\s\-./]?(?:\(?\d{2,5}\)?[\s\-./]?)\d[\d\s\-./]{6,18}\d/g
const EMAIL_IGNORE = ['example', 'sentry', 'wix', 'domain.', '@2x', '.png', '.jpg', '.svg', 'noreply', 'no-reply', 'schema.org', 'w3.org']
const SKIP_DOMAINS = ['facebook.com', 'instagram.com', 'google.', 'yelp.', 'tripadvisor.', 'foursquare.com', 'twitter.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'xing.com', 'wolt.com', 'lieferando.', 'thefork.', 'opentable.', 'reservix.', 'eventbrite.', 'wikipedia.', 'ubereats.', 'just-eat.', 'deliveroo.', 'speisekarte.', 'quandoo.', 'restu.', 'dish.co', 'menudigital.']

interface SerperResult {
  title?: string
  link?: string
  snippet?: string
}

function extractContacts(text: string) {
  const emails = (text.match(EMAIL_RE) ?? [])
    .map(e => e.toLowerCase().trim())
    .filter(e => !EMAIL_IGNORE.some(bad => e.includes(bad)))
  const phones = (text.match(PHONE_RE) ?? [])
    .map(p => p.replace(/\s+/g, ' ').trim())
  return { emails: [...new Set(emails)], phones: [...new Set(phones)] }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username') ?? ''
  const fullName = searchParams.get('fullName') ?? ''
  const debug = searchParams.get('debug') === '1'

  if (!username) return NextResponse.json({ emails: [], phones: [], website: '' })

  const searchName = fullName || username
  const query = `${searchName} Frankfurt`

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl: 'de', hl: 'de', num: 5 }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      if (debug) return NextResponse.json({ debug: `Serper HTTP ${res.status}` })
      return NextResponse.json({ emails: [], phones: [], website: '' })
    }

    const data = await res.json()
    if (debug) return NextResponse.json({ debug_results: data.organic?.slice(0, 3), query })

    const organic: SerperResult[] = data.organic ?? []

    // Find first result that isn't a social/review site
    const best = organic.find(r => r.link && !SKIP_DOMAINS.some(d => r.link!.includes(d)))
    const website = best?.link ?? ''

    // Extract emails/phones from all snippets
    const allText = organic.map(r => `${r.title ?? ''} ${r.snippet ?? ''}`).join(' ')
    const { emails, phones } = extractContacts(allText)

    return NextResponse.json({
      emails: emails.slice(0, 5),
      phones: phones.slice(0, 4),
      website,
    })
  } catch {
    return NextResponse.json({ emails: [], phones: [], website: '' })
  }
}

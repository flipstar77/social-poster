import { NextRequest, NextResponse } from 'next/server'

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const PHONE_RE = /(?:\+49|0049|0)[\s\-./]?(?:\(?\d{2,5}\)?[\s\-./]?)\d[\d\s\-./]{6,18}\d/g
const EMAIL_IGNORE = ['example', 'sentry', 'wix', 'domain.', '@2x', '.png', '.jpg', '.svg', 'noreply', 'no-reply', 'schema.org', 'w3.org', 'duckduckgo', 'google', 'cloudflare', 'jquery', 'bootstrap']
const SKIP_DOMAINS = ['facebook.com', 'instagram.com', 'google.', 'yelp.', 'tripadvisor.', 'foursquare.', 'twitter.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.', 'xing.com', 'wolt.com', 'lieferando.', 'thefork.', 'opentable.', 'reservix.', 'eventbrite.', 'wikipedia.', 'duckduckgo.']

function extractContacts(text: string) {
  const emails = (text.match(EMAIL_RE) ?? [])
    .map(e => e.toLowerCase().trim())
    .filter(e => !EMAIL_IGNORE.some(bad => e.includes(bad)))
  const phones = (text.match(PHONE_RE) ?? [])
    .map(p => p.replace(/\s+/g, ' ').trim())
  return { emails: [...new Set(emails)], phones: [...new Set(phones)] }
}

function extractBestUrl(html: string): string {
  // lite.duckduckgo.com uses plain <a href="https://..."> links for results
  const linkRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>/g
  const matches = [...html.matchAll(linkRe)]

  for (const m of matches) {
    const url = m[1].trim()
    if (SKIP_DOMAINS.some(d => url.includes(d))) continue
    if (url.includes('duckduckgo.com')) continue
    return url
  }

  return ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username') ?? ''
  const fullName = searchParams.get('fullName') ?? ''
  const debug = searchParams.get('debug') === '1'

  if (!username) return NextResponse.json({ emails: [], phones: [], website: '' })

  // No quotes — avoids over-filtering on slight name variations
  const nameQuery = fullName
    ? `${fullName} Frankfurt Restaurant`
    : `${username} Restaurant Frankfurt`

  const query = encodeURIComponent(nameQuery)

  try {
    // Use POST to lite.duckduckgo.com — more reliable from server IPs than GET html endpoint
    const res = await fetch('https://lite.duckduckgo.com/lite/', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://lite.duckduckgo.com/',
      },
      body: `q=${query}`,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      if (debug) return NextResponse.json({ debug: `HTTP ${res.status}`, emails: [], phones: [], website: '' })
      return NextResponse.json({ emails: [], phones: [], website: '' })
    }

    const html = await res.text()

    if (debug) return NextResponse.json({ debug_status: res.status, debug_html: html.slice(0, 1000), query: nameQuery })


    // Extract website URL from first usable result
    const website = extractBestUrl(html)

    // Strip HTML for email/phone scanning of DDG snippets
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/&#64;/g, '@').replace(/&#46;/g, '.').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')

    const { emails, phones } = extractContacts(text)

    return NextResponse.json({
      emails: emails.slice(0, 5),
      phones: phones.slice(0, 4),
      website,
    })
  } catch {
    return NextResponse.json({ emails: [], phones: [], website: '' })
  }
}

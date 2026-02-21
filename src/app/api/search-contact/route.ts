import { NextRequest, NextResponse } from 'next/server'

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const PHONE_RE = /(?:\+49|0049|0)[\s\-./]?(?:\(?\d{2,5}\)?[\s\-./]?)\d[\d\s\-./]{6,18}\d/g
const EMAIL_IGNORE = ['example', 'sentry', 'wix', 'domain.', '@2x', '.png', '.jpg', '.svg', 'noreply', 'no-reply', 'schema.org', 'w3.org', 'duckduckgo', 'google']

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

  if (!username) return NextResponse.json({ emails: [], phones: [], website: '' })

  // Build search query: try name first, fallback to @username
  const nameQuery = fullName
    ? `"${fullName}" Frankfurt kontakt email telefon`
    : `"@${username}" restaurant Frankfurt kontakt`

  const query = encodeURIComponent(nameQuery)

  try {
    // DuckDuckGo HTML endpoint — no API key, no strict rate limits
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return NextResponse.json({ emails: [], phones: [], website: '' })

    const html = await res.text()

    // Strip HTML tags for clean text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/&#64;/g, '@').replace(/&#46;/g, '.').replace(/&amp;/g, '&')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')

    const { emails, phones } = extractContacts(text)

    // Also try to extract first result URL as fallback website
    const urlMatch = html.match(/class="result__url[^"]*"[^>]*>([^<]+)</)
    const website = urlMatch ? urlMatch[1].trim() : ''

    return NextResponse.json({
      emails: emails.slice(0, 5),
      phones: phones.slice(0, 4),
      website: website || '',
    })
  } catch {
    return NextResponse.json({ emails: [], phones: [], website: '' })
  }
}

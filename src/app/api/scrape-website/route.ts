import { NextRequest, NextResponse } from 'next/server'

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const PHONE_RE = /(?:\+49|0049|0)[\s\-./]?(?:\(?\d{2,5}\)?[\s\-./]?)\d[\d\s\-./]{6,18}\d/g

// Common false-positive email patterns to skip
const EMAIL_IGNORE = ['example', 'sentry.io', 'wix.com', 'domain.', 'email.', 'test@', 'mail@mail', '@2x', '.png', '.jpg', '.svg', '.webp', 'noreply', 'no-reply', 'schema.org', 'w3.org']

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    if (!res.ok) return ''
    return await res.text()
  } catch { return '' }
}

function extractContacts(html: string) {
  // Decode common HTML entities and strip tags
  const text = html
    .replace(/&#64;/g, '@')
    .replace(/&#46;/g, '.')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')

  const emails = (text.match(EMAIL_RE) ?? [])
    .map(e => e.toLowerCase().trim())
    .filter(e => !EMAIL_IGNORE.some(bad => e.includes(bad)))

  const phones = (text.match(PHONE_RE) ?? [])
    .map(p => p.replace(/\s+/g, ' ').trim())

  return { emails, phones }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  let rawUrl = searchParams.get('url') ?? ''
  if (!rawUrl) return NextResponse.json({ emails: [], phones: [] })

  if (!rawUrl.startsWith('http')) rawUrl = `https://${rawUrl}`

  let base: string
  try {
    base = new URL(rawUrl).origin
  } catch {
    return NextResponse.json({ emails: [], phones: [] })
  }

  // Try homepage first, then common German contact pages
  const pagesToTry = [rawUrl, `${base}/kontakt`, `${base}/impressum`, `${base}/contact`, `${base}/impressum.html`, `${base}/kontakt.html`]

  const allEmails = new Set<string>()
  const allPhones = new Set<string>()

  for (const pageUrl of pagesToTry) {
    const html = await fetchText(pageUrl)
    if (!html) continue

    const { emails, phones } = extractContacts(html)
    emails.forEach(e => allEmails.add(e))
    phones.forEach(p => allPhones.add(p))

    // Stop early once we have good data
    if (allEmails.size >= 2 && allPhones.size >= 1) break
  }

  return NextResponse.json({
    emails: [...allEmails].slice(0, 5),
    phones: [...allPhones].slice(0, 4),
  })
}

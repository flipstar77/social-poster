/**
 * Name Enrichment — Scrape owner/manager names from restaurant websites.
 *
 * Strategy (in priority order):
 * 1. /impressum page (German legal requirement — most reliable)
 * 2. /about, /ueber-uns pages
 * 3. Homepage footer (often contains "Inhaber" or "Geschäftsführer")
 * 4. IG bio parsing (fallback)
 *
 * Usage:
 *   npx tsx scripts/research/enrich-names.ts                 (all leads with websites)
 *   npx tsx scripts/research/enrich-names.ts --city Berlin   (one city)
 *   npx tsx scripts/research/enrich-names.ts --dry-run       (preview, don't update DB)
 *   npx tsx scripts/research/enrich-names.ts --limit 10      (process only N leads)
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const args = process.argv.slice(2)
const cityFilter = args.includes('--city') ? args[args.indexOf('--city') + 1] : null
const dryRun = args.includes('--dry-run')
const limitArg = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null

// ─── Name Extraction ───────────────────────────────────────────────

// Patterns that indicate an owner/manager name follows
const NAME_PATTERNS = [
  // German legal terms (most common in Impressum) — skip optional "Herr/Frau" prefix
  /(?:Inhaber(?:in)?|Geschäftsführer(?:in)?|Betreiber(?:in)?|Verantwortlich(?:e[r]?)?|Angaben gemäß|Vertreten durch|Vertretungsberechtigte[r]?)[\s:]*(?:(?:Herr|Frau)\s+)?([A-ZÀ-ÖÙ-Ü][a-zà-öù-ü]+(?:\s+[A-ZÀ-ÖÙ-Ü][a-zà-öù-ü]+){1,3})/g,
  // "Name: First Last" pattern
  /(?:Name|Kontakt|Ansprechpartner(?:in)?)[\s:]*(?:(?:Herr|Frau)\s+)?([A-ZÀ-ÖÙ-Ü][a-zà-öù-ü]+(?:\s+[A-ZÀ-ÖÙ-Ü][a-zà-öù-ü]+){1,3})/g,
  // Owner/CEO in English (for international restaurants)
  /(?:Owner|Founder|CEO|Manager|Operated by)[\s:]*([A-ZÀ-ÖÙ-Ü][a-zà-öù-ü]+(?:\s+[A-ZÀ-ÖÙ-Ü][a-zà-öù-ü]+){1,3})/gi,
]

// Names that are clearly not person names
const BLACKLIST = new Set([
  'impressum', 'kontakt', 'datenschutz', 'berlin', 'münchen', 'wien', 'zürich',
  'frankfurt', 'hamburg', 'restaurant', 'gmbh', 'gbr', 'ohg', 'ug', 'e.v.',
  'strasse', 'straße', 'platz', 'alle rechte', 'cookie', 'agb', 'dsgvo',
  'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag',
  'instagram', 'facebook', 'google', 'whatsapp', 'email', 'telefon',
  'impression', 'welcome', 'reservieren', 'firmenevents', 'navigation', 'download',
  'newsletter', 'anmelden', 'abmelden', 'bestellen', 'speisekarte', 'öffnungszeiten',
  'herr', 'frau', 'hrb', 'amtsgericht', 'registergericht', 'steuernummer',
  'fire', 'tiger', 'burger', 'pizza', 'sushi', 'curry', 'cafe', 'bar', 'grill',
])

function cleanName(name: string): string {
  // Remove trailing blacklisted words (e.g. "Joao Cunha HRB Nr" → "Joao Cunha")
  let parts = name.trim().split(/\s+/)
  while (parts.length > 2 && BLACKLIST.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop()
  }
  // Remove trailing junk like "Nr", "Tel", numbers
  while (parts.length > 2 && /^(?:Nr|Tel|Str|Fax|\d+)$/i.test(parts[parts.length - 1])) {
    parts.pop()
  }
  return parts.join(' ')
}

// Web agency / design studio patterns — these appear in Impressum as site creators, not owners
const AGENCY_PATTERNS = /webdesign|agentur|design|studio|media|digital|kraft|creative|pixel|development|solutions|consulting|marketing|werbeagentur|internetagentur|webagentur/i

function isValidName(name: string, restaurantName?: string): boolean {
  // Must have at least first + last name
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2 || parts.length > 4) return false
  // Each part should start with uppercase
  if (!parts.every(p => /^[A-ZÀ-ÖÙ-Ü]/.test(p))) return false
  // No blacklisted words
  if (parts.some(p => BLACKLIST.has(p.toLowerCase()))) return false
  // Not too short (avoid initials)
  if (parts.some(p => p.length < 2)) return false
  // Not a company suffix
  if (/(?:gmbh|gbr|ohg|ug|kg|ag|e\.v\.|inc|llc|ltd)/i.test(name)) return false
  // Not a web agency name
  if (AGENCY_PATTERNS.test(name)) return false
  // Not overlapping with the restaurant name itself
  if (restaurantName) {
    const nameWords = name.toLowerCase().split(/\s+/)
    const restWords = restaurantName.toLowerCase().split(/[\s\-_.,|]+/).filter(w => w.length > 2)
    const overlap = nameWords.filter(w => restWords.includes(w)).length
    if (overlap >= 2 || (overlap >= 1 && parts.length <= 2)) return false
  }
  // Must start with a plausible first name (not "Die", "Das", "Der", "The")
  if (/^(?:Die|Der|Das|The|Ein|Eine|Zum|Zur)$/i.test(parts[0])) return false
  return true
}

function extractNames(text: string, restaurantName?: string): string[] {
  const found: string[] = []
  for (const pattern of NAME_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(text)) !== null) {
      const candidate = cleanName(match[1].trim())
      if (isValidName(candidate, restaurantName) && !found.includes(candidate)) {
        found.push(candidate)
      }
    }
  }
  return found
}

// ─── Web Fetching ──────────────────────────────────────────────────

const IMPRESSUM_PATHS = [
  '/impressum',
  '/imprint',
  '/legal',
  '/rechtliches',
  '/datenschutz-impressum',
  '/about',
  '/ueber-uns',
  '/about-us',
  '/team',
  '/kontakt',
  '/contact',
]

async function fetchPage(url: string, timeout = 8000): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FlowingPost/1.0; restaurant research)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const html = await res.text()
    // Strip HTML tags, keep text
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 30000) // limit to 30kb of text
  } catch {
    return null
  }
}

// ─── LLM Name Extraction (Grok) ────────────────────────────────────

const XAI_API_KEY = process.env.XAI_API_KEY || ''

async function extractNameWithLLM(text: string, restaurantName: string): Promise<string | null> {
  if (!XAI_API_KEY) return null
  // Trim text to ~2000 chars around Impressum keywords for cost efficiency
  let snippet = text
  const impIdx = text.toLowerCase().search(/impressum|inhaber|geschäftsführer|vertreten durch|betreiber/)
  if (impIdx > 0) {
    snippet = text.substring(Math.max(0, impIdx - 200), impIdx + 1800)
  } else {
    snippet = text.substring(0, 2000)
  }

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        messages: [
          {
            role: 'system',
            content: 'Extract the OWNER or MANAGER (Inhaber/Geschäftsführer) name from this restaurant website text. Reply with ONLY the full person name (first + last), nothing else. IMPORTANT: Do NOT return restaurant names, brand names, web designer names, agency names, company names, or addresses. If you cannot confidently identify the restaurant owner/manager, reply "NONE".'
          },
          {
            role: 'user',
            content: `Restaurant: ${restaurantName}\n\nWebsite text:\n${snippet}`
          }
        ],
        max_tokens: 30,
        temperature: 0,
      })
    })
    const data = await res.json()
    const answer = data.choices?.[0]?.message?.content?.trim()
    if (!answer || answer === 'NONE' || answer.length > 50) return null
    // Validate the LLM output
    const cleaned = cleanName(answer)
    return isValidName(cleaned) ? cleaned : null
  } catch {
    return null
  }
}

async function findOwnerName(website: string, igBio: string | null, restaurantName: string): Promise<{ name: string | null; source: string }> {
  // Normalize base URL
  let baseUrl = website.trim().replace(/\/+$/, '')
  if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl

  // 1. Try impressum/about pages — first with regex, then LLM
  for (const path of IMPRESSUM_PATHS) {
    const text = await fetchPage(baseUrl + path)
    if (!text) continue

    // Try regex first (free)
    const names = extractNames(text, restaurantName)
    if (names.length > 0) {
      return { name: names[0], source: `regex:${path}` }
    }

    // Try LLM on impressum-like pages (cheap, more accurate)
    if (['/impressum', '/imprint', '/about', '/ueber-uns'].includes(path)) {
      const llmName = await extractNameWithLLM(text, restaurantName)
      if (llmName) {
        return { name: llmName, source: `llm:${path}` }
      }
    }
  }

  // 2. Try homepage — regex first, then LLM on footer area
  const homepage = await fetchPage(baseUrl)
  if (homepage) {
    const names = extractNames(homepage, restaurantName)
    if (names.length > 0) {
      return { name: names[0], source: 'regex:/' }
    }
    // LLM on last 3000 chars (footer area where Impressum info often lives)
    const footer = homepage.substring(Math.max(0, homepage.length - 3000))
    if (footer.toLowerCase().match(/impressum|inhaber|geschäftsführer|vertreten|betreiber/)) {
      const llmName = await extractNameWithLLM(footer, restaurantName)
      if (llmName) {
        return { name: llmName, source: 'llm:/' }
      }
    }
  }

  // 3. Google Search fallback: "Inhaber site:domain.com"
  try {
    const domain = new URL(baseUrl).hostname
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`"Inhaber" OR "Geschäftsführer" site:${domain}`)}&num=3`
    const searchText = await fetchPage(searchUrl)
    if (searchText) {
      // Try regex on Google snippet
      const names = extractNames(searchText, restaurantName)
      if (names.length > 0) {
        return { name: names[0], source: 'google_search' }
      }
    }
  } catch { /* ignore search errors */ }

  // 4. Fallback: IG bio
  if (igBio) {
    const names = extractNames(igBio, restaurantName)
    if (names.length > 0) {
      return { name: names[0], source: 'ig_bio' }
    }
  }

  return { name: null, source: 'not_found' }
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('Name Enrichment — Restaurant Owner Names\n')

  // Fetch leads
  let query = supabase
    .from('restaurant_profiles')
    .select('id, name, handle, email, website, ig_bio, city, owner_name')
    .not('email', 'is', null)
    .not('website', 'is', null) as any

  if (cityFilter) query = query.eq('city', cityFilter)
  const { data: leads, error } = await query

  if (error) {
    console.error('Supabase error:', error.message)
    process.exit(1)
  }

  // Filter out already enriched
  const toEnrich = (leads || []).filter((l: any) => !l.owner_name)
  const alreadyDone = (leads || []).length - toEnrich.length

  console.log(`Total leads with website: ${leads?.length}`)
  console.log(`Already enriched: ${alreadyDone}`)
  console.log(`To enrich: ${toEnrich.length}`)
  if (cityFilter) console.log(`City: ${cityFilter}`)
  if (dryRun) console.log('Mode: DRY RUN')
  console.log()

  const batch = limitArg ? toEnrich.slice(0, limitArg) : toEnrich
  let found = 0
  let notFound = 0

  for (let i = 0; i < batch.length; i++) {
    const lead = batch[i]
    process.stdout.write(`[${i + 1}/${batch.length}] ${lead.name || lead.handle}... `)

    const result = await findOwnerName(lead.website, lead.ig_bio, lead.name || lead.handle)

    if (result.name) {
      found++
      console.log(`${result.name} (${result.source})`)

      if (!dryRun) {
        await supabase
          .from('restaurant_profiles')
          .update({ owner_name: result.name } as any)
          .eq('id', lead.id)
      }
    } else {
      notFound++
      console.log('- not found')
    }

    // Rate limit: 500ms between requests
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Found: ${found}/${batch.length} (${Math.round(found / batch.length * 100)}%)`)
  console.log(`Not found: ${notFound}`)
  if (dryRun) console.log('\nDry run — no DB updates.')
  else console.log(`\nDB updated with owner_name.`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

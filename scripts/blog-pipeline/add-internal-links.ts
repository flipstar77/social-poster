/**
 * Automatic internal link injector for blog articles.
 *
 * Reads all MDX files, extracts key phrases from each article's title,
 * and inserts links into other articles where those phrases appear naturally.
 *
 * Rules:
 * - Each slug is linked at most once per article (first occurrence)
 * - Never links inside headings, code blocks, or existing links
 * - Longer/more specific phrases take priority over shorter ones
 * - Never self-links
 *
 * Usage:
 *   npx tsx scripts/blog-pipeline/add-internal-links.ts           # process all
 *   npx tsx scripts/blog-pipeline/add-internal-links.ts --dry-run # preview only
 *   npx tsx scripts/blog-pipeline/add-internal-links.ts --slug restaurant-seo-google-gefunden-werden
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')
const LOCALE = 'de'

// Words filtered from ALL phrase types (function words + very generic)
const STOP_ALL = new Set([
  // German function words
  'für', 'der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'mit', 'von', 'zu', 'im', 'in', 'am',
  'an', 'auf', 'so', 'wie', 'ohne', 'pro', 'dein', 'deinen', 'deiner', 'deine', 'mein', 'sein',
  'ihre', 'unser', 'was', 'warum', 'dass', 'ist', 'nicht', 'du', 'sich', 'es', 'wir', 'auch',
  'nur', 'wenn', 'dann', 'aber', 'noch', 'mehr', 'alle', 'alles', 'immer', 'viele', 'sehr', 'gut',
  'neue', 'schon', 'nach', 'bei', 'zum', 'zur', 'über', 'unter', 'durch', 'den', 'dem', 'des',
  'dieser', 'diese', 'diesem', 'wirklich', 'richtig', 'einfach', 'schnell', 'besser', 'best',
  'beste', 'kompletter', 'vollständige', 'ehrliche', 'konkrete', 'kostenlos', 'täglich', 'mal',
  'davon', 'damit', 'dabei', 'daran', 'darüber', 'darunter', 'daraus', 'welche', 'welchen',
  'kann', 'kannst', 'sollst', 'sollte', 'musst', 'muss', 'wird', 'werden', 'hat', 'haben',
  'bist', 'sind', 'war', 'waren', 'wer', 'wen', 'wem', 'ihren', 'seinen',
  'jetzt', 'heute', 'hier', 'dort', 'schritt', 'schritte', 'weniger',
  'guide', 'anleitung', 'tipps', 'tipp', 'ideen', 'idee',
  // English stop words (for English-titled articles in this German blog)
  'for', 'the', 'and', 'how', 'your', 'make', 'best', 'with', 'owner', 'examples',
])

// Additional words too generic to be standalone link anchors (ok in bigrams)
const STOP_SINGLE = new Set([
  ...STOP_ALL,
  'restaurant', 'restaurants', 'gastronomie', 'marketing', 'content', 'social', 'media',
  'online', 'digital', 'google', 'instagram', 'tiktok', 'facebook', 'hashtags', 'hashtag',
  'bewertungen', 'bewertung', 'reichweite', 'sichtbarkeit', 'strategie', 'strategien',
  'plan', 'optimieren', 'optimiert', 'funktionieren', 'funktioniert',
])

interface LinkEntry {
  slug: string
  title: string
  phrases: string[] // lowercase, sorted longest first
}

/**
 * Extract the best 2-word phrases from an article title for use as link anchors.
 * Focuses on the part before the colon (the "headline"), ignores subtitle.
 */
function extractPhrases(title: string): string[] {
  // Take main part before colon
  const mainPart = (title.split(':')[0] || title)
    .toLowerCase()
    .replace(/[^a-zäöüß\s]/gi, ' ')
    .trim()

  const words = mainPart
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_ALL.has(w))

  const phrases = new Set<string>()

  // Bigrams (2-word phrases) — the most useful for linking
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i], w2 = words[i + 1]
    // Both words should have some substance
    if (w1.length >= 4 || w2.length >= 5) {
      phrases.add(`${w1} ${w2}`)
    }
  }

  // Trigrams for extra specificity (only if all 3 are meaningful)
  for (let i = 0; i < words.length - 2; i++) {
    const w1 = words[i], w2 = words[i + 1], w3 = words[i + 2]
    if (w1.length >= 4 && w2.length >= 4 && w3.length >= 4) {
      phrases.add(`${w1} ${w2} ${w3}`)
    }
  }

  // Single compound nouns (12+ chars, not in STOP_SINGLE)
  for (const w of words) {
    if (w.length >= 12 && !STOP_SINGLE.has(w)) {
      phrases.add(w)
    }
  }

  // Sort longest first (more specific matches take priority)
  return Array.from(phrases).sort((a, b) => b.length - a.length)
}

/**
 * Build the full link index from all MDX articles.
 */
function buildLinkIndex(): LinkEntry[] {
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx'))
  const entries: LinkEntry[] = []

  for (const filename of files) {
    const slug = filename.replace('.mdx', '')
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf-8')
    const { data } = matter(raw)

    if (!data.title || data.locale !== LOCALE) continue

    const phrases = extractPhrases(String(data.title))
    if (phrases.length > 0) {
      entries.push({ slug, title: String(data.title), phrases })
    }
  }

  return entries
}

/**
 * Attempt to insert a markdown link for `phrase` → `/de/blog/slug` in `content`.
 * Returns { newContent, linked }.
 * Only inserts the FIRST valid occurrence (not in heading/code/existing link).
 */
function insertLink(content: string, phrase: string, slug: string): { newContent: string; linked: boolean } {
  const url = `/de/blog/${slug}`
  const phraseLower = phrase.toLowerCase()
  let linked = false
  let inCodeBlock = false

  const lines = content.split('\n')

  const processedLines = lines.map(line => {
    if (linked) return line

    // Track fenced code blocks
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      return line
    }
    if (inCodeBlock) return line

    // Skip headings
    if (/^#{1,6}\s/.test(line.trim())) return line

    // Skip indented code lines
    if (line.startsWith('    ')) return line

    // Quick check: does this line contain the phrase at all?
    if (!line.toLowerCase().includes(phraseLower)) return line

    // Find the first valid occurrence (not inside an existing [...](...)  link)
    let searchFrom = 0
    while (searchFrom < line.length) {
      const idx = line.toLowerCase().indexOf(phraseLower, searchFrom)
      if (idx === -1) break

      // Check bracket depth to detect if we're inside [link text](...)
      const before = line.substring(0, idx)
      let bracketDepth = 0
      for (const ch of before) {
        if (ch === '[') bracketDepth++
        else if (ch === ']') bracketDepth--
      }

      if (bracketDepth > 0) {
        // Inside [link text] — skip
        searchFrom = idx + 1
        continue
      }

      // Check if followed by ]( which would mean we're in the middle of link text
      const after = line.substring(idx + phraseLower.length)
      if (after.startsWith('](')) {
        searchFrom = idx + 1
        continue
      }

      // Check if preceded by ( which might be part of URL
      if (before.endsWith('(')) {
        searchFrom = idx + 1
        continue
      }

      // Valid occurrence — wrap it
      const originalPhrase = line.substring(idx, idx + phrase.length)
      const newLine =
        line.substring(0, idx) +
        `[${originalPhrase}](${url})` +
        line.substring(idx + phrase.length)

      linked = true
      return newLine
    }

    return line
  })

  return { newContent: processedLines.join('\n'), linked }
}

/**
 * Process a single article: insert internal links for all known slugs.
 */
function processArticle(
  slug: string,
  content: string,
  linkIndex: LinkEntry[]
): { content: string; linksAdded: string[] } {
  // Collect slugs already linked in this article
  const alreadyLinkedSlugs = new Set<string>()
  const alreadyLinkedPhrases = new Set<string>() // prevent same phrase text → two different slugs
  const existingLinkRegex = /\[([^\]]+)\]\(\/de\/blog\/([^)]+)\)/g
  let match
  while ((match = existingLinkRegex.exec(content)) !== null) {
    alreadyLinkedSlugs.add(match[2])
    alreadyLinkedPhrases.add(match[1].toLowerCase())
  }

  // Build flat sorted phrase list across all articles (longest first)
  const allPhrases: Array<{ phrase: string; slug: string }> = []
  for (const entry of linkIndex) {
    if (entry.slug === slug) continue // no self-links
    for (const phrase of entry.phrases) {
      allPhrases.push({ phrase, slug: entry.slug })
    }
  }
  // Sort by phrase length desc so longer/more specific matches happen first
  allPhrases.sort((a, b) => b.phrase.length - a.phrase.length)

  let body = content
  const linksAdded: string[] = []

  for (const { phrase, slug: targetSlug } of allPhrases) {
    if (alreadyLinkedSlugs.has(targetSlug)) continue
    if (alreadyLinkedPhrases.has(phrase.toLowerCase())) continue
    if (!body.toLowerCase().includes(phrase.toLowerCase())) continue

    const { newContent, linked } = insertLink(body, phrase, targetSlug)
    if (linked) {
      body = newContent
      alreadyLinkedSlugs.add(targetSlug)
      alreadyLinkedPhrases.add(phrase.toLowerCase())
      linksAdded.push(`"${phrase}" → /de/blog/${targetSlug}`)
    }
  }

  return { content: body, linksAdded }
}

/**
 * Exported function for use by the pipeline after article generation.
 */
export async function processAllArticles(slugFilter?: string) {
  const linkIndex = buildLinkIndex()
  const files = fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.mdx'))
    .filter(f => slugFilter ? f === `${slugFilter}.mdx` : true)

  let updated = 0
  for (const filename of files) {
    const slug = filename.replace('.mdx', '')
    const filePath = path.join(BLOG_DIR, filename)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(raw)
    if (data.locale !== LOCALE) continue

    const { content: newContent, linksAdded } = processArticle(slug, content, linkIndex)
    if (linksAdded.length === 0) continue

    fs.writeFileSync(filePath, matter.stringify(newContent, data), 'utf-8')
    updated++
    console.log(`   🔗 ${filename} (+${linksAdded.length} links)`)
  }
  if (updated === 0) console.log('   No new links to add.')
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const slugArg = process.argv.find((a, i) => process.argv[i - 1] === '--slug')

  const linkIndex = buildLinkIndex()
  console.log(`📚 Loaded ${linkIndex.length} articles into link index\n`)

  const files = fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.mdx'))
    .filter(f => slugArg ? f === `${slugArg}.mdx` : true)

  let totalUpdated = 0

  for (const filename of files) {
    const slug = filename.replace('.mdx', '')
    const filePath = path.join(BLOG_DIR, filename)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(raw)

    if (data.locale !== LOCALE) continue

    const { content: newContent, linksAdded } = processArticle(slug, content, linkIndex)

    if (linksAdded.length === 0) {
      console.log(`  ✓ ${filename}`)
      continue
    }

    console.log(`  → ${filename} (+${linksAdded.length} links)`)
    linksAdded.forEach(l => console.log(`      ${l}`))

    if (!dryRun) {
      const newFile = matter.stringify(newContent, data)
      fs.writeFileSync(filePath, newFile, 'utf-8')
      totalUpdated++
    }
  }

  console.log(`\n${dryRun ? '[dry-run] ' : ''}Done! ${totalUpdated}/${files.length} files updated.`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

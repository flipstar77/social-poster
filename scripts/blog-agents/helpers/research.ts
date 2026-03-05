/**
 * RESEARCHER Agent Helper
 *
 * Picks the highest-priority unwritten keyword from Supabase,
 * gathers context from scraped articles + Tavily web search,
 * and outputs a research brief as JSON.
 *
 * Usage: npx tsx scripts/blog-agents/helpers/research.ts
 * Output: data/pipeline/research.json
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabase, findRelevantArticles, searchWeb, getExistingSlugs } from '../../blog-pipeline/shared'

const OUTPUT_DIR = path.join(process.cwd(), 'data', 'pipeline')

interface KeywordRow {
  id: string
  keyword: string
  category: string
  priority: number
  search_volume_estimate: string
  competition: string
}

// English keywords to skip (DACH blog = German only)
const ENGLISH_PATTERN = /\b(for|the|how|your|best|with|and|ideas|business|owner|examples|tips|new york|marketing for|hashtags for)\b/i

async function main() {
  console.log('[Researcher] Starting research phase...\n')

  const supabase = getSupabase()

  // 1. Get top priority keywords with status=new
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawKeywords, error } = await (supabase.from('blog_keywords') as any)
    .select('id, keyword, category, priority, search_volume_estimate, competition')
    .eq('status', 'new')
    .order('priority', { ascending: false })
    .limit(10) as { data: KeywordRow[] | null; error: unknown }

  if (error) {
    console.error('[Researcher] Supabase error:', error)
    process.exit(1)
  }

  if (!rawKeywords || rawKeywords.length === 0) {
    console.log('[Researcher] No unwritten keywords found. Run keyword research first.')
    writeOutput({ status: 'no_keywords', keyword: null, context: null })
    process.exit(0)
  }

  // Filter out English keywords
  const germanKeywords = rawKeywords.filter(kw => !ENGLISH_PATTERN.test(kw.keyword))
  if (germanKeywords.length === 0) {
    console.log('[Researcher] Only English keywords remaining — skipping.')
    writeOutput({ status: 'no_german_keywords', keyword: null, context: null })
    process.exit(0)
  }

  // 2. Check for duplicate slugs (avoid writing about same topic)
  const existingSlugs = getExistingSlugs()
  const existingSlugStr = Array.from(existingSlugs).join(' ')

  // Pick the first keyword that doesn't overlap too much with existing articles
  let selected = germanKeywords[0]
  for (const kw of germanKeywords) {
    const kwWords = kw.keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const overlap = kwWords.filter(w => existingSlugStr.includes(w)).length
    if (overlap / kwWords.length < 0.7) {
      selected = kw
      break
    }
  }

  console.log(`[Researcher] Selected: "${selected.keyword}" (${selected.category}, priority: ${selected.priority})`)

  // 3. Mark as planned
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('blog_keywords') as any)
    .update({ status: 'planned' })
    .eq('id', selected.id)

  // 4. Gather context from scraped articles
  console.log('[Researcher] Searching scraped articles...')
  const sourceArticles = await findRelevantArticles(selected.keyword)
  console.log(`[Researcher] Found ${sourceArticles.length} source articles`)

  // 5. Gather web search results
  console.log('[Researcher] Running web search...')
  const webResults = await searchWeb(
    `${selected.keyword} Restaurant DACH Deutschland Statistiken ${new Date().getFullYear()}`
  )
  console.log(`[Researcher] Found ${webResults.length} web results`)

  // 6. Get list of existing articles for context
  const existingArticleTitles = Array.from(existingSlugs).slice(0, 20).map(s =>
    s.replace(/-/g, ' ')
  )

  // 7. Write research brief
  const brief = {
    status: 'ready',
    keyword: {
      id: selected.id,
      text: selected.keyword,
      category: selected.category,
      priority: selected.priority,
      volume: selected.search_volume_estimate,
      competition: selected.competition,
    },
    context: {
      sourceArticles: sourceArticles.map(a => ({
        title: a.title,
        content: a.content.slice(0, 3000),
        source: a.source_id,
      })),
      webResults: webResults.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content.slice(0, 800),
      })),
      existingArticles: existingArticleTitles,
    },
    timestamp: new Date().toISOString(),
  }

  writeOutput(brief)
  console.log(`\n[Researcher] Research brief saved to data/pipeline/research.json`)
  console.log(`[Researcher] Keyword: "${selected.keyword}" (${selected.category})`)
  console.log(`[Researcher] Sources: ${sourceArticles.length} DB + ${webResults.length} web`)
}

function writeOutput(data: unknown) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'research.json'),
    JSON.stringify(data, null, 2),
    'utf-8'
  )
}

main().catch(err => {
  console.error('[Researcher] Fatal error:', err)
  process.exit(1)
})

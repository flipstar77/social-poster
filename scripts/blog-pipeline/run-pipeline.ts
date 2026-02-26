/**
 * Blog Pipeline Runner
 *
 * Orchestrates the full content pipeline:
 * 1. Keyword research (if --research flag)
 * 2. Pick top N keywords without articles
 * 3. Generate articles for each
 * 4. Add internal links
 *
 * Usage:
 *   npx tsx scripts/blog-pipeline/run-pipeline.ts                    # Generate 3 articles for top keywords
 *   npx tsx scripts/blog-pipeline/run-pipeline.ts --count 5          # Generate 5 articles
 *   npx tsx scripts/blog-pipeline/run-pipeline.ts --research         # Run keyword research first, then generate
 *   npx tsx scripts/blog-pipeline/run-pipeline.ts --category SEO     # Only generate for SEO keywords
 *   npx tsx scripts/blog-pipeline/run-pipeline.ts --dry-run          # Show what would be generated
 */

import {
  getSupabase,
  findRelevantArticles,
  buildAndSaveArticle,
} from './shared'

// --- Argument parsing ---
const args = process.argv.slice(2)
const flags = {
  research: args.includes('--research'),
  dryRun: args.includes('--dry-run'),
  count: parseInt(args[args.indexOf('--count') + 1]) || 3,
  category: args.includes('--category') ? args[args.indexOf('--category') + 1] : null,
}

// --- Keyword Research ---
const SEED_KEYWORDS: Record<string, string[]> = {
  'Instagram': [
    'restaurant instagram', 'instagram gastronomie', 'instagram tipps restaurant',
    'instagram reels restaurant', 'instagram stories gastronomie', 'instagram hashtags restaurant',
    'instagram reichweite gastronomie', 'instagram bio restaurant',
  ],
  'TikTok': [
    'restaurant tiktok', 'tiktok gastronomie', 'tiktok marketing restaurant',
    'tiktok video ideen restaurant', 'tiktok trends gastronomie',
  ],
  'Google Maps': [
    'google maps restaurant eintragen', 'google business profil restaurant',
    'google bewertungen restaurant', 'google maps optimieren gastronomie',
    'restaurant google ranking', 'google maps seo restaurant',
  ],
  'SEO': [
    'restaurant seo', 'seo gastronomie', 'restaurant website optimieren',
    'lokale seo restaurant', 'restaurant online gefunden werden',
  ],
  'Strategie': [
    'social media strategie restaurant', 'restaurant marketing strategie',
    'gastronomie marketing plan', 'restaurant mehr gäste',
    'restaurant content marketing', 'gastronomie kundenbindung',
  ],
}

async function googleSuggest(query: string): Promise<string[]> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=de&q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    if (!res.ok) {
      console.log(`   ⚠️  Google Suggest returned ${res.status} for "${query}" — may be rate-limited`)
      return []
    }
    const data = await res.json() as [string, string[]]
    return data[1] || []
  } catch (err) {
    console.log(`   ⚠️  Google Suggest failed for "${query}": ${(err as Error).message?.slice(0, 100)}`)
    return []
  }
}

async function runKeywordResearch() {
  console.log('🔍 Running keyword research...')
  const supabase = getSupabase()
  const keywords: Array<{ keyword: string; category: string; search_volume_estimate: string; competition: string; parent_keyword: string; priority: number }> = []

  for (const [category, seeds] of Object.entries(SEED_KEYWORDS)) {
    for (const seed of seeds) {
      const suggestions = await googleSuggest(seed)
      await new Promise(r => setTimeout(r, 300))

      const words = seed.split(' ').length
      const competition = words >= 4 ? 'low' : words >= 3 ? 'medium' : 'high'
      const volume = suggestions.length >= 5 ? 'high' : suggestions.length >= 2 ? 'medium' : 'low'
      const priority = (volume === 'high' ? 30 : volume === 'medium' ? 20 : 10) + (competition === 'low' ? 30 : competition === 'medium' ? 20 : 10)

      keywords.push({ keyword: seed, category, search_volume_estimate: volume, competition, parent_keyword: seed, priority })

      for (const s of suggestions) {
        const n = s.toLowerCase().trim()
        if (n === seed || keywords.some(k => k.keyword === n)) continue
        const isRelevant = /restaurant|gastro|café|cafe|bar |lokal|instagram|tiktok|google|seo|marketing|social media|online|bewertung/i.test(n)
        if (!isRelevant) continue
        const sw = n.split(' ').length
        const sc = sw >= 4 ? 'low' : sw >= 3 ? 'medium' : 'high'
        const sv = suggestions.filter(x => x.includes(n)).length >= 3 ? 'high' : 'medium'
        const sp = (sv === 'high' ? 30 : 20) + (sc === 'low' ? 30 : sc === 'medium' ? 20 : 10)
        keywords.push({ keyword: n, category, search_volume_estimate: sv, competition: sc, parent_keyword: seed, priority: sp })
      }
    }
  }

  const unique = Array.from(new Map(keywords.map(k => [k.keyword, k])).values())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('blog_keywords') as any).upsert(unique, { onConflict: 'keyword', ignoreDuplicates: true }).select('id')
  console.log(`   ${data?.length || 0} keywords saved (${unique.length} total)\n`)
}

// --- Main Pipeline ---
async function main() {
  console.log('🚀 Blog Pipeline\n')
  const supabase = getSupabase()

  // Step 1: Keyword research
  if (flags.research) {
    await runKeywordResearch()
  }

  // Step 2: Pick top keywords
  interface KeywordRow { id: string; keyword: string; category: string; priority: number }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('blog_keywords') as any)
    .select('id, keyword, category, priority')
    .eq('status', 'new')
    .order('priority', { ascending: false })
    .limit(flags.count)

  if (flags.category) {
    query = query.eq('category', flags.category)
  }

  const { data: keywords } = await query as { data: KeywordRow[] | null }

  if (!keywords || keywords.length === 0) {
    console.log('📭 No unwritten keywords found. Run with --research first.')
    process.exit(0)
  }

  console.log(`📋 Selected ${keywords.length} keywords to write about:\n`)
  for (const kw of keywords) {
    console.log(`   [${kw.priority}] ${kw.keyword} (${kw.category})`)
  }

  if (flags.dryRun) {
    console.log('\n🏁 Dry run — no articles generated.')
    process.exit(0)
  }

  // Step 3: Generate articles
  console.log('')
  let generated = 0
  for (const kw of keywords) {
    console.log(`\n📝 [${generated + 1}/${keywords.length}] "${kw.keyword}" (${kw.category})`)

    // Mark as planned to avoid parallel duplicates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('blog_keywords') as any).update({ status: 'planned' }).eq('id', kw.id)

    const sources = await findRelevantArticles(kw.keyword)
    const result = await buildAndSaveArticle(kw.keyword, kw.category, kw.id, sources)
    if (result.success) generated++

    // Small delay between generations
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`\n🎉 Pipeline complete! ${generated}/${keywords.length} articles generated.`)
  console.log(`   📁 Files: content/blog/`)

  // Step 4: Add internal links across all articles
  if (generated > 0) {
    console.log('\n🔗 Adding internal links...')
    const { processAllArticles } = await import('./add-internal-links')
    await processAllArticles()
  }

  // Stats
  const { count: totalArticles } = await supabase
    .from('generated_articles')
    .select('id', { count: 'exact', head: true })
  const { count: totalKeywords } = await supabase
    .from('blog_keywords')
    .select('id', { count: 'exact', head: true })
  const { count: writtenKeywords } = await supabase
    .from('blog_keywords')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'written')

  console.log(`\n📊 Pipeline Stats:`)
  console.log(`   Keywords: ${writtenKeywords}/${totalKeywords} written`)
  console.log(`   Articles: ${totalArticles} generated`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

/**
 * Article Generator (standalone CLI)
 *
 * Takes a keyword/topic, pulls relevant scraped articles from Supabase,
 * and generates an SEO-optimized blog post using xAI/Grok.
 *
 * Usage:
 *   npx tsx scripts/blog-pipeline/generate-article.ts "google business profil restaurant"
 *   npx tsx scripts/blog-pipeline/generate-article.ts --keyword-id <uuid>
 *   npx tsx scripts/blog-pipeline/generate-article.ts            # auto-select highest priority
 */

import {
  getSupabase,
  detectCategory,
  findRelevantArticles,
  buildAndSaveArticle,
} from './shared'

async function main() {
  const args = process.argv.slice(2)
  const supabase = getSupabase()

  let keyword = ''
  let keywordId: string | null = null
  let category = ''

  interface KeywordRow { id: string; keyword: string; category: string }

  if (args[0] === '--keyword-id' && args[1]) {
    keywordId = args[1]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('blog_keywords') as any)
      .select('keyword, category')
      .eq('id', keywordId)
      .single() as { data: KeywordRow | null }
    if (!data) {
      console.error('Keyword not found:', keywordId)
      process.exit(1)
    }
    keyword = data.keyword
    category = data.category
  } else if (args[0]) {
    keyword = args.join(' ')
    category = detectCategory(keyword)
  } else {
    // Auto-select: pick highest priority unwritten keyword
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('blog_keywords') as any)
      .select('id, keyword, category')
      .eq('status', 'new')
      .order('priority', { ascending: false })
      .limit(1)
      .single() as { data: KeywordRow | null }

    if (!data) {
      console.log('No unwritten keywords found. Run keyword-research.ts first.')
      process.exit(0)
    }
    keywordId = data.id
    keyword = data.keyword
    category = data.category
  }

  console.log(`\n📝 Generating article for: "${keyword}" (${category})`)

  // Find relevant source articles
  const sources = await findRelevantArticles(keyword)
  console.log(`📚 Found ${sources.length} relevant source articles`)

  if (sources.length === 0) {
    console.log('⚠️  No source articles found — generating without context')
  }

  // Generate and save
  console.log('🤖 Generating with Grok...')
  const result = await buildAndSaveArticle(keyword, category, keywordId, sources)

  if (!result.success) {
    console.error('❌ Article generation failed')
    process.exit(1)
  }

  console.log(`\n✅ Done: content/blog/${result.slug}.mdx (~${result.wordCount} words)`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

/**
 * Keyword Research Script
 *
 * Scrapes Google Autocomplete for gastro-relevant keywords,
 * categorizes them, and saves to Supabase.
 *
 * Usage: npx tsx scripts/blog-pipeline/keyword-research.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabase } from './shared'

// Seed keywords grouped by blog category
const SEED_KEYWORDS: Record<string, string[]> = {
  'Instagram': [
    'restaurant instagram',
    'instagram gastronomie',
    'instagram tipps restaurant',
    'restaurant instagram marketing',
    'instagram reels restaurant',
    'instagram stories gastronomie',
    'instagram hashtags restaurant',
    'restaurant fotos instagram',
    'cafe instagram tipps',
    'instagram reichweite gastronomie',
    'instagram bio restaurant',
    'restaurant instagram content ideen',
  ],
  'TikTok': [
    'restaurant tiktok',
    'tiktok gastronomie',
    'tiktok marketing restaurant',
    'tiktok video ideen restaurant',
    'tiktok trends gastronomie',
    'restaurant viral tiktok',
    'tiktok für kleine restaurants',
  ],
  'Google Maps': [
    'google maps restaurant eintragen',
    'google business profil restaurant',
    'google bewertungen restaurant',
    'google maps optimieren gastronomie',
    'restaurant google ranking',
    'google maps restaurant fotos',
    'google business profil optimieren',
    'restaurant mehr google bewertungen',
    'google maps seo restaurant',
    'lokale suche restaurant',
  ],
  'SEO': [
    'restaurant seo',
    'seo gastronomie',
    'restaurant website optimieren',
    'lokale seo restaurant',
    'restaurant online gefunden werden',
    'seo tipps gastronomie',
    'restaurant webseite seo',
    'gastronomie online marketing',
    'restaurant online sichtbarkeit',
  ],
  'Strategie': [
    'social media strategie restaurant',
    'restaurant marketing strategie',
    'gastronomie marketing plan',
    'restaurant online marketing',
    'social media plan gastronomie',
    'restaurant mehr gäste',
    'marketing budget restaurant',
    'restaurant werbung',
    'gastronomie kundenbindung',
    'restaurant stammgäste gewinnen',
    'restaurant content marketing',
    'restaurant newsletter',
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

function estimateVolume(suggestions: string[], keyword: string): string {
  // Heuristic: if a keyword appears in many autocomplete results, it's likely higher volume
  const appearances = suggestions.filter(s => s.includes(keyword) || keyword.includes(s)).length
  if (appearances >= 5) return 'high'
  if (appearances >= 2) return 'medium'
  return 'low'
}

function estimateCompetition(keyword: string): string {
  // Heuristic based on keyword specificity
  const words = keyword.split(' ').length
  if (words >= 4) return 'low'   // Long-tail = less competition
  if (words >= 3) return 'medium'
  return 'high'                   // Short keywords = more competition
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('🔍 Starting keyword research...\n')

  const allKeywords: Array<{
    keyword: string
    category: string
    search_volume_estimate: string
    competition: string
    parent_keyword: string
    priority: number
  }> = []

  for (const [category, seeds] of Object.entries(SEED_KEYWORDS)) {
    console.log(`\n📂 Category: ${category}`)

    for (const seed of seeds) {
      const suggestions = await googleSuggest(seed)
      await delay(300) // Rate limit

      // Add the seed keyword itself
      const volume = estimateVolume(suggestions, seed)
      const competition = estimateCompetition(seed)
      // Priority: long-tail + high volume = best
      const priority = (volume === 'high' ? 30 : volume === 'medium' ? 20 : 10)
        + (competition === 'low' ? 30 : competition === 'medium' ? 20 : 10)

      allKeywords.push({
        keyword: seed,
        category,
        search_volume_estimate: volume,
        competition,
        parent_keyword: seed,
        priority,
      })

      // Add unique suggestions that are relevant
      for (const suggestion of suggestions) {
        const normalized = suggestion.toLowerCase().trim()
        if (normalized === seed) continue
        if (allKeywords.some(k => k.keyword === normalized)) continue

        // Filter out irrelevant suggestions
        const isRelevant = normalized.includes('restaurant') || normalized.includes('gastro')
          || normalized.includes('café') || normalized.includes('cafe')
          || normalized.includes('bar') || normalized.includes('lokal')
          || normalized.includes('gaststätte') || normalized.includes('imbiss')
          || normalized.includes('instagram') || normalized.includes('tiktok')
          || normalized.includes('google') || normalized.includes('seo')
          || normalized.includes('marketing') || normalized.includes('social media')
          || normalized.includes('online') || normalized.includes('bewertung')

        if (!isRelevant) continue

        const sugVolume = estimateVolume(suggestions, normalized)
        const sugCompetition = estimateCompetition(normalized)
        const sugPriority = (sugVolume === 'high' ? 30 : sugVolume === 'medium' ? 20 : 10)
          + (sugCompetition === 'low' ? 30 : sugCompetition === 'medium' ? 20 : 10)

        allKeywords.push({
          keyword: normalized,
          category,
          search_volume_estimate: sugVolume,
          competition: sugCompetition,
          parent_keyword: seed,
          priority: sugPriority,
        })
      }

      console.log(`   "${seed}" → ${suggestions.length} suggestions`)
    }
  }

  // Deduplicate
  const unique = Array.from(new Map(allKeywords.map(k => [k.keyword, k])).values())
  console.log(`\n📊 Total unique keywords: ${unique.length}`)

  // Save to Supabase
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabase().from('blog_keywords') as any)
    .upsert(unique, { onConflict: 'keyword', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('❌ Supabase error:', error.message)
  } else {
    console.log(`💾 ${data?.length || 0} keywords saved to Supabase`)
  }

  // Print top priority keywords
  const sorted = unique.sort((a, b) => b.priority - a.priority)
  console.log('\n🏆 Top 15 Keywords by Priority:')
  for (const kw of sorted.slice(0, 15)) {
    console.log(`   [${kw.priority}] ${kw.keyword} (${kw.category}, vol: ${kw.search_volume_estimate}, comp: ${kw.competition})`)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

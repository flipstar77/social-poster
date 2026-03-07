/**
 * Scrape Instagram restaurant data for supported cities via Apify.
 *
 * Two-phase flow:
 *   Phase 1 (this script): Hashtag scrape → city stats + discover new handles
 *     - Scrapes restaurant hashtags per city
 *     - Aggregates stats into gastro_city_stats
 *     - Inserts newly discovered handles into restaurant_profiles (skips existing)
 *
 *   Phase 2 (existing pipeline): Deep profile scrape
 *     - Use Apify instagram-profile-scraper on new handles
 *     - Import via: npx tsx scripts/research/import-apify.ts
 *
 * Usage:
 *   npx tsx scripts/apify/scrape-city-restaurants.ts                  # all cities
 *   npx tsx scripts/apify/scrape-city-restaurants.ts --city berlin     # single city
 *   npx tsx scripts/apify/scrape-city-restaurants.ts --dry-run         # scrape but don't save
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config() // fallback to .env
import { createClient } from '@supabase/supabase-js'
import {
  CITY_HASHTAGS,
  SUPPORTED_CITIES,
  scrapeHashtag,
  type ApifyInstagramPost,
} from '../../src/lib/apify/client'
import { aggregateCityStats } from '../../src/lib/insights/analyzer'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const cityFlag = args.find((_, i, a) => a[i - 1] === '--city')
const cities = cityFlag ? [cityFlag] : SUPPORTED_CITIES

async function scrapeCity(city: string) {
  const hashtags = CITY_HASHTAGS[city]
  if (!hashtags) {
    console.error(`[Scraper] Unknown city: ${city}`)
    return
  }

  console.log(`\n========== Scraping ${city} (${hashtags.length} hashtags) ==========`)

  const allPosts: ApifyInstagramPost[] = []

  for (const tag of hashtags) {
    try {
      const posts = await scrapeHashtag(tag, 100)
      allPosts.push(...posts)
    } catch (err) {
      console.error(`[Scraper] Failed to scrape #${tag}:`, err)
    }
  }

  // Deduplicate by post ID
  const uniquePosts = [...new Map(allPosts.map(p => [p.id, p])).values()]
  console.log(`[Scraper] ${city}: ${uniquePosts.length} unique posts (${allPosts.length} total)`)

  // Aggregate city stats
  const stats = aggregateCityStats(city, uniquePosts)
  console.log(`[Scraper] ${city} stats:`, {
    avgLikes: stats.avgLikes,
    avgComments: stats.avgComments,
    topHashtags: stats.topHashtags.slice(0, 5).map(t => t.tag),
    sampleSize: stats.sampleSize,
  })

  // Extract unique accounts
  const accountMap = new Map<string, ApifyInstagramPost[]>()
  for (const post of uniquePosts) {
    if (!post.ownerUsername) continue
    const existing = accountMap.get(post.ownerUsername) ?? []
    existing.push(post)
    accountMap.set(post.ownerUsername, existing)
  }

  console.log(`[Scraper] ${city}: Found ${accountMap.size} unique accounts`)

  if (dryRun) {
    console.log('[Scraper] Dry run — skipping database writes')
    return { stats, accounts: accountMap.size }
  }

  // Upsert city stats
  const { error: statsError } = await (supabase
    .from('gastro_city_stats') as any)
    .upsert({
      city,
      platform: 'instagram',
      avg_likes: stats.avgLikes,
      avg_comments: stats.avgComments,
      avg_engagement_rate: stats.avgEngagementRate,
      median_followers: stats.medianFollowers,
      avg_posting_frequency: stats.avgPostingFrequency,
      top_hashtags: stats.topHashtags,
      best_posting_hours: stats.bestPostingHours,
      top_content_types: stats.topContentTypes,
      sample_size: stats.sampleSize,
      scraped_at: new Date().toISOString(),
    }, { onConflict: 'city,platform' })

  if (statsError) {
    console.error(`[Scraper] Failed to upsert city stats for ${city}:`, statsError)
  } else {
    console.log(`[Scraper] Saved city stats for ${city}`)
  }

  // Check which handles already exist in restaurant_profiles
  const handles = [...accountMap.keys()].map(h => h.toLowerCase())
  const { data: existingProfiles } = await (supabase
    .from('restaurant_profiles') as any)
    .select('handle')
    .in('handle', handles)

  const existingHandles = new Set((existingProfiles ?? []).map((p: any) => p.handle))
  const newHandles = handles.filter(h => !existingHandles.has(h))

  console.log(`[Scraper] ${existingHandles.size} already in DB, ${newHandles.length} new`)

  // Insert only NEW handles as minimal profiles (to be enriched later)
  let insertedCount = 0
  for (const handle of newHandles) {
    const posts = accountMap.get(handle) ?? accountMap.get(handle.toLowerCase()) ?? []
    const name = posts[0]?.ownerFullName ?? null

    const { error } = await (supabase
      .from('restaurant_profiles') as any)
      .insert({
        handle,
        name,
        city: city.charAt(0).toUpperCase() + city.slice(1),
        category: null,
        ig_followers: null,
        ig_posts_count: null,
        ig_avg_likes: posts.length > 0
          ? Math.round(posts.reduce((s, p) => s + (p.likesCount ?? 0), 0) / posts.length)
          : null,
        ig_avg_comments: posts.length > 0
          ? Math.round(posts.reduce((s, p) => s + (p.commentsCount ?? 0), 0) / posts.length * 10) / 10
          : null,
        ig_posts_analyzed: posts.length,
        collected_at: new Date().toISOString(),
      })

    if (error) {
      if (insertedCount === 0) console.error(`[Scraper] Insert error:`, error.message)
    } else {
      insertedCount++
    }
  }

  console.log(`[Scraper] Inserted ${insertedCount}/${newHandles.length} new profiles for ${city}`)
  return { stats, accounts: accountMap.size, newProfiles: insertedCount }
}

async function main() {
  console.log(`[Scraper] Starting scrape for cities: ${cities.join(', ')}`)
  console.log(`[Scraper] Dry run: ${dryRun}`)

  for (const city of cities) {
    await scrapeCity(city)
  }

  console.log('\n[Scraper] Done!')
  console.log('[Scraper] Next: Run Apify profile scraper on new handles, then:')
  console.log('  npx tsx scripts/research/import-apify.ts --file apify-output.json --restaurants data/restaurants.json')
}

main().catch(console.error)

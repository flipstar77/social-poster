/**
 * Import Apify Instagram data into Supabase.
 *
 * Usage:
 *   npx tsx scripts/research/import-apify.ts --file apify-output.json --restaurants data/restaurants.json
 *
 * - apify-output.json: Download from Apify run → Dataset → Export as JSON
 * - data/restaurants.json: Your list of [{handle, city, category}]
 *   (needed because Apify doesn't know city/category)
 *
 * Apify actor to use: apify/instagram-profile-scraper
 * Input: list of usernames
 * Output: download as JSON, pass via --file
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabase } from '../blog-pipeline/shared'
import type { ApifyProfileRaw, ApifyPost, RestaurantInput } from './types'

const args = process.argv.slice(2)
const fileArg = args[args.indexOf('--file') + 1]
const restaurantsArg = args[args.indexOf('--restaurants') + 1]

if (!fileArg) {
  console.error('Usage: npx tsx scripts/research/import-apify.ts --file apify-output.json --restaurants data/restaurants.json')
  process.exit(1)
}

// --- Score calculation (0–100) ---
function calcIgScore(p: {
  ig_has_bio_link: boolean | null
  ig_highlights_count: number | null
  ig_posting_frequency_per_week: number | null
  ig_engagement_rate: number | null
  ig_reel_ratio: number | null
}): number {
  let score = 0

  // Bio link (15 pts)
  if (p.ig_has_bio_link) score += 15

  // Highlights (10 pts)
  if ((p.ig_highlights_count ?? 0) > 0) score += 10

  // Posting frequency (25 pts)
  const freq = p.ig_posting_frequency_per_week ?? 0
  if (freq >= 4) score += 25
  else if (freq >= 2) score += 18
  else if (freq >= 1) score += 10
  else score += 3

  // Engagement rate (25 pts)
  const eng = p.ig_engagement_rate ?? 0
  if (eng >= 5) score += 25
  else if (eng >= 2) score += 18
  else if (eng >= 0.5) score += 10
  else score += 3

  // Reel ratio (25 pts)
  const rr = p.ig_reel_ratio ?? 0
  if (rr >= 0.6) score += 25
  else if (rr >= 0.3) score += 18
  else if (rr >= 0.1) score += 10
  else score += 3

  return Math.min(100, score)
}

// --- Parse Apify profile ---
function parseApifyProfile(raw: ApifyProfileRaw, meta: RestaurantInput) {
  const posts: ApifyPost[] = raw.latestPosts ?? []
  const analyzed = Math.min(posts.length, 50) // use up to 50 posts

  const recentPosts = posts.slice(0, analyzed)

  const reelCount = recentPosts.filter(p =>
    p.isReel === true || p.type?.toLowerCase() === 'video'
  ).length
  const photoCount = recentPosts.filter(p => p.type?.toLowerCase() === 'image').length
  const carouselCount = recentPosts.filter(p => p.type?.toLowerCase() === 'sidecar').length

  const avgLikes = analyzed > 0
    ? recentPosts.reduce((s, p) => s + (p.likesCount ?? 0), 0) / analyzed
    : null
  const avgComments = analyzed > 0
    ? recentPosts.reduce((s, p) => s + (p.commentsCount ?? 0), 0) / analyzed
    : null

  const followers = raw.followersCount ?? 0
  const engagementRate = (followers > 0 && avgLikes !== null && avgComments !== null)
    ? ((avgLikes + avgComments) / followers) * 100
    : null

  const reelRatio = analyzed > 0 ? reelCount / analyzed : null

  // Estimate posting frequency from timestamps
  let postingFreqPerWeek: number | null = null
  if (recentPosts.length >= 2) {
    const timestamps = recentPosts
      .map(p => p.timestamp ? new Date(p.timestamp).getTime() : null)
      .filter((t): t is number => t !== null)
      .sort((a, b) => b - a)

    if (timestamps.length >= 2) {
      const spanMs = timestamps[0] - timestamps[timestamps.length - 1]
      const spanWeeks = spanMs / (7 * 24 * 60 * 60 * 1000)
      if (spanWeeks > 0) {
        postingFreqPerWeek = Math.round((timestamps.length / spanWeeks) * 10) / 10
      }
    }
  }

  const metrics = {
    ig_followers: raw.followersCount ?? null,
    ig_posts_count: raw.postsCount ?? null,
    ig_has_bio_link: !!(raw.externalUrl),
    ig_bio: raw.biography ?? null,
    ig_highlights_count: raw.highlightReelCount ?? null,
    ig_avg_likes: avgLikes !== null ? Math.round(avgLikes * 10) / 10 : null,
    ig_avg_comments: avgComments !== null ? Math.round(avgComments * 10) / 10 : null,
    ig_reel_count: reelCount,
    ig_photo_count: photoCount,
    ig_carousel_count: carouselCount,
    ig_posts_analyzed: analyzed,
    ig_posting_frequency_per_week: postingFreqPerWeek,
    ig_engagement_rate: engagementRate !== null ? Math.round(engagementRate * 100) / 100 : null,
    ig_reel_ratio: reelRatio !== null ? Math.round(reelRatio * 100) / 100 : null,
  }

  const ig_score = calcIgScore(metrics)

  return {
    handle: (raw.username ?? raw.igUsername ?? meta.handle).toLowerCase(),
    name: raw.fullName ?? raw.name ?? meta.name ?? null,
    city: meta.city,
    category: meta.category ?? null,
    ...metrics,
    ig_score,
    google_place_id: null,
    google_rating: null,
    google_review_count: null,
    google_photos_count: null,
    google_has_website: null,
    google_hours_complete: null,
    apify_raw: raw as Record<string, unknown>,
    collected_at: new Date().toISOString(),
  }
}

async function main() {
  console.log('📥 Apify Import\n')

  // Load Apify output
  const apifyPath = path.resolve(fileArg)
  if (!fs.existsSync(apifyPath)) {
    console.error(`File not found: ${apifyPath}`)
    process.exit(1)
  }
  const apifyData = JSON.parse(fs.readFileSync(apifyPath, 'utf-8')) as ApifyProfileRaw[]
  console.log(`   ${apifyData.length} profiles from Apify`)

  // Load restaurant meta (city, category) if provided
  const metaMap = new Map<string, RestaurantInput>()
  if (restaurantsArg) {
    const metaPath = path.resolve(restaurantsArg)
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as RestaurantInput[]
      for (const r of meta) {
        metaMap.set(r.handle.toLowerCase(), r)
      }
      console.log(`   ${meta.length} restaurants from meta file`)
    }
  }

  // Parse + upsert
  const supabase = getSupabase()
  let imported = 0
  let skipped = 0

  for (const raw of apifyData) {
    const handle = ((raw.username ?? raw.igUsername) ?? '').toLowerCase()
    if (!handle) { skipped++; continue }

    const meta = metaMap.get(handle) ?? { handle, city: 'Unbekannt' }
    const profile = parseApifyProfile(raw, meta)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('restaurant_profiles') as any)
      .upsert(profile, { onConflict: 'handle' })

    if (error) {
      console.log(`   ❌ ${handle}: ${error.message}`)
      skipped++
    } else {
      console.log(`   ✅ @${handle} (${profile.city}) — score: ${profile.ig_score}, eng: ${profile.ig_engagement_rate?.toFixed(2)}%, reels: ${Math.round((profile.ig_reel_ratio ?? 0) * 100)}%`)
      imported++
    }
  }

  console.log(`\n✅ Done: ${imported} imported, ${skipped} skipped`)
  console.log(`\nNext step: npx tsx scripts/research/enrich-google.ts`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

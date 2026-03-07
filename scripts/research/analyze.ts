/**
 * Analyze restaurant profiles and compute insights.
 *
 * Reads from Supabase, computes stats, saves to data/analysis.json
 * (used by generate-report.ts to write the blog article).
 *
 * Usage:
 *   npx tsx scripts/research/analyze.ts
 *   npx tsx scripts/research/analyze.ts --city Berlin
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabase } from '../blog-pipeline/shared'
import { getCategoryDisplay } from './categories'

const args = process.argv.slice(2)
const cityFilter = args.includes('--city') ? args[args.indexOf('--city') + 1] : null

interface Profile {
  handle: string
  name: string | null
  city: string
  category: string | null
  ig_followers: number | null
  ig_has_bio_link: boolean | null
  ig_highlights_count: number | null
  ig_avg_likes: number | null
  ig_avg_comments: number | null
  ig_posting_frequency_per_week: number | null
  ig_engagement_rate: number | null
  ig_reel_ratio: number | null
  ig_posts_analyzed: number | null
  ig_score: number | null
  google_rating: number | null
  google_review_count: number | null
  google_photos_count: number | null
  google_has_website: boolean | null
}

function avg(values: (number | null)[]): number {
  const nums = values.filter((v): v is number => v !== null && !isNaN(v))
  if (!nums.length) return 0
  return Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 100) / 100
}

function median(values: (number | null)[]): number {
  const nums = values.filter((v): v is number => v !== null && !isNaN(v)).sort((a, b) => a - b)
  if (!nums.length) return 0
  const mid = Math.floor(nums.length / 2)
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid]
}

function pct(profiles: Profile[], pred: (p: Profile) => boolean): number {
  const count = profiles.filter(pred).length
  return Math.round((count / profiles.length) * 100)
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 3) return 0
  const mx = xs.reduce((s, x) => s + x, 0) / n
  const my = ys.reduce((s, y) => s + y, 0) / n
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const den = Math.sqrt(
    xs.reduce((s, x) => s + (x - mx) ** 2, 0) *
    ys.reduce((s, y) => s + (y - my) ** 2, 0)
  )
  return den === 0 ? 0 : Math.round((num / den) * 100) / 100
}

async function main() {
  console.log('📊 Restaurant Research Analysis\n')
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('restaurant_profiles') as any)
    .select('*')
    .not('ig_score', 'is', null)

  if (cityFilter) {
    query = query.eq('city', cityFilter)
  }

  const { data: allProfiles, error } = await query as { data: Profile[] | null; error: unknown }
  if (error || !allProfiles?.length) {
    console.error('No profiles found. Run import-apify.ts first.')
    process.exit(1)
  }

  const profiles = allProfiles
  const withGoogle = profiles.filter(p => p.google_rating !== null)
  const cities = [...new Set(profiles.map(p => p.city))]

  console.log(`Total profiles: ${profiles.length}`)
  console.log(`With Google data: ${withGoogle.length}`)
  console.log(`Cities: ${cities.join(', ')}\n`)

  // --- Segment: top vs bottom by IG score ---
  const sorted = [...profiles].sort((a, b) => (b.ig_score ?? 0) - (a.ig_score ?? 0))
  const topQuartile = sorted.slice(0, Math.floor(sorted.length * 0.25))
  const bottomQuartile = sorted.slice(Math.floor(sorted.length * 0.75))

  // --- Key metrics ---
  const stats = {
    total: profiles.length,
    cities,
    collected_at: new Date().toISOString(),

    // Overall averages
    avg_ig_score: avg(profiles.map(p => p.ig_score)),
    avg_engagement_rate: avg(profiles.map(p => p.ig_engagement_rate)),
    avg_posting_freq: avg(profiles.map(p => p.ig_posting_frequency_per_week)),
    avg_reel_ratio: avg(profiles.map(p => p.ig_reel_ratio)),
    avg_google_rating: avg(withGoogle.map(p => p.google_rating)),
    avg_google_reviews: avg(withGoogle.map(p => p.google_review_count)),

    // Medians
    median_ig_score: median(profiles.map(p => p.ig_score)),
    median_engagement_rate: median(profiles.map(p => p.ig_engagement_rate)),
    median_followers: median(profiles.map(p => p.ig_followers)),

    // Percentages
    pct_has_bio_link: pct(profiles, p => p.ig_has_bio_link === true),
    pct_has_highlights: pct(profiles, p => (p.ig_highlights_count ?? 0) > 0),
    pct_has_website: pct(withGoogle, p => p.google_has_website === true),
    pct_posts_4plus_per_week: pct(profiles, p => (p.ig_posting_frequency_per_week ?? 0) >= 4),
    pct_posts_1to4_per_week: pct(profiles, p => {
      const f = p.ig_posting_frequency_per_week ?? 0
      return f >= 1 && f < 4
    }),
    pct_posts_less_than_1_per_week: pct(profiles, p => (p.ig_posting_frequency_per_week ?? 0) < 1),
    pct_reels_majority: pct(profiles, p => (p.ig_reel_ratio ?? 0) >= 0.5),

    // Top vs Bottom comparison
    top_quartile: {
      count: topQuartile.length,
      avg_score: avg(topQuartile.map(p => p.ig_score)),
      avg_engagement: avg(topQuartile.map(p => p.ig_engagement_rate)),
      avg_posting_freq: avg(topQuartile.map(p => p.ig_posting_frequency_per_week)),
      avg_reel_ratio: avg(topQuartile.map(p => p.ig_reel_ratio)),
      pct_bio_link: pct(topQuartile, p => p.ig_has_bio_link === true),
      pct_highlights: pct(topQuartile, p => (p.ig_highlights_count ?? 0) > 0),
      avg_google_rating: avg(topQuartile.filter(p => p.google_rating !== null).map(p => p.google_rating)),
    },
    bottom_quartile: {
      count: bottomQuartile.length,
      avg_score: avg(bottomQuartile.map(p => p.ig_score)),
      avg_engagement: avg(bottomQuartile.map(p => p.ig_engagement_rate)),
      avg_posting_freq: avg(bottomQuartile.map(p => p.ig_posting_frequency_per_week)),
      avg_reel_ratio: avg(bottomQuartile.map(p => p.ig_reel_ratio)),
      pct_bio_link: pct(bottomQuartile, p => p.ig_has_bio_link === true),
      pct_highlights: pct(bottomQuartile, p => (p.ig_highlights_count ?? 0) > 0),
      avg_google_rating: avg(bottomQuartile.filter(p => p.google_rating !== null).map(p => p.google_rating)),
    },

    // Per city
    by_city: Object.fromEntries(cities.map(city => {
      const cp = profiles.filter(p => p.city === city)
      const cg = cp.filter(p => p.google_rating !== null)
      return [city, {
        count: cp.length,
        avg_ig_score: avg(cp.map(p => p.ig_score)),
        avg_engagement: avg(cp.map(p => p.ig_engagement_rate)),
        avg_google_rating: avg(cg.map(p => p.google_rating)),
        pct_bio_link: pct(cp, p => p.ig_has_bio_link === true),
      }]
    })),

    // Per category (all cities combined)
    by_category: (() => {
      const cats = [...new Set(profiles.map(p => p.category ?? 'restaurant'))]
      return Object.fromEntries(cats.map(cat => {
        const cp = profiles.filter(p => (p.category ?? 'restaurant') === cat)
        const cg = cp.filter(p => p.google_rating !== null)
        return [cat, {
          display: getCategoryDisplay(cat),
          count: cp.length,
          avg_ig_score: avg(cp.map(p => p.ig_score)),
          avg_engagement: avg(cp.map(p => p.ig_engagement_rate)),
          avg_posting_freq: avg(cp.map(p => p.ig_posting_frequency_per_week)),
          avg_reel_ratio: avg(cp.map(p => p.ig_reel_ratio)),
          avg_google_rating: avg(cg.map(p => p.google_rating)),
          pct_bio_link: pct(cp, p => p.ig_has_bio_link === true),
        }]
      }))
    })(),

    // Per city × category (used for card comparisons)
    by_city_and_category: (() => {
      const result: Record<string, Record<string, {
        display: string; count: number
        avg_ig_score: number; avg_engagement: number
        avg_posting_freq: number; avg_reel_ratio: number
        avg_google_rating: number
      }>> = {}

      for (const city of cities) {
        result[city] = {}
        const cityProfiles = profiles.filter(p => p.city === city)
        const cats = [...new Set(cityProfiles.map(p => p.category ?? 'restaurant'))]

        for (const cat of cats) {
          const cp = cityProfiles.filter(p => (p.category ?? 'restaurant') === cat)
          if (cp.length < 2) continue   // skip categories with only 1 entry
          const cg = cp.filter(p => p.google_rating !== null)
          result[city][cat] = {
            display: getCategoryDisplay(cat),
            count: cp.length,
            avg_ig_score: avg(cp.map(p => p.ig_score)),
            avg_engagement: avg(cp.map(p => p.ig_engagement_rate)),
            avg_posting_freq: avg(cp.map(p => p.ig_posting_frequency_per_week)),
            avg_reel_ratio: avg(cp.map(p => p.ig_reel_ratio)),
            avg_google_rating: avg(cg.map(p => p.google_rating)),
          }
        }
      }
      return result
    })(),

    // Correlations (Instagram score vs Google rating)
    correlation_ig_score_google_rating: (() => {
      const pairs = withGoogle.filter(p => p.ig_score !== null)
      if (pairs.length < 5) return null
      return pearsonCorrelation(
        pairs.map(p => p.ig_score!),
        pairs.map(p => p.google_rating!)
      )
    })(),
    correlation_engagement_google_rating: (() => {
      const pairs = withGoogle.filter(p => p.ig_engagement_rate !== null)
      if (pairs.length < 5) return null
      return pearsonCorrelation(
        pairs.map(p => p.ig_engagement_rate!),
        pairs.map(p => p.google_rating!)
      )
    })(),
    correlation_posting_freq_google_reviews: (() => {
      const pairs = withGoogle.filter(p => p.ig_posting_frequency_per_week !== null && p.google_review_count !== null)
      if (pairs.length < 5) return null
      return pearsonCorrelation(
        pairs.map(p => p.ig_posting_frequency_per_week!),
        pairs.map(p => p.google_review_count!)
      )
    })(),

    // Top 10 profiles by score (for article shoutouts)
    top_10: sorted.slice(0, 10).map(p => ({
      handle: p.handle,
      name: p.name,
      city: p.city,
      category: p.category,
      ig_score: p.ig_score,
      ig_engagement_rate: p.ig_engagement_rate,
      google_rating: p.google_rating,
    })),

  }

  // Compute per-profile category-aware deltas (needs full stats object)
  const byCityAndCat = stats.by_city_and_category as Record<string, Record<string, { avg_ig_score: number }>>
  const byCity = stats.by_city as Record<string, { avg_ig_score: number }>
  const profileDeltas = profiles.map(p => {
    const cat = p.category ?? 'restaurant'
    const city = p.city
    const catCityAvg = byCityAndCat?.[city]?.[cat]?.avg_ig_score
    const cityAvg = byCity?.[city]?.avg_ig_score ?? 50
    const referenceAvg = catCityAvg ?? cityAvg
    return {
      handle: p.handle,
      city,
      category: cat,
      category_display: getCategoryDisplay(cat),
      ig_score: p.ig_score,
      reference_avg: Math.round(referenceAvg * 10) / 10,
      reference_label: catCityAvg
        ? `Ø ${city} ${getCategoryDisplay(cat)}`
        : `Ø ${city}`,
      delta: Math.round(((p.ig_score ?? 0) - referenceAvg) * 10) / 10,
    }
  })
  ;(stats as Record<string, unknown>).profile_deltas = profileDeltas

  // Print summary
  console.log('='.repeat(60))
  console.log('ANALYSIS RESULTS')
  console.log('='.repeat(60))
  console.log(`\n📱 Instagram`)
  console.log(`  Avg Score:        ${stats.avg_ig_score}/100`)
  console.log(`  Avg Engagement:   ${stats.avg_engagement_rate}%`)
  console.log(`  Avg Posting Freq: ${stats.avg_posting_freq}x/Woche`)
  console.log(`  Avg Reel Ratio:   ${Math.round((stats.avg_reel_ratio ?? 0) * 100)}%`)
  console.log(`  % mit Bio-Link:   ${stats.pct_has_bio_link}%`)
  console.log(`  % mit Highlights: ${stats.pct_has_highlights}%`)
  console.log(`  % >4x/Woche:      ${stats.pct_posts_4plus_per_week}%`)
  console.log(`  % Reels Mehrheit: ${stats.pct_reels_majority}%`)

  console.log(`\n🗺️  Google (${withGoogle.length} profiles)`)
  console.log(`  Avg Rating:       ${stats.avg_google_rating}`)
  console.log(`  Avg Reviews:      ${stats.avg_google_reviews}`)

  console.log(`\n🔝 Top 25% vs Bottom 25%`)
  console.log(`  Engagement:   Top ${stats.top_quartile.avg_engagement}% vs Bottom ${stats.bottom_quartile.avg_engagement}%`)
  console.log(`  Freq/Woche:   Top ${stats.top_quartile.avg_posting_freq} vs Bottom ${stats.bottom_quartile.avg_posting_freq}`)
  console.log(`  Bio-Link:     Top ${stats.top_quartile.pct_bio_link}% vs Bottom ${stats.bottom_quartile.pct_bio_link}%`)
  console.log(`  Google ⭐:    Top ${stats.top_quartile.avg_google_rating} vs Bottom ${stats.bottom_quartile.avg_google_rating}`)

  if (stats.correlation_ig_score_google_rating !== null) {
    console.log(`\n📈 Korrelationen`)
    console.log(`  IG Score ↔ Google Rating:    r=${stats.correlation_ig_score_google_rating}`)
    console.log(`  Engagement ↔ Google Rating:  r=${stats.correlation_engagement_google_rating}`)
    console.log(`  Posting Freq ↔ Reviews:      r=${stats.correlation_posting_freq_google_reviews}`)
  }

  // Save analysis
  const outDir = path.join(process.cwd(), 'data')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'analysis.json')
  fs.writeFileSync(outPath, JSON.stringify(stats, null, 2), 'utf-8')
  console.log(`\n💾 Saved to data/analysis.json`)
  console.log(`\nNext step: npx tsx scripts/research/generate-report.ts`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

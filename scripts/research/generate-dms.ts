/**
 * Generate personalized DM texts for each restaurant.
 *
 * Reads analyzed profiles from Supabase,
 * generates a personalized DM for each,
 * exports to data/dms.csv (ready to copy-paste or import into tool)
 *
 * Usage:
 *   npx tsx scripts/research/generate-dms.ts
 *   npx tsx scripts/research/generate-dms.ts --city Berlin
 *   npx tsx scripts/research/generate-dms.ts --min-score 0 --max-score 65   # only under-performers
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabase } from '../blog-pipeline/shared'

const args = process.argv.slice(2)
const cityFilter = args.includes('--city') ? args[args.indexOf('--city') + 1] : null
const minScore = args.includes('--min-score') ? parseInt(args[args.indexOf('--min-score') + 1]) : 0
const maxScore = args.includes('--max-score') ? parseInt(args[args.indexOf('--max-score') + 1]) : 100

interface Profile {
  handle: string
  name: string | null
  city: string
  category: string | null
  ig_score: number | null
  ig_engagement_rate: number | null
  ig_reel_ratio: number | null
  ig_posting_frequency_per_week: number | null
  ig_has_bio_link: boolean | null
  ig_highlights_count: number | null
  ig_avg_likes: number | null
  google_rating: number | null
  google_review_count: number | null
}

interface CityStats {
  avg_ig_score: number
  avg_engagement: number
  avg_reel_ratio: number
  avg_posting_freq: number
  count: number
}

interface ProfileDelta {
  handle: string
  reference_avg: number
  reference_label: string
  delta: number
}

// Step 1: Icebreaker — no score, no pitch, just a question
function buildIcebreaker(p: Profile): string {
  return `Hey 👋

Kurze Frage: Wer kümmert sich bei euch um Instagram?

(Wir haben gerade 100 Restaurants in ${p.city} analysiert und ${p.name ?? p.handle} war dabei — wollten kurz fragen bevor wir die Auswertung schicken)`
}

// Step 2: Follow-up after they respond
function buildFollowup(p: Profile, cityStats: CityStats, deltaInfo?: ProfileDelta): string {
  const score = p.ig_score ?? 0
  const tips: string[] = []
  if (!p.ig_has_bio_link) tips.push('Bio-Link fehlt')
  if ((p.ig_reel_ratio ?? 0) < 0.2) tips.push(`kaum Reels (${Math.round((p.ig_reel_ratio ?? 0) * 100)}% eurer Posts)`)
  if ((p.ig_posting_frequency_per_week ?? 0) < 1.5) tips.push(`Posting-Frequenz: ${p.ig_posting_frequency_per_week ?? 0}x/Woche`)

  const topTip = tips[0] ?? 'Engagement-Potenzial'
  const refAvg = deltaInfo?.reference_avg ?? cityStats.avg_ig_score
  const refLabel = deltaInfo?.reference_label ?? `Ø ${p.city}`
  const delta = score - refAvg
  const deltaStr = delta >= 0
    ? `${delta.toFixed(0)} Punkte über dem ${refLabel}`
    : `${Math.abs(delta).toFixed(0)} Punkte Potenzial bis zum ${refLabel}`

  return `Super, danke!

Hier eure Kurzauswertung: Digitale Sichtbarkeit ${score}/100 (${deltaStr}).

Größter Hebel den wir gesehen haben: ${topTip}.

Die vollständige Analyse (mit 3 konkreten Maßnahmen) schicke ich euch gern — ich hänge sie als Bild an.

Soll ich das kurz machen?`
}

function buildDmText(p: Profile, cityStats: CityStats, variant: 'soft' | 'data', deltaInfo?: ProfileDelta): string {
  const score = p.ig_score ?? 0
  const displayName = p.name ?? p.handle
  const city = p.city

  // Top improvement tips
  const tips: string[] = []
  if (!p.ig_has_bio_link) tips.push('kein Bio-Link')
  if ((p.ig_reel_ratio ?? 0) < 0.2) tips.push(`kaum Reels (${Math.round((p.ig_reel_ratio ?? 0) * 100)}%)`)
  if ((p.ig_posting_frequency_per_week ?? 0) < 1.5) tips.push(`selten gepostet (${p.ig_posting_frequency_per_week ?? 0}x/Woche)`)
  if ((p.ig_highlights_count ?? 0) === 0) tips.push('keine Story-Highlights')

  const topTip = tips[0] ?? 'Engagement-Potenzial'
  const refAvg = deltaInfo?.reference_avg ?? cityStats.avg_ig_score
  const refLabel = deltaInfo?.reference_label ?? `Ø ${city}`
  const scoreVsAvg = score - refAvg
  const scoreContext = scoreVsAvg >= 0
    ? `Das ist über dem ${refLabel} (${refAvg}/100)`
    : `Der ${refLabel} liegt bei ${refAvg}/100`

  if (variant === 'soft') {
    return `Hey 👋

Wir haben gerade 100 DACH-Restaurant-Instagram-Profile analysiert und ${displayName} war dabei.

Euer Instagram Score liegt bei ${score}/100. ${scoreContext}.

Falls ihr wollt, schicken wir euch eine kurze kostenlose Analyse mit den 3 größten Hebeln für mehr Sichtbarkeit.

Interesse?

– FlowingPost Team`
  }

  // data variant — more specific
  return `Hey 👋

Kurze Info: Wir haben ${displayName} in unserer Instagram-Analyse von 100 DACH-Restaurants analysiert.

Euer Score: ${score}/100 (${refLabel}: ${refAvg}/100)

Größter Hebel den wir gesehen haben: ${topTip}.

Wenn das interessant ist — wir schicken euch gern eine kostenlose 3-Punkte-Analyse.

– FlowingPost`
}

function escapeCsv(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

async function main() {
  console.log('💬 DM Generator\n')
  const supabase = getSupabase()

  // Load profile_deltas from analysis.json for category-aware reference averages
  const analysisPath = path.join(process.cwd(), 'data', 'analysis.json')
  const deltaMap = new Map<string, ProfileDelta>()
  if (fs.existsSync(analysisPath)) {
    try {
      const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'))
      const deltas: ProfileDelta[] = analysis.profile_deltas ?? []
      for (const d of deltas) deltaMap.set(d.handle, d)
      console.log(`📊 Loaded ${deltaMap.size} category-aware deltas from analysis.json\n`)
    } catch {
      console.log('⚠️  analysis.json could not be parsed — using city averages\n')
    }
  } else {
    console.log('ℹ️  No analysis.json — run analyze.ts first for category-aware comparisons\n')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('restaurant_profiles') as any)
    .select('handle, name, city, category, ig_score, ig_engagement_rate, ig_reel_ratio, ig_posting_frequency_per_week, ig_has_bio_link, ig_highlights_count, ig_avg_likes, google_rating, google_review_count')
    .not('ig_score', 'is', null)
    .gte('ig_score', minScore)
    .lte('ig_score', maxScore)

  if (cityFilter) query = query.eq('city', cityFilter)

  const { data: profiles, error } = await query as { data: Profile[] | null; error: unknown }

  if (error || !profiles?.length) {
    console.error('No profiles found. Run import-apify.ts + analyze.ts first.')
    process.exit(1)
  }

  // City stats
  const cities = [...new Set(profiles.map(p => p.city))]
  const cityStatsMap = new Map<string, CityStats>()

  for (const city of cities) {
    const cp = profiles.filter(p => p.city === city)
    const avg = (vals: (number | null)[]) => {
      const nums = vals.filter((v): v is number => v !== null)
      return nums.length ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10 : 0
    }
    cityStatsMap.set(city, {
      avg_ig_score: avg(cp.map(p => p.ig_score)),
      avg_engagement: avg(cp.map(p => p.ig_engagement_rate)),
      avg_reel_ratio: avg(cp.map(p => p.ig_reel_ratio)),
      avg_posting_freq: avg(cp.map(p => p.ig_posting_frequency_per_week)),
      count: cp.length,
    })
  }

  console.log(`Generating DMs for ${profiles.length} profiles...\n`)

  const rows: string[] = [
    ['handle', 'name', 'city', 'ig_score', 'google_rating', 'dm_icebreaker', 'dm_followup', 'dm_soft', 'card_path'].join(',')
  ]

  for (const p of profiles) {
    const cityStats = cityStatsMap.get(p.city) ?? { avg_ig_score: 50, avg_engagement: 1.5, avg_reel_ratio: 0.35, avg_posting_freq: 2.5, count: 0 }
    const deltaInfo = deltaMap.get(p.handle)
    const dmIcebreaker = buildIcebreaker(p)
    const dmFollowup = buildFollowup(p, cityStats, deltaInfo)
    const dmSoft = buildDmText(p, cityStats, 'soft', deltaInfo)
    const cardPath = `data/cards/${p.handle}.png`

    rows.push([
      escapeCsv('@' + p.handle),
      escapeCsv(p.name ?? p.handle),
      escapeCsv(p.city),
      String(p.ig_score ?? ''),
      String(p.google_rating ?? ''),
      escapeCsv(dmIcebreaker),
      escapeCsv(dmFollowup),
      escapeCsv(dmSoft),
      escapeCsv(cardPath),
    ].join(','))

    console.log(`   ✅ @${p.handle} (score: ${p.ig_score})`)
  }

  // Save CSV
  const outDir = path.join(process.cwd(), 'data')
  fs.mkdirSync(outDir, { recursive: true })
  const csvPath = path.join(outDir, 'dms.csv')
  fs.writeFileSync(csvPath, rows.join('\n'), 'utf-8')

  // Also save JSON for easier scripting
  const jsonPath = path.join(outDir, 'dms.json')
  const jsonData = profiles.map(p => {
    const cityStats = cityStatsMap.get(p.city) ?? { avg_ig_score: 50, avg_engagement: 1.5, avg_reel_ratio: 0.35, avg_posting_freq: 2.5, count: 0 }
    const deltaInfo = deltaMap.get(p.handle)
    return {
      handle: p.handle,
      name: p.name,
      city: p.city,
      category: p.category,
      ig_score: p.ig_score,
      google_rating: p.google_rating,
      reference_label: deltaInfo?.reference_label ?? `Ø ${p.city}`,
      reference_avg: deltaInfo?.reference_avg ?? cityStats.avg_ig_score,
      dm_icebreaker: buildIcebreaker(p),
      dm_followup: buildFollowup(p, cityStats, deltaInfo),
      dm_soft: buildDmText(p, cityStats, 'soft', deltaInfo),
      card_path: `data/cards/${p.handle}.png`,
    }
  })
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8')

  console.log(`\n✅ ${profiles.length} DMs generated`)
  console.log(`   CSV: data/dms.csv`)
  console.log(`   JSON: data/dms.json`)
  console.log(`\nExample DM (soft):`)
  if (profiles[0]) {
    const first = cityStatsMap.get(profiles[0].city) ?? { avg_ig_score: 50, avg_engagement: 1.5, avg_reel_ratio: 0.35, avg_posting_freq: 2.5, count: 0 }
    const firstDelta = deltaMap.get(profiles[0].handle)
    console.log('\n' + buildDmText(profiles[0], first, 'soft', firstDelta))
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

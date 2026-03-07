/**
 * Generate personalized score cards (PNG) for each restaurant.
 * V2: Ranking-focused, one lever, clean metric bars, subtle branding.
 *
 * Output: data/cards/{handle}.png (1080x1080, square)
 *
 * Usage:
 *   npx tsx scripts/research/generate-cards.ts              # all profiles
 *   npx tsx scripts/research/generate-cards.ts --handle xyz # single profile
 *   npx tsx scripts/research/generate-cards.ts --city Berlin
 */

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabase } from '../blog-pipeline/shared'

const args = process.argv.slice(2)
const handleFilter = args.includes('--handle') ? args[args.indexOf('--handle') + 1] : null
const cityFilter = args.includes('--city') ? args[args.indexOf('--city') + 1] : null

const OUT_DIR = path.join(process.cwd(), 'data', 'cards')

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
  google_rating: number | null
  google_review_count: number | null
}

interface ProfileDelta {
  handle: string
  reference_avg: number
  reference_label: string
  delta: number
}

interface CityAvg {
  avg_ig_score: number
  avg_engagement_rate: number
  avg_reel_ratio: number
  avg_posting_freq: number
}

function getCityAvg(profiles: Profile[], city: string): CityAvg {
  const cp = profiles.filter(p => p.city === city && p.ig_score !== null)
  const avg = (vals: (number | null)[]) => {
    const nums = vals.filter((v): v is number => v !== null)
    return nums.length ? Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10 : 0
  }
  return {
    avg_ig_score: avg(cp.map(p => p.ig_score)),
    avg_engagement_rate: avg(cp.map(p => p.ig_engagement_rate !== null ? Math.min(p.ig_engagement_rate, 10) : null)),
    avg_reel_ratio: avg(cp.map(p => p.ig_reel_ratio)),
    avg_posting_freq: avg(cp.map(p => p.ig_posting_frequency_per_week !== null ? Math.min(p.ig_posting_frequency_per_week, 7) : null)),
  }
}

// Single biggest lever — human-readable, 2 lines max
function getBiggestHebel(p: Profile, avg: CityAvg): { line1: string; line2: string } {
  const reelRatio = p.ig_reel_ratio ?? 0
  const freq = p.ig_posting_frequency_per_week ?? 0
  const eng = p.ig_engagement_rate ?? 0

  if (reelRatio === 0 && freq < 0.5) {
    return {
      line1: 'Kaum aktiv und null Reels — Instagram',
      line2: 'zeigt euer Profil keinen neuen Gästen.',
    }
  }
  if (reelRatio === 0) {
    return {
      line1: 'Kein einziges Reel — der stärkste',
      line2: 'Reichweiten-Hebel auf Instagram fehlt komplett.',
    }
  }
  if (freq < 0.3) {
    return {
      line1: 'Fast inaktiv — bei weniger als 1x pro Woche',
      line2: 'vergisst der Algorithmus euer Profil.',
    }
  }
  if (!p.ig_has_bio_link) {
    return {
      line1: 'Kein Link in der Bio — neue Gäste',
      line2: 'können nicht direkt reservieren.',
    }
  }
  if (reelRatio < 0.15) {
    return {
      line1: `Nur ${Math.round(reelRatio * 100)}% Reels — Fotos allein erreichen`,
      line2: 'kaum neue Follower über Explore.',
    }
  }
  if (freq < 1.0) {
    return {
      line1: `${freq.toFixed(1)}x pro Woche — 2-3x posten bringt`,
      line2: 'messbar mehr Sichtbarkeit bei neuen Gästen.',
    }
  }
  if (eng < avg.avg_engagement_rate * 0.5) {
    return {
      line1: `${eng.toFixed(1)}% Engagement — eure Community`,
      line2: 'interagiert kaum. Content-Mix anpassen.',
    }
  }
  return {
    line1: 'Mehr Reels und konsistentes Posting',
    line2: 'steigern eure Sichtbarkeit spürbar.',
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return '#4ade80'   // green
  if (score >= 45) return '#fbbf24'   // amber
  return '#f87171'                     // red
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildSvg(p: Profile, cityAvg: CityAvg, _deltaInfo?: ProfileDelta, rank?: number, cityTotal?: number): string {
  const score = p.ig_score ?? 0
  const color = scoreColor(score)

  // Strip emojis (sharp/librsvg can't render them)
  const rawName = (p.name ?? p.handle)
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
    .trim()
  const displayName = esc(rawName.length > 32 ? rawName.substring(0, 30) + '...' : rawName)
  const handle = esc('@' + p.handle)
  const city = esc(p.city)

  const W = 1080
  const H = 1080

  // Metrics
  const freq = p.ig_posting_frequency_per_week ?? 0
  const reelRatio = p.ig_reel_ratio ?? 0
  const engagement = p.ig_engagement_rate ?? 0
  const googleRating = p.google_rating ?? 0
  const googleReviews = p.google_review_count ?? 0

  // Cap extreme averages (outliers in small city samples skew these)
  const avgFreq = Math.min(cityAvg.avg_posting_freq, 7)
  const avgReelRatio = cityAvg.avg_reel_ratio
  const avgEng = Math.min(cityAvg.avg_engagement_rate, 8)

  const hebel = getBiggestHebel(p, cityAvg)

  // ── Metric bar helper ──
  const BAR_X = 420
  const BAR_W = 480
  const BAR_H = 14
  const BAR_R = BAR_H / 2

  function metricRow(
    y: number, label: string, value: string,
    pct: number, avgPct: number, rightLabel: string,
    isStrength = false,
  ): string {
    const filled = Math.max(Math.round(BAR_W * Math.min(pct, 1)), 0)
    const avgX = BAR_X + Math.round(BAR_W * Math.min(avgPct, 1))
    const fillColor = isStrength
      ? '#4ade80'
      : (pct < avgPct * 0.8 ? color : 'rgba(255,255,255,0.3)')

    return `
      <text x="80" y="${y}" font-family="Arial, sans-serif" font-size="22" fill="rgba(255,255,255,0.45)">${label}</text>
      <text x="340" y="${y}" text-anchor="end" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#ffffff">${value}</text>
      <rect x="${BAR_X}" y="${y - 9}" width="${BAR_W}" height="${BAR_H}" fill="rgba(255,255,255,0.06)" rx="${BAR_R}"/>
      <rect x="${BAR_X}" y="${y - 9}" width="${filled}" height="${BAR_H}" fill="${fillColor}" rx="${BAR_R}"/>
      ${avgPct > 0 ? `<line x1="${avgX}" y1="${y - 16}" x2="${avgX}" y2="${y + 8}" stroke="rgba(255,255,255,0.25)" stroke-width="2" stroke-dasharray="3,2"/>` : ''}
      <text x="${W - 80}" y="${y}" text-anchor="end" font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.25)">${rightLabel}</text>
    `
  }

  // Bar fill percentages (relative to sensible max)
  const freqPct = freq / 5
  const freqAvgPct = avgFreq / 5
  const reelPct = reelRatio          // already 0-1
  const reelAvgPct = avgReelRatio
  const engPct = engagement / 5
  const engAvgPct = avgEng / 5
  const googlePct = googleRating / 5

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#0c0c14"/>
      <stop offset="100%" stop-color="#0a0a10"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Accent bar -->
  <rect width="${W}" height="4" fill="${color}"/>

  <!-- ── IDENTITY ── -->
  <text x="80" y="60" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.2)" letter-spacing="1">
    Instagram Analyse · Februar 2026
  </text>

  <text x="80" y="130" font-family="Arial, sans-serif" font-size="48" font-weight="800" fill="#ffffff">
    ${displayName}
  </text>
  <text x="80" y="172" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.3)">
    ${handle} · ${city}
  </text>

  <line x1="80" y1="205" x2="${W - 80}" y2="205" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

  <!-- ── RANKING (hero metric) ── -->
  <text x="80" y="258" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.25)" letter-spacing="3">
    PLATZ
  </text>
  ${rank && cityTotal ? `
  <text x="80" y="365" font-family="Arial, sans-serif" font-size="104" font-weight="900" fill="${color}">
    ${rank}
  </text>
  <text x="80" y="405" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.35)">
    von ${cityTotal} Restaurants in ${city}
  </text>` : `
  <text x="80" y="365" font-family="Arial, sans-serif" font-size="104" font-weight="900" fill="${color}">
    ${score}
  </text>
  <text x="80" y="405" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.35)">
    Sichtbarkeits-Score von 100
  </text>`}

  <!-- Score (secondary, right side) -->
  ${rank && cityTotal ? `
  <text x="${W - 80}" y="288" text-anchor="end" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.2)" letter-spacing="2">
    SCORE
  </text>
  <text x="${W - 80}" y="360" text-anchor="end" font-family="Arial, sans-serif" font-size="60" font-weight="800" fill="rgba(255,255,255,0.35)">
    ${score}
  </text>
  <text x="${W - 80}" y="393" text-anchor="end" font-family="Arial, sans-serif" font-size="22" fill="rgba(255,255,255,0.15)">
    von 100
  </text>` : ''}

  <line x1="80" y1="435" x2="${W - 80}" y2="435" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

  <!-- ── METRICS ── -->
  <text x="80" y="480" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.2)" letter-spacing="3">
    PROFIL-DATEN
  </text>

  ${metricRow(530, 'Posting', `${freq.toFixed(1)}x / Wo`, freqPct, freqAvgPct, `Ø ${avgFreq.toFixed(1)}x`)}
  ${metricRow(590, 'Reels', `${Math.round(reelRatio * 100)}%`, reelPct, reelAvgPct, `Ø ${Math.round(avgReelRatio * 100)}%`)}
  ${metricRow(650, 'Engagement', `${engagement.toFixed(1)}%`, engPct, engAvgPct, `Ø ${avgEng.toFixed(1)}%`)}
  ${googleRating > 0 ? metricRow(710, 'Google', `${googleRating}`, googlePct, 0, `${googleReviews} Bew.`, true) : ''}

  <line x1="80" y1="755" x2="${W - 80}" y2="755" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

  <!-- ── BIGGEST LEVER ── -->
  <text x="80" y="805" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.2)" letter-spacing="3">
    GRÖSSTER HEBEL
  </text>
  <text x="80" y="860" font-family="Arial, sans-serif" font-size="28" font-weight="600" fill="${color}">
    ${esc(hebel.line1)}
  </text>
  <text x="80" y="900" font-family="Arial, sans-serif" font-size="28" font-weight="600" fill="${color}">
    ${esc(hebel.line2)}
  </text>

  <!-- ── FOOTER ── -->
  <line x1="80" y1="${H - 65}" x2="${W - 80}" y2="${H - 65}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <text x="${W / 2}" y="${H - 30}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.12)">
    FlowingPost · Restaurant Instagram Research 2026
  </text>
</svg>`
}

async function main() {
  console.log('🎨 Score Card Generator v2\n')
  const supabase = getSupabase()

  // Load profile_deltas from analysis.json if available
  const analysisPath = path.join(process.cwd(), 'data', 'analysis.json')
  const deltaMap = new Map<string, ProfileDelta>()
  if (fs.existsSync(analysisPath)) {
    try {
      const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'))
      const deltas: ProfileDelta[] = analysis.profile_deltas ?? []
      for (const d of deltas) deltaMap.set(d.handle, d)
      console.log(`📊 Loaded ${deltaMap.size} category-aware deltas from analysis.json\n`)
    } catch {
      console.log('⚠️  analysis.json found but could not be parsed — using city averages\n')
    }
  } else {
    console.log('ℹ️  No analysis.json found — run analyze.ts first for category-aware comparisons\n')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('restaurant_profiles') as any)
    .select('handle, name, city, category, ig_score, ig_engagement_rate, ig_reel_ratio, ig_posting_frequency_per_week, ig_has_bio_link, ig_highlights_count, google_rating, google_review_count')
    .not('ig_score', 'is', null)

  if (handleFilter) query = query.eq('handle', handleFilter)
  if (cityFilter) query = query.eq('city', cityFilter)

  const { data: profiles, error } = await query as { data: Profile[] | null; error: unknown }

  if (error || !profiles?.length) {
    console.error('No profiles found.')
    process.exit(1)
  }

  console.log(`Generating cards for ${profiles.length} profiles...\n`)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // Precompute city averages
  const cityAvgMap = new Map<string, CityAvg>()
  for (const city of [...new Set(profiles.map(p => p.city))]) {
    cityAvgMap.set(city, getCityAvg(profiles, city))
  }

  // Precompute rankings per city (sorted by ig_score descending)
  const rankMap = new Map<string, { rank: number; total: number }>()
  const citiesSet = [...new Set(profiles.map(p => p.city))]
  for (const city of citiesSet) {
    const cityProfiles = profiles
      .filter(p => p.city === city && (p.ig_score ?? 0) > 0)
      .sort((a, b) => (b.ig_score ?? 0) - (a.ig_score ?? 0))
    cityProfiles.forEach((p, i) => {
      rankMap.set(p.handle, { rank: i + 1, total: cityProfiles.length })
    })
  }

  let done = 0
  for (const profile of profiles) {
    const cityAvg = cityAvgMap.get(profile.city) ?? {
      avg_ig_score: 50, avg_engagement_rate: 1.5, avg_reel_ratio: 0.35, avg_posting_freq: 2.5,
    }

    const deltaInfo = deltaMap.get(profile.handle)
    const ranking = rankMap.get(profile.handle)
    const svg = buildSvg(profile, cityAvg, deltaInfo, ranking?.rank, ranking?.total)
    const outPath = path.join(OUT_DIR, `${profile.handle}.png`)

    try {
      await sharp(Buffer.from(svg))
        .png({ quality: 95 })
        .toFile(outPath)
      console.log(`   ✅ @${profile.handle} (score: ${profile.ig_score}) → ${profile.handle}.png`)
      done++
    } catch (err) {
      console.log(`   ❌ @${profile.handle}: ${(err as Error).message}`)
    }
  }

  console.log(`\n✅ ${done} cards saved to data/cards/`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

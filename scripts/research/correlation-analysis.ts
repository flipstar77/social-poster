/**
 * Deep correlation analysis: Google Rating vs Instagram metrics
 * Answers: Does Instagram actually matter for restaurant success?
 */

import fs from 'fs'
import path from 'path'

interface DmProfile {
  handle: string
  name: string
  city: string
  category: string
  ig_score: number
  google_rating: number
  reference_label: string
  reference_avg: number
}

interface ApifyPost {
  likesCount?: number
  commentsCount?: number
  type?: string
  isReel?: boolean
  timestamp?: string
}

interface ApifyProfile {
  username?: string
  igUsername?: string
  followersCount?: number
  postsCount?: number
  latestPosts?: ApifyPost[]
  externalUrl?: string
  highlightReelCount?: number
}

const dms: DmProfile[] = JSON.parse(fs.readFileSync('data/dms.json', 'utf-8'))
const apify: ApifyProfile[] = JSON.parse(fs.readFileSync('data/apify-output.json', 'utf-8'))

// Build apify lookup
const apifyMap = new Map<string, ApifyProfile>()
apify.forEach(p => {
  const handle = (p.username || p.igUsername || '').toLowerCase()
  if (handle) apifyMap.set(handle, p)
})

// Combine into enriched profiles
const profiles = dms.map(d => {
  const ap = apifyMap.get(d.handle) || {}
  const posts: ApifyPost[] = (ap as ApifyProfile).latestPosts || []
  const recentPosts = posts.slice(0, 12)
  const reelCount = recentPosts.filter(p => p.type === 'Video' || p.isReel).length
  const followers = (ap as ApifyProfile).followersCount || 0
  const avgLikes = recentPosts.length > 0
    ? recentPosts.reduce((s, p) => s + (p.likesCount || 0), 0) / recentPosts.length
    : 0
  const avgComments = recentPosts.length > 0
    ? recentPosts.reduce((s, p) => s + (p.commentsCount || 0), 0) / recentPosts.length
    : 0
  const engRate = followers > 0 ? ((avgLikes + avgComments) / followers) * 100 : 0

  let freqPerWeek = 0
  if (recentPosts.length >= 2) {
    const ts = recentPosts
      .map(p => p.timestamp ? new Date(p.timestamp).getTime() : null)
      .filter((t): t is number => t !== null)
      .sort((a, b) => b - a)
    if (ts.length >= 2) {
      const spanWeeks = (ts[0] - ts[ts.length - 1]) / (7 * 24 * 60 * 60 * 1000)
      if (spanWeeks > 0) freqPerWeek = ts.length / spanWeeks
    }
  }

  return {
    handle: d.handle,
    city: d.city,
    category: d.category,
    ig_score: d.ig_score,
    google_rating: d.google_rating,
    followers,
    engagement: Math.round(engRate * 100) / 100,
    reelRatio: recentPosts.length > 0 ? reelCount / recentPosts.length : 0,
    freqPerWeek: Math.round(freqPerWeek * 10) / 10,
    postsCount: (ap as ApifyProfile).postsCount || 0,
    hasBioLink: !!(ap as ApifyProfile).externalUrl,
    highlightCount: (ap as ApifyProfile).highlightReelCount || 0,
  }
})

// Filter out ghost accounts
const active = profiles.filter(p => p.ig_score > 9)
console.log(`Active profiles (non-ghost): ${active.length}`)
console.log(`Ghost accounts (score 9): ${profiles.length - active.length}\n`)

// Helpers
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  return dx2 > 0 && dy2 > 0 ? num / Math.sqrt(dx2 * dy2) : 0
}

function avgOf<T>(arr: T[], fn: (item: T) => number): number {
  return arr.length > 0 ? arr.reduce((s, p) => s + fn(p), 0) / arr.length : 0
}

// === CORRELATIONS ===
const withGoogle = active.filter(p => p.google_rating > 0)
console.log(`=== KORRELATIONEN (n=${withGoogle.length} aktive Profile) ===`)
console.log(`Google Rating ↔ IG Score:     r = ${pearson(withGoogle.map(p => p.google_rating), withGoogle.map(p => p.ig_score)).toFixed(3)}`)
console.log(`Google Rating ↔ Engagement:   r = ${pearson(withGoogle.map(p => p.google_rating), withGoogle.map(p => p.engagement)).toFixed(3)}`)
console.log(`Google Rating ↔ Post-Freq:    r = ${pearson(withGoogle.map(p => p.google_rating), withGoogle.map(p => p.freqPerWeek)).toFixed(3)}`)
console.log(`Google Rating ↔ Followers:    r = ${pearson(withGoogle.map(p => p.google_rating), withGoogle.map(p => p.followers)).toFixed(3)}`)
console.log(`Google Rating ↔ Reel-Ratio:   r = ${pearson(withGoogle.map(p => p.google_rating), withGoogle.map(p => p.reelRatio)).toFixed(3)}`)

// === SEGMENT COMPARISON ===
console.log('\n=== GOOGLE-SEGMENTE ===')

const highGoogle = active.filter(p => p.google_rating >= 4.7)
const midGoogle = active.filter(p => p.google_rating >= 4.3 && p.google_rating < 4.7)
const lowGoogle = active.filter(p => p.google_rating > 0 && p.google_rating < 4.3)

for (const [label, group] of [
  ['Google 4.7+', highGoogle],
  ['Google 4.3-4.6', midGoogle],
  ['Google <4.3', lowGoogle],
] as const) {
  const g = group as typeof active
  console.log(`\n${label} (n=${g.length}):`)
  console.log(`  Ø IG Score:    ${avgOf(g, p => p.ig_score).toFixed(1)}`)
  console.log(`  Ø Engagement:  ${avgOf(g, p => p.engagement).toFixed(2)}%`)
  console.log(`  Ø Freq/Woche:  ${avgOf(g, p => p.freqPerWeek).toFixed(1)}`)
  console.log(`  Ø Followers:   ${Math.round(avgOf(g, p => p.followers))}`)
  console.log(`  Ø Reel-Ratio:  ${(avgOf(g, p => p.reelRatio) * 100).toFixed(0)}%`)
}

// === THE KEY QUESTION ===
console.log('\n=== DIE KERNFRAGE: Brauchen Top-Google-Restaurants Instagram? ===')

const topGoogle = active.filter(p => p.google_rating >= 4.7)
const topGoogleLowIG = topGoogle.filter(p => p.ig_score < 50)
const topGoogleMidIG = topGoogle.filter(p => p.ig_score >= 50 && p.ig_score < 65)
const topGoogleHighIG = topGoogle.filter(p => p.ig_score >= 65)

console.log(`\nGoogle 4.7+ Restaurants: ${topGoogle.length}`)
console.log(`  davon IG < 50:   ${topGoogleLowIG.length} (${Math.round(topGoogleLowIG.length / topGoogle.length * 100)}%) — vernachlässigen IG`)
console.log(`  davon IG 50-64:  ${topGoogleMidIG.length} (${Math.round(topGoogleMidIG.length / topGoogle.length * 100)}%) — Mittelmaß`)
console.log(`  davon IG 65+:    ${topGoogleHighIG.length} (${Math.round(topGoogleHighIG.length / topGoogle.length * 100)}%) — machen IG gut`)

console.log('\nBeispiele: Top Google + schwaches IG:')
topGoogleLowIG.sort((a, b) => a.ig_score - b.ig_score).slice(0, 8).forEach(p => {
  console.log(`  @${p.handle} (${p.city}) — Google ${p.google_rating}, IG ${p.ig_score}, ${p.freqPerWeek}x/Wo, Eng ${p.engagement}%`)
})

console.log('\nBeispiele: Top Google + starkes IG:')
topGoogleHighIG.sort((a, b) => b.ig_score - a.ig_score).slice(0, 8).forEach(p => {
  console.log(`  @${p.handle} (${p.city}) — Google ${p.google_rating}, IG ${p.ig_score}, ${p.freqPerWeek}x/Wo, Eng ${p.engagement}%`)
})

// === POSTING FREQ vs GOOGLE ===
console.log('\n=== POSTING-FREQUENZ vs GOOGLE ===')
const freq0 = active.filter(p => p.freqPerWeek < 0.5)
const freq1 = active.filter(p => p.freqPerWeek >= 0.5 && p.freqPerWeek < 2)
const freq2 = active.filter(p => p.freqPerWeek >= 2)

console.log(`<0.5x/Woche (n=${freq0.length}): Ø Google ${avgOf(freq0, p => p.google_rating).toFixed(2)}, Ø IG ${avgOf(freq0, p => p.ig_score).toFixed(0)}`)
console.log(`0.5-2x/Woche (n=${freq1.length}): Ø Google ${avgOf(freq1, p => p.google_rating).toFixed(2)}, Ø IG ${avgOf(freq1, p => p.ig_score).toFixed(0)}`)
console.log(`2+x/Woche (n=${freq2.length}):    Ø Google ${avgOf(freq2, p => p.google_rating).toFixed(2)}, Ø IG ${avgOf(freq2, p => p.ig_score).toFixed(0)}`)

// === 4 CLUSTER ===
console.log('\n=== 4 CLUSTER ===')
const dominant = active.filter(p => p.google_rating >= 4.5 && p.ig_score >= 65)
const untapped = active.filter(p => p.google_rating >= 4.5 && p.ig_score < 55)
const igFocused = active.filter(p => p.google_rating < 4.5 && p.ig_score >= 55)
const atRisk = active.filter(p => p.google_rating < 4.5 && p.ig_score < 55)

console.log(`🟢 Dominant (Google 4.5+ & IG 65+):              ${dominant.length} (${Math.round(dominant.length / active.length * 100)}%)`)
console.log(`🟡 Ungenutztes Potenzial (Google 4.5+ & IG <55):  ${untapped.length} (${Math.round(untapped.length / active.length * 100)}%)`)
console.log(`🔵 IG-fokussiert (Google <4.5 & IG 55+):          ${igFocused.length} (${Math.round(igFocused.length / active.length * 100)}%)`)
console.log(`🔴 At Risk (Google <4.5 & IG <55):                ${atRisk.length} (${Math.round(atRisk.length / active.length * 100)}%)`)

console.log('\n🟡 Ungenutztes Potenzial — Top-Outreach-Kandidaten:')
untapped.sort((a, b) => b.google_rating - a.google_rating || a.ig_score - b.ig_score).slice(0, 15).forEach(p => {
  console.log(`  @${p.handle} (${p.city}) — Google ${p.google_rating}, IG ${p.ig_score}, ${p.freqPerWeek}x/Wo, ${p.followers} Follower`)
})

// === DOES IG ACTIVITY CORRELATE WITH MORE GOOGLE REVIEWS? ===
console.log('\n=== HYPOTHESE: Aktive IG-Restaurants bekommen mehr Google Reviews ===')
// We don't have review count in dms.json but we can check from analysis
// Let's look at it from another angle — followers as proxy for IG visibility

const highIG = active.filter(p => p.ig_score >= 65)
const lowIG = active.filter(p => p.ig_score < 45 && p.ig_score > 9)
console.log(`\nIG Score 65+ (n=${highIG.length}):  Ø Google ${avgOf(highIG, p => p.google_rating).toFixed(2)}, Ø Followers ${Math.round(avgOf(highIG, p => p.followers))}`)
console.log(`IG Score <45 (n=${lowIG.length}):   Ø Google ${avgOf(lowIG, p => p.google_rating).toFixed(2)}, Ø Followers ${Math.round(avgOf(lowIG, p => p.followers))}`)

// === VERDICT ===
console.log('\n========================================')
console.log('VERDICT')
console.log('========================================')
const r = pearson(withGoogle.map(p => p.google_rating), withGoogle.map(p => p.ig_score))
if (Math.abs(r) < 0.15) {
  console.log(`\nr = ${r.toFixed(3)} → KEINE Korrelation zwischen Google Rating und IG Score.`)
  console.log('\nDas bedeutet:')
  console.log('  - Google-Erfolg und IG-Erfolg sind UNABHÄNGIG voneinander')
  console.log('  - Ein Restaurant kann 4.9 auf Google haben und trotzdem IG vernachlässigen')
  console.log('  - IG ist ein SEPARATER Kanal, nicht eine Ableitung von Google-Qualität')
  console.log('  - Das ist GUT für FlowingPost: IG ist eine eigene Kompetenz, kein Nebenprodukt')
} else if (r > 0.15) {
  console.log(`\nr = ${r.toFixed(3)} → POSITIVE Korrelation.`)
  console.log('Bessere Restaurants tendieren auch zu besserem IG.')
} else {
  console.log(`\nr = ${r.toFixed(3)} → NEGATIVE Korrelation.`)
  console.log('Überraschend: Bessere Google-Restaurants haben tendenziell schwächeres IG.')
}

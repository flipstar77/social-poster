/**
 * Direct-Write Batch — Claude Code writes personalized Email 1 for each lead.
 *
 * Mode B from the cold email pipeline: $0 API costs, personalized per lead.
 * Email 2 (follow-up) and Email 3 (breakup) stay as templates.
 *
 * Usage:
 *   npx tsx scripts/cold-email/write-batch.ts                    (all Berlin leads)
 *   npx tsx scripts/cold-email/write-batch.ts --city Wien        (different city)
 *   npx tsx scripts/cold-email/write-batch.ts --dry-run          (preview, don't update Instantly)
 *
 * Output: data/batch-[city]-[date].json + updates leads in Instantly campaign
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabase } from '../blog-pipeline/shared'
import fs from 'fs'
import path from 'path'

const args = process.argv.slice(2)
const cityFilter = args.includes('--city') ? args[args.indexOf('--city') + 1] : null
const dryRun = args.includes('--dry-run')
const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY || ''

// ─── Personalization Engine ─────────────────────────────────────────

interface Lead {
  name: string
  handle: string
  email: string
  ig_followers: number | null
  ig_posts_count: number | null
  ig_avg_likes: number | null
  ig_posting_frequency_per_week: number | null
  ig_engagement_rate: number | null
  ig_reel_ratio: number | null
  google_rating: number | null
  google_review_count: number | null
}

interface PersonalizedEmail {
  email: string
  company_name: string
  subject: string
  body: string
  observation: string
  segment: string
  hook?: string
}

function getSegment(followers: number): string {
  if (followers < 500) return 'tiny'
  if (followers < 2000) return 'small'
  if (followers < 10000) return 'medium'
  return 'large'
}

// Priority-ranked observations — most actionable first, no random picking
function writeObservation(lead: Lead): { main: string; reinforcer: string } {
  const followers = lead.ig_followers || 0
  const freq = lead.ig_posting_frequency_per_week || 0
  const avgLikes = lead.ig_avg_likes || 0
  const engagement = lead.ig_engagement_rate || 0
  const reelRatio = (lead.ig_reel_ratio || 0) * 100
  const googleRating = lead.google_rating || 0
  const googleReviews = lead.google_review_count || 0

  // Use handle hash for variation within same priority level
  const hash = lead.handle.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const pick = (options: string[]) => options[hash % options.length]

  // Priority 1: Posting frequency (biggest pain point for restaurants)
  // All observations in Sie-Form
  let main = ''
  if (freq < 0.3) {
    main = pick([
      'Ihr letzter Post ist schon eine Weile her',
      'Sie haben seit Wochen nichts gepostet',
    ])
  } else if (freq < 1) {
    main = pick([
      'Sie posten nur alle paar Wochen',
      'Sie posten selten — obwohl die Fotos gut sind',
    ])
  } else if (freq < 2) {
    main = pick([
      'Sie posten etwa einmal die Woche',
      'Sie posten ca. einmal pro Woche — da geht noch was',
    ])
  }

  // Priority 2: Low engagement (only if posting isn't the main issue)
  if (!main && followers > 1000 && engagement < 0.5) {
    main = pick([
      'Ihre Posts bekommen wenig Interaktion für Ihre Follower-Zahl',
      'Ihre Fotos sind gut, aber die Reichweite stimmt nicht',
    ])
  }

  // Priority 3: No reels
  if (!main && reelRatio < 20 && followers > 500) {
    main = pick([
      'Sie nutzen kaum Reels — dabei bringen die gerade am meisten Reichweite',
      'fast keine Reels — Instagram pusht die gerade 3-5x stärker als Fotos',
    ])
  }

  // Priority 4: Likes/follower mismatch
  if (!main && followers > 2000 && avgLikes < followers * 0.01) {
    main = pick([
      'Ihre Posts erreichen nur einen Bruchteil Ihrer Follower',
      'die meisten Ihrer Follower sehen Ihre Posts gar nicht',
    ])
  }

  // Priority 5: Active but could optimize (for frequent posters)
  if (!main && freq >= 4) {
    main = pick([
      'Sie posten regelmäßig — aber die Captions könnten mehr rausholen',
      'Sie sind aktiv, aber die Hashtags und Texte verschenken Reichweite',
    ])
  }

  // Fallback
  if (!main) {
    main = 'Sie posten selten — obwohl die Fotos gut sind'
  }

  // Reinforcer: Google strength as supporting evidence (not the lead)
  let reinforcer = ''
  if (googleReviews > 500 && googleRating >= 4.3) {
    reinforcer = pick([
      'Ihre Google-Bewertungen zeigen dass die Gäste zufrieden sind',
      'Ihre Gäste lieben Sie laut Google',
    ])
  } else if (googleReviews > 100) {
    reinforcer = 'Ihre Google-Bewertungen zeigen dass die Basis da ist'
  }

  return { main, reinforcer }
}

// Shorten restaurant name for subject line (max 25 chars before " — instagram")
function shortenName(name: string, handle: string): string {
  if (!name || name.trim().length === 0) {
    // Fallback to handle without @
    return handle.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim()
  }
  // Remove common suffixes/noise
  let short = name
    .replace(/\s*\|.*$/, '')           // "Name | Something" → "Name"
    .replace(/\s*[-–—]\s*Restaurant.*$/i, '')
    .replace(/\s*Berlin$/i, '')
    .replace(/\s*Frankfurt.*$/i, '')
    .replace(/\s*Nähe.*$/i, '')
    .replace(/\s*Alexanderplatz$/i, '')
    .trim()

  // If still too long, take first 2 words
  if (short.length > 25) {
    short = short.split(/\s+/).slice(0, 2).join(' ')
  }
  return short || name.substring(0, 25)
}

// ─── Hook Selection by IG Data ──────────────────────────────────────
// Hook assigned per lead based on their IG/Google profile, not location.
// All use "Sie" (formal) — cold outreach to business owners.

type Hook = 'reichweite' | 'social_proof' | 'zeit_pain' | 'pattern_interrupt'

function selectHook(lead: Lead): Hook {
  const followers = lead.ig_followers || 0
  const freq = lead.ig_posting_frequency_per_week || 0
  const engagement = lead.ig_engagement_rate || 0
  const googleRating = lead.google_rating || 0
  const googleReviews = lead.google_review_count || 0

  // 1. Reichweite/Ambition: >5k Follower + postet selten
  if (followers > 5000 && freq < 2) return 'reichweite'

  // 2. Social Proof: starke Google-Bewertungen (>4.3⭐, >500 Reviews)
  if (googleRating >= 4.3 && googleReviews > 500) return 'social_proof'

  // 3. Zeit/Pain: <5k Follower + postet selten
  if (followers < 5000 && freq < 2) return 'zeit_pain'

  // 4. Pattern Interrupt: postet häufig aber wenig Engagement, oder kein klares Signal
  return 'pattern_interrupt'
}

function auditUrl(handle: string, city: string): string {
  const slug = city.toLowerCase()
    .replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae')
    .replace(/\s+/g, '-')
  return `https://flowingpost.com/de/tools/instagram-audit?handle=${encodeURIComponent(handle)}&city=${encodeURIComponent(slug)}`
}

// ─── Signature ─────────────────────────────────────────────────────
const SIGNATURE = `Viele Grüße
Tobias Hertfelder
FlowingPost — Social Media für Restaurants
flowingpost.com`

// ─── Subject Lines (data-driven, no generic "kurze Frage") ────────
function writeSubject(lead: Lead, displayName: string, hook: Hook, city: string): string {
  const followers = lead.ig_followers || 0
  const freq = lead.ig_posting_frequency_per_week || 0
  const googleRating = lead.google_rating || 0
  const googleReviews = lead.google_review_count || 0
  const hash = lead.handle.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const pick = (options: string[]) => options[hash % options.length]

  if (hook === 'reichweite') {
    return pick([
      `${displayName} — ${followers.toLocaleString('de')} Follower, aber wer sieht die Posts?`,
      `${displayName} vs. ${city}: Euer Instagram-Score`,
    ])
  }
  if (hook === 'social_proof') {
    return pick([
      `${displayName} — ${googleRating} Sterne auf Google, aber auf Instagram?`,
      `${displayName}: ${googleReviews} Google-Bewertungen vs. Instagram`,
    ])
  }
  if (hook === 'zeit_pain') {
    return pick([
      `${displayName} — letzter Post ist eine Weile her`,
      `${displayName}: 5 Min/Tag reichen für Instagram`,
    ])
  }
  // pattern_interrupt
  return pick([
    `${displayName} — postet ihr bewusst wenig?`,
    `${displayName} vs. andere Restaurants in ${city}`,
  ])
}

function writeEmail1(lead: Lead, city: string): PersonalizedEmail {
  const followers = lead.ig_followers || 0
  const segment = getSegment(followers)
  const { main: observation, reinforcer } = writeObservation(lead)
  const freq = lead.ig_posting_frequency_per_week || 0
  const displayName = shortenName(lead.name, lead.handle)
  const hook = selectHook(lead)
  const audit = auditUrl(lead.handle, city)
  const subject = writeSubject(lead, displayName, hook, city)

  // Email 1: NO LINKS. Goal = reply. Personalized observation + question.
  let body: string

  if (hook === 'reichweite') {
    body = `Hallo,\n\nIhr Instagram (@${lead.handle}) hat ${followers.toLocaleString('de')} Follower — aber ${observation}.\n\nDas sehe ich bei vielen Restaurants in ${city}: starkes Profil, aber die Reichweite bleibt hinter dem Potenzial.\n\nIch hab mich auf Instagram für Restaurants spezialisiert — soll ich Ihnen kurz zeigen wo die grössten Quick Wins bei Ihrem Profil liegen?`

  } else if (hook === 'social_proof') {
    const reinforcerLine = reinforcer || 'Ihre Google-Bewertungen zeigen dass die Gäste zufrieden sind'
    body = `Hallo,\n\n${reinforcerLine} — Ihr Instagram (@${lead.handle}) erzählt diese Geschichte aber noch nicht.\n\n${observation.charAt(0).toUpperCase() + observation.slice(1)}.\n\nIch analysiere Instagram-Profile von Restaurants in ${city} — soll ich Ihnen kurz zeigen was bei Ihrem Profil am meisten bringen würde?`

  } else if (hook === 'zeit_pain') {
    body = `Hallo,\n\nIhr Instagram (@${lead.handle}) ist mir aufgefallen — ${observation}.\n\nKenne das von vielen Gastronomen: die Zeit fehlt einfach.\n\nWürde es helfen wenn ich Ihnen kurz die 2-3 Sachen zeige die bei Ihrem Profil den grössten Unterschied machen würden?`

  } else {
    body = `Hallo,\n\nKurze Frage zu Ihrem Instagram (@${lead.handle}) — posten Sie dort bewusst wenig oder fehlt die Zeit?\n\nFrage weil ich einige Restaurants in ${city} beim Thema Instagram unterstütze und Ihr Profil Potenzial hat.`
  }

  body += `\n\n${SIGNATURE}`

  return {
    email: lead.email,
    company_name: displayName,
    subject,
    body,
    observation,
    segment,
    hook,
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(`📧 Direct-Write Batch — Personalized Email 1\n`)
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('restaurant_profiles') as any)
    .select('name, handle, email, city, ig_followers, ig_posts_count, ig_avg_likes, ig_posting_frequency_per_week, ig_engagement_rate, ig_reel_ratio, google_rating, google_review_count')
    .not('email', 'is', null)
  if (cityFilter) query = query.eq('city', cityFilter)
  const { data: leads, error } = await query

  if (error) {
    console.error('❌ Supabase error:', error.message)
    process.exit(1)
  }

  if (!leads?.length) {
    console.log('No leads found for', cityFilter)
    return
  }

  console.log(`City: ${cityFilter || 'ALL'}`)
  console.log(`Leads: ${leads.length}`)
  if (dryRun) console.log('Mode: DRY RUN (no Instantly updates)\n')
  else console.log('Mode: LIVE (updating Instantly)\n')

  const results: PersonalizedEmail[] = []
  const segmentCounts: Record<string, number> = {}

  for (const raw of leads as (Lead & { city?: string })[]) {
    const leadCity = raw.city || cityFilter || 'Berlin'
    const personalized = writeEmail1(raw, leadCity)
    results.push(personalized)
    segmentCounts[personalized.segment] = (segmentCounts[personalized.segment] || 0) + 1

    // Preview
    console.log(`━ ${personalized.company_name} [${personalized.hook}] (${personalized.segment})`)
    console.log(`  "${personalized.observation}"`)
    console.log(`  ${personalized.subject}`)
    console.log()
  }

  // Save batch output
  const dataDir = path.join(process.cwd(), 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  const date = new Date().toISOString().split('T')[0]
  const filename = `batch-${(cityFilter || 'all').toLowerCase()}-${date}.json`
  const filepath = path.join(dataDir, filename)
  fs.writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf-8')

  const hookCounts: Record<string, number> = {}
  for (const r of results) hookCounts[r.hook || 'unknown'] = (hookCounts[r.hook || 'unknown'] || 0) + 1

  console.log('='.repeat(50))
  console.log(`\nHooks:`)
  for (const [hook, count] of Object.entries(hookCounts)) {
    console.log(`  ${hook}: ${count}`)
  }
  console.log(`\nSegments:`)
  for (const [seg, count] of Object.entries(segmentCounts)) {
    console.log(`  ${seg}: ${count}`)
  }
  console.log(`\n✅ Saved to: ${filepath}`)
  console.log(`   ${results.length} personalized emails written`)

  // Update Instantly leads if not dry run
  if (!dryRun && INSTANTLY_API_KEY) {
    console.log('\nUpdating Instantly leads with personalized Email 1...')
    let updated = 0

    for (const result of results) {
      // Find and update lead in Instantly by email
      const res = await fetch('https://api.instantly.ai/api/v2/leads/list', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${INSTANTLY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: result.email, limit: 1 })
      })
      const data = await res.json()
      const lead = data.items?.[0]
      if (!lead) continue

      // Update custom variables with personalized body
      await fetch('https://api.instantly.ai/api/v2/leads/' + lead.id, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${INSTANTLY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          custom_variables: {
            ...lead.payload,
            personalized_body: result.body,
            observation: result.observation,
            segment: result.segment,
            audit_url: auditUrl(lead.payload?.ig_handle || '', lead.payload?.city || cityFilter || 'Berlin'),
          }
        })
      })
      updated++
      await new Promise(r => setTimeout(r, 100))
    }
    console.log(`✅ ${updated} leads updated in Instantly`)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

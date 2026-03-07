/**
 * Generate the research report blog article from analysis data.
 *
 * Reads data/analysis.json (from analyze.ts),
 * builds a data-rich prompt, calls Grok,
 * saves the article as content/blog/*.mdx
 *
 * Usage:
 *   npx tsx scripts/research/generate-report.ts
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getXai, BLOG_DIR, slugify, getExistingSlugs } from '../blog-pipeline/shared'
import { fetchHeroImage } from '../blog-pipeline/pexels-utils'

const analysisPath = path.join(process.cwd(), 'data', 'analysis.json')

if (!fs.existsSync(analysisPath)) {
  console.error('❌ data/analysis.json not found. Run analyze.ts first.')
  process.exit(1)
}

const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'))

function buildReportPrompt(data: typeof analysis): string {
  const corrStr = data.correlation_ig_score_google_rating !== null
    ? `- Instagram Score ↔ Google Rating: r=${data.correlation_ig_score_google_rating} (${
        Math.abs(data.correlation_ig_score_google_rating) > 0.5 ? 'starke' :
        Math.abs(data.correlation_ig_score_google_rating) > 0.3 ? 'moderate' : 'schwache'
      } Korrelation)
- Instagram Engagement ↔ Google Rating: r=${data.correlation_engagement_google_rating}
- Posting-Frequenz ↔ Anzahl Google-Bewertungen: r=${data.correlation_posting_freq_google_reviews}`
    : '(Nicht genug Google-Daten für Korrelationen)'

  const cityStats = Object.entries(data.by_city as Record<string, {
    count: number
    avg_ig_score: number
    avg_engagement: number
    avg_google_rating: number
    pct_bio_link: number
  }>).map(([city, s]) =>
    `- ${city}: ${s.count} Restaurants, Ø Instagram Score ${s.avg_ig_score}/100, Ø Engagement ${s.avg_engagement}%, Ø Google ${s.avg_google_rating}⭐`
  ).join('\n')

  return `Du schreibst einen Primärdaten-Analyse-Artikel für FlowingPost.

DATENSATZ: Wir haben ${data.total} DACH-Restaurant-Instagram-Profile analysiert (${data.cities.join(', ')}).
Dies sind echte, selbst erhobene Daten — kein generisches Fachwissen.

ROHDATEN:

**Gesamtüberblick:**
- ${data.total} analysierte Instagram-Profile
- Ø Instagram Score: ${data.avg_ig_score}/100 (0=schlecht, 100=optimal)
- Ø Engagement Rate: ${data.avg_engagement_rate}% (Industrie-Benchmark Gastronomie: ~1.5%)
- Ø Posting-Frequenz: ${data.avg_posting_freq}x pro Woche
- Ø Reel-Anteil: ${Math.round(data.avg_reel_ratio * 100)}% aller Posts
- Nur ${data.pct_has_bio_link}% haben einen Bio-Link
- Nur ${data.pct_has_highlights}% nutzen Story-Highlights
- ${data.pct_posts_4plus_per_week}% posten 4x oder mehr pro Woche
- ${data.pct_posts_less_than_1_per_week}% posten weniger als 1x pro Woche
- ${data.pct_reels_majority}% haben Reels als Mehrheit ihrer Posts

**Top 25% vs. Bottom 25% (Instagram Score):**
- Engagement Rate: ${data.top_quartile.avg_engagement}% vs. ${data.bottom_quartile.avg_engagement}%
- Posting-Frequenz: ${data.top_quartile.avg_posting_freq}x vs. ${data.bottom_quartile.avg_posting_freq}x/Woche
- Reel-Anteil: ${Math.round(data.top_quartile.avg_reel_ratio * 100)}% vs. ${Math.round(data.bottom_quartile.avg_reel_ratio * 100)}%
- Bio-Link: ${data.top_quartile.pct_bio_link}% vs. ${data.bottom_quartile.pct_bio_link}%
- Story-Highlights: ${data.top_quartile.pct_highlights}% vs. ${data.bottom_quartile.pct_highlights}%
- Google Rating: ${data.top_quartile.avg_google_rating}⭐ vs. ${data.bottom_quartile.avg_google_rating}⭐

**Nach Stadt:**
${cityStats}

**Instagram ↔ Google Korrelationen:**
${corrStr}

SCHREIBAUFTRAG:

Schreibe einen umfassenden Analyse-Artikel (mindestens 2000 Wörter) mit folgendem Aufbau:

1. Einleitung: Warum wir diese Analyse gemacht haben, was wir erwartet haben vs. was wir gefunden haben
2. Methodik: Wie wir die Daten erhoben haben (Apify + Google Places, ${data.total} Profile, Zeitraum)
3. Kernbefund 1: Was erfolgreiche Restaurants anders machen (Top 25% vs. Bottom 25%)
4. Kernbefund 2: Stadtvergleich (Berlin vs. Wien vs. Zürich)
5. Kernbefund 3: Instagram ↔ Google-Korrelation — hängt Online-Sichtbarkeit mit echtem Gäste-Feedback zusammen?
6. Die 5 größten Fehler die wir gesehen haben (mit echten Prozentsätzen aus den Daten)
7. Was das für dein Restaurant bedeutet (konkrete Handlungsempfehlungen)
8. Fazit + CTA zu FlowingPost

WICHTIG:
- Nutze die echten Zahlen aus den Daten überall
- "Wir haben analysiert" / "Unsere Daten zeigen" — das ist Primärforschung, nicht Meinung
- Baue 2-3 SVG-Diagramme ein (Balkendiagramme, Vergleiche)
- Schreib in "du"-Form für Restaurantbesitzer
- Meta-Description: 130-155 Zeichen
- Ausgabeformat: JSON-Objekt mit title+description, dann Markdown-Artikel (kein H1, kein Frontmatter)`
}

async function main() {
  console.log('📝 Generating Research Report Article\n')

  const prompt = buildReportPrompt(analysis)
  const keyword = `Instagram Analyse ${analysis.total} DACH Restaurants`

  console.log(`   🤖 Calling Grok (this may take a minute)...`)

  const response = await getXai().chat.completions.create({
    model: 'grok-4-1-fast-non-reasoning',
    messages: [
      {
        role: 'system',
        content: `Du bist ein datengetriebener Content-Writer für FlowingPost. Du schreibst auf Basis echter Primärdaten Analyse-Artikel für Restaurantbesitzer in DACH. Dein Ton ist direkt, zahlenbasiert, und praktisch. Keine Marketing-Floskeln. Alle Zahlen kommen aus unserer eigenen Erhebung — das ist kein generischer SEO-Artikel, sondern ein Forschungsbericht der trotzdem für normale Restaurantbesitzer verständlich ist. IMMER "du" verwenden.

OUTPUT-FORMAT: JSON-Objekt ohne Code-Fences mit title und description, dann Leerzeile, dann Markdown-Artikel.`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.65,
    max_tokens: 10000,
  })

  const raw = response.choices[0]?.message?.content ?? ''
  console.log(`   Response: ${raw.length} chars`)

  // Parse title + description
  let title = ''
  let description = ''
  let body = raw

  const jsonMatch = raw.match(/^\s*\{[\s\S]*?"title"\s*:\s*"[\s\S]*?"description"\s*:\s*"[\s\S]*?\}/)
  if (jsonMatch) {
    try {
      const m = JSON.parse(jsonMatch[0])
      title = m.title || ''
      description = m.description || ''
    } catch {}
    body = raw.slice(jsonMatch[0].length).trim()
  }

  if (!title) {
    title = `Instagram-Analyse: ${analysis.total} DACH-Restaurants im Vergleich (${new Date().getFullYear()})`
  }
  if (!description) {
    description = `Wir haben ${analysis.total} Restaurant-Instagram-Profile in Berlin, Wien und Zürich analysiert. Das sind die Ergebnisse.`
  }

  const slug = slugify(title)
  const existing = getExistingSlugs()
  if (existing.has(slug)) {
    console.log(`⚠️  Slug "${slug}" already exists — use a different title`)
    process.exit(0)
  }

  const date = new Date().toISOString().split('T')[0]
  const heroImage = await fetchHeroImage('restaurant instagram analyse', 'Strategie')
  const imageFrontmatter = heroImage
    ? `image: "${heroImage.url}"\nimageMedium: "${heroImage.urlMedium}"\nimageCredit: "${heroImage.photographer}"\nimageCreditUrl: "${heroImage.photographerUrl}"`
    : `image: "/blog/${slug}.jpg"`

  const mdx = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
date: "${date}"
category: "Strategie"
locale: "de"
type: "article"
${imageFrontmatter}
---

${body}
`

  fs.mkdirSync(BLOG_DIR, { recursive: true })
  const outPath = path.join(BLOG_DIR, `${slug}.mdx`)
  fs.writeFileSync(outPath, mdx, 'utf-8')

  const wordCount = body.split(/\s+/).length
  console.log(`\n✅ Article saved: content/blog/${slug}.mdx`)
  console.log(`   Words: ~${wordCount}`)
  console.log(`   Title: ${title}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

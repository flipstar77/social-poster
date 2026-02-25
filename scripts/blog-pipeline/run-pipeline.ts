/**
 * Blog Pipeline Runner
 *
 * Orchestrates the full content pipeline:
 * 1. Keyword research (if --research flag)
 * 2. Pick top N keywords without articles
 * 3. Generate articles for each
 *
 * Usage:
 *   npx tsx scripts/blog-pipeline/run-pipeline.ts                    # Generate 3 articles for top keywords
 *   npx tsx scripts/blog-pipeline/run-pipeline.ts --count 5          # Generate 5 articles
 *   npx tsx scripts/blog-pipeline/run-pipeline.ts --research         # Run keyword research first, then generate
 *   npx tsx scripts/blog-pipeline/run-pipeline.ts --category SEO     # Only generate for SEO keywords
 *   npx tsx scripts/blog-pipeline/run-pipeline.ts --dry-run          # Show what would be generated
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { fetchHeroImage } from './pexels-utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY!,
  baseURL: 'https://api.x.ai/v1',
})

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

// --- Argument parsing ---
const args = process.argv.slice(2)
const flags = {
  research: args.includes('--research'),
  dryRun: args.includes('--dry-run'),
  count: parseInt(args[args.indexOf('--count') + 1]) || 3,
  category: args.includes('--category') ? args[args.indexOf('--category') + 1] : null,
}

// --- Keyword Research (inline, same as keyword-research.ts but condensed) ---
const SEED_KEYWORDS: Record<string, string[]> = {
  'Instagram': [
    'restaurant instagram', 'instagram gastronomie', 'instagram tipps restaurant',
    'instagram reels restaurant', 'instagram stories gastronomie', 'instagram hashtags restaurant',
    'instagram reichweite gastronomie', 'instagram bio restaurant',
  ],
  'TikTok': [
    'restaurant tiktok', 'tiktok gastronomie', 'tiktok marketing restaurant',
    'tiktok video ideen restaurant', 'tiktok trends gastronomie',
  ],
  'Google Maps': [
    'google maps restaurant eintragen', 'google business profil restaurant',
    'google bewertungen restaurant', 'google maps optimieren gastronomie',
    'restaurant google ranking', 'google maps seo restaurant',
  ],
  'SEO': [
    'restaurant seo', 'seo gastronomie', 'restaurant website optimieren',
    'lokale seo restaurant', 'restaurant online gefunden werden',
  ],
  'Strategie': [
    'social media strategie restaurant', 'restaurant marketing strategie',
    'gastronomie marketing plan', 'restaurant mehr gäste',
    'restaurant content marketing', 'gastronomie kundenbindung',
  ],
}

async function googleSuggest(query: string): Promise<string[]> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=de&q=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    const data = await res.json() as [string, string[]]
    return data[1] || []
  } catch { return [] }
}

async function runKeywordResearch() {
  console.log('🔍 Running keyword research...')
  const keywords: Array<{ keyword: string; category: string; search_volume_estimate: string; competition: string; parent_keyword: string; priority: number }> = []

  for (const [category, seeds] of Object.entries(SEED_KEYWORDS)) {
    for (const seed of seeds) {
      const suggestions = await googleSuggest(seed)
      await new Promise(r => setTimeout(r, 300))

      const words = seed.split(' ').length
      const competition = words >= 4 ? 'low' : words >= 3 ? 'medium' : 'high'
      const volume = suggestions.length >= 5 ? 'high' : suggestions.length >= 2 ? 'medium' : 'low'
      const priority = (volume === 'high' ? 30 : volume === 'medium' ? 20 : 10) + (competition === 'low' ? 30 : competition === 'medium' ? 20 : 10)

      keywords.push({ keyword: seed, category, search_volume_estimate: volume, competition, parent_keyword: seed, priority })

      for (const s of suggestions) {
        const n = s.toLowerCase().trim()
        if (n === seed || keywords.some(k => k.keyword === n)) continue
        const isRelevant = /restaurant|gastro|café|cafe|bar |lokal|instagram|tiktok|google|seo|marketing|social media|online|bewertung/i.test(n)
        if (!isRelevant) continue
        const sw = n.split(' ').length
        const sc = sw >= 4 ? 'low' : sw >= 3 ? 'medium' : 'high'
        const sv = suggestions.filter(x => x.includes(n)).length >= 3 ? 'high' : 'medium'
        const sp = (sv === 'high' ? 30 : 20) + (sc === 'low' ? 30 : sc === 'medium' ? 20 : 10)
        keywords.push({ keyword: n, category, search_volume_estimate: sv, competition: sc, parent_keyword: seed, priority: sp })
      }
    }
  }

  const unique = Array.from(new Map(keywords.map(k => [k.keyword, k])).values())
  const { data } = await supabase.from('blog_keywords').upsert(unique, { onConflict: 'keyword', ignoreDuplicates: true }).select('id')
  console.log(`   ${data?.length || 0} keywords saved (${unique.length} total)\n`)
}

// --- Article Generation ---
function slugify(title: string): string {
  return title.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

async function findRelevantArticles(keyword: string): Promise<Array<{ id: string; title: string; content: string; source_id: string }>> {
  const searchTerms = keyword.split(' ').filter(w => w.length > 3).join(' & ')
  const { data: fts } = await supabase
    .from('scraped_articles')
    .select('id, title, content, source_id')
    .textSearch('fts', searchTerms, { type: 'plain', config: 'german' })
    .limit(6)
  if (fts && fts.length >= 2) return fts

  const words = keyword.split(' ').filter(w => w.length > 3)
  const { data: like } = await supabase
    .from('scraped_articles')
    .select('id, title, content, source_id')
    .or(words.map(w => `title.ilike.%${w}%`).join(','))
    .limit(6)
  return like || fts || []
}

function truncate(s: string, max: number = 3000): string {
  return s.length <= max ? s : s.slice(0, max) + '...'
}

// Check existing slugs to avoid duplicates
async function getExistingSlugs(): Promise<Set<string>> {
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx'))
  return new Set(files.map(f => f.replace('.mdx', '')))
}

async function generateOneArticle(keyword: string, category: string, keywordId: string | null): Promise<boolean> {
  const sources = await findRelevantArticles(keyword)
  console.log(`   📚 ${sources.length} source articles found`)

  const contextBlock = sources.map((a, i) =>
    `### Quelle ${i + 1}: "${a.title}" (${a.source_id})\n${truncate(a.content)}`
  ).join('\n\n')

  const systemPrompt = `Du bist ein SEO-Content-Writer für FlowingPost, ein SaaS-Tool das Restaurants bei Social Media und Online-Marketing hilft.

ZIELGRUPPE: Restaurantbesitzer in DACH (Deutschland, Österreich, Schweiz), 1-5 Mitarbeiter, Inhaber macht Marketing selbst, kein Marketing-Wissen, wenig Zeit, preissensitiv.

SCHREIBSTIL:
- IMMER "du" verwenden, niemals "Sie". Das ist ein striktes Muss.
- Kein Marketing-Jargon. Statt "Engagement Rate" schreibe "wie viele Leute reagieren". Statt "Conversion" schreibe "wie viele Leute tatsächlich bestellen".
- Kurze, klare Sätze. Keine verschachtelten Nebensätze.
- Schreibe so, als würdest du einem Freund erklären, der ein Restaurant betreibt.
- KEINE Emojis im Text.

INHALTLICHE QUALITÄT:
- Nutze konkrete Zahlen und Beispiele aus den bereitgestellten Quellen. Wenn eine Quelle sagt "SEO brachte 42x mehr Neukunden als Social Media", verwende diese Zahl.
- Jeder H2-Abschnitt MUSS einen konkreten, sofort umsetzbaren Tipp enthalten mit einer klaren Schritt-für-Schritt-Anleitung.
- Verwende Tabellen für Vergleiche, Checklisten oder Übersichten.
- Nenne DACH-spezifische Beispiele (Städte wie Berlin, Wien, Zürich; deutsche Plattformen).
- Der Artikel MUSS mindestens 1800 Wörter haben. Schreibe ausführlich mit vielen praktischen Details.
- Am Ende: ein Fazit-Abschnitt + kurzer, natürlicher CTA zu FlowingPost (1-2 Sätze, nicht aufdringlich).

SEO-REGELN:
- H2 (##) für Hauptabschnitte, H3 (###) für Unterabschnitte.
- Haupt-Keyword natürlich im Titel, in der Einleitung (erste 100 Wörter), und in mindestens 3 H2-Überschriften einbauen.
- Meta-Description: exakt 130-155 Zeichen, enthält Keyword und eine Handlungsaufforderung.
- Mindestens 1x Link zu [FlowingPost](/) im Text.
- Keine Keyword-Überoptimierung — der Text muss natürlich klingen.

OUTPUT-FORMAT:
Gib zuerst die Meta-Daten als JSON-Objekt (OHNE Code-Fences), dann eine Leerzeile, dann den Artikeltext in Markdown.
{"title": "...", "description": "..."}

Der Artikeltext beginnt direkt mit dem Einleitungsabsatz (kein H1, kein Frontmatter).`

  const userPrompt = `Schreibe einen umfassenden, detaillierten Blog-Artikel zum Keyword: "${keyword}"
Kategorie: ${category}

WICHTIG: Nutze die folgenden Quellen aktiv als Wissensbasis. Übernimm konkrete Zahlen, Strategien und Beispiele daraus (in eigenen Worten, nicht kopieren). Der Artikel soll die besten Erkenntnisse aus allen Quellen kombinieren und für DACH-Restaurantbesitzer aufbereiten.

${sources.length > 0 ? contextBlock : 'Keine Quellen verfügbar — schreibe basierend auf allgemeinem Fachwissen.'}

Schreibe jetzt einen ausführlichen Artikel mit mindestens 1800 Wörtern.`

  let raw = ''
  try {
    const response = await xai.chat.completions.create({
      model: 'grok-4-1-fast-non-reasoning',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    })
    raw = response.choices[0]?.message?.content || ''
    console.log(`   🤖 Grok response: ${raw.length} chars, finish: ${response.choices[0]?.finish_reason}`)
  } catch (e) {
    console.log(`   ❌ API error: ${(e as Error).message?.slice(0, 200)}`)
    return false
  }

  // Parse JSON meta — handle both fenced ```json``` and raw JSON at start
  let title = '', description = ''
  let body = raw

  const fencedMatch = raw.match(/```json\s*\n({[\s\S]*?})\n\s*```/)
  const rawJsonMatch = raw.match(/^\s*\{[\s\S]*?"title"\s*:\s*"[\s\S]*?"description"\s*:\s*"[\s\S]*?\}/)

  if (fencedMatch) {
    try { const m = JSON.parse(fencedMatch[1]); title = m.title; description = m.description } catch {}
    body = raw.replace(/```json\s*\n[\s\S]*?\n\s*```\s*\n?/, '').trim()
  } else if (rawJsonMatch) {
    try { const m = JSON.parse(rawJsonMatch[0]); title = m.title; description = m.description } catch {}
    body = raw.slice(rawJsonMatch[0].length).trim()
  }

  if (!title || body.length < 500) {
    console.log(`   ❌ Generation failed — title: "${title?.slice(0, 50)}", body: ${body.length} chars`)
    if (raw.length > 0) console.log(`   Raw start: ${raw.slice(0, 200).replace(/\n/g, ' ')}`)
    return false
  }

  const slug = slugify(title)
  const existingSlugs = await getExistingSlugs()
  if (existingSlugs.has(slug)) {
    console.log(`   ⚠️  Slug "${slug}" already exists — skipping`)
    return false
  }

  const date = new Date().toISOString().split('T')[0]

  // Fetch hero image from Pexels
  const heroImage = await fetchHeroImage(keyword, category)
  const imageFrontmatter = heroImage
    ? `image: "${heroImage.url}"
imageMedium: "${heroImage.urlMedium}"
imageCredit: "${heroImage.photographer}"
imageCreditUrl: "${heroImage.photographerUrl}"`
    : `image: "/blog/${slug}.jpg"`

  if (heroImage) {
    console.log(`   🖼️  Image: ${heroImage.photographer} (Pexels)`)
  }

  const mdx = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
date: "${date}"
category: "${category}"
locale: "de"
${imageFrontmatter}
---

${body}
`

  fs.mkdirSync(BLOG_DIR, { recursive: true })
  fs.writeFileSync(path.join(BLOG_DIR, `${slug}.mdx`), mdx, 'utf-8')

  // Track in DB
  await supabase.from('generated_articles').upsert({
    slug, title, description, category, locale: 'de',
    word_count: body.split(/\s+/).length,
    source_article_ids: sources.map(s => s.id),
    status: 'draft',
    keyword_id: keywordId,
  }, { onConflict: 'slug' })

  if (keywordId) {
    await supabase.from('blog_keywords').update({ status: 'written' }).eq('id', keywordId)
  }

  console.log(`   ✅ ${slug}.mdx (~${body.split(/\s+/).length} words)`)
  return true
}

// --- Main Pipeline ---
async function main() {
  console.log('🚀 Blog Pipeline\n')

  // Step 1: Keyword research
  if (flags.research) {
    await runKeywordResearch()
  }

  // Step 2: Pick top keywords
  let query = supabase
    .from('blog_keywords')
    .select('id, keyword, category, priority')
    .eq('status', 'new')
    .order('priority', { ascending: false })
    .limit(flags.count)

  if (flags.category) {
    query = query.eq('category', flags.category)
  }

  const { data: keywords } = await query

  if (!keywords || keywords.length === 0) {
    console.log('📭 No unwritten keywords found. Run with --research first.')
    process.exit(0)
  }

  console.log(`📋 Selected ${keywords.length} keywords to write about:\n`)
  for (const kw of keywords) {
    console.log(`   [${kw.priority}] ${kw.keyword} (${kw.category})`)
  }

  if (flags.dryRun) {
    console.log('\n🏁 Dry run — no articles generated.')
    process.exit(0)
  }

  // Step 3: Generate articles
  console.log('')
  let generated = 0
  for (const kw of keywords) {
    console.log(`\n📝 [${generated + 1}/${keywords.length}] "${kw.keyword}" (${kw.category})`)

    // Mark as planned to avoid parallel duplicates
    await supabase.from('blog_keywords').update({ status: 'planned' }).eq('id', kw.id)

    const success = await generateOneArticle(kw.keyword, kw.category, kw.id)
    if (success) generated++

    // Small delay between generations
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`\n🎉 Pipeline complete! ${generated}/${keywords.length} articles generated.`)
  console.log(`   📁 Files: content/blog/`)

  // Step 4: Add internal links across all articles
  if (generated > 0) {
    console.log('\n🔗 Adding internal links...')
    const { processAllArticles } = await import('./add-internal-links')
    await processAllArticles()
  }

  // Stats
  const { count: totalArticles } = await supabase
    .from('generated_articles')
    .select('id', { count: 'exact', head: true })
  const { count: totalKeywords } = await supabase
    .from('blog_keywords')
    .select('id', { count: 'exact', head: true })
  const { count: writtenKeywords } = await supabase
    .from('blog_keywords')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'written')

  console.log(`\n📊 Pipeline Stats:`)
  console.log(`   Keywords: ${writtenKeywords}/${totalKeywords} written`)
  console.log(`   Articles: ${totalArticles} generated`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

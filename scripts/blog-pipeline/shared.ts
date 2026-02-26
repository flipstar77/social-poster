/**
 * Shared utilities for the blog pipeline.
 *
 * Single source of truth for: Supabase/xAI clients, slugify, article search,
 * content truncation, article generation prompt, JSON parsing, MDX building.
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { fetchHeroImage } from './pexels-utils'

// --- Environment validation ---

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'XAI_API_KEY'] as const

export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error(`❌ Missing environment variables: ${missing.join(', ')}`)
    console.error('   Make sure .env.local exists and contains these keys.')
    process.exit(1)
  }
}

// --- Shared clients (lazy singletons) ---

let _supabase: ReturnType<typeof createClient>
let _xai: OpenAI

export function getSupabase() {
  if (!_supabase) {
    validateEnv()
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _supabase
}

export function getXai() {
  if (!_xai) {
    validateEnv()
    _xai = new OpenAI({
      apiKey: process.env.XAI_API_KEY!,
      baseURL: 'https://api.x.ai/v1',
    })
  }
  return _xai
}

// --- Constants ---

export const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export const CATEGORIES = ['Instagram', 'TikTok', 'Google Maps', 'SEO', 'Strategie'] as const
export type Category = typeof CATEGORIES[number]

// --- Slugify ---

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// --- Category detection ---

export function detectCategory(keyword: string): Category {
  const kw = keyword.toLowerCase()
  if (kw.includes('instagram') || kw.includes('insta')) return 'Instagram'
  if (kw.includes('tiktok') || kw.includes('tik tok')) return 'TikTok'
  if (kw.includes('google') || kw.includes('maps') || kw.includes('bewertung')) return 'Google Maps'
  if (kw.includes('seo') || kw.includes('suchmaschine') || kw.includes('ranking')) return 'SEO'
  return 'Strategie'
}

// --- Content truncation ---

export function truncate(text: string, maxChars: number = 3000): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars) + '...'
}

// --- Tavily web search ---

export interface WebSearchResult {
  title: string
  url: string
  content: string
  score: number
}

export async function searchWeb(query: string, maxResults: number = 5): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    console.log('   ⚠️  TAVILY_API_KEY not set — skipping web search')
    return []
  }

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
      }),
    })

    if (!res.ok) {
      console.log(`   ⚠️  Tavily error: ${res.status}`)
      return []
    }

    const data = await res.json() as { results: WebSearchResult[] }
    return data.results || []
  } catch (err) {
    console.log(`   ⚠️  Tavily failed: ${(err as Error).message?.slice(0, 100)}`)
    return []
  }
}

// --- Find relevant source articles ---

export interface SourceArticle {
  id: string
  title: string
  content: string
  source_id: string
}

export async function findRelevantArticles(
  keyword: string,
  limit: number = 6
): Promise<SourceArticle[]> {
  const supabase = getSupabase()
  const searchTerms = keyword.split(' ').filter(w => w.length > 3).join(' & ')

  const { data: fts } = await supabase
    .from('scraped_articles')
    .select('id, title, content, source_id')
    .textSearch('fts', searchTerms, { type: 'plain', config: 'german' })
    .limit(limit) as { data: SourceArticle[] | null }

  if (fts && fts.length >= 2) return fts

  const words = keyword.split(' ').filter(w => w.length > 3)
  const { data: like } = await supabase
    .from('scraped_articles')
    .select('id, title, content, source_id')
    .or(words.map(w => `title.ilike.%${w.replace(/%/g, '').replace(/_/g, '')}%`).join(','))
    .limit(limit) as { data: SourceArticle[] | null }

  return like || fts || []
}

// --- Article generation prompt (single source of truth) ---

export function buildSystemPrompt(): string {
  return `Du bist ein SEO-Content-Writer für FlowingPost, ein SaaS-Tool das Restaurants bei Social Media und Online-Marketing hilft.

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

SVG-DIAGRAMME:
- Baue 1-2 einfache SVG-Diagramme direkt in den Artikel ein, wo es inhaltlich passt (Balkendiagramm, Vergleich, Statistik).
- SVG direkt als HTML/JSX im Markdown — kein Code-Block, direkt im Text.
- Halte SVGs einfach: max. 400px breit, dunkles Theme (#1a1a2e Hintergrund, #a78bfa Akzentfarbe, weiße Beschriftung).
- Beispiel für ein einfaches Balkendiagramm:
<svg viewBox="0 0 400 200" style={{width:'100%',maxWidth:'400px',display:'block',margin:'24px auto'}}>
  <rect width="400" height="200" fill="#1a1a2e" rx="8"/>
  <text x="200" y="24" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">Titel</text>
  <rect x="40" y="40" width="120" height="80" fill="#a78bfa" rx="4"/>
  <text x="100" y="138" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="11">Label A</text>
  <text x="100" y="80" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">42%</text>
</svg>
- Passe Werte, Labels und Farben dem Artikel-Inhalt an. Nutze echte Zahlen aus den Quellen.

QUELLENANGABEN:
- Wenn du konkrete Zahlen oder Fakten aus den Web-Quellen verwendest, füge am Ende des Artikels einen Abschnitt "## Quellen" ein.
- Format: einfache Markdown-Liste mit Titel und URL der Quelle.
- Nur für Fakten mit Zahlen, nicht für allgemeine Aussagen.

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
}

export function buildUserPrompt(
  keyword: string,
  category: string,
  sources: Array<{ title: string; content: string; source_id: string }>,
  webResults: WebSearchResult[] = []
): string {
  const contextBlock = sources.map((a, i) =>
    `### Quelle ${i + 1}: "${a.title}" (${a.source_id})\n${truncate(a.content)}`
  ).join('\n\n')

  const webBlock = webResults.length > 0
    ? `\n\n### Aktuelle Web-Quellen (Tavily, ${new Date().getFullYear()}):\n` +
      webResults.map(r =>
        `**${r.title}** (${r.url})\n${truncate(r.content, 800)}`
      ).join('\n\n')
    : ''

  return `Schreibe einen umfassenden, detaillierten Blog-Artikel zum Keyword: "${keyword}"
Kategorie: ${category}

WICHTIG: Nutze die folgenden Quellen aktiv als Wissensbasis. Übernimm konkrete Zahlen, Strategien und Beispiele daraus (in eigenen Worten, nicht kopieren). Der Artikel soll die besten Erkenntnisse aus allen Quellen kombinieren und für DACH-Restaurantbesitzer aufbereiten.

${sources.length > 0 ? contextBlock : 'Keine Datenbank-Quellen verfügbar.'}${webBlock}

${sources.length === 0 && webResults.length === 0 ? 'Keine Quellen verfügbar — schreibe basierend auf allgemeinem Fachwissen.' : ''}

Schreibe jetzt einen ausführlichen Artikel mit mindestens 1800 Wörtern.`
}

// --- Generate article via Grok ---

export async function generateArticleContent(
  keyword: string,
  category: string,
  sources: Array<{ title: string; content: string; source_id: string }>,
  webResults: WebSearchResult[] = []
): Promise<string> {
  const response = await getXai().chat.completions.create({
    model: 'grok-4-1-fast-non-reasoning',
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(keyword, category, sources, webResults) },
    ],
    temperature: 0.7,
    max_tokens: 8000,
  })

  return response.choices[0]?.message?.content || ''
}

// --- Parse JSON metadata + body from Grok response ---

export function parseGeneratedContent(raw: string): { title: string; description: string; body: string } {
  let title = ''
  let description = ''
  let body = raw

  const fencedMatch = raw.match(/```json\s*\n({[\s\S]*?})\n\s*```/)
  const rawJsonMatch = raw.match(/^\s*\{[\s\S]*?"title"\s*:\s*"[\s\S]*?"description"\s*:\s*"[\s\S]*?\}/)

  if (fencedMatch) {
    try { const m = JSON.parse(fencedMatch[1]); title = m.title || ''; description = m.description || '' } catch {}
    body = raw.replace(/```json\s*\n[\s\S]*?\n\s*```\s*\n?/, '').trim()
  } else if (rawJsonMatch) {
    try { const m = JSON.parse(rawJsonMatch[0]); title = m.title || ''; description = m.description || '' } catch {}
    body = raw.slice(rawJsonMatch[0].length).trim()
  }

  return { title, description, body }
}

// --- Build MDX frontmatter + save ---

export interface SaveArticleResult {
  slug: string
  wordCount: number
  success: boolean
}

export async function buildAndSaveArticle(
  keyword: string,
  category: string,
  keywordId: string | null,
  sources: SourceArticle[]
): Promise<SaveArticleResult> {
  const fail = { slug: '', wordCount: 0, success: false }

  // Web search via Tavily
  console.log(`   🌐 Searching web for: "${keyword}"`)
  const webResults = await searchWeb(`${keyword} Restaurant DACH Deutschland Statistiken`)
  if (webResults.length > 0) {
    console.log(`   🌐 ${webResults.length} web results found`)
  }

  // Generate
  console.log(`   📚 ${sources.length} source articles found`)
  let raw: string
  try {
    raw = await generateArticleContent(keyword, category, sources, webResults)
    console.log(`   🤖 Grok response: ${raw.length} chars`)
  } catch (e) {
    console.log(`   ❌ API error: ${(e as Error).message?.slice(0, 200)}`)
    return fail
  }

  // Parse
  const { title, description, body } = parseGeneratedContent(raw)
  if (!title || body.length < 500) {
    console.log(`   ❌ Generation failed — title: "${title?.slice(0, 50)}", body: ${body.length} chars`)
    if (raw.length > 0) console.log(`   Raw start: ${raw.slice(0, 200).replace(/\n/g, ' ')}`)
    return fail
  }

  const slug = slugify(title)

  // Check for duplicate slug
  const existingSlugs = getExistingSlugs()
  if (existingSlugs.has(slug)) {
    console.log(`   ⚠️  Slug "${slug}" already exists — skipping`)
    return fail
  }

  const date = new Date().toISOString().split('T')[0]

  // Fetch hero image
  const heroImage = await fetchHeroImage(keyword, category)
  const imageFrontmatter = heroImage
    ? `image: "${heroImage.url}"\nimageMedium: "${heroImage.urlMedium}"\nimageCredit: "${heroImage.photographer}"\nimageCreditUrl: "${heroImage.photographerUrl}"`
    : `image: "/blog/${slug}.jpg"`

  if (heroImage) {
    console.log(`   🖼️  Image: ${heroImage.photographer} (Pexels)`)
  }

  // Write MDX
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
  const wordCount = body.split(/\s+/).length
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('generated_articles') as any).upsert({
    slug, title, description, category, locale: 'de',
    word_count: wordCount,
    source_article_ids: sources.map(s => s.id),
    status: 'draft',
    keyword_id: keywordId,
  }, { onConflict: 'slug' })

  if (keywordId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('blog_keywords') as any).update({ status: 'written' }).eq('id', keywordId)
  }

  console.log(`   ✅ ${slug}.mdx (~${wordCount} words)`)
  return { slug, wordCount, success: true }
}

// --- Helpers ---

export function getExistingSlugs(): Set<string> {
  if (!fs.existsSync(BLOG_DIR)) return new Set()
  return new Set(
    fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx')).map(f => f.replace('.mdx', ''))
  )
}

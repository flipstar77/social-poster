/**
 * Article Generator
 *
 * Takes a keyword/topic, pulls relevant scraped articles from Supabase,
 * and generates an SEO-optimized blog post using xAI/Grok.
 *
 * Usage:
 *   npx tsx scripts/blog-pipeline/generate-article.ts "google business profil restaurant"
 *   npx tsx scripts/blog-pipeline/generate-article.ts --keyword-id <uuid>
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY!,
  baseURL: 'https://api.x.ai/v1',
})

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

// Category detection from keyword
function detectCategory(keyword: string): string {
  const kw = keyword.toLowerCase()
  if (kw.includes('instagram') || kw.includes('insta')) return 'Instagram'
  if (kw.includes('tiktok') || kw.includes('tik tok')) return 'TikTok'
  if (kw.includes('google') || kw.includes('maps') || kw.includes('bewertung')) return 'Google Maps'
  if (kw.includes('seo') || kw.includes('suchmaschine') || kw.includes('ranking')) return 'SEO'
  return 'Strategie'
}

// Generate slug from title
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// Find relevant scraped articles for context
async function findRelevantArticles(keyword: string, category: string): Promise<Array<{ id: string; title: string; content: string; source_id: string }>> {
  // Search by keyword in full-text search
  const searchTerms = keyword.split(' ').filter(w => w.length > 3).join(' & ')

  const { data: ftsResults } = await supabase
    .from('scraped_articles')
    .select('id, title, content, source_id')
    .textSearch('fts', searchTerms, { type: 'plain', config: 'german' })
    .limit(8)

  if (ftsResults && ftsResults.length >= 3) return ftsResults

  // Fallback: search by individual words with ILIKE
  const words = keyword.split(' ').filter(w => w.length > 3)
  const { data: likeResults } = await supabase
    .from('scraped_articles')
    .select('id, title, content, source_id')
    .or(words.map(w => `title.ilike.%${w}%`).join(','))
    .limit(8)

  return likeResults || ftsResults || []
}

// Truncate content to fit context window
function truncateContent(content: string, maxChars: number = 3000): string {
  if (content.length <= maxChars) return content
  return content.slice(0, maxChars) + '...'
}

async function generateArticle(keyword: string, category: string, sourceArticles: Array<{ title: string; content: string; source_id: string }>) {
  const contextBlock = sourceArticles.map((a, i) =>
    `### Quelle ${i + 1}: "${a.title}" (${a.source_id})\n${truncateContent(a.content)}`
  ).join('\n\n')

  const systemPrompt = `Du bist ein SEO-Content-Writer für FlowingPost, ein SaaS-Tool das Restaurants bei Social Media und Online-Marketing hilft.

ZIELGRUPPE: Restaurantbesitzer in DACH (Deutschland, Österreich, Schweiz), 1-5 Mitarbeiter, Inhaber macht Marketing selbst, kein Marketing-Wissen, wenig Zeit.

SCHREIBSTIL:
- IMMER "du" verwenden, niemals "Sie". Striktes Muss.
- Kein Marketing-Jargon. Statt "Engagement Rate" schreibe "wie viele Leute reagieren".
- Kurze, klare Sätze. Schreibe wie für einen Freund der ein Restaurant betreibt.
- KEINE Emojis im Text.

INHALTLICHE QUALITÄT:
- Nutze konkrete Zahlen und Beispiele aus den Quellen.
- Jeder H2-Abschnitt MUSS einen konkreten, sofort umsetzbaren Tipp mit Schritt-für-Schritt-Anleitung enthalten.
- Verwende Tabellen für Vergleiche und Checklisten.
- Nenne DACH-spezifische Beispiele.
- Mindestens 1800 Wörter. Schreibe ausführlich.
- Am Ende: Fazit + kurzer CTA zu FlowingPost (1-2 Sätze).

SEO-REGELN:
- H2 (##) für Hauptabschnitte, H3 (###) für Unterabschnitte.
- Keyword natürlich im Titel, Einleitung, und mindestens 3 H2s.
- Meta-Description: 130-155 Zeichen, mit Keyword.
- Mind. 1x Link zu [FlowingPost](/).

OUTPUT-FORMAT:
Gib zuerst die Meta-Daten als JSON-Objekt (OHNE Code-Fences), dann Leerzeile, dann Artikeltext in Markdown.
{"title": "...", "description": "..."}

Artikeltext beginnt direkt mit Einleitungsabsatz (kein H1, kein Frontmatter).`

  const userPrompt = `Schreibe einen umfassenden Blog-Artikel zum Keyword: "${keyword}" (Kategorie: ${category})

WICHTIG: Nutze die folgenden Quellen aktiv als Wissensbasis. Übernimm konkrete Zahlen, Strategien und Beispiele (in eigenen Worten). Kombiniere die besten Erkenntnisse für DACH-Restaurantbesitzer.

${contextBlock}

Schreibe jetzt einen ausführlichen Artikel mit mindestens 1800 Wörtern.`

  const response = await xai.chat.completions.create({
    model: 'grok-4-1-fast-non-reasoning',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 8000,
  })

  return response.choices[0]?.message?.content || ''
}

function parseGeneratedContent(raw: string): { title: string; description: string; body: string } {
  let title = ''
  let description = ''
  let body = raw

  // Try fenced ```json``` first, then raw JSON at start
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

async function main() {
  const args = process.argv.slice(2)
  let keyword = ''
  let keywordId: string | null = null
  let category = ''

  if (args[0] === '--keyword-id' && args[1]) {
    keywordId = args[1]
    const { data } = await supabase
      .from('blog_keywords')
      .select('keyword, category')
      .eq('id', keywordId)
      .single()
    if (!data) {
      console.error('Keyword not found:', keywordId)
      process.exit(1)
    }
    keyword = data.keyword
    category = data.category
  } else if (args[0]) {
    keyword = args.join(' ')
    category = detectCategory(keyword)
  } else {
    // Auto-select: pick highest priority unwritten keyword
    const { data } = await supabase
      .from('blog_keywords')
      .select('id, keyword, category')
      .eq('status', 'new')
      .order('priority', { ascending: false })
      .limit(1)
      .single()

    if (!data) {
      console.log('No unwritten keywords found. Run keyword-research.ts first.')
      process.exit(0)
    }
    keywordId = data.id
    keyword = data.keyword
    category = data.category
  }

  console.log(`\n📝 Generating article for: "${keyword}" (${category})`)

  // Find relevant source articles
  const sources = await findRelevantArticles(keyword, category)
  console.log(`📚 Found ${sources.length} relevant source articles`)

  if (sources.length === 0) {
    console.log('⚠️  No source articles found — generating without context')
  }

  // Generate the article
  console.log('🤖 Generating with Grok...')
  const raw = await generateArticle(keyword, category, sources)
  const { title, description, body } = parseGeneratedContent(raw)

  if (!title || !body) {
    console.error('❌ Failed to generate — empty title or body')
    console.log('Raw output:', raw.slice(0, 500))
    process.exit(1)
  }

  const slug = slugify(title)
  const date = new Date().toISOString().split('T')[0]

  // Build MDX file
  const mdxContent = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
date: "${date}"
category: "${category}"
locale: "de"
image: "/blog/${slug}.jpg"
---

${body}
`

  // Save MDX file
  fs.mkdirSync(BLOG_DIR, { recursive: true })
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  fs.writeFileSync(filePath, mdxContent, 'utf-8')
  console.log(`\n✅ Article saved: content/blog/${slug}.mdx`)
  console.log(`   Title: ${title}`)
  console.log(`   Words: ~${body.split(/\s+/).length}`)

  // Track in Supabase
  const sourceIds = sources.map(s => s.id)
  const { error: insertError } = await supabase
    .from('generated_articles')
    .upsert({
      slug,
      title,
      description,
      category,
      locale: 'de',
      word_count: body.split(/\s+/).length,
      source_article_ids: sourceIds,
      status: 'draft',
      keyword_id: keywordId,
    }, { onConflict: 'slug' })

  if (insertError) {
    console.log(`⚠️  DB tracking error: ${insertError.message}`)
  } else {
    console.log('💾 Tracked in Supabase')
  }

  // Update keyword status
  if (keywordId) {
    await supabase
      .from('blog_keywords')
      .update({ status: 'written' })
      .eq('id', keywordId)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

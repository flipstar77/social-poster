import { chromium, Browser, Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { sources, Source } from './sources'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const OUTPUT_DIR = path.join(process.cwd(), 'content', 'scraped')

// Supabase client (uses service role for write access)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

type ScrapedArticle = {
  source: string
  sourceId: string
  language: string
  url: string
  title: string
  date: string
  content: string
  scrapedAt: string
}

// CLI args: optional source filter
const targetSourceId = process.argv[2]

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function saveToSupabase(articles: ScrapedArticle[]): Promise<number> {
  if (!supabase || articles.length === 0) return 0

  const rows = articles.map(a => ({
    source_id: a.sourceId,
    url: a.url,
    title: a.title,
    content: a.content,
    date: a.date || null,
    language: a.language,
    scraped_at: a.scrapedAt,
  }))

  // Upsert: update content if URL already exists, insert if new
  const { data, error } = await supabase
    .from('scraped_articles')
    .upsert(rows, { onConflict: 'url', ignoreDuplicates: false })
    .select('id')

  if (error) {
    console.log(`   ⚠️  Supabase error: ${error.message}`)
    return 0
  }

  return data?.length || 0
}

async function scrapeSource(browser: Browser, source: Source): Promise<ScrapedArticle[]> {
  const articles: ScrapedArticle[] = []
  let page: Page | null = null

  try {
    page = await browser.newPage()
    const pageTimeout = source.timeout || 20000
    page.setDefaultTimeout(pageTimeout)

    console.log(`\n📡 [${source.id}] Loading ${source.blogUrl}`)
    await page.goto(source.blogUrl, { waitUntil: 'domcontentloaded', timeout: pageTimeout })
    await delay(2000)

    // Find article links
    const links = await page.evaluate(({ selector, baseUrl, allowQP }: { selector: string; baseUrl?: string; allowQP?: boolean }) => {
      const elements = document.querySelectorAll(selector)
      const urls = new Set<string>()
      elements.forEach(el => {
        const href = el.getAttribute('href')
        if (!href) return
        if (href === '#' || href === '/' || href.endsWith('/blog/') || href.endsWith('/blog')) return
        // Skip pagination and category URLs
        if (href.includes('page=') || href.includes('category=') || href.includes('/category/')) return
        // Skip query-string URLs unless allowQueryParams is set
        if (!allowQP && href.includes('?')) return
        let fullUrl = href
        if (href.startsWith('/')) {
          fullUrl = (baseUrl || '') + href
        } else if (!href.startsWith('http')) {
          fullUrl = (baseUrl || '') + '/' + href
        }
        // Strip query params to normalize URLs (e.g. HubSpot tracking params)
        if (allowQP && fullUrl.includes('?')) {
          fullUrl = fullUrl.split('?')[0]
        }
        urls.add(fullUrl)
      })
      return Array.from(urls)
    }, { selector: source.articleLinkSelector, baseUrl: source.baseUrl, allowQP: source.allowQueryParams })

    const articleUrls = links.slice(0, source.maxArticles)
    console.log(`   Found ${links.length} links, scraping ${articleUrls.length}`)

    // Scrape each article
    for (const url of articleUrls) {
      try {
        console.log(`   📄 ${url}`)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: pageTimeout })
        await delay(1500)

        const articleData = await page.evaluate(({ titleSel, contentSel, dateSel }: { titleSel: string; contentSel: string; dateSel?: string }) => {
          const titleEl = document.querySelector(titleSel)
          const title = titleEl?.textContent?.trim() || ''

          let content = ''
          for (const sel of contentSel.split(',').map(s => s.trim())) {
            const el = document.querySelector(sel)
            if (el && el.textContent && el.textContent.trim().length > 100) {
              const clone = el.cloneNode(true) as HTMLElement
              clone.querySelectorAll('script, style, nav, header, footer, .sidebar, .menu, .nav, .cookie-banner, .newsletter-signup').forEach(n => n.remove())
              // Clean up whitespace: collapse tabs/newlines into single spaces, then preserve paragraph breaks
              const raw = clone.textContent?.trim() || ''
              content = raw
                .replace(/\t/g, ' ')
                .replace(/ {2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .replace(/\n /g, '\n')
                .trim()
              break
            }
          }

          let date = ''
          if (dateSel) {
            for (const sel of dateSel.split(',').map(s => s.trim())) {
              const dateEl = document.querySelector(sel)
              if (dateEl) {
                date = dateEl.getAttribute('datetime') || dateEl.textContent?.trim() || ''
                if (date) break
              }
            }
          }

          return { title, content, date }
        }, { titleSel: source.titleSelector, contentSel: source.contentSelector, dateSel: source.dateSelector })

        if (articleData.title && articleData.content.length > 50) {
          articles.push({
            source: source.name,
            sourceId: source.id,
            language: source.language,
            url,
            title: articleData.title,
            date: articleData.date,
            content: articleData.content,
            scrapedAt: new Date().toISOString(),
          })
        }
      } catch (err) {
        console.log(`   ⚠️  Failed: ${url} — ${(err as Error).message?.slice(0, 80)}`)
      }
    }
  } catch (err) {
    console.log(`❌ [${source.id}] Error: ${(err as Error).message?.slice(0, 100)}`)
  } finally {
    if (page) await page.close()
  }

  return articles
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const sourcesToScrape = targetSourceId
    ? sources.filter(s => s.id === targetSourceId)
    : sources

  if (sourcesToScrape.length === 0) {
    console.error(`Source "${targetSourceId}" not found. Available: ${sources.map(s => s.id).join(', ')}`)
    process.exit(1)
  }

  if (supabase) {
    console.log('📦 Supabase connected — articles will be saved to database')
  } else {
    console.log('⚠️  No Supabase credentials — saving to JSON files only')
  }

  console.log(`🚀 Scraping ${sourcesToScrape.length} source(s)...\n`)

  const browser = await chromium.launch({ headless: true })
  let totalArticles = 0
  let totalSaved = 0

  for (const source of sourcesToScrape) {
    const articles = await scrapeSource(browser, source)
    totalArticles += articles.length

    // Save to Supabase
    if (supabase && articles.length > 0) {
      const saved = await saveToSupabase(articles)
      totalSaved += saved
      console.log(`   💾 ${saved} articles → Supabase`)
    }

    // Also save JSON backup
    const outputPath = path.join(OUTPUT_DIR, `${source.id}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(articles, null, 2), 'utf-8')
    console.log(`✅ [${source.id}] ${articles.length} articles → ${source.id}.json`)
  }

  await browser.close()

  console.log(`\n🎉 Done! ${totalArticles} articles scraped from ${sourcesToScrape.length} sources.`)
  if (supabase) console.log(`   💾 ${totalSaved} saved/updated in Supabase`)
  console.log(`   📁 JSON backup: content/scraped/`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

/**
 * Backfill Pexels hero images for existing blog articles.
 *
 * Reads all MDX files, finds those without Pexels image URLs,
 * searches Pexels based on article category/title, and updates frontmatter.
 *
 * Usage:
 *   npx tsx scripts/blog-pipeline/backfill-images.ts           # Update all
 *   npx tsx scripts/blog-pipeline/backfill-images.ts --dry-run  # Preview only
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { fetchHeroImage } from './pexels-utils'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx'))
  console.log(`Found ${files.length} articles\n`)

  let updated = 0

  for (const filename of files) {
    const filePath = path.join(BLOG_DIR, filename)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(raw)

    // Skip if already has a Pexels URL
    if (data.image && data.image.startsWith('http')) {
      console.log(`  ✓ ${filename} — already has Pexels image`)
      continue
    }

    const keyword = data.title || filename.replace('.mdx', '').replace(/-/g, ' ')
    const category = data.category || 'Strategie'

    console.log(`  → ${filename}`)
    console.log(`    Keyword: "${keyword}" (${category})`)

    if (dryRun) {
      console.log('    [dry-run] Would search Pexels\n')
      continue
    }

    const image = await fetchHeroImage(keyword, category)

    if (!image) {
      console.log('    No image found\n')
      continue
    }

    // Update frontmatter
    data.image = image.url
    data.imageMedium = image.urlMedium
    data.imageCredit = image.photographer
    data.imageCreditUrl = image.photographerUrl

    // Rebuild the file
    const newContent = matter.stringify(content, data)
    fs.writeFileSync(filePath, newContent, 'utf-8')

    console.log(`    Image: ${image.photographer} (Pexels)`)
    console.log(`    Updated!\n`)
    updated++

    // Rate limit: 200 req/hr = ~1 per 18s, but we do 3 per article max
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log(`\nDone! ${updated}/${files.length} articles updated.`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

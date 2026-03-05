/**
 * PUBLISHER Agent Helper
 *
 * Takes the final draft.mdx, adds a hero image from Pexels,
 * copies it to content/blog/, runs internal links,
 * and updates Supabase tracking.
 *
 * Usage: npx tsx scripts/blog-agents/helpers/publish.ts
 * Input:  data/pipeline/draft.mdx + data/pipeline/research.json
 * Output: content/blog/{slug}.mdx + Supabase update
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabase, slugify, BLOG_DIR } from '../../blog-pipeline/shared'
import { fetchHeroImage } from '../../blog-pipeline/pexels-utils'

const PIPELINE_DIR = path.join(process.cwd(), 'data', 'pipeline')

async function main() {
  console.log('[Publisher] Starting publish phase...\n')

  const draftPath = path.join(PIPELINE_DIR, 'draft.mdx')
  const researchPath = path.join(PIPELINE_DIR, 'research.json')

  if (!fs.existsSync(draftPath)) {
    console.error('[Publisher] No draft found at data/pipeline/draft.mdx')
    process.exit(1)
  }

  // Read draft
  const raw = fs.readFileSync(draftPath, 'utf-8')
  const { data: frontmatter, content: body } = matter(raw)

  if (!frontmatter.title) {
    console.error('[Publisher] Draft has no title in frontmatter')
    process.exit(1)
  }

  // Read research brief
  let keywordId: string | null = null
  let keyword = ''
  let category = 'Strategie'
  if (fs.existsSync(researchPath)) {
    const research = JSON.parse(fs.readFileSync(researchPath, 'utf-8'))
    keywordId = research.keyword?.id || null
    keyword = research.keyword?.text || ''
    category = research.keyword?.category || frontmatter.category || 'Strategie'
  }

  const slug = slugify(frontmatter.title)
  const destPath = path.join(BLOG_DIR, `${slug}.mdx`)

  // Check for duplicate
  if (fs.existsSync(destPath)) {
    console.error(`[Publisher] Slug "${slug}" already exists — aborting`)
    process.exit(1)
  }

  // Fetch hero image
  console.log(`[Publisher] Fetching hero image for "${keyword || frontmatter.title}"...`)
  const heroImage = await fetchHeroImage(keyword || frontmatter.title, category)

  let imageFrontmatter = ''
  if (heroImage) {
    imageFrontmatter = `image: "${heroImage.url}"
imageMedium: "${heroImage.urlMedium}"
imageCredit: "${heroImage.photographer}"
imageCreditUrl: "${heroImage.photographerUrl}"`
    console.log(`[Publisher] Image: ${heroImage.photographer} (Pexels)`)
  } else {
    imageFrontmatter = `image: "/blog/${slug}.jpg"`
    console.log('[Publisher] No image found — using placeholder')
  }

  // Build final MDX
  const date = new Date().toISOString().split('T')[0]
  const mdx = `---
title: "${frontmatter.title.replace(/"/g, '\\"')}"
description: "${(frontmatter.description || '').replace(/"/g, '\\"')}"
date: "${date}"
category: "${category}"
locale: "de"
${imageFrontmatter}
---

${body}
`

  // Write to blog directory
  fs.mkdirSync(BLOG_DIR, { recursive: true })
  fs.writeFileSync(destPath, mdx, 'utf-8')
  console.log(`[Publisher] Saved: content/blog/${slug}.mdx`)

  // Track in Supabase
  const wordCount = body.split(/\s+/).length
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: articleError } = await (supabase.from('generated_articles') as any).upsert({
    slug,
    title: frontmatter.title,
    description: frontmatter.description || '',
    category,
    locale: 'de',
    word_count: wordCount,
    status: 'draft',
    keyword_id: keywordId,
  }, { onConflict: 'slug' })

  if (articleError) {
    console.error('[Publisher] Supabase article tracking error:', articleError.message)
  }

  // Update keyword status
  if (keywordId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('blog_keywords') as any)
      .update({ status: 'written' })
      .eq('id', keywordId)
    console.log('[Publisher] Keyword status updated to "written"')
  }

  // Run internal links
  console.log('[Publisher] Adding internal links...')
  try {
    const { processAllArticles } = await import('../../blog-pipeline/add-internal-links')
    await processAllArticles()
    console.log('[Publisher] Internal links added')
  } catch (err) {
    console.error('[Publisher] Internal links failed:', (err as Error).message)
  }

  // Write publish result
  const result = {
    slug,
    title: frontmatter.title,
    category,
    wordCount,
    date,
    hasImage: !!heroImage,
    filePath: `content/blog/${slug}.mdx`,
  }

  fs.writeFileSync(
    path.join(PIPELINE_DIR, 'publish-result.json'),
    JSON.stringify(result, null, 2),
    'utf-8'
  )

  console.log(`\n[Publisher] Done! Article ready at: content/blog/${slug}.mdx`)
  console.log(`[Publisher] ${wordCount} words, category: ${category}`)
}

main().catch(err => {
  console.error('[Publisher] Fatal error:', err)
  process.exit(1)
})

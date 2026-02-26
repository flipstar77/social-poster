/**
 * Article → Video Pipeline
 *
 * For each blog article:
 *   1. Parse MDX frontmatter + content
 *   2. Call Grok to extract 6 slide scripts (heading + subtext + voiceover)
 *   3. Generate German voiceover audio with Edge TTS → public/audio/{slug}.mp3
 *   4. Render Remotion Blog-Video composition → public/videos/{slug}.mp4
 *
 * Usage:
 *   npx tsx scripts/blog-pipeline/article-to-video.ts                    # All articles missing videos
 *   npx tsx scripts/blog-pipeline/article-to-video.ts --slug restaurant-neueroffnung-marketing
 *   npx tsx scripts/blog-pipeline/article-to-video.ts --dry-run          # Show what would be processed
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import OpenAI from 'openai'
import { Communicate } from 'edge-tts-universal'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import type { BlogVideoProps, BlogSlide } from '../../remotion/videos/BlogVideoSlides'

// ─── Config ──────────────────────────────────────────────────────────────────

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')
const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio')
const VIDEO_DIR = path.join(process.cwd(), 'public', 'videos')
const ENTRY_POINT = path.join(process.cwd(), 'remotion', 'index.ts')

const VOICE = 'de-DE-KatjaNeural'
const FPS = 30
const SLIDE_COUNT = 6      // 1 intro + 4 content + 1 outro

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY!,
  baseURL: 'https://api.x.ai/v1',
})

// ─── Arg parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const targetSlug = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null
const dryRun = args.includes('--dry-run')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getArticleSlugs(): string[] {
  return fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace('.mdx', ''))
}

function hasVideo(slug: string): boolean {
  return fs.existsSync(path.join(VIDEO_DIR, `${slug}.mp4`))
}

function parseArticle(slug: string): { title: string; category: string; imageUrl: string; content: string } {
  const raw = fs.readFileSync(path.join(BLOG_DIR, `${slug}.mdx`), 'utf-8')
  const { data, content } = matter(raw)
  return {
    title: data.title || slug,
    category: data.category || 'Strategie',
    imageUrl: data.image || '',
    content: content.slice(0, 4000),
  }
}

// ─── Step 1: Generate slide scripts with Grok ────────────────────────────────

interface GrokSlide {
  heading: string
  subtext: string
  voiceover: string
}

async function generateSlides(
  title: string,
  category: string,
  content: string
): Promise<GrokSlide[]> {
  const systemPrompt = `Du bist ein Social-Media-Video-Skript-Autor für FlowingPost.
Erstelle ein kurzes TikTok/Reels-Video-Skript aus einem Blog-Artikel.

FORMAT: Gib exakt ${SLIDE_COUNT} Slides als JSON-Array zurück.
- Slide 1: Intro — fange mit einer provokanten Frage oder Aussage an
- Slides 2-${SLIDE_COUNT - 1}: Je ein konkreter, praktischer Tipp aus dem Artikel
- Slide ${SLIDE_COUNT}: Outro — kurzer CTA zu flowingpost.com

PRO SLIDE:
- "heading": kurz und prägnant (max 8 Wörter), kein Punkt am Ende
- "subtext": eine kurze erklärende Zeile (max 12 Wörter), kann leer sein ("")
- "voiceover": gesprochener Text (15-25 Wörter), natürlich und direkt — als würdest du einem Freund etwas erklären

WICHTIG:
- Alle Texte auf Deutsch, "du"-Ansprache
- Voiceover-Texte zusammen ergeben einen flüssigen Monolog (keine Übergänge wie "In Slide 2...")
- Kein Jargon, konkret und umsetzbar

Gib NUR das JSON-Array zurück, kein anderer Text.`

  const userPrompt = `Artikel: "${title}" (Kategorie: ${category})\n\nInhalt:\n${content}`

  const response = await xai.chat.completions.create({
    model: 'grok-3-fast',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1200,
  })

  const raw = response.choices[0]?.message?.content || ''

  // Extract JSON array (handle possible code fences)
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`Grok returned no JSON array. Raw: ${raw.slice(0, 200)}`)

  const slides: GrokSlide[] = JSON.parse(match[0])
  if (!Array.isArray(slides) || slides.length < 3) {
    throw new Error(`Expected array of slides, got: ${typeof slides}`)
  }

  return slides.slice(0, SLIDE_COUNT)
}

// ─── Step 2: Generate audio with Edge TTS ────────────────────────────────────

async function generateAudio(slides: GrokSlide[], outputPath: string): Promise<number> {
  // Combine all voiceovers with short pauses between slides
  const fullText = slides
    .map(s => s.voiceover)
    .filter(Boolean)
    .join('  ')  // double space = slight natural pause

  const comm = new Communicate(fullText, {
    voice: VOICE,
    rate: '-5%',  // slightly slower for clarity
  })

  const audioChunks: Buffer[] = []
  let lastOffset = 0
  let lastDuration = 0

  for await (const chunk of comm.stream()) {
    if (chunk.type === 'audio' && chunk.data) {
      audioChunks.push(chunk.data)
    } else if (chunk.type === 'WordBoundary' && chunk.offset != null && chunk.duration != null) {
      lastOffset = chunk.offset
      lastDuration = chunk.duration
    }
  }

  if (audioChunks.length === 0) throw new Error('Edge TTS returned no audio chunks')

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, Buffer.concat(audioChunks))

  // Duration in seconds from word boundary timing (100-nanosecond units)
  const durationSeconds = (lastOffset + lastDuration) / 10_000_000
  // Fallback: estimate from text length (~2.5 chars per second at -5% rate)
  const fallbackSeconds = fullText.length / 14
  return durationSeconds > 1 ? durationSeconds : fallbackSeconds
}

// ─── Step 3: Render with Remotion ────────────────────────────────────────────

async function renderVideo(
  slug: string,
  props: BlogVideoProps,
  outputPath: string
): Promise<void> {
  console.log('   📦 Bundling Remotion...')
  const bundleLocation = await bundle({ entryPoint: ENTRY_POINT })

  const totalFrames = props.slides.length * props.framesPerSlide

  console.log(`   🎬 Selecting composition (${props.slides.length} slides, ${(totalFrames / FPS).toFixed(1)}s)...`)
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'Blog-Video',
    inputProps: props,
  })

  console.log(`   🖥️  Rendering ${totalFrames} frames...`)
  await renderMedia({
    composition: { ...composition, durationInFrames: totalFrames },
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: props,
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function processArticle(slug: string): Promise<boolean> {
  console.log(`\n📝 ${slug}`)

  const { title, category, imageUrl, content } = parseArticle(slug)
  console.log(`   "${title}" (${category})`)

  if (!imageUrl) {
    console.log('   ⚠️  No image in frontmatter — skipping (need imageUrl for background)')
    return false
  }

  // Step 1: Generate slides
  console.log('   🤖 Generating slide scripts...')
  let grokSlides: GrokSlide[]
  try {
    grokSlides = await generateSlides(title, category, content)
    console.log(`   ✓ ${grokSlides.length} slides ready`)
  } catch (e) {
    console.log(`   ❌ Slide generation failed: ${(e as Error).message?.slice(0, 150)}`)
    return false
  }

  // Step 2: Generate audio
  const audioFile = `${slug}.mp3`
  const audioPath = path.join(AUDIO_DIR, audioFile)
  console.log('   🎤 Generating voiceover (Edge TTS)...')
  let audioDurationSeconds: number
  try {
    audioDurationSeconds = await generateAudio(grokSlides, audioPath)
    console.log(`   ✓ Audio: ${audioPath} (${audioDurationSeconds.toFixed(1)}s)`)
  } catch (e) {
    console.log(`   ❌ TTS failed: ${(e as Error).message?.slice(0, 150)}`)
    return false
  }

  // Calculate frames per slide: distribute audio duration evenly
  const totalAudioFrames = Math.ceil(audioDurationSeconds * FPS)
  const framesPerSlide = Math.ceil(totalAudioFrames / grokSlides.length)

  // Build BlogVideoProps
  const slides: BlogSlide[] = grokSlides.map(s => ({
    heading: s.heading,
    subtext: s.subtext,
    voiceover: s.voiceover,
    imageUrl,
  }))

  const videoProps: BlogVideoProps = {
    slides,
    audioFile,
    title,
    category,
    framesPerSlide,
  }

  // Step 3: Render video
  const videoPath = path.join(VIDEO_DIR, `${slug}.mp4`)
  fs.mkdirSync(VIDEO_DIR, { recursive: true })

  const startTime = Date.now()
  try {
    await renderVideo(slug, videoProps, videoPath)
  } catch (e) {
    console.log(`   ❌ Render failed: ${(e as Error).message?.slice(0, 150)}`)
    return false
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`   ✅ Video saved: public/videos/${slug}.mp4 (${elapsed}s)`)
  return true
}

async function main() {
  console.log('🎬 Article → Video Pipeline\n')

  const allSlugs = getArticleSlugs()

  let toProcess: string[]
  if (targetSlug) {
    if (!allSlugs.includes(targetSlug)) {
      console.error(`❌ Article not found: ${targetSlug}`)
      process.exit(1)
    }
    toProcess = [targetSlug]
  } else {
    // All articles that don't have a video yet
    toProcess = allSlugs.filter(s => !hasVideo(s))
  }

  if (toProcess.length === 0) {
    console.log('✓ All articles already have videos.')
    process.exit(0)
  }

  console.log(`📋 ${toProcess.length} article(s) to process:\n`)
  toProcess.forEach(s => console.log(`   - ${s}`))

  if (dryRun) {
    console.log('\n🏁 Dry run — no videos generated.')
    process.exit(0)
  }

  let success = 0
  for (const slug of toProcess) {
    const ok = await processArticle(slug)
    if (ok) success++
  }

  console.log(`\n🎉 Done! ${success}/${toProcess.length} videos generated.`)
  console.log(`   📁 Videos: public/videos/`)
  console.log(`   🔊 Audio:  public/audio/`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

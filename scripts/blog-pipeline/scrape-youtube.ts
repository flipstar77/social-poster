/**
 * YouTube Transcript Scraper (CLI)
 *
 * Fetches transcripts from YouTube videos using yt-dlp and saves them
 * as premium knowledge sources in Supabase.
 *
 * Requirements: yt-dlp (pip install yt-dlp)
 *
 * Usage:
 *   npx tsx scripts/blog-pipeline/scrape-youtube.ts <video-url-or-id>
 *   npx tsx scripts/blog-pipeline/scrape-youtube.ts https://www.youtube.com/watch?v=abc123
 *   npx tsx scripts/blog-pipeline/scrape-youtube.ts abc123
 *   npx tsx scripts/blog-pipeline/scrape-youtube.ts --batch videos.txt  (one URL per line)
 */

import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { processVideo } from './youtube-utils'

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`Usage:
  npx tsx scripts/blog-pipeline/scrape-youtube.ts <video-url-or-id>
  npx tsx scripts/blog-pipeline/scrape-youtube.ts --batch <file.txt>

Examples:
  npx tsx scripts/blog-pipeline/scrape-youtube.ts https://www.youtube.com/watch?v=abc123
  npx tsx scripts/blog-pipeline/scrape-youtube.ts dQw4w9WgXcQ
  npx tsx scripts/blog-pipeline/scrape-youtube.ts --batch youtube-videos.txt`)
    process.exit(0)
  }

  let videos: string[] = []

  if (args[0] === '--batch' && args[1]) {
    const file = fs.readFileSync(args[1], 'utf-8')
    videos = file.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  } else {
    videos = args
  }

  console.log(`🎬 YouTube Transcript Scraper — ${videos.length} video(s)\n`)

  let saved = 0
  for (const video of videos) {
    const success = await processVideo(video)
    if (success) saved++
    if (videos.length > 1) await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`\n🎉 Done! ${saved}/${videos.length} videos processed and saved.`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

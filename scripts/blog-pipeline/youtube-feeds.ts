/**
 * YouTube RSS Feed Auto-Scraper
 *
 * Checks RSS feeds of configured YouTube channels for new videos,
 * scrapes transcripts, and saves them to Supabase.
 *
 * Designed to run as a GitHub Actions cron job (daily).
 *
 * Usage:
 *   npx tsx scripts/blog-pipeline/youtube-feeds.ts           # Check all channels
 *   npx tsx scripts/blog-pipeline/youtube-feeds.ts --max 5   # Limit to 5 new videos
 *   npx tsx scripts/blog-pipeline/youtube-feeds.ts --dry-run  # Check without processing
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabase, processVideo } from './youtube-utils'

const CHANNELS = [
  { handle: 'DISH.Digital' },
  { handle: 'KeywordsEvery' },
  { handle: 'RestaurantTechGuys' },
  { handle: 'owner-com' },
  { handle: 'mikeybausch' },
  { handle: 'Softtrix' },
  { handle: 'TobyDanylchuk' },
  { handle: 'mightysites' },
  { handle: 'GreenHatLocalSEO' },
]

async function resolveChannelId(handle: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
    const html = await res.text()

    // Extract channel ID from page HTML
    const match = html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/)
    if (match) return match[1]

    // Fallback: try meta tag
    const metaMatch = html.match(/<meta\s+itemprop="identifier"\s+content="(UC[a-zA-Z0-9_-]+)"/)
    if (metaMatch) return metaMatch[1]

    // Fallback: try canonical URL
    const canonicalMatch = html.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/)
    if (canonicalMatch) return canonicalMatch[1]

    return null
  } catch {
    return null
  }
}

interface FeedEntry {
  videoId: string
  title: string
  published: string
  channelHandle: string
}

async function fetchFeed(channelId: string, handle: string): Promise<FeedEntry[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)
    const xml = await res.text()

    const entries: FeedEntry[] = []
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    let match

    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1]
      const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
      const title = entry.match(/<title>([^<]+)<\/title>/)?.[1]
      const published = entry.match(/<published>([^<]+)<\/published>/)?.[1]

      if (videoId && title) {
        entries.push({ videoId, title, published: published || '', channelHandle: handle })
      }
    }

    return entries
  } catch (err) {
    console.log(`   ⚠️  Failed to fetch feed for @${handle}: ${(err as Error).message}`)
    return []
  }
}

async function getExistingUrls(): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from('scraped_articles')
    .select('url')
    .eq('source_id', 'youtube-transcripts')

  if (error) {
    console.log(`⚠️  Could not fetch existing URLs: ${error.message}`)
    return new Set()
  }

  return new Set((data || []).map(row => row.url))
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const maxIdx = args.indexOf('--max')
  const maxVideos = maxIdx !== -1 ? parseInt(args[maxIdx + 1]) || 10 : 10

  console.log(`📡 YouTube RSS Feed Checker`)
  console.log(`   Channels: ${CHANNELS.length}`)
  console.log(`   Max new videos: ${maxVideos}`)
  if (dryRun) console.log(`   🔍 DRY RUN — no videos will be processed\n`)
  else console.log()

  // Step 1: Resolve channel handles to IDs
  console.log('Resolving channel IDs...')
  const resolved: { handle: string; channelId: string }[] = []

  for (const ch of CHANNELS) {
    const channelId = await resolveChannelId(ch.handle)
    if (channelId) {
      resolved.push({ handle: ch.handle, channelId })
      console.log(`   ✅ @${ch.handle} → ${channelId}`)
    } else {
      console.log(`   ❌ @${ch.handle} — could not resolve`)
    }
  }

  // Step 2: Fetch RSS feeds
  console.log(`\nFetching RSS feeds...`)
  const allEntries: FeedEntry[] = []

  for (const ch of resolved) {
    const entries = await fetchFeed(ch.channelId, ch.handle)
    allEntries.push(...entries)
    console.log(`   @${ch.handle}: ${entries.length} videos in feed`)
  }

  console.log(`   Total: ${allEntries.length} videos across all feeds`)

  // Step 3: Filter out already-scraped videos
  const existingUrls = await getExistingUrls()
  const newEntries = allEntries.filter(
    e => !existingUrls.has(`https://www.youtube.com/watch?v=${e.videoId}`)
  )

  console.log(`   Already scraped: ${allEntries.length - newEntries.length}`)
  console.log(`   New videos: ${newEntries.length}`)

  if (newEntries.length === 0) {
    console.log('\n✅ No new videos to process. All up to date!')
    return
  }

  // Sort by publish date (newest first) and limit
  newEntries.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())
  const toProcess = newEntries.slice(0, maxVideos)

  if (dryRun) {
    console.log(`\n🔍 Would process ${toProcess.length} videos:`)
    for (const entry of toProcess) {
      console.log(`   - [${entry.channelHandle}] ${entry.title} (${entry.videoId})`)
    }
    return
  }

  // Step 4: Process new videos
  console.log(`\nProcessing ${toProcess.length} new videos...\n`)

  let saved = 0
  for (const entry of toProcess) {
    console.log(`--- @${entry.channelHandle} ---`)
    const success = await processVideo(entry.videoId)
    if (success) saved++
    await new Promise(r => setTimeout(r, 3000))
  }

  console.log(`\n🎉 Done! ${saved}/${toProcess.length} new videos processed and saved.`)
  console.log(`   Total in database: ${existingUrls.size + saved} transcripts`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

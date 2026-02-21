import { NextRequest, NextResponse } from 'next/server'

function pick(item: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') return item[key]
  }
  return undefined
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('runId')
  const datasetId = searchParams.get('datasetId')
  const token = process.env.APIFY_API_KEY

  const statusRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
  )
  const statusData = await statusRes.json()
  const runStatus: string = statusData.data?.status ?? 'UNKNOWN'

  if (runStatus === 'FAILED' || runStatus === 'ABORTED' || runStatus === 'TIMED-OUT') {
    return NextResponse.json({ status: runStatus })
  }
  if (runStatus !== 'SUCCEEDED') {
    return NextResponse.json({ status: runStatus })
  }

  const resultsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=300`
  )
  const items: Record<string, unknown>[] = await resultsRes.json()

  const seen = new Set<string>()
  const leads = []
  const hashtagFreq: Record<string, number> = {}

  for (const item of items) {
    const username = (pick(item, 'ownerUsername', 'username') as string | undefined)?.trim()
    if (!username || seen.has(username)) continue
    seen.add(username)

    const caption = (pick(item, 'caption') as string | undefined) ?? ''
    const shortCode = pick(item, 'shortCode', 'shortcode') as string | undefined

    leads.push({
      username,
      fullName: (pick(item, 'ownerFullName', 'fullName') as string | undefined) ?? '',
      caption: caption.slice(0, 600),
      likesCount: (pick(item, 'likesCount', 'likes') as number | undefined) ?? 0,
      commentsCount: (pick(item, 'commentsCount', 'comments') as number | undefined) ?? 0,
      postUrl: shortCode ? `https://instagram.com/p/${shortCode}` : '',
      postImageUrl: (pick(item, 'displayUrl', 'display_url', 'thumbnail_src') as string | undefined) ?? '',
      timestamp: (pick(item, 'timestamp', 'taken_at_timestamp') as string | undefined) ?? '',
      profileUrl: `https://instagram.com/${username}`,
    })

    // Collect hashtags from post for discovery
    const tags = item.hashtags as string[] | undefined
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (tag && typeof tag === 'string') {
          const t = tag.toLowerCase().replace(/^#/, '')
          hashtagFreq[t] = (hashtagFreq[t] ?? 0) + 1
        }
      }
    }
  }

  // Top 20 discovered hashtags (excluding the ones we already searched)
  const discoveredHashtags = Object.entries(hashtagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }))

  return NextResponse.json({ status: 'SUCCEEDED', leads, discoveredHashtags })
}

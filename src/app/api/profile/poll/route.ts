import { NextRequest, NextResponse } from 'next/server'

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

  if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(runStatus)) {
    return NextResponse.json({ status: runStatus })
  }
  if (runStatus !== 'SUCCEEDED') {
    return NextResponse.json({ status: runStatus })
  }

  const resultsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=9`
  )
  const items: Record<string, unknown>[] = await resultsRes.json()

  // Extract profile-level data from the first item (all posts are from same owner)
  const first = items[0] ?? {}

  function str(obj: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
      const v = obj[k]
      if (v && typeof v === 'string') return v
      // nested: e.g. owner.biography
      if (k.includes('.')) {
        const [a, b] = k.split('.')
        const nested = obj[a]
        if (nested && typeof nested === 'object') {
          const val = (nested as Record<string, unknown>)[b]
          if (val && typeof val === 'string') return val
        }
      }
    }
    return ''
  }

  function num(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
    for (const k of keys) {
      const v = obj[k]
      if (typeof v === 'number') return v
    }
    return undefined
  }

  const profileInfo = {
    biography: str(first, 'ownerBiography', 'biography', 'bio', 'owner.biography'),
    externalUrl: str(first, 'ownerExternalUrl', 'externalUrl', 'external_url', 'owner.external_url', 'bioLinks'),
    followersCount: num(first, 'ownerFollowersCount', 'followersCount', 'followers_count', 'edge_followed_by.count'),
    followingCount: num(first, 'ownerFollowingCount', 'followingCount'),
  }

  const posts = items.map(item => ({
    caption: (item.caption as string | undefined) ?? '',
    displayUrl: (item.displayUrl as string | undefined) ?? (item.display_url as string | undefined) ?? '',
    postUrl: item.shortCode ? `https://instagram.com/p/${item.shortCode}` : (item.url as string | undefined) ?? '',
    likesCount: (item.likesCount as number | undefined) ?? 0,
    commentsCount: (item.commentsCount as number | undefined) ?? 0,
    timestamp: (item.timestamp as string | undefined) ?? '',
  }))

  // Aggregate captions for Grok evaluation
  const captionSample = posts
    .map((p, i) => `Post ${i + 1}: "${p.caption.slice(0, 120) || '(keine Caption)'}"`)
    .join('\n')

  return NextResponse.json({ status: 'SUCCEEDED', posts, captionSample, profileInfo })
}

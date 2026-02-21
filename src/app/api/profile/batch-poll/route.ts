import { NextRequest, NextResponse } from 'next/server'

function pick(item: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const v = item[key]
    if (v !== undefined && v !== null && v !== '') return v
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

  if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(runStatus)) {
    return NextResponse.json({ status: runStatus })
  }
  if (runStatus !== 'SUCCEEDED') {
    return NextResponse.json({ status: runStatus })
  }

  const resultsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=500`
  )
  const items: Record<string, unknown>[] = await resultsRes.json()

  // Group posts by username — try multiple field name variants
  const postsByUser: Record<string, { caption: string; displayUrl: string; postUrl: string; likesCount: number; commentsCount: number; timestamp: string }[]> = {}
  const infoByUser: Record<string, { biography: string; externalUrl: string; followersCount?: number }> = {}

  for (const item of items) {
    const username = (pick(item, 'ownerUsername', 'username', 'owner_username') as string | undefined)?.trim()
    if (!username) continue

    if (!postsByUser[username]) {
      postsByUser[username] = []
      infoByUser[username] = {
        biography: (pick(item, 'ownerBiography', 'biography', 'bio') as string | undefined) ?? '',
        externalUrl: (pick(item, 'ownerExternalUrl', 'externalUrl', 'external_url', 'websiteUrl') as string | undefined) ?? '',
        followersCount: (pick(item, 'ownerFollowersCount', 'followersCount', 'followers_count', 'followedByCount') as number | undefined),
      }
    }

    const shortCode = pick(item, 'shortCode', 'shortcode') as string | undefined
    postsByUser[username].push({
      caption: (pick(item, 'caption') as string | undefined) ?? '',
      displayUrl: (pick(item, 'displayUrl', 'display_url', 'thumbnail_src') as string | undefined) ?? '',
      postUrl: shortCode ? `https://instagram.com/p/${shortCode}` : (pick(item, 'url') as string | undefined) ?? '',
      likesCount: (pick(item, 'likesCount', 'likes') as number | undefined) ?? 0,
      commentsCount: (pick(item, 'commentsCount', 'comments') as number | undefined) ?? 0,
      timestamp: (pick(item, 'timestamp', 'taken_at_timestamp') as string | undefined) ?? '',
    })
  }

  // Build caption samples for Grok re-evaluation
  const captionSamples: Record<string, string> = {}
  for (const [username, posts] of Object.entries(postsByUser)) {
    captionSamples[username] = posts
      .map((p, i) => `Post ${i + 1}: "${p.caption.slice(0, 120) || '(keine Caption)'}"`)
      .join('\n')
  }

  return NextResponse.json({
    status: 'SUCCEEDED',
    profiles: postsByUser,
    profileInfos: infoByUser,
    captionSamples,
    debug: { totalItems: items.length, usernamesFound: Object.keys(postsByUser).length },
  })
}

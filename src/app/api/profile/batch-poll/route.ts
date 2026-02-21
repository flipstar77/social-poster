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
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&limit=500`
  )
  const items: Record<string, unknown>[] = await resultsRes.json()

  // Group posts by username
  const postsByUser: Record<string, { caption: string; displayUrl: string; postUrl: string; likesCount: number; commentsCount: number; timestamp: string }[]> = {}
  const infoByUser: Record<string, { biography: string; externalUrl: string; followersCount?: number }> = {}

  for (const item of items) {
    const username = (item.ownerUsername as string | undefined)?.trim()
    if (!username) continue

    if (!postsByUser[username]) {
      postsByUser[username] = []
      infoByUser[username] = {
        biography: (item.ownerBiography as string | undefined) ?? '',
        externalUrl: (item.ownerExternalUrl as string | undefined) ?? '',
        followersCount: item.ownerFollowersCount as number | undefined,
      }
    }

    postsByUser[username].push({
      caption: (item.caption as string | undefined) ?? '',
      displayUrl: (item.displayUrl as string | undefined) ?? '',
      postUrl: item.shortCode ? `https://instagram.com/p/${item.shortCode}` : '',
      likesCount: (item.likesCount as number | undefined) ?? 0,
      commentsCount: (item.commentsCount as number | undefined) ?? 0,
      timestamp: (item.timestamp as string | undefined) ?? '',
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
  })
}

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { usernames, postsPerProfile = 6 } = await req.json()

  const directUrls = (usernames as string[]).map(u => `https://www.instagram.com/${u}/`)

  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-api-scraper/runs?token=${process.env.APIFY_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls,
        resultsType: 'posts',
        // Set high total limit; actor returns ~postsPerProfile per URL
        resultsLimit: usernames.length * postsPerProfile,
      }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({
    runId: data.data.id,
    datasetId: data.data.defaultDatasetId,
  })
}

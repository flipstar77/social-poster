import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { hashtags, limit = 25 } = await req.json()

  // instagram-hashtag-scraper expects hashtags WITHOUT # prefix
  const tagList = hashtags.map((tag: string) => tag.replace(/^#/, ''))

  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/runs?token=${process.env.APIFY_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hashtags: tagList,
        keywordSearch: false,
        resultsType: 'posts',
        resultsLimit: limit,
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

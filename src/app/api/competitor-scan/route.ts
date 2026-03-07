import { NextResponse } from 'next/server'

interface ScanRequest {
  handle: string
  businessType: string
  language: string
  platforms: string[]
}

interface ApifyPost {
  id: string
  caption: string
  likesCount: number
  commentsCount: number
  hashtags: string[]
  timestamp: string
  type: string
}

interface ApifyProfile {
  username: string
  fullName: string
  followersCount: number
  postsCount: number
  latestPosts: ApifyPost[]
}

async function scrapeProfileDirect(username: string, maxPosts: number): Promise<ApifyProfile | null> {
  const token = process.env.APIFY_API_KEY

  // Start the actor run via Apify REST API
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/runs?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [username],
        resultsLimit: maxPosts,
      }),
    }
  )

  if (!startRes.ok) {
    console.error('[CompetitorScan] Apify start failed:', await startRes.text())
    return null
  }

  const runData = await startRes.json()
  const runId = runData.data?.id
  if (!runId) return null

  // Wait for the run to finish (poll every 3s, max 90s)
  const deadline = Date.now() + 90_000
  let status = runData.data?.status
  while (status !== 'SUCCEEDED' && status !== 'FAILED' && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000))
    const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`)
    const pollData = await pollRes.json()
    status = pollData.data?.status
  }

  if (status !== 'SUCCEEDED') {
    console.error('[CompetitorScan] Apify run did not succeed:', status)
    return null
  }

  // Fetch dataset items
  const datasetId = runData.data?.defaultDatasetId
  const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}`)
  const items = await itemsRes.json()

  if (!Array.isArray(items) || items.length === 0) return null
  return items[0] as ApifyProfile
}

export async function POST(request: Request) {
  const body: ScanRequest = await request.json()
  const { handle, businessType, language, platforms } = body

  const apiKey = process.env.XAI_API_KEY
  const apifyKey = process.env.APIFY_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'XAI API key not configured' }, { status: 500 })
  if (!apifyKey) return NextResponse.json({ error: 'Apify API key not configured' }, { status: 500 })

  const username = handle.replace(/^@/, '').trim()
  if (!username) return NextResponse.json({ error: 'Handle required' }, { status: 400 })

  try {
    // Step 1: Scrape competitor profile
    const profile = await scrapeProfileDirect(username, 30)
    if (!profile) {
      return NextResponse.json({ error: `Profile @${username} not found` }, { status: 404 })
    }

    // Step 2: Analyze top posts
    const posts = profile.latestPosts || []
    const sortedByLikes = [...posts].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
    const topPosts = sortedByLikes.slice(0, 10)

    const avgLikes = posts.length > 0
      ? Math.round(posts.reduce((s, p) => s + (p.likesCount || 0), 0) / posts.length)
      : 0
    const avgComments = posts.length > 0
      ? Math.round(posts.reduce((s, p) => s + (p.commentsCount || 0), 0) / posts.length)
      : 0

    // Extract hooks (first lines of top captions)
    const topHooks = topPosts
      .map(p => p.caption?.split('\n')[0] || '')
      .filter(h => h.length > 5)
      .slice(0, 5)

    // Extract common hashtags
    const hashtagCounts = new Map<string, number>()
    for (const p of posts) {
      for (const tag of (p.hashtags || [])) {
        hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1)
      }
    }
    const topHashtags = Array.from(hashtagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag]) => tag)

    // Posting time analysis
    const hourCounts = new Map<number, number>()
    for (const p of posts) {
      if (p.timestamp) {
        const hour = new Date(p.timestamp).getHours()
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
      }
    }
    const bestHours = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h]) => `${h}:00`)

    // Content type distribution
    const typeCounts = new Map<string, number>()
    for (const p of posts) {
      const t = p.type || 'Image'
      typeCounts.set(t, (typeCounts.get(t) || 0) + 1)
    }
    const contentMix = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count, pct: Math.round((count / posts.length) * 100) }))

    // Step 3: Generate content ideas based on competitor analysis
    const analysisBlock = `COMPETITOR-ANALYSE von @${username}:
- ${profile.followersCount?.toLocaleString()} Follower, ${posts.length} analysierte Posts
- Durchschnittlich ${avgLikes} Likes, ${avgComments} Kommentare pro Post
- Top Hashtags: ${topHashtags.slice(0, 8).map(t => '#' + t).join(' ')}
- Beste Posting-Zeiten: ${bestHours.join(', ')}
- Content-Mix: ${contentMix.map(c => `${c.type} ${c.pct}%`).join(', ')}
- Top Hooks der erfolgreichsten Posts:
${topHooks.map((h, i) => `  ${i + 1}. "${h}"`).join('\n')}`

    const systemPrompt = `Du bist ein Social-Media-Stratege fuer ${businessType || 'Restaurants'}.
Basierend auf der Competitor-Analyse, erstelle 5 Content-Ideen fuer den Nutzer.

${analysisBlock}

REGELN:
- Jede Idee soll vom Stil des Competitors INSPIRIERT sein, aber NICHT kopiert
- Verwende aehnliche Hook-Strategien, die beim Competitor funktionieren
- Passe an die Plattformen an: ${platforms.join(', ')}
- Sprache: ${language || 'Deutsch'}
- Jede Idee braucht: Hook, Caption-Vorschlag, Hashtags, und einen Tipp warum das funktioniert

Gib NUR gueltiges JSON zurueck:
{"ideas": [{"hook": "...", "caption": "...", "hashtags": ["..."], "category": "Storytelling / Emotion | Wissen / Mehrwert | Community / FOMO | Behind the Scenes | Produkt-Highlight", "platform": "...", "whyItWorks": "..."}]}`

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Erstelle 5 Content-Ideen inspiriert von @${username}.` },
        ],
        temperature: 0.8,
      }),
    })

    if (!res.ok) {
      console.error('[CompetitorScan] Grok error:', await res.text())
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      profile: {
        username: profile.username,
        fullName: profile.fullName,
        followers: profile.followersCount,
        posts: profile.postsCount,
      },
      analysis: {
        avgLikes,
        avgComments,
        topHashtags,
        bestHours,
        contentMix,
        topHooks,
        postsAnalyzed: posts.length,
      },
      ideas: parsed.ideas || [],
    })
  } catch (err) {
    console.error('[CompetitorScan] Error:', err)
    return NextResponse.json({ error: 'Competitor scan failed' }, { status: 500 })
  }
}

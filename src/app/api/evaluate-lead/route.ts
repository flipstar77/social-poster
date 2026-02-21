import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { username, fullName, caption, likesCount, commentsCount, captionSample } = await req.json()

  // captionSample = aggregated captions from profile deep-dive (optional, more accurate)
  const captionContext = captionSample
    ? `Letzte Posts:\n${captionSample}`
    : `Letzter Post: "${caption || '(keine Caption vorhanden)'}"`

  const prompt = `Du bist Outreach-Spezialist für ein Social-Media-Automatisierungstool für Restaurants.

Bewerte diesen Instagram-Account. Lohnt sich eine Kontaktaufnahme?

Account: @${username}${fullName ? ` (${fullName})` : ''}
Likes (letzter Post): ${likesCount} | Kommentare: ${commentsCount}

${captionContext}

Hoher Score (7-10) wenn:
- Captions kurz, generisch, nur Emojis, oder gar keine Captions
- Erkennbar kleines lokales Restaurant / Café / Bar
- Wenige Likes (unter 200) = kleines lokales Business

Niedriger Score (1-4) wenn:
- Bereits professionelle, lange, engagierte Captions
- Food-Blogger oder Influencer (kein echtes Lokal)
- Große Kette oder bereits professionell betreut

Antworte NUR als JSON ohne Markdown:
{"score":8,"reason":"Kurze Captions, typisches kleines Restaurant.","recommendation":"Kontaktieren"}`

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-4-1-fast-non-reasoning',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        stream: false,
      }),
    })

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content ?? '{}'
    const clean = raw.replace(/```json\s*|\s*```/g, '').trim()
    const evaluation = JSON.parse(clean)
    return NextResponse.json(evaluation)
  } catch {
    return NextResponse.json({
      score: 5,
      reason: 'Bewertung fehlgeschlagen.',
      recommendation: 'Manuell prüfen',
    })
  }
}

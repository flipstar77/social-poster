import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { username, fullName, bio, captionSample, reason, score, followersCount } = await req.json()

  const restaurantName = fullName || `@${username}`

  const prompt = `Du bist ein Sales-Experte und schreibst Instagram-DMs für ein Social-Media-Automatisierungstool, das sich an Restaurants in Frankfurt richtet.

Schreib eine kurze, persönliche Instagram-DM auf Deutsch für dieses Restaurant:

Profil: @${username}${fullName ? ` (${fullName})` : ''}
Follower: ${followersCount ? followersCount.toLocaleString('de') : 'unbekannt'}
Bio: ${bio || '(keine Bio verfügbar)'}
${captionSample ? `\nAktuelle Posts:\n${captionSample}` : ''}
${reason ? `\nAnalyse: ${reason} (Score: ${score}/10)` : ''}

Regeln für die Nachricht:
- Exakt 3-4 Sätze, nicht mehr
- Erwähne etwas Konkretes aus ihrer Bio oder einem Post (zeige dass du wirklich hingeschaut hast)
- Erkläre in 1 Satz den Nutzen: Instagram-Posts laufen automatisch – Bild hochladen, Caption fertig, fertig gepostet
- Betone die Zeit die sie sparen (täglich posten ohne Aufwand)
- Schließe mit einer einfachen Frage ab ob sie das 5 Minuten sehen möchten
- Schreibe natürlich und menschlich, kein Marketing-Sprech
- Beginne mit "Hey ${restaurantName},"

Antworte NUR mit der fertigen Nachricht, ohne Anführungszeichen oder Erklärungen.`

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
        max_tokens: 250,
        temperature: 0.8,
      }),
    })
    const data = await res.json()
    const icebreaker = data.choices?.[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ icebreaker })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { originalCaption, originalPlatform, targetPlatform, businessType, language, tone } = await request.json()

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const systemPrompt = `Du bist ein Social-Media-Recycling-Experte fuer ${businessType || 'Restaurants'} im DACH-Raum.
Deine Aufgabe: Erstelle 3 neue Varianten aus einem bestehenden Post.

REGELN:
- Sprache: ${language || 'Deutsch'}
- Ton: ${tone || 'freundlich und einladend'}
- Zielplattform: ${targetPlatform || originalPlatform}
- NICHT den Original-Text wiederholen — neuer Angle, neuer Hook, andere Perspektive
- Jede Variante nutzt eine andere Strategie:
  1. NEUER HOOK: Gleiche Botschaft, komplett anderer Einstieg
  2. ANDERER ANGLE: Thema von anderer Seite beleuchten (z.B. Kundenperspektive statt Kochperspektive)
  3. NEUES FORMAT: z.B. aus Story wird Tipp-Post, aus Tipp wird Frage, aus Frage wird Challenge
- 15-25 Hashtags pro Variante

Gib NUR gueltiges JSON zurueck:
{"variants": [{"caption": "...", "hashtags": ["tag1", "tag2"], "category": "Neuer Hook"}, {"caption": "...", "hashtags": [...], "category": "Anderer Angle"}, {"caption": "...", "hashtags": [...], "category": "Neues Format"}]}`

  const userPrompt = `Original-Post (${originalPlatform}):
---
${originalCaption}
---

Erstelle 3 recycelte Varianten fuer ${targetPlatform || originalPlatform}.`

  try {
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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.85,
      }),
    })

    if (!res.ok) {
      console.error('[Recycle] Grok error:', await res.text())
      return NextResponse.json({ error: 'Recycling failed' }, { status: 500 })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ variants: parsed.variants || [] })
  } catch (err) {
    console.error('[Recycle] Error:', err)
    return NextResponse.json({ error: 'Recycling failed' }, { status: 500 })
  }
}

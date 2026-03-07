import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { description, businessType, platform, language, tone } = await request.json()

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const systemPrompt = `Du bist ein Social-Media-Hook-Experte fuer ${businessType || 'Restaurants'} im DACH-Raum.
Deine Aufgabe: Generiere 8 verschiedene Hooks (erste Zeile eines Posts) fuer ${platform || 'Instagram'}.

HOOK-REGELN:
- Sprache: ${language || 'Deutsch'}
- Ton: ${tone || 'freundlich und einladend'}
- Jeder Hook ist EIN Satz, maximal 15 Woerter
- Der Hook muss den Feed-Scroll sofort stoppen
- KEINE Floskeln, KEIN "Wir freuen uns..."
- Jeder Hook nutzt eine andere Strategie

HOOK-STRATEGIEN (nutze alle 8):
1. STORYTELLING: "Manche Gerichte schmecken nach Heimat."
2. FRAGE: "Wusstest du, warum echter Sauerteig 48h braucht?"
3. KONTROVERS: "Die meisten Restaurants machen diesen Fehler."
4. POV: "POV: Dein erster Biss von unserer Pizza."
5. STATISTIK: "93% unserer Gaeste bestellen dieses Gericht nochmal."
6. GEHEIMNIS: "Das verraet dir kein Koch."
7. DRINGLICHKEIT: "Nur noch diese Woche auf der Karte."
8. EMOTION: "Dieses Gericht hat unseren Koch zum Weinen gebracht."

Gib NUR gueltiges JSON zurueck:
{"hooks": [{"text": "...", "strategy": "storytelling"}, {"text": "...", "strategy": "frage"}, ...]}`

  const userPrompt = `Plattform: ${platform || 'Instagram'}
Foto-Beschreibung: ${description || 'ein Foto des Restaurants'}

Generiere 8 verschiedene Hooks.`

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
        temperature: 0.9,
      }),
    })

    if (!res.ok) {
      console.error('[Hooks] Grok error:', await res.text())
      return NextResponse.json({ error: 'Hook generation failed' }, { status: 500 })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid AI response', raw: content }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({ hooks: parsed.hooks || [] })
  } catch (err) {
    console.error('[Hooks] Error:', err)
    return NextResponse.json({ error: 'Hook generation failed' }, { status: 500 })
  }
}

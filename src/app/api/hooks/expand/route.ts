import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { hook, description, businessType, platform, language, tone, whatsappNumber } = await request.json()

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const whatsappCTA = whatsappNumber
    ? (['instagram', 'tiktok'].includes(platform?.toLowerCase())
        ? `Fuege am Ende einen WhatsApp-CTA ein: "Schreib uns auf WhatsApp: ${whatsappNumber}"`
        : `Fuege einen klickbaren WhatsApp-Link ein: https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`)
    : ''

  const systemPrompt = `Du bist ein Social-Media-Experte fuer ${businessType || 'Restaurants'} im DACH-Raum.
Deine Aufgabe: Erstelle eine vollstaendige Caption aus dem gegebenen Hook.

REGELN:
- Sprache: ${language || 'Deutsch'}
- Ton: ${tone || 'freundlich und einladend'}
- Plattform: ${platform || 'Instagram'}
- Der Hook ist die erste Zeile — NICHT aendern, exakt uebernehmen
- 2-4 Saetze Body nach dem Hook
- 1 CTA am Ende
${whatsappCTA ? `- ${whatsappCTA}` : ''}
- 15-25 relevante Hashtags

Gib NUR gueltiges JSON zurueck:
{"caption": "...", "hashtags": ["tag1", "tag2"], "category": "..."}`

  const userPrompt = `Hook (erste Zeile, nicht aendern): ${hook}
Foto-Beschreibung: ${description || 'ein Foto des Restaurants'}

Baue daraus eine vollstaendige Caption mit Hashtags.`

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
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      console.error('[HookExpand] Grok error:', await res.text())
      return NextResponse.json({ error: 'Caption expansion failed' }, { status: 500 })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({
      caption: parsed.caption || '',
      hashtags: parsed.hashtags || [],
      category: parsed.category || '',
    })
  } catch (err) {
    console.error('[HookExpand] Error:', err)
    return NextResponse.json({ error: 'Expansion failed' }, { status: 500 })
  }
}

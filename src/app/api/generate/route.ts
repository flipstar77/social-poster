import { NextResponse } from 'next/server'
import { getPlatformPrompt } from '@/lib/platform-prompts'

export async function POST(request: Request) {
  const { description, businessType, tone, platform, exampleCaptions, language, whatsappNumber, contentDNA } = await request.json()

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const exampleBlock = exampleCaptions
    ? `\n\nBeispiel-Captions des Nutzers — passe deinen Stil, Ton und Struktur daran an:\n---\n${exampleCaptions}\n---\n`
    : ''

  const whatsappCTA = whatsappNumber
    ? (['instagram', 'tiktok'].includes(platform?.toLowerCase())
        ? `Füge am Ende jeder Caption (vor den Hashtags) einen WhatsApp-CTA ein, z.B. "Schreib uns auf WhatsApp: ${whatsappNumber}" (kein Link, nur Nummer)`
        : `Füge einen klickbaren WhatsApp-Link ein: https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')} mit CTA wie "Reserviere per WhatsApp"`)
    : ''

  const dnaBlock = contentDNA ? `\n${contentDNA}\n` : ''

  const platformConfig = getPlatformPrompt(platform)
  const systemPrompt = platformConfig.systemPrompt({ businessType, language, whatsappCTA, exampleBlock }) + dnaBlock

  const userPrompt = `Plattform: ${platform || 'Instagram'}
Ton-Präferenz: ${tone || 'freundlich und einladend'}
Beschreibung des Fotos / Inhalts: ${description}

Erstelle 3 Caption-Varianten (eine pro Content-Strategie) mit Hashtags.`

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
        temperature: 0.8,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Generate] Grok error:', err)
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid AI response', raw: content }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Normalize: if old single-caption format, wrap in variants array
    if (parsed.variants && Array.isArray(parsed.variants)) {
      return NextResponse.json({ variants: parsed.variants })
    }
    return NextResponse.json({ variants: [{ caption: parsed.caption, hashtags: parsed.hashtags }] })
  } catch (err) {
    console.error('[Generate] Error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

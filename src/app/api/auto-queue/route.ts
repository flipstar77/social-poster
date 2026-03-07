import { NextResponse } from 'next/server'
import { buildAutoQueuePrompt } from '@/lib/auto-queue'

interface QueueRequest {
  photos: { description: string }[]
  platforms: { id: string; bestTime: string }[]
  businessType: string
  tone: string
  language: string
  whatsappNumber?: string
  exampleCaptions?: string
}

interface GeneratedCaption {
  photoIndex: number
  platform: string
  caption: string
  hashtags: string[]
  category: string
}

// Content angles to generate per photo-platform pair
const ANGLES = [
  'Storytelling / Emotion',
  'Community / FOMO',
] as const

export async function POST(request: Request) {
  const body: QueueRequest = await request.json()
  const { photos, platforms, businessType, tone, language, whatsappNumber, exampleCaptions } = body

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const whatsappCTA = whatsappNumber
    ? `Fuege einen WhatsApp-CTA ein: ${whatsappNumber}`
    : ''

  const exampleBlock = exampleCaptions
    ? `\nBeispiel-Captions des Nutzers:\n---\n${exampleCaptions}\n---\n`
    : ''

  // Generate captions for each photo x platform x angle combination
  const tasks: Promise<GeneratedCaption | null>[] = []

  for (let pi = 0; pi < photos.length; pi++) {
    for (const plat of platforms) {
      // Pick 2 angles per photo-platform combo
      for (const angle of ANGLES) {
        tasks.push(
          generateSingleCaption({
            apiKey,
            photoDescription: photos[pi].description || 'ein Foto des Restaurants',
            platform: plat.id,
            angle: angle as any,
            businessType,
            tone,
            language,
            whatsappCTA,
            exampleBlock,
          }).then(result => result ? { ...result, photoIndex: pi, platform: plat.id } : null)
        )
      }
    }
  }

  try {
    const results = await Promise.all(tasks)
    const captions = results.filter((r): r is GeneratedCaption => r !== null)

    return NextResponse.json({ captions })
  } catch (err) {
    console.error('[AutoQueue] Error:', err)
    return NextResponse.json({ error: 'Auto-queue generation failed' }, { status: 500 })
  }
}

async function generateSingleCaption(opts: {
  apiKey: string
  photoDescription: string
  platform: string
  angle: string
  businessType: string
  tone: string
  language: string
  whatsappCTA: string
  exampleBlock: string
}): Promise<{ caption: string; hashtags: string[]; category: string } | null> {
  const { system } = buildAutoQueuePrompt({
    businessType: opts.businessType,
    language: opts.language,
    platform: opts.platform,
    angle: opts.angle as any,
    whatsappCTA: opts.whatsappCTA,
    exampleBlock: opts.exampleBlock,
  })

  const userPrompt = `Plattform: ${opts.platform}
Ton: ${opts.tone || 'freundlich und einladend'}
Content-Angle: ${opts.angle}
Foto-Beschreibung: ${opts.photoDescription}

Erstelle EINE Caption mit Hashtags.`

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
      }),
    })

    if (!res.ok) {
      console.error('[AutoQueue] Grok error:', await res.text())
      return null
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    return {
      caption: parsed.caption || '',
      hashtags: parsed.hashtags || [],
      category: parsed.category || opts.angle,
    }
  } catch (err) {
    console.error('[AutoQueue] Single generation failed:', err)
    return null
  }
}

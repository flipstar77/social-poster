import { NextResponse } from 'next/server'
import { getTinaPrompt, type TinaCaptionOpts } from '@/lib/tina/prompts'

export async function POST(request: Request) {
  const { imageDescription, category, platform, mood } = await request.json() as {
    imageDescription: string
    category: string
    platform: 'instagram' | 'facebook'
    mood?: string
  }

  if (!imageDescription || !category || !platform) {
    return NextResponse.json(
      { error: 'Missing required fields: imageDescription, category, platform' },
      { status: 400 }
    )
  }

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'XAI_API_KEY not configured' }, { status: 500 })
  }

  const opts: TinaCaptionOpts = { imageDescription, category, platform, mood }
  const systemPrompt = getTinaPrompt(opts)

  const userPrompt = `Image description: ${imageDescription}
Category: ${category}
${mood ? `Mood: ${mood}` : ''}

Create 3 caption variants as Tina "Thunder" for ${platform === 'facebook' ? 'Facebook' : 'Instagram'}. Write in English.`

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
      const err = await res.text()
      console.error('[Tina Generate] Grok error:', err)
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid AI response', raw: content }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])

    if (parsed.variants && Array.isArray(parsed.variants)) {
      return NextResponse.json({ variants: parsed.variants })
    }
    return NextResponse.json({ variants: [{ caption: parsed.caption, hashtags: parsed.hashtags }] })
  } catch (err) {
    console.error('[Tina Generate] Error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

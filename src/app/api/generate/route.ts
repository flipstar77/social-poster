import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { description, businessType, tone, platform, exampleCaptions } = await request.json()

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const exampleBlock = exampleCaptions
    ? `\n\nHere are example captions the user likes — match this writing style, voice, and structure closely:\n---\n${exampleCaptions}\n---\n`
    : ''

  const systemPrompt = `You are a social media expert for a ${businessType || 'small business'}.
Generate engaging social media captions and hashtags.

Rules:
- Write the caption in the language that matches the business description (if German business, write German; if English, write English)
- Keep it authentic, warm, and engaging
- For Instagram: up to 2200 chars, 20-30 relevant hashtags
- For TikTok: shorter, punchier, 5-10 trending hashtags
- Include emojis naturally
- Add a call-to-action when appropriate
- Match the requested tone${exampleBlock}

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{"variants": [{"caption": "caption 1", "hashtags": ["tag1", "tag2"]}, {"caption": "caption 2", "hashtags": ["tag1", "tag2"]}, {"caption": "caption 3", "hashtags": ["tag1", "tag2"]}]}
`

  const userPrompt = `Platform: ${platform || 'Instagram'}
Tone: ${tone || 'friendly and inviting'}
Photo/content description: ${description}

Generate 3 different caption variants with hashtags for this post. Each should have a distinct style/angle.`

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

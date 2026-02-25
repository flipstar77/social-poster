import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are the FlowingPost FAQ assistant. Answer questions about FlowingPost concisely (2-4 sentences max). Be friendly and helpful.

If the question is not about FlowingPost or social media scheduling, politely redirect: "Ich kann nur Fragen zu FlowingPost beantworten." / "I can only answer questions about FlowingPost."

=== FLOWINGPOST KNOWLEDGE BASE ===

WHAT IS FLOWINGPOST:
FlowingPost is an AI-powered social media scheduling tool for restaurants, cafes, bars, bakeries, and food businesses. Upload a photo, the AI writes 3 caption variants in your tone and language, and the Auto-Scheduler posts to up to 9 platforms. Saves 2-3 hours per week.

HOW IT WORKS:
1. Upload a photo
2. AI generates 3 caption variants — pick your favorite
3. Auto-Scheduler handles when and where to post
Setup takes less than 24 hours. No technical knowledge required.

SUPPORTED PLATFORMS (9):
Instagram, TikTok, Facebook, LinkedIn, X (Twitter), YouTube, Threads, Pinterest, Bluesky

PRICING (cancel anytime):
- Starter: €39/month (yearly €390) — 3 platforms, unlimited posts, AI captions, Auto-Scheduler, email support
- Growth: €79/month (yearly €790) — 6 platforms, 3 caption variants, priority support. MOST POPULAR.
- Pro: €149/month (yearly €1,490) — All 9 platforms, Telegram Bot (post via voice), dedicated account manager

LAUNCH OFFER: First 50 customers pay no setup fee (normally €99).

VS COMPETITORS:
- Social media agencies: €500-2,000/month. FlowingPost starts at €39.
- Later, Hootsuite, Buffer: require manual planning, AI only in English, more expensive.
- FlowingPost is the only tool with AI captions in ANY language and a fully automatic scheduler.

LANGUAGES: AI writes captions in any language. Interface in German and English.

SECURITY: Uses only official, verified APIs. No scraping, no bots. Accounts 100% protected.

CONTACT: hello@flowingpost.com`

export async function POST(request: Request) {
  const { question, locale } = await request.json()

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'Question required' }, { status: 400 })
  }

  const langInstruction = locale === 'en'
    ? 'Always answer in English.'
    : 'Antworte immer auf Deutsch.'

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-4-1-fast-non-reasoning',
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\n${langInstruction}` },
          { role: 'user', content: question },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[VoiceFAQ] Grok error:', err)
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
    }

    const data = await res.json()
    const answer = data.choices?.[0]?.message?.content?.trim() ?? ''

    return NextResponse.json({ answer })
  } catch (err) {
    console.error('[VoiceFAQ] Error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

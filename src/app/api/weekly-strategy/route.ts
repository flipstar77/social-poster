import { NextResponse } from 'next/server'

interface StrategyRequest {
  platforms: string[]
  businessType: string
  language: string
  postsPerWeek: number
  preferences?: Record<string, { likes: number; skips: number; superLikes: number }>
  recentCategories?: string[]
}

export async function POST(request: Request) {
  const body: StrategyRequest = await request.json()
  const { platforms, businessType, language, postsPerWeek, preferences, recentCategories } = body

  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  // Build preference context
  let prefContext = ''
  if (preferences && Object.keys(preferences).length > 0) {
    const entries = Object.entries(preferences)
      .filter(([, v]) => v.likes + v.skips >= 2)
      .map(([key, v]) => {
        const score = Math.round((v.likes / (v.likes + v.skips)) * 100)
        const superNote = v.superLikes > 0 ? ` (${v.superLikes} Super Likes!)` : ''
        return `- ${key}: ${score}% Akzeptanzrate${superNote}`
      })
    if (entries.length > 0) {
      prefContext = `\nNUTZER-PRAEFERENZEN (aus Swipe-Daten):\n${entries.join('\n')}\n`
    }
  }

  // Build balance context
  let balanceContext = ''
  if (recentCategories && recentCategories.length > 0) {
    const counts = new Map<string, number>()
    for (const cat of recentCategories) {
      counts.set(cat, (counts.get(cat) || 0) + 1)
    }
    const total = recentCategories.length
    balanceContext = `\nLETZTE POSTS (Content-Mix):\n${
      Array.from(counts.entries())
        .map(([cat, count]) => `- ${cat}: ${count}x (${Math.round((count / total) * 100)}%)`)
        .join('\n')
    }\nACHTUNG: Unterrepresentierte Kategorien bevorzugen fuer bessere Balance!\n`
  }

  const systemPrompt = `Du bist ein Social-Media-Stratege fuer ${businessType || 'Restaurants'} im DACH-Raum.
Erstelle einen optimalen Wochenplan fuer Social Media.

KONTEXT:
- Plattformen: ${platforms.join(', ')}
- Posts pro Woche: ${postsPerWeek}
- Sprache: ${language || 'Deutsch'}
${prefContext}${balanceContext}
REGELN:
- Verteile Posts gleichmaessig ueber die Woche (nicht alles am Montag)
- Variiere Content-Kategorien: Storytelling, Wissen/Mehrwert, Community/FOMO, Behind the Scenes, Produkt-Highlight
- Plattformen rotieren (nicht jeden Tag dieselbe)
- Beruecksichtige Best Posting Times: Instagram 11:00, TikTok 18:00, Facebook 12:00, LinkedIn 09:00
- Nutze Praeferenzen: Kategorien mit hoher Akzeptanzrate oefter einsetzen
- Nutze Super-Like-Daten: Diese Styles besonders stark gewichten
- Balance: Unterrepresentierte Kategorien gezielt einbauen

WOCHENTAGE: Montag bis Sonntag (0=Mo, 1=Di, 2=Mi, 3=Do, 4=Fr, 5=Sa, 6=So)

Gib NUR gueltiges JSON zurueck:
{"strategy": [{"day": 0, "platform": "instagram", "category": "Storytelling / Emotion", "time": "11:00", "tip": "Kurze Geschichte zum Wochenstart"}, ...],"weeklyTip": "Ein uebergeordneter Tipp fuer die Woche"}`

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
          { role: 'user', content: `Erstelle einen Wochenplan mit ${postsPerWeek} Posts fuer ${platforms.join(', ')}.` },
        ],
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      console.error('[WeeklyStrategy] Grok error:', await res.text())
      return NextResponse.json({ error: 'Strategy generation failed' }, { status: 500 })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({
      strategy: parsed.strategy || [],
      weeklyTip: parsed.weeklyTip || '',
    })
  } catch (err) {
    console.error('[WeeklyStrategy] Error:', err)
    return NextResponse.json({ error: 'Strategy generation failed' }, { status: 500 })
  }
}

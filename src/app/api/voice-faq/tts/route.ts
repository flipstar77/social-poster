import { NextResponse } from 'next/server'

const VOICES: Record<string, string> = {
  de: 'de-DE-KatjaNeural',
  en: 'en-US-EmmaMultilingualNeural',
}

export async function POST(request: Request) {
  try {
    const { text, locale = 'de' } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text required' }, { status: 400 })
    }

    if (text.length > 2000) {
      return NextResponse.json({ error: 'Text too long (max 2000 chars)' }, { status: 400 })
    }

    const voice = VOICES[locale] || VOICES.de

    // Dynamic import to avoid issues with edge-tts-universal in build
    const { EdgeTTS } = await import('edge-tts-universal')
    const tts = new EdgeTTS(text.trim(), voice)
    const result = await tts.synthesize()
    const audioBuffer = Buffer.from(await result.audio.arrayBuffer())

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.length),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[VoiceFAQ TTS] Error:', err)
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
  }
}

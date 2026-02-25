/**
 * Shared YouTube transcript utilities.
 * Used by scrape-youtube.ts (CLI) and youtube-feeds.ts (RSS auto-scraper).
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

let _supabase: ReturnType<typeof createClient>
let _xai: OpenAI

export function getSupabase() {
  if (!_supabase) _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  return _supabase
}

export function getXai() {
  if (!_xai) _xai = new OpenAI({ apiKey: process.env.XAI_API_KEY!, baseURL: 'https://api.x.ai/v1' })
  return _xai
}

export function extractVideoId(input: string): string {
  const urlMatch = input.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input
  throw new Error(`Could not extract video ID from: ${input}`)
}

export function parseVtt(vtt: string): string {
  const lines = vtt.split('\n')
  const textLines: string[] = []
  let lastLine = ''

  for (const line of lines) {
    if (line.startsWith('WEBVTT') || line.startsWith('Kind:') || line.startsWith('Language:')) continue
    if (/^\d{2}:\d{2}/.test(line)) continue
    if (line.includes('-->')) continue
    if (line.trim() === '') continue

    const cleaned = line
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
      .replace(/<\/?c>/g, '')
      .replace(/<[^>]*>/g, '')
      .trim()

    if (!cleaned) continue

    if (cleaned !== lastLine) {
      textLines.push(cleaned)
      lastLine = cleaned
    }
  }

  return textLines
    .join(' ')
    .replace(/\[Music\]/gi, '')
    .replace(/\[Applause\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Try youtube-transcript-api (Python) first — works from server/CI IPs.
 * Falls back to yt-dlp for local usage.
 */
export async function fetchTranscript(videoId: string): Promise<{ text: string; lang: string }> {
  // Method 1: youtube-transcript-api (works from CI/datacenter IPs)
  for (const lang of ['en', 'de']) {
    try {
      const result = execSync(
        `python -c "from youtube_transcript_api import YouTubeTranscriptApi; import json; t = YouTubeTranscriptApi.get_transcript('${videoId}', languages=['${lang}']); print(json.dumps([s['text'] for s in t]))"`,
        { timeout: 30000, stdio: 'pipe' }
      ).toString().trim()

      const segments: string[] = JSON.parse(result)
      const text = segments
        .join(' ')
        .replace(/\[Music\]/gi, '')
        .replace(/\[Applause\]/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()

      if (text.length > 100) return { text, lang }
    } catch (err) {
      const msg = (err as { stderr?: Buffer })?.stderr?.toString()?.slice(0, 200) || (err as Error).message?.slice(0, 200)
      console.log(`      [transcript-api/${lang}] ${msg}`)
    }
  }

  // Method 2: yt-dlp (works locally, blocked on datacenter IPs)
  const tmpDir = os.tmpdir()
  const outTemplate = path.join(tmpDir, `yt-transcript-${videoId}`)

  for (const lang of ['en', 'de']) {
    try {
      const vttPath = `${outTemplate}.${lang}.vtt`
      if (fs.existsSync(vttPath)) fs.unlinkSync(vttPath)

      execSync(
        `python -m yt_dlp --write-auto-sub --sub-lang ${lang} --skip-download --sub-format vtt -o "${outTemplate}" "https://www.youtube.com/watch?v=${videoId}"`,
        { timeout: 30000, stdio: 'pipe' }
      )

      if (fs.existsSync(vttPath)) {
        const vtt = fs.readFileSync(vttPath, 'utf-8')
        fs.unlinkSync(vttPath)
        const text = parseVtt(vtt)
        if (text.length > 100) return { text, lang }
      }
    } catch (err) {
      const msg = (err as { stderr?: Buffer })?.stderr?.toString()?.slice(0, 200) || (err as Error).message?.slice(0, 200)
      console.log(`      [yt-dlp/${lang}] ${msg}`)
    }
  }

  throw new Error('No transcript available for this video')
}

export async function summarizeTranscript(transcript: string, videoTitle: string): Promise<string> {
  const response = await getXai().chat.completions.create({
    model: 'grok-4-1-fast-non-reasoning',
    messages: [
      {
        role: 'system',
        content: `Du bist ein Content-Analyst. Erstelle aus einem YouTube-Video-Transkript eine strukturierte Zusammenfassung auf Englisch.

FORMAT:
- Beginne mit einer 2-3 Satz Zusammenfassung des Videos
- Dann: KEY RESULTS mit konkreten Zahlen/Statistiken (falls vorhanden)
- Dann: Jede Strategie/jeden Tipp als eigenen Abschnitt mit Überschrift
- Pro Abschnitt: 3-5 Sätze mit den wichtigsten Punkten
- Konkrete Zahlen, Beispiele und Schritt-für-Schritt-Anleitungen beibehalten
- Unwichtige Füllwörter und Wiederholungen entfernen

Ziel: Die Zusammenfassung soll als Wissensbasis für Blog-Artikel über Restaurant-Marketing dienen.`
      },
      {
        role: 'user',
        content: `Video: "${videoTitle}"\n\nTranskript:\n${transcript.slice(0, 15000)}`
      }
    ],
    temperature: 0.3,
    max_tokens: 4000,
  })

  return response.choices[0]?.message?.content || transcript.slice(0, 5000)
}

export async function getVideoTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
    const data = await res.json() as { title: string; author_name: string }
    return `${data.title} — ${data.author_name}`
  } catch {
    return `YouTube Video ${videoId}`
  }
}

export async function processVideo(input: string): Promise<boolean> {
  try {
    const videoId = extractVideoId(input)
    const url = `https://www.youtube.com/watch?v=${videoId}`

    console.log(`\n📺 Processing: ${url}`)

    const title = await getVideoTitle(videoId)
    console.log(`   Title: ${title}`)

    console.log('   Fetching transcript via yt-dlp...')
    const { text: transcript, lang: language } = await fetchTranscript(videoId)
    console.log(`   Transcript: ${transcript.length} chars (${transcript.split(/\s+/).length} words) [${language}]`)

    if (transcript.length < 200) {
      console.log('   ⚠️  Transcript too short — skipping')
      return false
    }

    console.log('   Summarizing with Grok...')
    const summary = await summarizeTranscript(transcript, title)
    console.log(`   Summary: ${summary.length} chars`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getSupabase().from('blog_sources') as any).upsert({
      source_id: 'youtube-transcripts',
      name: 'YouTube Transcripts (Premium)',
      language: 'en',
      blog_url: 'https://youtube.com',
      rating: 5,
    }, { onConflict: 'source_id' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getSupabase().from('scraped_articles') as any)
      .upsert({
        source_id: 'youtube-transcripts',
        url,
        title,
        content: summary,
        date: new Date().getFullYear().toString(),
        language,
        scraped_at: new Date().toISOString(),
      }, { onConflict: 'url', ignoreDuplicates: false })

    if (error) {
      console.log(`   ❌ DB error: ${error.message}`)
      return false
    }

    console.log(`   ✅ Saved: "${title}"`)
    return true
  } catch (err) {
    console.log(`   ❌ Error: ${(err as Error).message?.slice(0, 150)}`)
    return false
  }
}

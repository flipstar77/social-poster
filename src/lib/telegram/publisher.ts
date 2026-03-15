import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface PublishOptions {
  photoBuffer: Buffer
  caption: string
  hashtags: string[]
  platforms: string[]
  scheduledAt: Date
  profileId: string
}

async function getUploadPostUsername(apiKey: string): Promise<string | null> {
  const res = await fetch('https://api.upload-post.com/api/uploadposts/users', {
    headers: { 'Authorization': `Apikey ${apiKey}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.profiles as Array<{ username: string }> | undefined)?.[0]?.username ?? null
}

export interface PublishResult {
  succeeded: string[]
  failed: string[]
}

export async function publishPost({
  photoBuffer,
  caption,
  hashtags,
  platforms,
  scheduledAt,
  profileId,
}: PublishOptions): Promise<PublishResult> {
  const apiKey = process.env.UPLOAD_POST_API_KEY
  if (!apiKey) throw new Error('UPLOAD_POST_API_KEY not configured')

  const username = await getUploadPostUsername(apiKey)
  if (!username) throw new Error('No upload-post.com profile found')

  const hashtagStr = hashtags.map(h => `#${h}`).join(' ')
  const title = hashtags.length > 0 ? `${caption}\n\n${hashtagStr}` : caption

  const pad = (n: number) => String(n).padStart(2, '0')
  const d = scheduledAt
  const isoDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`

  const photoFile = new File([new Uint8Array(photoBuffer)], 'photo.jpg', { type: 'image/jpeg' })

  const succeeded: string[] = []
  const failed: string[] = []

  for (const platform of platforms) {
    const uploadForm = new FormData()
    uploadForm.append('photos[]', photoFile, 'photo.jpg')
    uploadForm.append('user', username)
    uploadForm.append('platform[]', platform)
    uploadForm.append('title', title)
    uploadForm.append('scheduled_date', isoDate)
    uploadForm.append('timezone', 'Europe/Berlin')

    try {
      const res = await fetch('https://api.upload-post.com/api/upload_photos', {
        method: 'POST',
        headers: { 'Authorization': `Apikey ${apiKey}` },
        body: uploadForm,
      })

      if (res.ok) {
        succeeded.push(platform)
      } else {
        console.error(`[Telegram Publisher] upload-post.com error for ${platform}:`, res.status, await res.text())
        failed.push(platform)
      }
    } catch (err) {
      console.error(`[Telegram Publisher] network error for ${platform}:`, err)
      failed.push(platform)
    }
  }

  // Save to scheduled_posts for next-slot logic (only succeeded platforms)
  const admin = getAdmin()
  for (const platform of succeeded) {
    await admin.from('scheduled_posts').insert({
      profile_id: profileId,
      platform,
      scheduled_at: scheduledAt.toISOString(),
      caption: title,
      status: 'scheduled',
      source: 'telegram',
    })
  }

  return { succeeded, failed }
}

export interface CaptionVariant {
  caption: string
  hashtags: string[]
}

export async function generateCaptions(
  description: string,
  tone: string,
  hashtagCount: number,
  businessType: string,
  count = 3
): Promise<CaptionVariant[]> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new Error('XAI_API_KEY not configured')

  const systemPrompt = `Du bist ein Social-Media-Experte für Gastronomie (${businessType}).
Erstelle genau ${count} verschiedene Instagram-Caption-Varianten auf Deutsch.
Ton: ${tone}
Regeln:
- Max 2200 Zeichen pro Caption
- Genau ${hashtagCount} relevante Hashtags pro Variante
- Emojis willkommen
- Authentisch und einladend
- Jede Variante soll einen anderen Stil haben (z.B. storytelling, direkt, emotional)
- Gib NUR valides JSON zurück (kein Markdown):
[{"caption": "...", "hashtags": ["tag1", "tag2"]}, ...]`

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-4-1-fast-non-reasoning',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Foto-Beschreibung: ${description}` },
      ],
      temperature: 0.9,
    }),
  })

  if (!res.ok) throw new Error(`Grok error: ${res.status}`)

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  const jsonMatch = content.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Invalid AI response — expected JSON array')

  const parsed = JSON.parse(jsonMatch[0]) as CaptionVariant[]
  return parsed.slice(0, count).map(v => ({
    caption: v.caption ?? '',
    hashtags: (v.hashtags as string[]) ?? [],
  }))
}

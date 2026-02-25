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

export async function publishPost({
  photoBuffer,
  caption,
  hashtags,
  platforms,
  scheduledAt,
  profileId,
}: PublishOptions): Promise<void> {
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

  for (const platform of platforms) {
    const uploadForm = new FormData()
    uploadForm.append('photos[]', photoFile, 'photo.jpg')
    uploadForm.append('user', username)
    uploadForm.append('platform[]', platform)
    uploadForm.append('title', title)
    uploadForm.append('scheduled_date', isoDate)
    uploadForm.append('timezone', 'Europe/Berlin')

    const res = await fetch('https://api.upload-post.com/api/upload_photos', {
      method: 'POST',
      headers: { 'Authorization': `Apikey ${apiKey}` },
      body: uploadForm,
    })

    if (!res.ok) {
      console.error(`[Telegram Publisher] upload-post.com error for ${platform}:`, res.status, await res.text())
    }
  }

  // Save to scheduled_posts for next-slot logic
  const admin = getAdmin()
  for (const platform of platforms) {
    await admin.from('scheduled_posts').insert({
      profile_id: profileId,
      platform,
      scheduled_at: scheduledAt.toISOString(),
      caption: title,
      status: 'scheduled',
      source: 'telegram',
    })
  }
}

export async function generateCaption(
  description: string,
  tone: string,
  hashtagCount: number,
  businessType: string
): Promise<{ caption: string; hashtags: string[] }> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new Error('XAI_API_KEY not configured')

  const systemPrompt = `Du bist ein Social-Media-Experte für Gastronomie (${businessType}).
Erstelle eine ansprechende Instagram-Caption auf Deutsch.
Ton: ${tone}
Regeln:
- Max 2200 Zeichen
- Genau ${hashtagCount} relevante Hashtags
- Emojis willkommen
- Authentisch und einladend
- Gib NUR valides JSON zurück (kein Markdown):
{"caption": "...", "hashtags": ["tag1", "tag2"]}`

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
        { role: 'user', content: `Foto-Beschreibung: ${description}` },
      ],
      temperature: 0.8,
    }),
  })

  if (!res.ok) throw new Error(`Grok error: ${res.status}`)

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Invalid AI response')

  const parsed = JSON.parse(jsonMatch[0])
  return {
    caption: parsed.caption ?? '',
    hashtags: (parsed.hashtags as string[]) ?? [],
  }
}

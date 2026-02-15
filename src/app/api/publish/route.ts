import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const apiKey = process.env.UPLOAD_POST_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Upload API key not configured' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const photo = formData.get('photo') as File | null
    const caption = formData.get('caption') as string
    const hashtags = formData.get('hashtags') as string // comma-separated
    const platform = formData.get('platform') as string // instagram | tiktok
    const scheduledDate = formData.get('scheduledDate') as string // YYYY-MM-DD
    const scheduledTime = formData.get('scheduledTime') as string // HH:mm

    if (!photo || !caption || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: photo, caption, platform' },
        { status: 400 }
      )
    }

    // Build title: caption + hashtags
    const hashtagStr = hashtags
      ? hashtags.split(',').map(h => `#${h.trim()}`).join(' ')
      : ''
    const title = `${caption}\n\n${hashtagStr}`.trim()

    // Build the form data for upload-post.com
    const uploadForm = new FormData()
    uploadForm.append('photos[]', photo, photo.name)
    // Derive user from API key JWT payload (email field)
    try {
      const payload = JSON.parse(atob(apiKey.split('.')[1]))
      uploadForm.append('user', payload.email || 'default')
    } catch {
      uploadForm.append('user', 'default')
    }
    uploadForm.append('platform[]', platform)
    uploadForm.append('title', title)

    // Add scheduling if date is provided
    if (scheduledDate && scheduledTime) {
      const isoDate = `${scheduledDate}T${scheduledTime}:00`
      uploadForm.append('scheduled_date', isoDate)
      uploadForm.append('timezone', 'Europe/Berlin')
    }

    const res = await fetch('https://api.upload-post.com/api/upload_photos', {
      method: 'POST',
      headers: {
        'Authorization': `Apikey ${apiKey}`,
      },
      body: uploadForm,
    })

    const responseText = await res.text()
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { raw: responseText }
    }

    if (!res.ok) {
      console.error('[Publish] upload-post.com error:', res.status, responseText)
      return NextResponse.json(
        { error: 'Publishing failed', status: res.status, details: responseData },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, data: responseData })
  } catch (err) {
    console.error('[Publish] Error:', err)
    return NextResponse.json({ error: 'Publishing failed' }, { status: 500 })
  }
}

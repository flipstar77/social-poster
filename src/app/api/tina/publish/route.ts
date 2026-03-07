import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const apiKey = process.env.UPLOAD_POST_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'UPLOAD_POST_API_KEY not configured' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const photo = formData.get('photo') as File | null
    const caption = formData.get('caption') as string
    const hashtags = formData.get('hashtags') as string
    const platform = formData.get('platform') as string
    const scheduledDate = formData.get('scheduledDate') as string
    const scheduledTime = formData.get('scheduledTime') as string
    const username = formData.get('username') as string | null

    if (!photo || !caption || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: photo, caption, platform' },
        { status: 400 }
      )
    }

    // Default to Tina's profile on upload-post.com
    const user = username || 'Tina'
    if (!user) {
      return NextResponse.json(
        { error: 'No upload-post.com profile found. Connect your accounts first.' },
        { status: 400 }
      )
    }

    // Build caption with hashtags
    const hashtagStr = hashtags
      ? hashtags.split(',').map(h => `#${h.trim()}`).join(' ')
      : ''
    const title = hashtagStr ? `${caption}\n\n${hashtagStr}` : caption

    const uploadForm = new FormData()
    uploadForm.append('photos[]', photo, photo.name)
    uploadForm.append('user', user)
    uploadForm.append('platform[]', platform)
    uploadForm.append('title', title)

    if (scheduledDate && scheduledTime) {
      uploadForm.append('scheduled_date', `${scheduledDate}T${scheduledTime}:00`)
      uploadForm.append('timezone', 'Europe/Berlin')
    }

    const res = await fetch('https://api.upload-post.com/api/upload_photos', {
      method: 'POST',
      headers: { 'Authorization': `Apikey ${apiKey}` },
      body: uploadForm,
    })

    const responseText = await res.text()
    let responseData
    try { responseData = JSON.parse(responseText) } catch { responseData = { raw: responseText } }

    if (!res.ok) {
      console.error('[Tina Publish] upload-post.com error:', res.status, responseText)
      return NextResponse.json(
        { error: `upload-post.com returned ${res.status}`, details: responseData },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, data: responseData })
  } catch (err) {
    console.error('[Tina Publish] Error:', err)
    return NextResponse.json({ error: 'Publishing failed' }, { status: 500 })
  }
}

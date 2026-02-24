import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const apiKey = process.env.UPLOAD_POST_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Upload API key not configured' }, { status: 500 })
  }

  const { username } = await request.json()
  if (!username || typeof username !== 'string') {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }

  // Step 1: Create user profile (ignore 409 conflict if already exists)
  const createRes = await fetch('https://api.upload-post.com/api/uploadposts/users', {
    method: 'POST',
    headers: {
      'Authorization': `Apikey ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username }),
  })

  if (!createRes.ok && createRes.status !== 409) {
    const text = await createRes.text()
    console.error('[Connect] Create user warning:', createRes.status, text)
    // 403 = plan limit reached, but profile may already exist — continue to JWT
    if (createRes.status !== 403) {
      return NextResponse.json({ error: `Failed to create profile: ${createRes.status}`, detail: text }, { status: 502 })
    }
  }

  // Step 2: Generate JWT URL for the user to connect their social accounts
  const redirectUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/tool`
    : 'https://flowingpost.com/tool'

  const jwtRes = await fetch('https://api.upload-post.com/api/uploadposts/users/generate-jwt', {
    method: 'POST',
    headers: {
      'Authorization': `Apikey ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      redirect_url: redirectUrl,
      connect_title: 'Verbinde deine Social Media Konten',
      connect_description: 'Verbinde Instagram und TikTok, um automatisch zu posten.',
      redirect_button_text: 'Zurück zum Tool',
    }),
  })

  if (!jwtRes.ok) {
    const text = await jwtRes.text()
    console.error('[Connect] JWT generation error:', jwtRes.status, text)
    return NextResponse.json({ error: `Failed to generate connection URL: ${jwtRes.status}` }, { status: 502 })
  }

  const jwtData = await jwtRes.json()
  const connectUrl = jwtData.url || jwtData.access_url || jwtData.jwt_url

  if (!connectUrl) {
    console.error('[Connect] No URL in JWT response:', jwtData)
    return NextResponse.json({ error: 'No connection URL returned', raw: jwtData }, { status: 502 })
  }

  return NextResponse.json({ connectUrl })
}

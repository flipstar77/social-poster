import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { to, subject, body, fromName } = await req.json()

  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Fehlende Felder: to, subject, body' }, { status: 400 })
  }

  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const fromLabel = fromName ? `${fromName} <${from}>` : from

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromLabel,
        to: [to],
        subject,
        text: body,
      }),
    })

    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.message ?? 'Resend Fehler' }, { status: res.status })

    return NextResponse.json({ id: data.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { name, restaurant, email, message } = await req.json()

  const to = process.env.CONTACT_EMAIL
  if (!to) return NextResponse.json({ error: 'CONTACT_EMAIL nicht konfiguriert' }, { status: 500 })
  if (!name || !restaurant || !email) return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 })

  const subject = `Demo-Anfrage: ${restaurant}`
  const body = [
    `Neue Demo-Anfrage über Social Poster AI`,
    ``,
    `Name:       ${name}`,
    `Restaurant: ${restaurant}`,
    `E-Mail:     ${email}`,
    ``,
    message || '(keine weitere Nachricht)',
  ].join('\n')

  const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text: body }),
  })

  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: (data as { message?: string }).message ?? 'Resend Fehler' }, { status: res.status })

  return NextResponse.json({ ok: true })
}

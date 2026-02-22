import { NextResponse, type NextRequest } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const TOBIAS_EMAIL = 'Tobias.Hersemeyer@outlook.de'
const SUPABASE_WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  // Verify webhook secret
  if (SUPABASE_WEBHOOK_SECRET) {
    const secret = request.headers.get('x-webhook-secret')
    if (secret !== SUPABASE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await request.json()
  const record = body.record // new profile row

  if (!record) {
    return NextResponse.json({ error: 'No record' }, { status: 400 })
  }

  const { email, plan, selected_platforms } = record
  const platforms = (selected_platforms ?? []).join(', ')

  await resend.emails.send({
    from: 'FlowingPost <hello@flowingpost.com>',
    to: TOBIAS_EMAIL,
    subject: `🆕 Neuer FlowingPost Nutzer: ${email}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Neuer Nutzer registriert</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280;">E-Mail</td><td><strong>${email}</strong></td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Plan</td><td><strong>${plan ?? 'starter'}</strong></td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Plattformen</td><td>${platforms || '—'}</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="color: #6b7280; font-size: 14px;">
          Nach Zahlungseingang: <strong>is_active = true</strong> in Supabase setzen.
        </p>
        <a href="https://supabase.com/dashboard/project/fboyeqtetcfcgngkefhg/editor"
           style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">
          Supabase öffnen →
        </a>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}

import { NextResponse, type NextRequest } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const TOBIAS_EMAIL = 'Tobias.Hersemeyer@outlook.de'

export async function POST(request: NextRequest) {
  const { email, plan } = await request.json()

  await resend.emails.send({
    from: 'FlowingPost <hello@flowingpost.com>',
    to: TOBIAS_EMAIL,
    subject: `💸 Zahlung gemeldet: ${email}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Zahlung gemeldet</h2>
        <p>Nutzer <strong>${email}</strong> hat angegeben, die Zahlung für den <strong>${plan ?? 'starter'}</strong>-Plan gesendet zu haben.</p>
        <p>Bitte Zahlung prüfen und <strong>is_active = true</strong> setzen.</p>
        <a href="https://supabase.com/dashboard/project/fboyeqtetcfcgngkefhg/editor"
           style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">
          Supabase öffnen →
        </a>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}

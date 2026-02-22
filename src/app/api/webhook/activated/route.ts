import { NextResponse, type NextRequest } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const SUPABASE_WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  if (SUPABASE_WEBHOOK_SECRET) {
    const secret = request.headers.get('x-webhook-secret')
    if (secret !== SUPABASE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await request.json()
  const record = body.record // updated profile row
  const oldRecord = body.old_record

  // Only fire when is_active changes from false → true
  if (!record?.is_active || oldRecord?.is_active === true) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { email, plan } = record
  if (!email) {
    return NextResponse.json({ error: 'No email in record' }, { status: 400 })
  }

  const planLabel = PLAN_LABELS[plan ?? 'starter'] ?? plan

  await resend.emails.send({
    from: 'FlowingPost <hello@flowingpost.com>',
    to: email,
    subject: '🎉 Dein FlowingPost Account ist jetzt aktiv!',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 32px; border-radius: 12px;">
        <h1 style="font-size: 24px; margin: 0 0 8px;">
          <span style="color: #3b82f6;">Flowing</span>Post
        </h1>
        <h2 style="font-size: 20px; font-weight: 700; margin: 24px 0 12px;">
          Dein Account ist aktiv! 🎉
        </h2>
        <p style="color: #9ca3af; line-height: 1.6; margin: 0 0 24px;">
          Dein <strong style="color: #fff;">${planLabel}-Plan</strong> ist jetzt freigeschaltet.
          Du kannst ab sofort loslegen und deine Social Media Posts automatisieren.
        </p>
        <a href="https://www.flowingpost.com/tool"
           style="display: inline-block; padding: 14px 28px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
          Zum Tool →
        </a>
        <p style="color: #4b5563; font-size: 13px; margin-top: 32px; line-height: 1.5;">
          Fragen? Schreib uns: <a href="mailto:hello@flowingpost.com" style="color: #6b7280;">hello@flowingpost.com</a>
        </p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}

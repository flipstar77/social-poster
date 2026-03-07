import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('Missing RESEND_API_KEY')
    _resend = new Resend(key)
  }
  return _resend
}

const FROM_EMAIL = 'FlowingPost <newsletter@flowingpost.com>'

export interface SendNewsletterOptions {
  to: string[]
  subject: string
  html: string
}

/** Send a newsletter email to a list of recipients */
export async function sendNewsletter({ to, subject, html }: SendNewsletterOptions) {
  const resend = getResend()

  // Resend supports batch sending up to 100 per call
  const batches: string[][] = []
  for (let i = 0; i < to.length; i += 100) {
    batches.push(to.slice(i, i + 100))
  }

  let sent = 0
  for (const batch of batches) {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: batch,
      subject,
      html,
    })

    if (error) {
      console.error('[Newsletter] Send failed:', error)
    } else {
      sent += batch.length
    }
  }

  console.log(`[Newsletter] Sent ${sent}/${to.length} emails`)
  return { sent, total: to.length }
}

/** Send a single audit report email */
export async function sendAuditReport(
  to: string,
  restaurantHandle: string,
  reportHtml: string
) {
  const resend = getResend()

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Instagram-Audit fuer @${restaurantHandle} — Dein Report`,
    html: reportHtml,
  })

  if (error) {
    console.error('[Newsletter] Audit report send failed:', error)
    throw new Error(`Failed to send audit report: ${error.message}`)
  }

  console.log(`[Newsletter] Audit report sent to ${to}`)
}

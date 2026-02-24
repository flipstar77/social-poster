import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TOBIAS_EMAIL = 'Tobias.Hersemeyer@outlook.de'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const stripe = getStripe()
  const supabase = getSupabase()
  const resend = new Resend(process.env.RESEND_API_KEY)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      const plan = session.metadata?.plan
      const interval = session.metadata?.interval

      if (userId) {
        await supabase
          .from('profiles')
          .update({
            is_active: true,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            stripe_plan_interval: interval || 'monthly',
          })
          .eq('id', userId)

        console.log(`[Stripe] User ${userId} activated — plan: ${plan}, interval: ${interval}`)

        // Notify admin
        try {
          await resend.emails.send({
            from: 'FlowingPost <hello@flowingpost.com>',
            to: TOBIAS_EMAIL,
            subject: `Neuer zahlender Kunde: ${session.customer_email || 'unbekannt'}`,
            html: `
              <h2>Neuer Stripe-Kunde!</h2>
              <p><strong>Email:</strong> ${session.customer_email}</p>
              <p><strong>Plan:</strong> ${plan} (${interval})</p>
              <p><strong>User ID:</strong> ${userId}</p>
            `,
          })
        } catch {
          // Non-critical
        }
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.supabase_user_id

      if (userId) {
        const isActive = subscription.status === 'active' || subscription.status === 'trialing'
        await supabase
          .from('profiles')
          .update({
            is_active: isActive,
            stripe_subscription_id: subscription.id,
          })
          .eq('id', userId)

        console.log(`[Stripe] Subscription updated for ${userId} — status: ${subscription.status}`)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.supabase_user_id

      if (userId) {
        await supabase
          .from('profiles')
          .update({ is_active: false })
          .eq('id', userId)

        console.log(`[Stripe] Subscription cancelled for ${userId}`)

        // Notify admin
        try {
          await resend.emails.send({
            from: 'FlowingPost <hello@flowingpost.com>',
            to: TOBIAS_EMAIL,
            subject: `Abo gekündigt: User ${userId}`,
            html: `<p>User <strong>${userId}</strong> hat sein Abo gekündigt.</p>`,
          })
        } catch {
          // Non-critical
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      // Find user by stripe_customer_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        console.log(`[Stripe] Payment failed for user ${profile.id}`)

        try {
          await resend.emails.send({
            from: 'FlowingPost <hello@flowingpost.com>',
            to: TOBIAS_EMAIL,
            subject: `Zahlung fehlgeschlagen: User ${profile.id}`,
            html: `<p>Zahlung fehlgeschlagen für User <strong>${profile.id}</strong>. Bitte prüfen.</p>`,
          })
        } catch {
          // Non-critical
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

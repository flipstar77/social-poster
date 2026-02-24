import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    httpClient: Stripe.createFetchHttpClient(),
  })
}

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { session_id } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
    }

    // Verify the user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Retrieve the checkout session from Stripe
    const session = await getStripe().checkout.sessions.retrieve(session_id)

    // Verify payment was successful and this session belongs to this user
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment not completed', status: session.payment_status }, { status: 402 })
    }

    const sessionUserId = session.metadata?.supabase_user_id
    if (sessionUserId !== user.id) {
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 })
    }

    // Activate the user and save Stripe IDs
    const admin = getAdmin()
    const { error } = await admin
      .from('profiles')
      .update({
        is_active: true,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        stripe_plan_interval: session.metadata?.interval || 'monthly',
      })
      .eq('id', user.id)

    if (error) {
      console.error('[Stripe Verify] Failed to activate user:', error)
      return NextResponse.json({ error: 'Failed to activate' }, { status: 500 })
    }

    console.log(`[Stripe Verify] User ${user.id} activated via session ${session_id}`)
    return NextResponse.json({ success: true, is_active: true })
  } catch (err) {
    console.error('[Stripe Verify] Error:', err)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}

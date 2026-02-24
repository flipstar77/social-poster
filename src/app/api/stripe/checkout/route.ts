import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// These will be filled after running `npx tsx scripts/stripe-setup.ts`
// For now, use placeholder IDs — the script will output the real ones.
const PRICE_IDS: Record<string, Record<string, string>> = {
  starter: { monthly: 'price_1T4HYhGet5PrVLmAhYPqXidG', yearly: 'price_1T4HYhGet5PrVLmA0m2iJkSa' },
  growth: { monthly: 'price_1T4HYiGet5PrVLmAa09hgOx2', yearly: 'price_1T4HYiGet5PrVLmA6xbEDFHF' },
  pro: { monthly: 'price_1T4HYjGet5PrVLmAQOjcXiIP', yearly: 'price_1T4HYjGet5PrVLmAB6YE9Bmf' },
}

export async function POST(request: NextRequest) {
  try {
    const { plan, yearly } = await request.json()

    if (!PRICE_IDS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const priceId = yearly ? PRICE_IDS[plan].yearly : PRICE_IDS[plan].monthly
    if (!priceId) {
      return NextResponse.json({ error: 'Price not configured — run stripe-setup first' }, { status: 500 })
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user already has a Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // Save customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Determine base URL
    const origin = request.headers.get('origin') || 'http://localhost:3000'

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/waiting?success=true`,
      cancel_url: `${origin}/onboarding`,
      metadata: {
        supabase_user_id: user.id,
        plan,
        interval: yearly ? 'yearly' : 'monthly',
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

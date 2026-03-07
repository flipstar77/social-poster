import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { email, restaurantName, restaurantType, city, source } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const { error } = await (supabase
      .from('newsletter_subscribers') as any)
      .upsert({
        email: email.toLowerCase().trim(),
        restaurant_name: restaurantName ?? null,
        restaurant_type: restaurantType ?? null,
        city: city ?? null,
        source: source ?? 'landing_page',
        subscribed_at: new Date().toISOString(),
        unsubscribed_at: null, // re-subscribe if previously unsubscribed
      }, { onConflict: 'email' })

    if (error) {
      console.error('[Newsletter] Subscribe error:', error)
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }

    console.log(`[Newsletter] Subscribed: ${email} (source: ${source})`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Newsletter] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

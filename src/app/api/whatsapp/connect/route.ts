import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET — Load connected WhatsApp account for current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = getAdmin()
    const { data: account } = await admin
      .from('whatsapp_accounts')
      .select('id, phone_number_id, display_phone_number, waba_id, business_name, status, created_at')
      .eq('profile_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    return NextResponse.json({ account })
  } catch (err) {
    console.error('[WhatsApp Connect] GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST — Connect a WhatsApp account (manual mode; later replaced by Embedded Signup)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { phone_number_id, access_token, display_phone_number, waba_id, business_name } = body

    if (!phone_number_id || !access_token) {
      return NextResponse.json(
        { error: 'phone_number_id and access_token are required' },
        { status: 400 }
      )
    }

    const admin = getAdmin()

    // Upsert: if user already has an account, update it
    const { error } = await admin
      .from('whatsapp_accounts')
      .upsert({
        profile_id: user.id,
        phone_number_id,
        access_token,
        display_phone_number: display_phone_number || null,
        waba_id: waba_id || null,
        business_name: business_name || null,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' })

    if (error) {
      // Could be unique constraint on phone_number_id (already used by another user)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This phone number is already connected to another account' },
          { status: 409 }
        )
      }
      console.error('[WhatsApp Connect] POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[WhatsApp Connect] POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// DELETE — Disconnect WhatsApp account
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = getAdmin()
    await admin
      .from('whatsapp_accounts')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('profile_id', user.id)
      .eq('status', 'active')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[WhatsApp Connect] DELETE error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

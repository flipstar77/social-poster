import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_FIELDS = [
  'whatsapp_number', 'whatsapp_cta_enabled',
  'wa_greeting', 'wa_opening_hours', 'wa_menu_url', 'wa_keywords', 'wa_auto_reply_enabled',
] as const

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    // Only allow whitelisted fields
    const updates: Record<string, unknown> = {}
    for (const field of ALLOWED_FIELDS) {
      if (field in body) updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = getAdmin()
    const { error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (error) {
      console.error('[Profile Update] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Profile Update] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

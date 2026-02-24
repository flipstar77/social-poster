import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { plan, selectedPlatforms } = await request.json()

    if (!plan || !selectedPlatforms?.length) {
      return NextResponse.json({ error: 'Missing plan or platforms' }, { status: 400 })
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = getAdmin()

    // Upsert profile — creates if missing, updates if exists
    const { error } = await admin
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        upload_post_username: user.id,
        selected_platforms: selectedPlatforms,
        plan,
        onboarding_completed: true,
        is_active: false,
      }, { onConflict: 'id' })

    if (error) {
      console.error('[Onboarding API] Upsert failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Onboarding API] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

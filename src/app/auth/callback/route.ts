import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[Auth Callback] Error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Get the newly authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  // Create profile if it doesn't exist yet
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!existing) {
    await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      upload_post_username: user.id, // UUID as username — invisible to user
      selected_platforms: ['instagram', 'tiktok'],
      plan: 'starter',
      is_active: false,
      onboarding_completed: false,
    })
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  if (!existing.onboarding_completed) {
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  return NextResponse.redirect(`${origin}/tool`)
}

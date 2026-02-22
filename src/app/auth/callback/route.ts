import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // In production Vercel uses x-forwarded-host for the public domain
  const forwardedHost = request.headers.get('x-forwarded-host')
  const baseUrl =
    process.env.NODE_ENV !== 'development' && forwardedHost
      ? `https://${forwardedHost}`
      : origin

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=no_code`)
  }

  const cookieStore = await cookies()
  const newCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) =>
          cs.forEach(({ name, value, options }) => {
            newCookies.push({ name, value, options: options ?? {} })
            try { cookieStore.set(name, value, options) } catch {}
          }),
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[Auth Callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${baseUrl}/login?error=no_user`)
  }

  // Check or create profile
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!existing) {
    await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      upload_post_username: user.id,
      selected_platforms: ['instagram', 'tiktok'],
      plan: 'starter',
      is_active: false,
      onboarding_completed: false,
    })
  }

  const destination =
    !existing || !existing.onboarding_completed ? '/onboarding' : '/tool'

  const response = NextResponse.redirect(`${baseUrl}${destination}`)

  // Explicitly copy auth session cookies onto the redirect response
  newCookies.forEach(({ name, value, options }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response.cookies.set(name, value, options as any)
  })

  return response
}

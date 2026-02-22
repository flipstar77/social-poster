import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session (important — don't remove this)
  const { data: { user } } = await supabase.auth.getUser()

  // --- Routing logic ---

  if (!user) {
    // Unauthenticated: only /login and public routes allowed
    if (pathname === '/tool' || pathname === '/onboarding' || pathname === '/waiting') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // Authenticated — fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_active, onboarding_completed')
    .eq('id', user.id)
    .single()

  const isActive = profile?.is_active ?? false
  const onboardingDone = profile?.onboarding_completed ?? false

  if (pathname === '/login') {
    // Already logged in — redirect appropriately
    if (!onboardingDone) return NextResponse.redirect(new URL('/onboarding', request.url))
    if (!isActive) return NextResponse.redirect(new URL('/waiting', request.url))
    return NextResponse.redirect(new URL('/tool', request.url))
  }

  if (pathname === '/onboarding') {
    if (onboardingDone) return NextResponse.redirect(new URL('/tool', request.url))
    return supabaseResponse
  }

  if (pathname === '/waiting') {
    if (isActive) return NextResponse.redirect(new URL('/tool', request.url))
    return supabaseResponse
  }

  if (pathname === '/tool') {
    if (!onboardingDone) return NextResponse.redirect(new URL('/onboarding', request.url))
    if (!isActive) return NextResponse.redirect(new URL('/waiting', request.url))
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/tool', '/onboarding', '/waiting', '/login'],
}

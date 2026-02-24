import createIntlMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './src/i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return pathname.slice(`/${locale}`.length) || '/'
    }
  }
  return pathname
}

function extractLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale
    }
  }
  return routing.defaultLocale
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1) Run next-intl middleware first (locale detection, rewrites, redirects)
  const intlResponse = intlMiddleware(request)

  // 2) Check if this path needs auth
  const pathWithoutLocale = stripLocalePrefix(pathname)
  const protectedPaths = ['/tool', '/onboarding', '/waiting', '/login']
  const needsAuth = protectedPaths.some(p => pathWithoutLocale === p)

  if (!needsAuth) {
    return intlResponse
  }

  // 3) For auth-required paths, create Supabase client
  const locale = extractLocale(pathname)
  const localePrefix = locale === routing.defaultLocale ? '' : `/${locale}`

  let supabaseResponse = intlResponse

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
          // Copy intl headers (alternate links for SEO)
          intlResponse.headers.forEach((value, key) => {
            supabaseResponse.headers.set(key, value)
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session (important — don't remove this)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    if (['/tool', '/onboarding', '/waiting'].includes(pathWithoutLocale)) {
      return NextResponse.redirect(new URL(`${localePrefix}/login`, request.url))
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

  if (pathWithoutLocale === '/login') {
    if (!onboardingDone) return NextResponse.redirect(new URL(`${localePrefix}/onboarding`, request.url))
    if (!isActive) return NextResponse.redirect(new URL(`${localePrefix}/waiting`, request.url))
    return NextResponse.redirect(new URL(`${localePrefix}/tool`, request.url))
  }

  if (pathWithoutLocale === '/onboarding') {
    if (onboardingDone && !isActive) return NextResponse.redirect(new URL(`${localePrefix}/waiting`, request.url))
    if (onboardingDone && isActive) return NextResponse.redirect(new URL(`${localePrefix}/tool`, request.url))
    return supabaseResponse
  }

  if (pathWithoutLocale === '/waiting') {
    if (isActive) return NextResponse.redirect(new URL(`${localePrefix}/tool`, request.url))
    return supabaseResponse
  }

  if (pathWithoutLocale === '/tool') {
    if (!onboardingDone) return NextResponse.redirect(new URL(`${localePrefix}/onboarding`, request.url))
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: '/((?!api|auth|_next|_vercel|.*\\..*).*)',
}

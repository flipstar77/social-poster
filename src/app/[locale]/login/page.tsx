'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

function LoginContent() {
  const t = useTranslations('login')
  const supabase = createClient()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [loading, setLoading] = useState(false)

  async function handleGoogleLogin() {
    setLoading(true)
    const redirectTo = `${window.location.origin}/auth/callback`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '1.5rem',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <div style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.03em',
          marginBottom: '0.5rem',
        }}>
          <span style={{ color: '#3b82f6' }}>Flowing</span>Post
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
          {t('subtitle')}
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: '#141414',
        border: '1px solid #222',
        borderRadius: '1rem',
        padding: '2rem',
        width: '100%',
        maxWidth: '380px',
        textAlign: 'center',
      }}>
        <h1 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
          {t('welcome')}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.75rem' }}>
          {t('description')}
        </p>

        {error && (
          <div style={{
            background: '#1f1010',
            border: '1px solid #5c1c1c',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            color: '#f87171',
            fontSize: '0.8rem',
            marginBottom: '1.25rem',
          }}>
            {t('error')}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.625rem',
            width: '100%',
            padding: '0.75rem 1.25rem',
            background: loading ? '#222' : '#fff',
            color: loading ? '#555' : '#111',
            border: 'none',
            borderRadius: '0.625rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {/* Google SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {loading ? t('redirecting') : t('googleButton')}
        </button>

        <p style={{ color: '#4b5563', fontSize: '0.75rem', marginTop: '1.25rem', lineHeight: 1.5 }}>
          {t('terms')}{' '}
          <a href="/#datenschutz" style={{ color: '#6b7280', textDecoration: 'underline' }}>
            {t('termsLink')}
          </a>{' '}
          {t('termsEnd')}
        </p>
      </div>

      <Link href="/" style={{ color: '#4b5563', fontSize: '0.8rem', marginTop: '1.5rem', textDecoration: 'none' }}>
        {t('backToHome')}
      </Link>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

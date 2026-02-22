'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter — €49/Monat',
  growth: 'Growth — €99/Monat',
  pro: 'Pro — €199/Monat',
}

const PLAN_PRICES: Record<string, string> = {
  starter: '49',
  growth: '99',
  pro: '199',
}

// ── ZAHLUNGSDETAILS ───────────────────────────────────────────────
const PAYPAL_EMAIL = 'Tobias.Hersemeyer@outlook.de'
const CRYPTO_ETH   = '0xB85Bf9dAba044FcEa3a8312d589e1616d582BDDc'
// ─────────────────────────────────────────────────────────────────

export default function WaitingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [plan, setPlan] = useState<string>('starter')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, selected_platforms, is_active')
        .eq('id', user.id)
        .single()

      if (profile?.is_active) {
        router.push('/tool')
        return
      }
      if (profile) {
        setPlan(profile.plan ?? 'starter')
        setPlatforms(profile.selected_platforms ?? [])
      }
    }
    loadProfile()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
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
      padding: '2rem 1.5rem',
      color: '#fff',
    }}>
      {/* Logo */}
      <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2.5rem' }}>
        <span style={{ color: '#3b82f6' }}>Flowing</span>Post
      </div>

      {/* Card */}
      <div style={{
        background: '#141414',
        border: '1px solid #222',
        borderRadius: '1.25rem',
        padding: '2.5rem',
        maxWidth: '440px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          background: '#172554',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          fontSize: '1.5rem',
        }}>
          ⏳
        </div>

        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
          Fast fertig — bitte bezahle jetzt
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
          Nach Zahlungseingang schalten wir deinen Account innerhalb von 24h frei
          und senden eine Bestätigung an <strong style={{ color: '#d1d5db' }}>{email}</strong>.
        </p>

        {/* Plan + Betrag */}
        <div style={{
          background: '#172554',
          border: '1px solid #1e3a8a',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.7rem', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
              Dein Plan
            </div>
            <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>
              {PLAN_LABELS[plan] ?? plan}
            </div>
            {platforms.length > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.2rem' }}>
                {platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
              </div>
            )}
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>
            €{PLAN_PRICES[plan] ?? '?'}
          </div>
        </div>

        {/* Zahlungsoptionen */}
        <div style={{
          background: '#0d0d0d',
          border: '1px solid #1f2937',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          textAlign: 'left',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Zahlung
          </div>

          {/* PayPal */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.4rem' }}>PayPal</div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0a0a0a',
              border: '1px solid #1f2937',
              borderRadius: '0.5rem',
              padding: '0.6rem 0.75rem',
            }}>
              <span style={{ fontSize: '0.8rem', color: '#e5e7eb', fontFamily: 'monospace' }}>{PAYPAL_EMAIL}</span>
              <button
                onClick={() => navigator.clipboard.writeText(PAYPAL_EMAIL)}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem', padding: '0 0.25rem' }}
              >
                kopieren
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.3rem' }}>
              Betrag: <strong style={{ color: '#9ca3af' }}>€{PLAN_PRICES[plan] ?? '?'}</strong> — Verwendungszweck: FlowingPost {plan}
            </div>
          </div>

          {/* Crypto */}
          <div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.4rem' }}>Crypto (ETH / ERC-20 USDT/USDC)</div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0a0a0a',
              border: '1px solid #1f2937',
              borderRadius: '0.5rem',
              padding: '0.6rem 0.75rem',
              gap: '0.5rem',
            }}>
              <span style={{ fontSize: '0.7rem', color: '#e5e7eb', fontFamily: 'monospace', wordBreak: 'break-all' }}>{CRYPTO_ETH}</span>
              <button
                onClick={() => navigator.clipboard.writeText(CRYPTO_ETH)}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem', padding: '0 0.25rem', flexShrink: 0 }}
              >
                kopieren
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.3rem' }}>
              ETH-Äquivalent zu €{PLAN_PRICES[plan] ?? '?'} senden
            </div>
          </div>
        </div>

        {/* Contact */}
        <a
          href="mailto:hello@flowingpost.com"
          style={{
            display: 'block',
            padding: '0.75rem',
            background: '#1f2937',
            color: '#e5e7eb',
            borderRadius: '0.625rem',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            marginBottom: '0.75rem',
          }}
        >
          Fragen? hello@flowingpost.com schreiben
        </a>

        <button
          onClick={handleSignOut}
          style={{
            background: 'none',
            border: 'none',
            color: '#4b5563',
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: '0.25rem',
          }}
        >
          Abmelden
        </button>
      </div>
    </div>
  )
}

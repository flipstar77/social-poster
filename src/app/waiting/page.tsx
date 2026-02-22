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

function Step({ num, done }: { num: number; done?: boolean }) {
  return (
    <div style={{
      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
      background: done ? '#16a34a' : '#172554',
      border: `2px solid ${done ? '#16a34a' : '#3b82f6'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.75rem', fontWeight: 700,
      color: done ? '#fff' : '#93c5fd',
    }}>
      {done ? '✓' : num}
    </div>
  )
}

export default function WaitingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [plan, setPlan] = useState<string>('starter')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [email, setEmail] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [accountsConnected, setAccountsConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

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
        .select('plan, selected_platforms, is_active, upload_post_username')
        .eq('id', user.id)
        .single()

      if (profile?.is_active) {
        router.push('/tool')
        return
      }
      if (profile) {
        setPlan(profile.plan ?? 'starter')
        setPlatforms(profile.selected_platforms ?? [])
        setUsername(profile.upload_post_username ?? '')
      }

      // accounts_connected is optional — query separately to avoid breaking if column missing
      const { data: extra } = await supabase
        .from('profiles')
        .select('accounts_connected')
        .eq('id', user.id)
        .single()
      if (extra?.accounts_connected) setAccountsConnected(true)
    }
    loadProfile()
  }, [])

  async function handleConnect() {
    if (!username) {
      setConnectError('Profil nicht geladen — bitte Seite neu laden.')
      return
    }
    setConnecting(true)
    setConnectError('')
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const data = await res.json()
      if (!res.ok || !data.connectUrl) {
        setConnectError(data.error || 'Fehler beim Generieren des Links')
        return
      }
      // Mark as connected in DB (optimistic — they'll actually connect in the new tab)
      await supabase.from('profiles').update({ accounts_connected: true }).eq('upload_post_username', username).throwOnError().catch(() => { /* column may not exist yet */ })
      setAccountsConnected(true)
      window.open(data.connectUrl, '_blank')
    } catch {
      setConnectError('Netzwerkfehler — bitte versuche es erneut')
    } finally {
      setConnecting(false)
    }
  }

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
      <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem' }}>
        <span style={{ color: '#3b82f6' }}>Flowing</span>Post
      </div>

      {/* Card */}
      <div style={{
        background: '#141414',
        border: '1px solid #222',
        borderRadius: '1.25rem',
        padding: '2rem',
        maxWidth: '460px',
        width: '100%',
      }}>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.375rem', textAlign: 'center' }}>
          Fast fertig — 2 Schritte noch
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', margin: '0 0 1.75rem', lineHeight: 1.5 }}>
          Wir schalten deinen Account nach Zahlungseingang innerhalb von 24h frei.
        </p>

        {/* Plan badge */}
        <div style={{
          background: '#172554', border: '1px solid #1e3a8a', borderRadius: '0.75rem',
          padding: '0.75rem 1rem', marginBottom: '1.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>Dein Plan</div>
            <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 600 }}>{PLAN_LABELS[plan] ?? plan}</div>
            {platforms.length > 0 && (
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.1rem' }}>
                {platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
              </div>
            )}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>€{PLAN_PRICES[plan] ?? '?'}</div>
        </div>

        {/* ── Schritt 1: Konten verbinden ── */}
        <div style={{
          border: `1px solid ${accountsConnected ? '#14532d' : '#1f2937'}`,
          background: accountsConnected ? '#052e16' : '#0d0d0d',
          borderRadius: '0.75rem',
          padding: '1rem 1.125rem',
          marginBottom: '0.75rem',
        }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <Step num={1} done={accountsConnected} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Social Media Konten verbinden
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5, marginBottom: accountsConnected ? 0 : '0.75rem' }}>
                {accountsConnected
                  ? 'Konten verbunden ✓ — Du kannst den Link erneut öffnen um weitere Accounts hinzuzufügen.'
                  : `Verbinde ${platforms.length > 0 ? platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ') : 'deine Plattformen'} damit wir direkt posten können.`
                }
              </div>
              {connectError && (
                <div style={{ fontSize: '0.72rem', color: '#f87171', marginBottom: '0.5rem' }}>{connectError}</div>
              )}
              <button
                onClick={handleConnect}
                disabled={connecting}
                style={{
                  display: accountsConnected ? 'none' : 'inline-block',
                  padding: '0.5rem 1rem',
                  background: connecting ? '#1e3a8a' : '#3b82f6',
                  color: '#fff', border: 'none', borderRadius: '0.5rem',
                  fontSize: '0.8rem', fontWeight: 600, cursor: connecting ? 'not-allowed' : 'pointer',
                }}
              >
                {connecting ? 'Link wird erstellt...' : 'Konten verbinden →'}
              </button>
              {accountsConnected && (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  style={{
                    background: 'none', border: 'none', color: '#4b5563',
                    fontSize: '0.72rem', cursor: 'pointer', padding: 0, marginTop: '0.25rem',
                    display: 'block',
                  }}
                >
                  {connecting ? 'Wird geöffnet...' : 'Link erneut öffnen'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Schritt 2: Bezahlen ── */}
        <div style={{
          border: '1px solid #1f2937',
          background: '#0d0d0d',
          borderRadius: '0.75rem',
          padding: '1rem 1.125rem',
          marginBottom: '1.25rem',
        }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <Step num={2} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Zahlung senden</div>

              {/* PayPal */}
              <div style={{ marginBottom: '0.875rem' }}>
                <div style={{ fontSize: '0.68rem', color: '#6b7280', marginBottom: '0.3rem' }}>PayPal</div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#e5e7eb', fontFamily: 'monospace' }}>{PAYPAL_EMAIL}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(PAYPAL_EMAIL)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.72rem' }}
                  >kopieren</button>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Betrag: <strong style={{ color: '#9ca3af' }}>€{PLAN_PRICES[plan] ?? '?'}</strong> — Verwendungszweck: FlowingPost {plan}
                </div>
              </div>

              {/* Crypto */}
              <div>
                <div style={{ fontSize: '0.68rem', color: '#6b7280', marginBottom: '0.3rem' }}>Crypto (ETH / ERC-20 USDT/USDC)</div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem', gap: '0.5rem',
                }}>
                  <span style={{ fontSize: '0.68rem', color: '#e5e7eb', fontFamily: 'monospace', wordBreak: 'break-all' }}>{CRYPTO_ETH}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(CRYPTO_ETH)}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.72rem', flexShrink: 0 }}
                  >kopieren</button>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  ETH-Äquivalent zu €{PLAN_PRICES[plan] ?? '?'} senden
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation note */}
        <p style={{ fontSize: '0.75rem', color: '#4b5563', textAlign: 'center', margin: '0 0 1rem', lineHeight: 1.5 }}>
          Nach Zahlungseingang senden wir eine Bestätigung an{' '}
          <strong style={{ color: '#6b7280' }}>{email}</strong> und schalten deinen Account frei.
        </p>

        {/* Contact */}
        <a
          href="mailto:hello@flowingpost.com"
          style={{
            display: 'block', padding: '0.65rem', background: '#1f2937', color: '#e5e7eb',
            borderRadius: '0.625rem', textDecoration: 'none', fontSize: '0.825rem',
            fontWeight: 500, textAlign: 'center', marginBottom: '0.75rem',
          }}
        >
          Fragen? hello@flowingpost.com
        </a>

        <button
          onClick={handleSignOut}
          style={{ background: 'none', border: 'none', color: '#374151', fontSize: '0.78rem', cursor: 'pointer', display: 'block', margin: '0 auto' }}
        >
          Abmelden
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

const PLAN_PRICES: Record<string, Record<string, string>> = {
  starter: { monthly: '39', yearly: '390' },
  growth: { monthly: '79', yearly: '790' },
  pro: { monthly: '149', yearly: '1.490' },
}


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
  const t = useTranslations('waiting')
  const tc = useTranslations('common')
  const router = useRouter()
  const supabase = createClient()
  const [plan, setPlan] = useState<string>('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [email, setEmail] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [accountsConnected, setAccountsConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [stripeSuccess, setStripeSuccess] = useState(false)
  const [activating, setActivating] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [yearly, setYearly] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    // Detect Stripe success redirect
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setStripeSuccess(true)
      setActivating(true)
    }

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, selected_platforms, is_active, upload_post_username, accounts_connected')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) {
        // No profile exists — send back to login so auth callback creates one
        router.push('/login')
        return
      }

      if (profile.is_active) {
        router.push('/tool')
        return
      }

      setPlan(profile.plan ?? 'starter')
      setPlatforms(profile.selected_platforms ?? [])
      setUsername(profile.upload_post_username ?? '')
      if (profile.accounts_connected) setAccountsConnected(true)
      setProfileLoaded(true)
    }
    loadProfile()
  }, [])

  // Poll for activation after Stripe success (webhook sets is_active=true)
  useEffect(() => {
    if (!stripeSuccess) return

    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.is_active) {
        setActivating(false)
        router.push('/tool')
      }
    }, 2000) // Poll every 2 seconds

    // Stop polling after 60 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval)
      setActivating(false)
    }, 60000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [stripeSuccess])

  async function handleConnect() {
    if (!username) {
      setConnectError(t('profileError'))
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
        setConnectError(data.error || t('linkError'))
        return
      }
      // Mark as connected in DB (optimistic — they'll actually connect in the new tab)
      try {
        await supabase.from('profiles').update({ accounts_connected: true }).eq('upload_post_username', username)
      } catch { /* column may not exist yet */ }
      setAccountsConnected(true)
      window.open(data.connectUrl, '_blank')
    } catch {
      setConnectError(t('networkError'))
    } finally {
      setConnecting(false)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
    } catch {
      // Ignore
    }
    setPortalLoading(false)
  }

  async function handleStripeCheckout() {
    setStripeLoading(true)
    setConnectError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, yearly }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
      setConnectError(`Stripe error: ${data.error || JSON.stringify(data)}`)
    } catch (err) {
      setConnectError(`Network error: ${err}`)
    }
    setStripeLoading(false)
  }

  // Sync plan change to DB when user selects a different plan
  async function handlePlanChange(newPlan: string) {
    setPlan(newPlan)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ plan: newPlan }).eq('id', user.id)
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

      {/* Loading state — wait for profile before showing anything */}
      {!profileLoaded && (
        <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Laden...</div>
      )}

      {/* Card — only show after profile loaded */}
      {profileLoaded && <div style={{
        background: '#141414',
        border: '1px solid #222',
        borderRadius: '1.25rem',
        padding: '2rem',
        maxWidth: '460px',
        width: '100%',
      }}>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.375rem', textAlign: 'center' }}>
          {t('title')}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', margin: '0 0 1.75rem', lineHeight: 1.5 }}>
          {t('subtitle')}
        </p>

        {/* Plan selector (before payment) or plan badge (after payment) */}
        {!stripeSuccess ? (
          <>
            {/* Yearly / Monthly toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', marginBottom: '0.75rem',
            }}>
              <span style={{ fontSize: '0.8rem', color: yearly ? '#6b7280' : '#e5e7eb', fontWeight: yearly ? 400 : 600 }}>Monatlich</span>
              <button
                onClick={() => setYearly(!yearly)}
                style={{
                  width: '44px', height: '24px', borderRadius: '999px', border: 'none',
                  background: yearly ? '#3b82f6' : '#374151', cursor: 'pointer',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: '2px', left: yearly ? '22px' : '2px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </button>
              <span style={{ fontSize: '0.8rem', color: yearly ? '#e5e7eb' : '#6b7280', fontWeight: yearly ? 600 : 400 }}>Jährlich</span>
              {yearly && (
                <span style={{ fontSize: '0.65rem', background: '#16a34a', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '999px', fontWeight: 600 }}>
                  2 Monate gratis
                </span>
              )}
            </div>

            {/* Plan cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
              {(['starter', 'growth', 'pro'] as const).map(p => {
                const selected = plan === p
                const price = PLAN_PRICES[p]?.[yearly ? 'yearly' : 'monthly'] ?? '?'
                return (
                  <button
                    key={p}
                    onClick={() => handlePlanChange(p)}
                    style={{
                      background: selected ? '#172554' : '#0d0d0d',
                      border: `1.5px solid ${selected ? '#3b82f6' : '#1f2937'}`,
                      borderRadius: '0.75rem',
                      padding: '0.75rem 0.5rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                      €{price}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>
                      {yearly ? '/Jahr' : '/Monat'}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{
            background: '#172554', border: '1px solid #1e3a8a', borderRadius: '0.75rem',
            padding: '0.75rem 1rem', marginBottom: '1rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>{t('yourPlan')}</div>
              <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 600 }}>
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                €{PLAN_PRICES[plan]?.[yearly ? 'yearly' : 'monthly'] ?? '?'}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#93c5fd' }}>
                {yearly ? '/Jahr' : '/Monat'}
              </div>
            </div>
          </div>
        )}

        {/* ── Stripe Success State ── */}
        {stripeSuccess && (
          <div style={{
            background: '#052e16', border: '1px solid #14532d', borderRadius: '0.75rem',
            padding: '1rem 1.25rem', marginBottom: '0.75rem', textAlign: 'center',
          }}>
            {activating ? (
              <>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4ade80', marginBottom: '0.25rem' }}>
                  {t('stripe.activating')}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {t('stripe.activatingHint')}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#4ade80' }}>
                  {t('stripe.success')}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Error display ── */}
        {connectError && (
          <div style={{
            background: '#1f1010', border: '1px solid #5c1c1c', borderRadius: '0.5rem',
            padding: '0.75rem 1rem', color: '#f87171', fontSize: '0.8rem',
            marginBottom: '0.75rem', wordBreak: 'break-all',
          }}>
            {connectError}
          </div>
        )}

        {/* ── Stripe Checkout Button (primary payment option) ── */}
        {!stripeSuccess && (
          <button
            onClick={handleStripeCheckout}
            disabled={stripeLoading || !profileLoaded}
            style={{
              width: '100%', padding: '0.875rem',
              background: (stripeLoading || !profileLoaded) ? '#1e3a8a' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff', border: 'none', borderRadius: '0.75rem',
              fontSize: '0.95rem', fontWeight: 700,
              cursor: (stripeLoading || !profileLoaded) ? 'not-allowed' : 'pointer',
              marginBottom: '1.25rem',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
            }}
          >
            {stripeLoading ? '...' : !profileLoaded ? '...' : t('stripe.checkoutButton')}
          </button>
        )}

        {/* ── Step 1: Connect accounts ── */}
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
                {t('step1.title')}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5, marginBottom: accountsConnected ? 0 : '0.75rem' }}>
                {accountsConnected
                  ? t('step1.connected')
                  : t('step1.connectPrompt', { platforms: platforms.length > 0 ? platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ') : t('step1.connectDefault') })
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
                {connecting ? t('step1.connecting') : t('step1.connectButton')}
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
                  {connecting ? t('step1.reopening') : t('step1.reopenLink')}
                </button>
              )}
            </div>
          </div>
        </div>


        {/* Confirmation note */}
        <p style={{ fontSize: '0.75rem', color: '#4b5563', textAlign: 'center', margin: '0 0 1rem', lineHeight: 1.5 }}>
          {t('confirmationNote', { email })}
        </p>

        {/* Manage subscription (Stripe portal) */}
        {stripeSuccess && (
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            style={{
              display: 'block', width: '100%', padding: '0.65rem', background: '#1f2937',
              color: '#e5e7eb', borderRadius: '0.625rem', border: '1px solid #374151',
              fontSize: '0.825rem', fontWeight: 500, textAlign: 'center',
              marginBottom: '0.75rem', cursor: portalLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {portalLoading ? '...' : t('stripe.manageSubscription')}
          </button>
        )}

        {/* Contact */}
        <a
          href="mailto:hello@flowingpost.com"
          style={{
            display: 'block', padding: '0.65rem', background: '#1f2937', color: '#e5e7eb',
            borderRadius: '0.625rem', textDecoration: 'none', fontSize: '0.825rem',
            fontWeight: 500, textAlign: 'center', marginBottom: '0.75rem',
          }}
        >
          {t('contact')}
        </a>

        <button
          onClick={handleSignOut}
          style={{ background: 'none', border: 'none', color: '#374151', fontSize: '0.78rem', cursor: 'pointer', display: 'block', margin: '0 auto' }}
        >
          {tc('signOut')}
        </button>
      </div>}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: '#E1306C' },
  { id: 'tiktok', label: 'TikTok', color: '#00f2ea' },
  { id: 'facebook', label: 'Facebook', color: '#1877F2' },
  { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
  { id: 'x', label: 'X (Twitter)', color: '#e7e7e7' },
  { id: 'threads', label: 'Threads', color: '#aaaaaa' },
  { id: 'pinterest', label: 'Pinterest', color: '#E60023' },
  { id: 'bluesky', label: 'Bluesky', color: '#0085ff' },
  { id: 'reddit', label: 'Reddit', color: '#FF4500' },
  { id: 'youtube', label: 'YouTube', color: '#FF0000' },
]

interface PlanData {
  name: string
  price: string
  period: string
  description: string
  features: string[]
}

export default function OnboardingPage() {
  const t = useTranslations('onboarding')
  const router = useRouter()
  const supabase = createClient()

  const starterData = t.raw('plans.starter') as PlanData
  const growthData = t.raw('plans.growth') as PlanData
  const proData = t.raw('plans.pro') as PlanData

  const PLANS = [
    {
      id: 'starter',
      ...starterData,
      maxPlatforms: 3,
      highlight: false,
    },
    {
      id: 'growth',
      ...growthData,
      maxPlatforms: 6,
      highlight: true,
    },
    {
      id: 'pro',
      ...proData,
      maxPlatforms: 9,
      highlight: false,
    },
  ]

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'tiktok'])
  const [selectedPlan, setSelectedPlan] = useState<string>('growth')
  const [yearly, setYearly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planMaxPlatforms = PLANS.find(p => p.id === selectedPlan)?.maxPlatforms ?? 3

  function togglePlatform(id: string) {
    setSelectedPlatforms(prev => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter(p => p !== id) : prev
      }
      if (prev.length >= planMaxPlatforms) {
        return prev
      }
      return [...prev, id]
    })
  }

  // When plan changes, trim platforms if over new limit
  useEffect(() => {
    setSelectedPlatforms(prev => prev.slice(0, planMaxPlatforms))
  }, [planMaxPlatforms])

  async function handleSubmit() {
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Save plan + platforms via API (uses service role to bypass RLS / create if missing)
    const saveRes = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan, selectedPlatforms }),
    })
    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({}))
      setError(err.error || t('saveError'))
      setSaving(false)
      return
    }

    // Auto-create upload-post.com profile using the UUID-based username
    try {
      await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.id }),
      })
    } catch {
      // Non-critical — can be retried later
    }

    // Redirect to Stripe Checkout
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan, yearly }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
    } catch {
      // Stripe not configured yet — fall back to waiting page
    }

    router.push('/waiting')
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0a0a0a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '2rem 1.5rem 4rem',
      color: '#fff',
    }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            <span style={{ color: '#3b82f6' }}>Flowing</span>Post
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            {t('title')}
          </h1>
          <p style={{ color: '#6b7280', margin: 0 }}>
            {t('subtitle')}
          </p>
        </div>

        {/* Step 1: Plan Selection */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#e5e7eb', margin: 0 }}>
              {t('step1')}
            </h2>
            {/* Yearly toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: yearly ? '#6b7280' : '#e5e7eb', fontWeight: yearly ? 400 : 600 }}>{t('monthly')}</span>
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
              <span style={{ fontSize: '0.8rem', color: yearly ? '#e5e7eb' : '#6b7280', fontWeight: yearly ? 600 : 400 }}>{t('yearly')}</span>
              {yearly && (
                <span style={{ fontSize: '0.65rem', background: '#16a34a', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '999px', fontWeight: 600 }}>
                  {t('yearlyBadge')}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {PLANS.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                style={{
                  background: selectedPlan === plan.id ? '#172554' : '#141414',
                  border: `1.5px solid ${selectedPlan === plan.id ? '#3b82f6' : plan.highlight ? '#374151' : '#1f2937'}`,
                  borderRadius: '0.875rem',
                  padding: '1.25rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                {plan.highlight && (
                  <span style={{
                    position: 'absolute',
                    top: '-0.625rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#3b82f6',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}>{t('popular')}</span>
                )}
                <div style={{ color: '#9ca3af', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {plan.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{plan.price}</span>
                  <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{plan.period}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {plan.features.map((f: string) => (
                    <li key={f} style={{ fontSize: '0.75rem', color: '#9ca3af', padding: '0.2rem 0', display: 'flex', gap: '0.4rem' }}>
                      <span style={{ color: '#3b82f6' }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </section>

        {/* Step 2: Platform Selection */}
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.375rem', color: '#e5e7eb' }}>
            {t('step2')}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginBottom: '1rem' }}>
            {t('platformCount', { selected: selectedPlatforms.length, max: planMaxPlatforms })}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {PLATFORMS.map(p => {
              const active = selectedPlatforms.includes(p.id)
              const atLimit = !active && selectedPlatforms.length >= planMaxPlatforms
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  disabled={atLimit}
                  style={{
                    padding: '0.4rem 0.875rem',
                    borderRadius: '999px',
                    border: `1.5px solid ${active ? p.color : '#2a2a2a'}`,
                    background: active ? `${p.color}18` : '#141414',
                    color: active ? '#fff' : atLimit ? '#3a3a3a' : '#9ca3af',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: atLimit ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          {selectedPlatforms.length >= planMaxPlatforms && (
            <p style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              {t('platformLimit')}
            </p>
          )}
        </section>

        {error && (
          <div style={{
            background: '#1f1010',
            border: '1px solid #5c1c1c',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            color: '#f87171',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || selectedPlatforms.length === 0}
          style={{
            width: '100%',
            padding: '0.875rem',
            background: saving ? '#1e3a8a' : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? t('saving') : t('submit')}
        </button>
      </div>
    </div>
  )
}

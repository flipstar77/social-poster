'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import React, { useState, useEffect, useRef } from 'react'
import LanguageSwitcher from '@/components/LanguageSwitcher'

// ── Types ────────────────────────────────────────────────────────────────────
type FeatureRow = { name: string; fp: string; later: string; hootsuite: string; buffer: string; planoly: string }
type VsPoint = { fp: string; other: string }
type FaqEntry = { q: string; a: string }
type PricingCard = { price: string; platforms: string; posts: string; note: string }

// ── CSS animations ───────────────────────────────────────────────────────────
const PAGE_CSS = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(32px) }
  to   { opacity: 1; transform: translateY(0) }
}
@media (max-width: 768px) {
  .vs-grid { grid-template-columns: 1fr !important; }
  .pricing-cards-grid { grid-template-columns: 1fr !important; }
}
@media (hover: hover) {
  .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(99,102,241,0.5) !important; }
}
`

// ── Scroll-in hook ───────────────────────────────────────────────────────────
function useScrollIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.disconnect() } },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [delay])
  const style: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(32px)',
    transition: 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)',
  }
  return { ref, style }
}

// ── FAQ accordion item ───────────────────────────────────────────────────────
function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid #e4e4e7' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 16, fontWeight: 600, color: '#09090b', fontFamily: 'inherit' }}
      >
        {q}
        <span style={{ fontSize: 20, color: '#a1a1aa', transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'none', flexShrink: 0, marginLeft: 16 }}>+</span>
      </button>
      <div style={{ maxHeight: open ? 400 : 0, overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ color: '#71717a', fontSize: 15, lineHeight: 1.7, margin: '0 0 20px', paddingRight: 40 }}>{a}</p>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function VergleichContent() {
  const t = useTranslations('vergleich')
  const tc = useTranslations('common')

  const features = t.raw('table.features') as FeatureRow[]
  const vsLaterPoints = t.raw('vsLater.points') as VsPoint[]
  const vsHootsuitePoints = t.raw('vsHootsuite.points') as VsPoint[]
  const vsBufferPoints = t.raw('vsBuffer.points') as VsPoint[]
  const vsPanolyPoints = t.raw('vsPlanoly.points') as VsPoint[]
  const faqItems = t.raw('faq.items') as FaqEntry[]
  const fpCard = t.raw('pricing.cards.flowingpost') as PricingCard
  const competitorCards = ['later', 'hootsuite', 'buffer', 'planoly'] as const
  const competitors = competitorCards.map(key => ({
    name: t(`table.${key}`),
    ...(t.raw(`pricing.cards.${key}`) as PricingCard),
  }))

  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  // Scroll-in refs
  const heroIn = useScrollIn()
  const tableIn = useScrollIn(80)
  const laterIn = useScrollIn()
  const hootsuiteIn = useScrollIn()
  const bufferIn = useScrollIn()
  const planolyIn = useScrollIn()
  const pricingIn = useScrollIn()
  const ctaIn = useScrollIn()
  const faqIn = useScrollIn()

  // ── VS Section helper ──
  const renderVsSection = (
    scrollIn: ReturnType<typeof useScrollIn>,
    title: string,
    subtitle: string,
    points: VsPoint[],
    bg: string,
  ) => (
    <div ref={scrollIn.ref} style={{ ...scrollIn.style, background: bg, padding: '80px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 800, marginBottom: 8, color: '#09090b' }}>{title}</h2>
        <p style={{ color: '#71717a', fontSize: 16, marginBottom: 36, maxWidth: 640 }}>{subtitle}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {points.map((p, i) => (
            <div key={i} className="vs-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '16px 20px', background: '#f0fdf4', borderRadius: 12, borderLeft: '3px solid #22c55e', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ color: '#166534', fontSize: 14, fontWeight: 500 }}>{p.fp}</span>
              </div>
              <div style={{ padding: '16px 20px', background: '#f4f4f5', borderRadius: 12, borderLeft: '3px solid #d4d4d8', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: '#a1a1aa', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✗</span>
                <span style={{ color: '#71717a', fontSize: 14 }}>{p.other}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <style>{PAGE_CSS}</style>
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: '#fff', color: '#09090b', minHeight: '100dvh' }}>

        {/* ── NAV ──────────────────────────────────────────────────────────── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e4e4e7', padding: '0 24px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 800, fontSize: 18, textDecoration: 'none' }}>
              <img src="/logo.png" alt="FlowingPost" width={28} height={28} style={{ borderRadius: 5 }} />
              <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FlowingPost</span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <LanguageSwitcher />
              <Link
                href="/login"
                className="cta-primary"
                style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', padding: '8px 20px', borderRadius: 999, fontSize: 14, fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s' }}
              >
                {t('cta.button')}
              </Link>
            </div>
          </div>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div ref={heroIn.ref} style={heroIn.style}>
          <section style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            {/* Background blob */}
            <div style={{ position: 'absolute', top: -80, right: -120, width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -60, left: -100, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative' }}>
              <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 999, background: '#eef2ff', color: '#6366f1', fontSize: 13, fontWeight: 700, marginBottom: 24, letterSpacing: '0.02em' }}>
                {t('hero.badge')}
              </div>
              <h1 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
                {t('hero.title1')}{' '}
                <span style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {t('hero.title2')}
                </span>
              </h1>
              <p style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: '#71717a', maxWidth: 640, margin: '0 auto 36px', lineHeight: 1.6 }}>
                {t('hero.subtitle')}
              </p>
              <Link
                href="/login"
                className="cta-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', padding: '14px 32px', borderRadius: 999, fontSize: 16, fontWeight: 700, textDecoration: 'none', transition: 'all 0.2s' }}
              >
                {t('cta.button')}
              </Link>
            </div>
          </section>
        </div>

        {/* ── FEATURE TABLE ────────────────────────────────────────────────── */}
        <div ref={tableIn.ref} style={tableIn.style}>
          <section style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 80px' }}>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>{t('table.title')}</h2>
            <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 40, fontSize: 16 }}>{t('table.subtitle')}</p>

            <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid #e4e4e7', background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e4e4e7' }}>
                    <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 700, color: '#71717a', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t('table.feature')}
                    </th>
                    <th style={{ padding: '20px 20px 16px', textAlign: 'center', fontWeight: 800, background: '#eef2ff', color: '#6366f1', borderLeft: '2px solid #c7d2fe', borderRight: '2px solid #c7d2fe' }}>
                      {t('table.flowingpost')}
                    </th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600, color: '#71717a' }}>{t('table.later')}</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600, color: '#71717a' }}>{t('table.hootsuite')}</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600, color: '#71717a' }}>{t('table.buffer')}</th>
                    <th style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 600, color: '#71717a' }}>{t('table.planoly')}</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((f, i) => {
                    const isNeg = (v: string) => v.startsWith('✗') || v.startsWith('Nur ') || v.startsWith('Only ') || v.includes('Manuell') || v.includes('Manual') || v.includes('manuell') || v.includes('Selbst') || v.includes('yourself') || v.includes('Nicht möglich') || v.includes('Not possible') || v.includes('Generisch') || v.includes('Generic') || v.includes('Enterprise') || v.includes('Instagram-fokus')
                    return (
                      <tr key={i} style={{ borderBottom: i < features.length - 1 ? '1px solid #f4f4f5' : 'none' }}>
                        <td style={{ padding: '14px 20px', fontWeight: 600, color: '#09090b', whiteSpace: 'nowrap' }}>{f.name}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 600, background: '#eef2ff', color: '#4338ca', borderLeft: '2px solid #c7d2fe', borderRight: '2px solid #c7d2fe' }}>{f.fp}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', color: isNeg(f.later) ? '#dc2626' : '#71717a', fontSize: isNeg(f.later) ? 13 : 14 }}>{f.later}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', color: isNeg(f.hootsuite) ? '#dc2626' : '#71717a', fontSize: isNeg(f.hootsuite) ? 13 : 14 }}>{f.hootsuite}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', color: isNeg(f.buffer) ? '#dc2626' : '#71717a', fontSize: isNeg(f.buffer) ? 13 : 14 }}>{f.buffer}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'center', color: isNeg(f.planoly) ? '#dc2626' : '#71717a', fontSize: isNeg(f.planoly) ? 13 : 14 }}>{f.planoly}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ── VS LATER ─────────────────────────────────────────────────────── */}
        {renderVsSection(laterIn, t('vsLater.title'), t('vsLater.subtitle'), vsLaterPoints, '#fff')}

        {/* ── VS HOOTSUITE ─────────────────────────────────────────────────── */}
        {renderVsSection(hootsuiteIn, t('vsHootsuite.title'), t('vsHootsuite.subtitle'), vsHootsuitePoints, '#fafafa')}

        {/* ── VS BUFFER ────────────────────────────────────────────────────── */}
        {renderVsSection(bufferIn, t('vsBuffer.title'), t('vsBuffer.subtitle'), vsBufferPoints, '#fff')}

        {/* ── VS PLANOLY ───────────────────────────────────────────────────── */}
        {renderVsSection(planolyIn, t('vsPlanoly.title'), t('vsPlanoly.subtitle'), vsPanolyPoints, '#fafafa')}

        {/* ── PRICING COMPARISON ───────────────────────────────────────────── */}
        <div ref={pricingIn.ref} style={pricingIn.style}>
          <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>{t('pricing.title')}</h2>
            <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 48, fontSize: 16 }}>{t('pricing.subtitle')}</p>

            {/* FlowingPost featured card */}
            <div style={{ maxWidth: 480, margin: '0 auto 40px', padding: 3, borderRadius: 20, background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>
              <div style={{ background: '#fff', borderRadius: 17, padding: 32, position: 'relative' }}>
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', padding: '4px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {t('pricing.best')}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#6366f1', marginBottom: 8 }}>FlowingPost</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginBottom: 16 }}>
                    <span style={{ fontSize: 48, fontWeight: 900, color: '#09090b', lineHeight: 1 }}>{fpCard.price}</span>
                    <span style={{ fontSize: 16, color: '#71717a' }}>{t('pricing.perMonth')}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                    <span style={{ padding: '6px 14px', background: '#eef2ff', borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#4338ca' }}>{fpCard.platforms}</span>
                    <span style={{ padding: '6px 14px', background: '#f0fdf4', borderRadius: 999, fontSize: 13, fontWeight: 600, color: '#166534' }}>{fpCard.posts}</span>
                  </div>
                  <p style={{ color: '#71717a', fontSize: 14, margin: 0 }}>{fpCard.note}</p>
                </div>
              </div>
            </div>

            {/* Competitor cards */}
            <div className="pricing-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {competitors.map((c, i) => (
                <div key={i} style={{ border: '1px solid #e4e4e7', borderRadius: 16, padding: 24, background: '#fafafa', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#71717a', marginBottom: 12 }}>{c.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: '#09090b', lineHeight: 1 }}>{c.price}</span>
                    <span style={{ fontSize: 13, color: '#a1a1aa' }}>{t('pricing.perMonth')}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#71717a' }}>
                    <span>{c.platforms}</span>
                    <span>{c.posts}</span>
                    <span style={{ color: '#a1a1aa', fontSize: 12 }}>{c.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <div ref={ctaIn.ref} style={ctaIn.style}>
          <section style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', padding: '80px 24px', textAlign: 'center' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: '#fff', marginBottom: 16 }}>{t('cta.title')}</h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 'clamp(16px, 2vw, 18px)', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.6 }}>
              {t('cta.subtitle')}
            </p>
            <Link
              href="/login"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#6366f1', padding: '16px 36px', borderRadius: 999, fontSize: 17, fontWeight: 800, textDecoration: 'none', transition: 'all 0.2s', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}
            >
              {t('cta.button')}
            </Link>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 16 }}>{t('cta.note')}</p>
          </section>
        </div>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <div ref={faqIn.ref} style={faqIn.style}>
          <section style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, textAlign: 'center', marginBottom: 48, color: '#09090b' }}>{t('faq.title')}</h2>
            <div>
              {faqItems.map((f, i) => (
                <FaqItem key={i} q={f.q} a={f.a} open={faqOpen === i} onToggle={() => setFaqOpen(faqOpen === i ? null : i)} />
              ))}
            </div>
          </section>
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid #e4e4e7', padding: '28px 24px', textAlign: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <p style={{ color: '#a1a1aa', fontSize: 13, margin: 0 }}>{tc('footer')}</p>
            <Link href="/" style={{ color: '#6366f1', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
              {t('footer.backToHome')}
            </Link>
          </div>
        </footer>

      </div>
    </>
  )
}

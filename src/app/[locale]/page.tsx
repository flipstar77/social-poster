'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import React, { useState, useEffect, useRef } from 'react'
import LanguageSwitcher from '@/components/LanguageSwitcher'

// ── CSS animations ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
@keyframes ticker {
  from { transform: translateX(0) }
  to   { transform: translateX(-50%) }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(32px) }
  to   { opacity: 1; transform: translateY(0) }
}
.ticker-track { animation: ticker 32s linear infinite; }
.ticker-track:hover { animation-play-state: paused; }
.testimonial-track { animation: ticker 45s linear infinite; }
.testimonial-track:hover { animation-play-state: paused; }
.hero-fadeup { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both; }
.hero-fadeup-2 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s both; }
.hero-fadeup-3 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
@keyframes heroImageCrossfade {
  0%, 42% { opacity: 1; }
  50%, 92% { opacity: 0; }
  100% { opacity: 1; }
}
.hero-img-1 { animation: heroImageCrossfade 10s ease-in-out infinite; }
.hero-img-2 { animation: heroImageCrossfade 10s ease-in-out infinite; animation-delay: -5s; }
@media (max-width: 768px) {
  .showcase-grid { grid-template-columns: 1fr !important; }
  .showcase-phone { display: none !important; }
  .pricing-grid { grid-template-columns: 1fr !important; }
  .hero-split { grid-template-columns: 1fr !important; }
  .hero-image-wrap { display: none !important; }
  .floating-posts { display: none !important; }
}
@media (max-width: 1400px) {
  .floating-posts { display: none !important; }
}
@media (hover: hover) {
  .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(99,102,241,0.5) !important; }
  .cta-secondary:hover { border-color: #6366f1 !important; color: #6366f1 !important; }
}
`

// ── Scroll-in hook ────────────────────────────────────────────────────────────
function useScrollIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return {
    ref,
    style: {
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(44px)',
      transition: `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.65s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    } as React.CSSProperties,
  }
}

// ── Parallax blobs ────────────────────────────────────────────────────────────
function ParallaxBlobs({ y }: { y: number }) {
  return (
    <>
      <div style={{ position: 'absolute', top: -180 + y * 0.28, right: -200, width: 900, height: 900, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 65%)' }} />
      <div style={{ position: 'absolute', bottom: -80 - y * 0.15, left: -160, width: 700, height: 700, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 65%)' }} />
      <div style={{ position: 'absolute', top: 160 + y * 0.1, left: '38%', width: 500, height: 500, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(236,72,153,0.10) 0%, transparent 65%)' }} />
      <div style={{ position: 'absolute', top: 40 + y * 0.06, left: '15%', width: 340, height: 340, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 65%)' }} />
    </>
  )
}

// ── Hover card wrapper (with 3D tilt) ─────────────────────────────────────────
function HoverCard({ children, accent = false, style: extraStyle }: { children: React.ReactNode; accent?: boolean; style?: React.CSSProperties }) {
  const [h, setH] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: py * -10, y: px * 10 })
  }

  const handleMouseLeave = () => { setH(false); setTilt({ x: 0, y: 0 }) }

  const isMoving = tilt.x !== 0 || tilt.y !== 0
  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setH(true)}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      style={{
        background: '#fff',
        border: h
          ? `2px solid ${accent ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.25)'}`
          : `${accent ? '2px' : '1px'} solid ${accent ? 'rgba(99,102,241,0.35)' : '#e4e4e7'}`,
        borderRadius: 20,
        transform: h
          ? `perspective(900px) translateY(-8px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
          : 'perspective(900px) translateY(0) rotateX(0deg) rotateY(0deg)',
        boxShadow: h
          ? `0 20px 60px ${accent ? 'rgba(99,102,241,0.18)' : 'rgba(0,0,0,0.1)'}`
          : `0 2px 20px ${accent ? 'rgba(99,102,241,0.08)' : 'rgba(0,0,0,0.04)'}`,
        transition: isMoving
          ? 'transform 0.08s ease, box-shadow 0.3s ease, border-color 0.3s ease'
          : 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, border-color 0.3s ease',
        cursor: 'default',
        willChange: 'transform',
        ...extraStyle,
      }}
    >
      {children}
    </div>
  )
}

// ── Step card ─────────────────────────────────────────────────────────────────
function StepCard({ n, icon, title, desc, delay }: { n: string; icon: string; title: string; desc: string; delay: number }) {
  const { ref, style } = useScrollIn(delay)
  return (
    <div ref={ref} style={style}>
      <HoverCard style={{ padding: '36px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 16, right: 20, fontSize: 56, fontWeight: 800, lineHeight: 1, color: 'rgba(99,102,241,0.06)', userSelect: 'none' }}>{n}</div>
        <div style={{ fontSize: 38, marginBottom: 18 }}>{icon}</div>
        <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10, color: '#09090b' }}>{title}</h3>
        <p style={{ fontSize: 15, color: '#71717a', lineHeight: 1.7, margin: 0 }}>{desc}</p>
      </HoverCard>
    </div>
  )
}

// ── Social media SVG icons ────────────────────────────────────────────────────
function IgIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}
function TikTokIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  )
}
function FbIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}
function YtIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
  )
}
function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
    </svg>
  )
}

// ── Scrolling pill ticker ─────────────────────────────────────────────────────
function Ticker({ items }: { items: { icon: React.ReactNode; text: string }[] }) {
  const doubled = [...items, ...items] // duplicate for infinite loop
  return (
    <div style={{ overflow: 'hidden', padding: '20px 0', borderTop: '1px solid #e4e4e7', background: '#fff' }}>
      <div className="ticker-track" style={{ display: 'flex', gap: 12, width: 'max-content' }}>
        {doubled.map((p, i) => (
          <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e4e4e7', borderRadius: 999, padding: '9px 20px', fontSize: 14, color: '#18181b', fontWeight: 500, whiteSpace: 'nowrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: 17 }}>{p.icon}</span>{p.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── FAQ accordion ─────────────────────────────────────────────────────────────
function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid #e4e4e7' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', gap: 16 }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: '#09090b' }}>{q}</span>
        <span style={{ fontSize: 22, color: '#6366f1', flexShrink: 0, transition: 'transform 0.3s ease', transform: open ? 'rotate(45deg)' : 'rotate(0)' }}>+</span>
      </button>
      <div style={{ overflow: 'hidden', maxHeight: open ? 200 : 0, transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)', }}>
        <p style={{ fontSize: 15, color: '#52525b', lineHeight: 1.7, margin: 0, paddingBottom: 20 }}>{a}</p>
      </div>
    </div>
  )
}


// ── Calendar section ──────────────────────────────────────────────────────────
const CAL_SCHEDULE = [
  [['IG'], [],          ['TT','FB'], [],     ['IG'],      [],    []        ],
  [[],     ['IG','TT'], [],          ['FB'], [],          ['IG'], []       ],
  [['TT'], [],          ['IG'],      [],     ['FB','TT'], [],    []        ],
  [[],     ['IG'],      [],          ['TT'], [],          [],    ['IG','FB']],
]
const PLAT_COLOR: Record<string, string> = {
  IG: '#e1306c', TT: '#010101', FB: '#1877f2',
}

interface CalendarBenefit {
  icon: string
  title: string
  desc: string
}

interface CalendarTranslations {
  badge: string
  title1: string
  title2: string
  subtitle: string
  days: string[]
  benefits: CalendarBenefit[]
  cta: string
  calendarMonth: string
  calendarPlanned: string
  calendarAutoPosted: string
}

function BenefitsList({ benefits, cta, listRef, listStyle }: { benefits: CalendarBenefit[]; cta: string; listRef: React.RefObject<HTMLDivElement | null>; listStyle: React.CSSProperties }) {
  const benefitsRef = useRef<HTMLDivElement>(null)
  const [benefitsVisible, setBenefitsVisible] = useState(false)
  useEffect(() => {
    if (!benefitsRef.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setBenefitsVisible(true); obs.disconnect() } }, { threshold: 0.3 })
    obs.observe(benefitsRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={listRef} style={{ ...listStyle, display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div ref={benefitsRef}>
        {benefits.map((b, i) => (
          <div key={b.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 28 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: benefitsVisible ? '#22c55e' : '#e4e4e7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: '#fff', fontWeight: 800,
              opacity: benefitsVisible ? 1 : 0,
              transform: benefitsVisible ? 'scale(1)' : 'scale(0.5)',
              transition: `background 0.4s ease ${200 + i * 200}ms, opacity 0.4s ease ${200 + i * 200}ms, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${200 + i * 200}ms`,
            }}>✓</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#09090b', marginBottom: 4 }}>{b.title}</div>
              <div style={{ fontSize: 14, color: '#71717a', lineHeight: 1.65 }}>{b.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#6366f1', color: '#fff', padding: '13px 28px', borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none', alignSelf: 'flex-start', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}>
        {cta}
      </Link>
    </div>
  )
}

// ── Floating mock posts (slide in from edges on scroll) ──────────────────────
const FLOATING_POSTS = [
  { Icon: IgIcon,     color: '#e1306c', user: 'trattoria_bella',       likes: '2.847', comments: '134', side: 'left'  as const, topPct: 4,  w: 180, speed: 0.7, img: '/showcase/food.png' },
  { Icon: TikTokIcon, color: '#010101', user: 'trattoria_bella',       likes: '12.4K', comments: '847', side: 'right' as const, topPct: 2,  w: 160, speed: 0.9, img: '/hero/wine.png' },
  { Icon: FbIcon,     color: '#1877f2', user: 'Trattoria Bella Vista', likes: '489',   comments: '67',  side: 'left'  as const, topPct: 48, w: 155, speed: 0.55, img: '/hero/gastronom.png' },
  { Icon: XIcon,      color: '#000',    user: '@trattoria_bella',      likes: '1.203', comments: '89',  side: 'right' as const, topPct: 55, w: 170, speed: 0.8, img: '/showcase/food.png' },
  { Icon: YtIcon,     color: '#ff0000', user: 'Trattoria Bella Vista', likes: '3.1K',  comments: '201', side: 'left'  as const, topPct: 78, w: 145, speed: 1.0, img: '/hero/wine.png' },
]

function FloatingPosts({ scrollY }: { scrollY: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [sectionTop, setSectionTop] = useState(0)
  const [sectionH, setSectionH] = useState(1)
  useEffect(() => {
    const update = () => {
      if (!wrapRef.current) return
      setSectionTop(wrapRef.current.offsetTop)
      setSectionH(wrapRef.current.offsetHeight || 1)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // progress: 0 when section enters viewport, 1 when it leaves
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800
  const relScroll = (scrollY - sectionTop + viewportH) / (sectionH + viewportH)
  const progress = Math.max(0, Math.min(1, relScroll))

  return (
    <div ref={wrapRef} className="floating-posts" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1 }}>
      {FLOATING_POSTS.map((p, i) => {
        const isLeft = p.side === 'left'
        // Each card peaks at its own scroll point, wider bell curve so they stay visible longer
        const peakCenter = 0.2 + i * 0.12
        const dist = Math.abs(progress - peakCenter)
        const cardVis = Math.max(0, Math.min(1, 1 - dist * 2)) // wider bell curve
        // Slide: off-screen → peek in → back out
        const slideX = isLeft
          ? -100 + cardVis * 120  // -100% → +20%
          : 100 - cardVis * 120   // 100% → -20%
        const driftY = (progress - peakCenter) * (50 + i * 15) * (i % 2 === 0 ? -1 : 1)
        const rot = (isLeft ? -4 : 4) * (1 - cardVis)
        return (
          <div key={i} style={{
            position: 'absolute',
            top: `${p.topPct}%`,
            [p.side]: 0,
            width: p.w,
            opacity: cardVis * 0.5,
            transform: `translateX(${slideX}%) translateY(${driftY}px) rotate(${rot}deg)`,
            willChange: 'transform, opacity',
          }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e4e4e7', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px 6px' }}>
                <span style={{ color: p.color, display: 'flex' }}><p.Icon /></span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#09090b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.user}</span>
              </div>
              <div style={{ aspectRatio: '1', overflow: 'hidden' }}>
                <img src={p.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ padding: '6px 10px 8px', display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 600 }}>❤️ {p.likes}</span>
                <span style={{ fontSize: 10, color: '#71717a' }}>💬 {p.comments}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CalendarSection({ translations }: { translations: CalendarTranslations }) {
  const { ref: headRef, style: headStyle } = useScrollIn(0)
  const { ref: calRef,  style: calStyle  } = useScrollIn(150)
  const { ref: listRef, style: listStyle } = useScrollIn(250)
  const calVisRef = useRef<HTMLDivElement>(null)
  const [calVisible, setCalVisible] = useState(false)
  useEffect(() => {
    if (!calVisRef.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setCalVisible(true); obs.disconnect() } }, { threshold: 0.3 })
    obs.observe(calVisRef.current)
    return () => obs.disconnect()
  }, [])

  // Build flat index for staggered checkmark animation
  let cellIndex = 0
  return (
    <section style={{ background: '#f8fafc', borderTop: '1px solid #e4e4e7', padding: '88px 24px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div ref={headRef} style={{ ...headStyle, textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 999, background: 'linear-gradient(135deg,#ede9fe,#fce7f3)', border: '1px solid #c4b5fd', color: '#7c3aed', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
            {translations.badge}
          </div>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, color: '#09090b', lineHeight: 1.15, marginBottom: 14 }}>
            {translations.title1}<br />
            <span style={{ color: '#6366f1' }}>
              {translations.title2}
            </span>
          </h2>
          <p style={{ color: '#71717a', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>
            {translations.subtitle}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 40, alignItems: 'center' }}>
          {/* Calendar mockup */}
          <div ref={calRef} style={calStyle}>
            <div ref={calVisRef}>
            <HoverCard style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#09090b' }}>{translations.calendarMonth}</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {Object.entries(PLAT_COLOR).map(([k, c]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#71717a' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{k}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
                {translations.days.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#a1a1aa' }}>{d}</div>
                ))}
              </div>
              {CAL_SCHEDULE.map((week, wi) => (
                <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
                  {week.map((day, di) => {
                    const hasPosts = day.length > 0
                    const idx = hasPosts ? cellIndex++ : 0
                    return (
                      <div key={di} style={{ minHeight: 46, background: day.length ? '#faf5ff' : '#f8fafc', borderRadius: 8, border: `1px solid ${day.length ? '#e9d5ff' : '#f0f0f0'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '4px 2px', position: 'relative' }}>
                        <span style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 500 }}>{wi * 7 + di + 1}</span>
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {day.map(p => <div key={p} style={{ width: 7, height: 7, borderRadius: '50%', background: PLAT_COLOR[p] ?? '#888' }} />)}
                        </div>
                        {hasPosts && (
                          <div style={{
                            position: 'absolute', top: 3, right: 3,
                            width: 14, height: 14, borderRadius: '50%',
                            background: '#22c55e', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8, fontWeight: 800,
                            opacity: calVisible ? 1 : 0,
                            transform: calVisible ? 'scale(1)' : 'scale(0)',
                            transition: `opacity 0.3s ease ${300 + idx * 120}ms, transform 0.4s cubic-bezier(0.34,1.56,0.64,1) ${300 + idx * 120}ms`,
                          }}>✓</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
              <div style={{ marginTop: 14, fontSize: 12, color: '#71717a', textAlign: 'center' }}>
                <span style={{ color: '#6366f1', fontWeight: 600 }}>{translations.calendarPlanned}</span> · <span style={{ color: '#22c55e', fontWeight: 600 }}>{translations.calendarAutoPosted}</span>
              </div>
            </HoverCard>
            </div>
          </div>

          {/* Benefits */}
          <BenefitsList benefits={translations.benefits} cta={translations.cta} listRef={listRef} listStyle={listStyle} />
        </div>
      </div>
    </section>
  )
}

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCountUp(target: number, isVisible: boolean, duration = 1400) {
  const [count, setCount] = useState(0)
  const animated = useRef(false)
  useEffect(() => {
    if (!isVisible || animated.current) return
    animated.current = true
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(eased * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [isVisible, target, duration])
  return count
}

// ── Stats strip ───────────────────────────────────────────────────────────────
interface StatItem {
  value: number
  suffix: string
  label: string
  icon: string
}

function StatCount({ stat, visible, delay }: { stat: StatItem; visible: boolean; delay: number }) {
  const n = useCountUp(stat.value, visible)
  return (
    <div style={{ textAlign: 'center', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms` }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{stat.icon}</div>
      <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-2px' }}>{n}{stat.suffix}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6, fontWeight: 500 }}>{stat.label}</div>
    </div>
  )
}

function StatsStrip({ stats }: { stats: StatItem[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.3 })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)', padding: '56px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 40 }}>
        {stats.map((s, i) => <StatCount key={i} stat={s} visible={visible} delay={i * 120} />)}
      </div>
    </div>
  )
}

// ── Sticky showcase ───────────────────────────────────────────────────────────
interface ShowcaseStep {
  n: string
  title: string
  desc: string
  color: string
}

interface PhoneScreenTranslations {
  selectImage: string
  optionalNote: string
  noteExample: string
  variants: string
  variantTexts: string[]
  platforms: string
  postNow: string
}

function PhoneScreen({ step, progress, translations }: { step: number; progress: number; translations: PhoneScreenTranslations }) {
  // Sub-progress within each step (0→1)
  const stepProgress = step === 0 ? progress * 3.2 : step === 1 ? (progress * 3.2) - 1 : (progress * 3.2) - 2
  const sub = Math.max(0, Math.min(1, stepProgress))

  if (step === 0) {
    // Image drops in, then badge appears
    const imgY = Math.min(1, sub * 3) // 0→1 in first third
    const badgeOpacity = Math.max(0, Math.min(1, (sub - 0.4) * 3))
    const noteOpacity = Math.max(0, Math.min(1, (sub - 0.6) * 3))
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>
        <div style={{ flex: 1, borderRadius: 16, overflow: 'hidden', position: 'relative', border: '2px solid #c4b5fd' }}>
          <img src="/showcase/food.png" alt="Food photo" style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: `translateY(${(1 - imgY) * -40}px) scale(${0.9 + imgY * 0.1})`,
            opacity: imgY,
            transition: 'none',
          }} />
          <div style={{ position: 'absolute', bottom: 8, right: 8, background: '#22c55e', borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 700, color: '#fff', opacity: badgeOpacity, transform: `scale(${0.6 + badgeOpacity * 0.4})` }}>
            ✓ {translations.selectImage}
          </div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', border: '1px solid #e4e4e7', opacity: noteOpacity, transform: `translateY(${(1 - noteOpacity) * 10}px)` }}>
          <div style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 4, fontWeight: 700, letterSpacing: '0.05em' }}>{translations.optionalNote}</div>
          <div style={{ fontSize: 12, color: '#52525b' }}>{translations.noteExample}</div>
        </div>
      </div>
    )
  }

  if (step === 1) {
    // Captions slide in one by one
    return (
      <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2, flexShrink: 0, opacity: Math.min(1, sub * 4) }}>{translations.variants}</div>
        {translations.variantTexts.map((text, i) => {
          const sel = i === 0
          const cardProgress = Math.max(0, Math.min(1, (sub - i * 0.25) * 4))
          return (
            <div key={i} style={{
              background: sel ? '#eef2ff' : '#f8fafc',
              border: `1.5px solid ${sel ? '#6366f1' : '#e4e4e7'}`,
              borderRadius: 10, padding: '8px 10px',
              flexShrink: 0,
              opacity: cardProgress,
              transform: `translateX(${(1 - cardProgress) * 30}px)`,
            }}>
              <div style={{ fontSize: 10, color: sel ? '#3730a3' : '#71717a', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{text}</div>
            </div>
          )
        })}
      </div>
    )
  }

  // Step 2: published posts slide in from right with engagement
  const posts = [
    { Icon: IgIcon,      name: 'Instagram', color: '#e1306c', likes: 127, comments: 23 },
    { Icon: TikTokIcon,  name: 'TikTok',    color: '#010101', likes: 342, comments: 41 },
    { Icon: FbIcon,      name: 'Facebook',  color: '#1877f2', likes: 89,  comments: 12 },
    { Icon: YtIcon,      name: 'YouTube',   color: '#ff0000', likes: 56,  comments: 8  },
    { Icon: XIcon,       name: 'X',         color: '#000',    likes: 73,  comments: 15 },
  ]

  return (
    <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4, opacity: Math.min(1, sub * 4) }}>
        <span>✓</span> {translations.postNow}
      </div>
      {posts.map((p, i) => {
        const cardProgress = Math.max(0, Math.min(1, (sub - i * 0.12) * 5))
        const engagementProgress = Math.max(0, Math.min(1, (sub - 0.3 - i * 0.12) * 4))
        return (
          <div key={p.name} style={{
            display: 'flex', gap: 8, padding: '6px 8px',
            background: '#fff', borderRadius: 10,
            border: '1px solid #e4e4e7',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            opacity: cardProgress,
            transform: `translateX(${(1 - cardProgress) * 60}px)`,
          }}>
            {/* Mini food photo */}
            <div style={{ width: 38, height: 38, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
              <img src="/showcase/food.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Platform header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <span style={{ color: p.color, display: 'flex', transform: 'scale(0.7)', transformOrigin: 'left center' }}><p.Icon /></span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#18181b' }}>{p.name}</span>
                <span style={{ fontSize: 8, color: '#22c55e', fontWeight: 700, marginLeft: 'auto' }}>LIVE</span>
              </div>
              {/* Engagement metrics */}
              <div style={{ display: 'flex', gap: 8, opacity: engagementProgress }}>
                <span style={{ fontSize: 9, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 2 }}>❤️ {Math.round(p.likes * engagementProgress)}</span>
                <span style={{ fontSize: 9, color: '#71717a', display: 'flex', alignItems: 'center', gap: 2 }}>💬 {Math.round(p.comments * engagementProgress)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StickyShowcase({ scrollY, vh, steps, label, title1, title2, phoneTranslations }: { scrollY: number; vh: number; steps: ShowcaseStep[]; label: string; title1: string; title2: string; phoneTranslations: PhoneScreenTranslations }) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(9999)
  useEffect(() => {
    const update = () => { if (ref.current) setTop(ref.current.offsetTop) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const progress = Math.max(0, Math.min(1, (scrollY - top) / (vh * 1.2)))
  const step = Math.min(Math.floor(progress * 3.2), 2)
  const stepColor = steps[step].color

  return (
    <div ref={ref} style={{ position: 'relative', minHeight: '220vh' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', background: '#fff' }}>
        <div className="showcase-grid" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px', width: '100%', display: 'grid', gridTemplateColumns: '1fr auto', gap: 48, alignItems: 'center' }}>

          {/* Left: step list */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>{label}</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, color: '#09090b', lineHeight: 1.1, marginBottom: 40 }}>
              {title1}<br />
              <span style={{ color: stepColor, transition: 'color 0.5s ease' }}>
                {title2}
              </span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {steps.map((s, i) => {
                const active = i === step
                const done = i < step
                return (
                  <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', opacity: active ? 1 : done ? 0.55 : 0.25, transform: active ? 'translateX(0)' : 'translateX(-6px)', transition: 'all 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: active ? s.color : done ? '#22c55e' : '#f4f4f5', color: active || done ? '#fff' : '#a1a1aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, transition: 'all 0.5s ease' }}>
                      {done ? '✓' : s.n}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: '#09090b', marginBottom: 4 }}>{s.title}</div>
                      <div style={{ fontSize: 14, color: '#71717a', lineHeight: 1.65 }}>{s.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: CSS phone mockup */}
          <div className="showcase-phone" style={{ flexShrink: 0 }}>
            <div style={{ width: 260, height: 520, background: '#09090b', borderRadius: 44, border: '2px solid #27272a', boxShadow: `0 32px 100px rgba(0,0,0,0.18), 0 0 60px ${stepColor}30`, position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.6s ease' }}>
              {/* Notch */}
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 88, height: 24, background: '#09090b', borderRadius: '0 0 14px 14px', zIndex: 10 }} />
              {/* Screen */}
              <div style={{ position: 'absolute', inset: 3, background: '#f8fafc', borderRadius: 42, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* App bar */}
                <div style={{ background: '#fff', padding: '34px 14px 10px', borderBottom: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✨</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#09090b', flex: 1 }}>FlowingPost</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i <= step ? steps[Math.min(i, step)].color : '#e4e4e7', transition: 'background 0.4s ease' }} />
                    ))}
                  </div>
                </div>
                <PhoneScreen step={step} progress={progress} translations={phoneTranslations} />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll progress bar */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#f4f4f5' }}>
          <div style={{ height: '100%', background: `linear-gradient(90deg, #6366f1, #a855f7, #ec4899)`, width: `${progress * 100}%`, transition: 'width 0.1s linear' }} />
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const t = useTranslations('landing')
  const tc = useTranslations('common')

  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [yearly, setYearly] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [windowHeight, setWindowHeight] = useState(0)

  useEffect(() => {
    setWindowHeight(window.innerHeight)
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY)
          ticking = false
        })
        ticking = true
      }
    }
    const onResize = () => setWindowHeight(window.innerHeight)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Hero parallax — progress 0→1 over first viewport height
  const vh = windowHeight || 800
  const heroProgress = Math.min(scrollY / (vh * 0.85), 1)
  const heroBlobScale = 1 + heroProgress * 0.65
  const heroBlobOpacity = Math.max(0, 1 - heroProgress * 2.1)
  const heroBlobBlur = heroProgress * 10
  const heroTextY = heroProgress * -45

  // ── Build translation-dependent data ────────────────────────────────────────

  // Ticker
  const tickerTexts = t.raw('ticker') as string[]
  const PILL_ITEMS: { icon: React.ReactNode; text: string }[] = [
    { icon: '⏱️', text: tickerTexts[0] },
    { icon: '📈', text: tickerTexts[1] },
    { icon: '🔁', text: tickerTexts[2] },
    { icon: '🤖', text: tickerTexts[3] },
    { icon: <IgIcon />, text: tickerTexts[4] },
    { icon: <TikTokIcon />, text: tickerTexts[5] },
    { icon: <FbIcon />, text: tickerTexts[6] },
    { icon: <YtIcon />, text: tickerTexts[7] },
    { icon: <XIcon />, text: tickerTexts[8] },
    { icon: '🎨', text: tickerTexts[9] },
    { icon: '🗣️', text: tickerTexts[10] },
    { icon: '💸', text: tickerTexts[11] },
    { icon: '🌍', text: tickerTexts[12] },
    { icon: '🚀', text: tickerTexts[13] },
  ]

  // Stats
  const statsData = t.raw('stats') as Array<{ suffix: string; label: string }>
  const STATS: StatItem[] = [
    { value: 3, suffix: statsData[0].suffix, label: statsData[0].label, icon: '⏱️' },
    { value: 9, suffix: statsData[1].suffix, label: statsData[1].label, icon: '🚀' },
    { value: 30, suffix: statsData[2].suffix, label: statsData[2].label, icon: '⚡' },
    { value: 90, suffix: statsData[3].suffix, label: statsData[3].label, icon: '📈' },
  ]

  // Showcase steps
  const showcaseStepsData = t.raw('showcase.steps') as Array<{ title: string; desc: string }>
  const SHOWCASE_STEPS: ShowcaseStep[] = [
    { n: '01', title: showcaseStepsData[0].title, desc: showcaseStepsData[0].desc, color: '#6366f1' },
    { n: '02', title: showcaseStepsData[1].title, desc: showcaseStepsData[1].desc, color: '#a855f7' },
    { n: '03', title: showcaseStepsData[2].title, desc: showcaseStepsData[2].desc, color: '#ec4899' },
  ]

  // Phone screen translations
  const phoneTranslations: PhoneScreenTranslations = {
    selectImage: t('showcase.phone.selectImage'),
    optionalNote: t('showcase.phone.optionalNote'),
    noteExample: t('showcase.phone.noteExample'),
    variants: t('showcase.phone.variants'),
    variantTexts: t.raw('showcase.phone.variantTexts') as string[],
    platforms: t('showcase.phone.platforms'),
    postNow: t('showcase.phone.postNow'),
  }

  // Calendar translations
  const calendarBenefits = t.raw('calendar.benefits') as CalendarBenefit[]
  const calendarTranslations: CalendarTranslations = {
    badge: t('calendar.badge'),
    title1: t('calendar.title1'),
    title2: t('calendar.title2'),
    subtitle: t('calendar.subtitle'),
    days: t.raw('calendar.days') as string[],
    benefits: calendarBenefits,
    cta: t('calendar.cta'),
    calendarMonth: t('calendar.calendarMonth'),
    calendarPlanned: t('calendar.calendarPlanned'),
    calendarAutoPosted: t('calendar.calendarAutoPosted'),
  }

  // Comparison
  const comparisonWithoutItems = t.raw('comparison.without.items') as string[]
  const comparisonWithItems = t.raw('comparison.with.items') as string[]

  // Audience
  const audiencePlatforms = t.raw('audience.platforms') as string[]
  const audienceTargets = t.raw('audience.targets') as string[]

  // Pricing
  const starterFeatures = t.raw('pricing.starter.features') as string[]
  const growthFeatures = t.raw('pricing.growth.features') as string[]
  const proFeatures = t.raw('pricing.pro.features') as string[]

  // FAQ
  const faqItems = t.raw('faq.items') as Array<{ q: string; a: string }>

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#18181b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(248,250,252,0.92)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #e4e4e7' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
              <img src="/logo.png" alt="FlowingPost" width={32} height={32} style={{ borderRadius: 6 }} />
              <span style={{ fontWeight: 700, fontSize: 16, color: '#09090b' }}>FlowingPost</span>
            </Link>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <LanguageSwitcher />
              <Link href="/blog" style={{ fontSize: 14, color: '#71717a', textDecoration: 'none', padding: '8px 14px' }}>Blog</Link>
              <Link href="/login" style={{ fontSize: 14, color: '#71717a', textDecoration: 'none', padding: '8px 14px' }}>{t('nav.login')}</Link>
              <Link href="/login" style={{ background: '#6366f1', color: 'white', padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                {t('nav.cta')}
              </Link>
            </div>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <section style={{ position: 'relative', overflow: 'hidden', background: '#fff', borderBottom: '1px solid #e4e4e7' }}>
          {/* Blobs wrapper — zooms + blurs + fades on scroll */}
          <div style={{
            position: 'absolute', inset: 0, overflow: 'hidden',
            transform: `scale(${heroBlobScale})`,
            opacity: heroBlobOpacity,
            filter: `blur(${heroBlobBlur}px)`,
            transformOrigin: '50% 30%',
            willChange: 'transform, opacity, filter',
          }}>
            <ParallaxBlobs y={scrollY} />
          </div>
          {/* Hero content — split layout */}
          <div className="hero-split" style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(56px, 10vw, 96px) 24px', position: 'relative', transform: `translateY(${heroTextY}px)`, willChange: 'transform', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
            {/* Left: text */}
            <div>
              <div className="hero-fadeup" style={{ display: 'inline-block', padding: '6px 18px', borderRadius: 999, background: 'linear-gradient(135deg, #eef2ff, #fdf4ff)', border: '1px solid #c7d2fe', color: '#6366f1', fontSize: 13, fontWeight: 700, marginBottom: 28, letterSpacing: '0.02em' }}>
                {t('hero.badge')}
              </div>
              <h1 className="hero-fadeup-2" style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 800, lineHeight: 1.08, marginBottom: 24, letterSpacing: '-1.5px', color: '#09090b' }}>
                {t('hero.title1')}<br />
                <span style={{ color: '#6366f1' }}>
                  {t('hero.title2')}
                </span>
              </h1>
              <p className="hero-fadeup-3" style={{ fontSize: 'clamp(15px, 1.8vw, 18px)', color: '#52525b', maxWidth: 480, margin: '0 0 32px', lineHeight: 1.75 }}>
                {t('hero.subtitle')}
              </p>
              <div className="hero-fadeup-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
                <Link href="/login" className="cta-primary" style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: 'white', padding: '16px 40px', borderRadius: 14, fontSize: 17, fontWeight: 700, textDecoration: 'none', boxShadow: '0 6px 28px rgba(99,102,241,0.45)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
                  {t('hero.ctaPrimary')}
                </Link>
                <p style={{ fontSize: 14, color: '#71717a', margin: 0 }}>
                  ⭐⭐⭐⭐⭐ {t('hero.miniProof')}
                </p>
              </div>
            </div>
            {/* Right: crossfading hero images */}
            <div className="hero-image-wrap hero-fadeup-3" style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
              <img className="hero-img-1" src="/hero/gastronom.png" alt="Gastronom am Handy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <img className="hero-img-2" src="/hero/wine.png" alt="Gastronomin mit Tablet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>
        </section>

        {/* ── TICKER ──────────────────────────────────────────────────────── */}
        <Ticker items={PILL_ITEMS} />

        {/* Gradient bridge: white → dark */}
        <div style={{ height: 160, background: 'linear-gradient(to bottom, #ffffff 0%, #3f3f46 50%, #09090b 100%)' }} />

        {/* ── PAIN POINT (Numbers-driven) ────────────────────────────────── */}
        {(() => {
          const stats = t.raw('painpoint.stats') as Array<{ number: string; text: string; subtext: string }>
          return (
            <section style={{ background: '#09090b', color: '#fff', padding: '80px 24px', overflow: 'hidden' }}>
              <div style={{ maxWidth: 960, margin: '0 auto' }}>
                {/* Section label */}
                {(() => { const s = useScrollIn(0); return (
                  <div ref={s.ref} style={{ ...s.style, textAlign: 'center', marginBottom: 56 }}>
                    <div style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#a1a1aa', fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
                      {t('painpoint.title')}
                    </div>
                  </div>
                ) })()}

                {/* Stats grid — big numbers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 20, overflow: 'hidden', marginBottom: 56 }}>
                  {stats.map((s, i) => {
                    const si = useScrollIn(i * 80)
                    return (
                      <div ref={si.ref} key={i} style={{ ...si.style, background: '#09090b', padding: '36px 28px' }}>
                        <div style={{ fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-2px', marginBottom: 10 }}>
                          {s.number}
                        </div>
                        <div style={{ fontSize: 15, color: '#d4d4d8', lineHeight: 1.5, marginBottom: 6, fontWeight: 500 }}>
                          {s.text}
                        </div>
                        <div style={{ fontSize: 13, color: '#71717a', lineHeight: 1.4 }}>
                          {s.subtext}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Agitate + Solve */}
                {(() => { const s = useScrollIn(0); return (
                  <div ref={s.ref} style={{ ...s.style, textAlign: 'center' }}>
                    <p style={{ fontSize: 16, color: '#ef4444', fontWeight: 600, marginBottom: 32 }}>
                      {t('painpoint.agitate')}
                    </p>
                    <h3 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 800, color: '#fff', marginBottom: 14 }}>
                      {t('painpoint.solveTitle')}
                    </h3>
                    <p style={{ fontSize: 16, color: '#a1a1aa', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.7 }}>
                      {t('painpoint.solveText')}
                    </p>
                    <Link href="/login" className="cta-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#09090b', padding: '14px 36px', borderRadius: 14, fontSize: 16, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 20px rgba(255,255,255,0.15)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
                      {t('painpoint.cta')}
                    </Link>
                  </div>
                ) })()}
              </div>
            </section>
          )
        })()}

        {/* ── STATS ───────────────────────────────────────────────────────── */}
        <StatsStrip stats={STATS} />

        {/* ── SOCIAL PROOF ─────────────────────────────────────────────────── */}
        <section style={{ background: '#f8fafc', borderBottom: '1px solid #e4e4e7', padding: '72px 0' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, textAlign: 'center', marginBottom: 8, color: '#09090b' }}>
              {t('social.title')}
            </h2>
            <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 40, fontSize: 16 }}>
              {t('social.subtitle')}
            </p>
          </div>
          {/* Scrolling testimonial ticker */}
          <div style={{ overflow: 'hidden', padding: '4px 0' }}>
            <div className="testimonial-track" style={{ display: 'flex', gap: 20, width: 'max-content' }}>
              {[...(t.raw('social.testimonials') as Array<{ name: string; role: string; text: string; stars: number; image?: string }>), ...(t.raw('social.testimonials') as Array<{ name: string; role: string; text: string; stars: number; image?: string }>)].map((item, i) => (
                <div key={i} style={{ width: 340, flexShrink: 0, background: '#fff', border: '1px solid #e4e4e7', borderRadius: 20, padding: 28, boxShadow: '0 2px 20px rgba(0,0,0,0.04)', transition: 'box-shadow 0.3s ease, border-color 0.3s ease' }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                    {Array.from({ length: item.stars }).map((_, si) => (
                      <span key={si} style={{ color: '#f59e0b', fontSize: 16 }}>★</span>
                    ))}
                  </div>
                  <p style={{ fontSize: 15, color: '#3f3f46', lineHeight: 1.7, margin: '0 0 18px', fontStyle: 'italic', minHeight: 80 }}>
                    &ldquo;{item.text}&rdquo;
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {item.image ? (
                      <img src={item.image} alt={item.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                        {item.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: '#a1a1aa' }}>{item.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STICKY SHOWCASE ─────────────────────────────────────────────── */}
        <StickyShowcase
          scrollY={scrollY}
          vh={vh}
          steps={SHOWCASE_STEPS}
          label={t('showcase.label')}
          title1={t('showcase.title1')}
          title2={t('showcase.title2')}
          phoneTranslations={phoneTranslations}
        />

        {/* ── AUTO-SCHEDULER + FLOATING POSTS ──────────────────────────── */}
        <div style={{ position: 'relative' }}>
          <FloatingPosts scrollY={scrollY} />
          <CalendarSection translations={calendarTranslations} />
        </div>

        {/* ── COMPARISON ──────────────────────────────────────────────────── */}
        <section style={{ background: '#fff', borderTop: '1px solid #e4e4e7', borderBottom: '1px solid #e4e4e7' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 24px' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, textAlign: 'center', marginBottom: 10, color: '#09090b' }}>{t('comparison.title')}</h2>
            <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 48, fontSize: 16 }}>{t('comparison.subtitle')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 720, margin: '0 auto' }}>
              <HoverCard style={{ padding: 28, background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#a1a1aa' }}>{t('comparison.without.label')}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {comparisonWithoutItems.map(item => (
                    <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14, color: '#71717a', alignItems: 'flex-start' }}>
                      <span style={{ color: '#ef4444', flexShrink: 0, fontWeight: 700 }}>✗</span>{item}
                    </li>
                  ))}
                </ul>
              </HoverCard>
              <HoverCard accent style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#6366f1' }}>{t('comparison.with.label')}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {comparisonWithItems.map(item => (
                    <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14, color: '#18181b', alignItems: 'flex-start' }}>
                      <span style={{ color: '#22c55e', flexShrink: 0, fontWeight: 700 }}>✓</span>{item}
                    </li>
                  ))}
                </ul>
              </HoverCard>
            </div>
          </div>
        </section>

        {/* ── AUDIENCE ──────────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, marginBottom: 10, color: '#09090b' }}>{t('audience.title')}</h2>
          <p style={{ color: '#71717a', marginBottom: 16, fontSize: 16 }}>
            {t('audience.subtitle')}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
            {audiencePlatforms.map(p => (
              <span key={p} style={{ padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366f1' }}>{p}</span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {audienceTargets.map(item => (
              <span key={item} style={{ padding: '10px 22px', borderRadius: 999, fontSize: 14, fontWeight: 500, background: '#fff', border: '1px solid #e4e4e7', color: '#3f3f46' }}>{item}</span>
            ))}
          </div>
        </section>

        {/* ── PRICING ─────────────────────────────────────────────── */}
        <section id="kaufen" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)', borderTop: '1px solid #e4e4e7', borderBottom: '1px solid #e4e4e7' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(56px, 8vw, 80px) 24px' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, textAlign: 'center', marginBottom: 10, color: '#09090b' }}>{t('pricing.title')}</h2>
            <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 24, fontSize: 16, maxWidth: 480, margin: '0 auto 24px' }}>
              {t('pricing.subtitle')}
            </p>

            {/* Promo banner */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '1px solid #fbbf24', borderRadius: 999, padding: '8px 20px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                {t('pricing.promo')}
              </div>
            </div>

            {/* Billing toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 48 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: yearly ? '#71717a' : '#09090b' }}>{t('pricing.monthly')}</span>
              <button
                onClick={() => setYearly(!yearly)}
                style={{
                  position: 'relative', width: 52, height: 28, borderRadius: 999,
                  background: yearly ? '#6366f1' : '#e4e4e7',
                  border: 'none', cursor: 'pointer', transition: 'background 0.25s',
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 4, left: yearly ? 28 : 4,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                  display: 'block',
                }} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: yearly ? '#09090b' : '#71717a' }}>
                {t('pricing.yearly')}
                <span style={{ marginLeft: 6, background: '#dcfce7', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{t('pricing.yearlyBadge')}</span>
              </span>
            </div>

            {/* 3 Tier cards */}
            <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

              {/* Starter */}
              <HoverCard style={{ padding: 36, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>{t('pricing.starter.name')}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, color: '#09090b', lineHeight: 1 }}>{yearly ? '33' : '39'} €</span>
                  <span style={{ fontSize: 14, color: '#71717a' }}>{t('pricing.perMonth')}</span>
                </div>
                <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 28 }}>
                  {yearly ? t('pricing.starter.yearlyNote') : t('pricing.cancelMonthly')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e4e4e7' }}>
                  <span style={{ fontSize: 18 }}>📱</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>{t('pricing.starter.highlight')}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
                  {starterFeatures.map(item => (
                    <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14 }}>
                      <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>✓</span>
                      <span style={{ color: '#18181b' }}>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#18181b', color: 'white', padding: '13px', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
                >
                  {t('pricing.cta')}
                </Link>
              </HoverCard>

              {/* Growth — POPULAR */}
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 16px', borderRadius: 999, letterSpacing: '0.06em', zIndex: 1, whiteSpace: 'nowrap' }}>{t('pricing.popular')}</div>
                <HoverCard accent style={{ padding: 36, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>{t('pricing.growth.name')}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 48, fontWeight: 800, color: '#09090b', lineHeight: 1 }}>{yearly ? '66' : '79'} €</span>
                    <span style={{ fontSize: 14, color: '#71717a' }}>{t('pricing.perMonth')}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 28 }}>
                    {yearly ? t('pricing.growth.yearlyNote') : t('pricing.cancelMonthly')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '10px 14px', background: '#eef2ff', borderRadius: 10, border: '1px solid #c7d2fe' }}>
                    <span style={{ fontSize: 18 }}>🚀</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#3730a3' }}>{t('pricing.growth.highlight')}</span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
                    {growthFeatures.map(item => (
                      <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14 }}>
                        <span style={{ color: '#6366f1', fontWeight: 700, flexShrink: 0 }}>✓</span>
                        <span style={{ color: '#18181b' }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: 'white', padding: '13px', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}
                  >
                    {t('pricing.cta')}
                  </Link>
                </HoverCard>
              </div>

              {/* Pro */}
              <HoverCard style={{ padding: 36, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>{t('pricing.pro.name')}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, color: '#09090b', lineHeight: 1 }}>{yearly ? '125' : '149'} €</span>
                  <span style={{ fontSize: 14, color: '#71717a' }}>{t('pricing.perMonth')}</span>
                </div>
                <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 28 }}>
                  {yearly ? t('pricing.pro.yearlyNote') : t('pricing.cancelMonthly')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '10px 14px', background: '#fdf4ff', borderRadius: 10, border: '1px solid #e9d5ff' }}>
                  <span style={{ fontSize: 18 }}>🌍</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#7e22ce' }}>{t('pricing.pro.highlight')}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
                  {proFeatures.map(item => (
                    <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14 }}>
                      <span style={{ color: '#a855f7', fontWeight: 700, flexShrink: 0 }}>✓</span>
                      <span style={{ color: '#18181b' }}>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#18181b', color: 'white', padding: '13px', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
                >
                  {t('pricing.cta')}
                </Link>
              </HoverCard>
            </div>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#a1a1aa', marginTop: 28 }}>
              {t('pricing.comparison')}
            </p>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, textAlign: 'center', marginBottom: 10, color: '#09090b' }}>{t('faq.title')}</h2>
          <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 48, fontSize: 16 }}>{t('faq.subtitle')}</p>
          <div>
            {faqItems.map((f, i) => (
              <FaqItem key={i} q={f.q} a={f.a} open={faqOpen === i} onToggle={() => setFaqOpen(faqOpen === i ? null : i)} />
            ))}
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid #e4e4e7', padding: '28px 24px', textAlign: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <p style={{ color: '#a1a1aa', fontSize: 13, margin: 0 }}>{tc('footer')}</p>
            <Link href="/vergleich" style={{ color: '#6366f1', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>{t('footerCompare')}</Link>
            <span style={{ color: '#d4d4d8' }}>·</span>
            <Link href="/privacy" style={{ color: '#a1a1aa', fontSize: 13, textDecoration: 'none' }}>Privacy Policy</Link>
            <span style={{ color: '#d4d4d8' }}>·</span>
            <Link href="/terms" style={{ color: '#a1a1aa', fontSize: 13, textDecoration: 'none' }}>Terms & Conditions</Link>
            <span style={{ color: '#d4d4d8' }}>·</span>
            <Link href="/refund" style={{ color: '#a1a1aa', fontSize: 13, textDecoration: 'none' }}>Refund Policy</Link>
          </div>
        </footer>

      </div>
    </>
  )
}

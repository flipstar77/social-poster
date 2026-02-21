'use client'

import Link from 'next/link'
import React, { useState, useEffect, useRef } from 'react'

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
.hero-fadeup { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) both; }
.hero-fadeup-2 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s both; }
.hero-fadeup-3 { animation: fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
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
const PILL_ITEMS: { icon: React.ReactNode; text: string }[] = [
  { icon: '⏱️', text: '2–3 Stunden / Woche gespart' },
  { icon: '📈', text: 'Mehr Reichweite, mehr Gäste' },
  { icon: '🔁', text: '5 Plattformen · 1 Upload' },
  { icon: <IgIcon />, text: 'Instagram' },
  { icon: <TikTokIcon />, text: 'TikTok' },
  { icon: <FbIcon />, text: 'Facebook' },
  { icon: <YtIcon />, text: 'YouTube' },
  { icon: <XIcon />, text: 'X / Twitter' },
  { icon: '🎨', text: '3 Varianten zur Auswahl' },
  { icon: '🗣️', text: 'Euer Ton, eure Stimme' },
  { icon: '💸', text: 'Günstiger als jede Agentur' },
  { icon: '🌍', text: 'Weltweit nutzbar' },
  { icon: '🚀', text: 'In 30 Sekunden gepostet' },
]

function Ticker() {
  const items = [...PILL_ITEMS, ...PILL_ITEMS] // duplicate for infinite loop
  return (
    <div style={{ overflow: 'hidden', padding: '20px 0', borderTop: '1px solid #e4e4e7', borderBottom: '1px solid #e4e4e7', background: '#fff' }}>
      <div className="ticker-track" style={{ display: 'flex', gap: 12, width: 'max-content' }}>
        {items.map((p, i) => (
          <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e4e4e7', borderRadius: 999, padding: '9px 20px', fontSize: 14, color: '#18181b', fontWeight: 500, whiteSpace: 'nowrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: 17 }}>{p.icon}</span>{p.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── FAQ accordion ─────────────────────────────────────────────────────────────
const FAQS = [
  { q: 'Wie lange dauert die Einrichtung?', a: 'Wir richten alles innerhalb von 24 Stunden ein. Ihr bekommt einen persönlichen Zugang und seid sofort startklar — keine technischen Vorkenntnisse nötig.' },
  { q: 'Brauche ich technisches Wissen?', a: 'Nein. Ihr ladet ein Bild hoch, schreibt optional eine kurze Notiz dazu — alles andere passiert automatisch. Kein Coding, kein Setup, kein Aufwand.' },
  { q: 'Welche Plattformen werden unterstützt?', a: 'Instagram, TikTok, Facebook, YouTube und X (Twitter) — bis zu 5 gleichzeitig mit einem einzigen Upload. So einfach wie auf einer posten.' },
  { q: 'Was kostet der laufende Betrieb bei Lite?', a: 'Ihr verwaltet zwei kleine API-Zugänge selbst — das kostet euch ca. 15–18 € / Monat. Wir zeigen euch alles Schritt für Schritt bei der Einrichtung. Einmalig, dauert ca. 10 Minuten.' },
  { q: 'Kann ich kündigen?', a: 'Lite ist eine Einmalzahlung — keine Kündigung nötig, Zugang bleibt für immer. Pro Monatlich ist jederzeit ohne Frist kündbar. Pro Jährlich gilt für 12 Monate und wird danach automatisch verlängert, außer ihr kündigt rechtzeitig.' },
  { q: 'Schreibt die KI auch auf Englisch oder anderen Sprachen?', a: 'Ja. Die KI schreibt in jeder Sprache — Deutsch, Englisch, Türkisch, Arabisch und mehr. Einfach beim Setup angeben.' },
  { q: 'Ist Zahlung per Crypto möglich?', a: 'Ja, wir akzeptieren ETH und BTC. Schick die Zahlung an die unten angezeigte Adresse und melde dich danach kurz bei uns.' },
]

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
const STATS = [
  { value: 3, suffix: 'h', label: 'pro Woche gespart', icon: '⏱️' },
  { value: 5, suffix: '', label: 'Plattformen gleichzeitig', icon: '🚀' },
  { value: 30, suffix: 's', label: 'pro Post', icon: '⚡' },
  { value: 90, suffix: '%', label: 'weniger Aufwand', icon: '📈' },
]
function StatCount({ stat, visible, delay }: { stat: typeof STATS[0]; visible: boolean; delay: number }) {
  const n = useCountUp(stat.value, visible)
  return (
    <div style={{ textAlign: 'center', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms` }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{stat.icon}</div>
      <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-2px' }}>{n}{stat.suffix}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6, fontWeight: 500 }}>{stat.label}</div>
    </div>
  )
}
function StatsStrip() {
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
        {STATS.map((s, i) => <StatCount key={i} stat={s} visible={visible} delay={i * 120} />)}
      </div>
    </div>
  )
}

// ── Sticky showcase ───────────────────────────────────────────────────────────
const SHOWCASE_STEPS = [
  { n: '01', title: 'Bild hochladen', desc: 'Foto oder Video direkt vom Handy. Optional eine kurze Notiz — wir schreiben den Rest.', color: '#6366f1' },
  { n: '02', title: '3 Varianten wählen', desc: 'Die KI schreibt drei Versionen in eurem Ton. Ihr wählt den besten — oder postet direkt.', color: '#a855f7' },
  { n: '03', title: 'Auf 5 Plattformen posten', desc: 'Instagram, TikTok, Facebook, YouTube, X — gleichzeitig, mit einem Klick.', color: '#ec4899' },
]
function PhoneScreen({ step }: { step: number }) {
  if (step === 0) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #ede9fe, #fce7f3)', borderRadius: 16, border: '2px dashed #c4b5fd', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ fontSize: 40 }}>📸</span>
        <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>Bild auswählen</span>
      </div>
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', border: '1px solid #e4e4e7' }}>
        <div style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 4, fontWeight: 700, letterSpacing: '0.05em' }}>OPTIONALE NOTIZ</div>
        <div style={{ fontSize: 12, color: '#52525b' }}>„Heute: Pasta Carbonara 🍝"</div>
      </div>
    </div>
  )
  if (step === 1) return (
    <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>3 Varianten</div>
      {[
        { sel: true,  text: '🍝 Heute bei uns: Pasta Carbonara nach Originalrezept. Kommt vorbei!' },
        { sel: false, text: 'Klassisch. Cremig. Perfekt. Unsere Carbonara wärmt Herz & Seele 🤍' },
        { sel: false, text: 'Was gibts heute? Pasta Carbonara! Reservierung: Link in Bio 👆' },
      ].map((v, i) => (
        <div key={i} style={{ background: v.sel ? '#eef2ff' : '#f8fafc', border: `1.5px solid ${v.sel ? '#6366f1' : '#e4e4e7'}`, borderRadius: 10, padding: '8px 10px' }}>
          <div style={{ fontSize: 11, color: v.sel ? '#3730a3' : '#71717a', lineHeight: 1.5 }}>{v.text}</div>
        </div>
      ))}
    </div>
  )
  return (
    <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Plattformen</div>
      {[
        { Icon: IgIcon,      name: 'Instagram', active: true,  color: '#e1306c' },
        { Icon: TikTokIcon,  name: 'TikTok',    active: true,  color: '#010101' },
        { Icon: FbIcon,      name: 'Facebook',  active: true,  color: '#1877f2' },
        { Icon: YtIcon,      name: 'YouTube',   active: true,  color: '#ff0000' },
        { Icon: XIcon,       name: 'X',         active: false, color: '#000'    },
      ].map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: p.active ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: `1px solid ${p.active ? '#bbf7d0' : '#e4e4e7'}` }}>
          <span style={{ color: p.color, display: 'flex' }}><p.Icon /></span>
          <span style={{ flex: 1, fontSize: 11, fontWeight: 500, color: '#18181b' }}>{p.name}</span>
          <span style={{ fontSize: 13, color: p.active ? '#22c55e' : '#d4d4d8' }}>{p.active ? '✓' : '○'}</span>
        </div>
      ))}
      <div style={{ marginTop: 4, background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: 10, padding: '10px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
        Jetzt posten →
      </div>
    </div>
  )
}
function StickyShowcase({ scrollY, vh }: { scrollY: number; vh: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(9999)
  useEffect(() => {
    const update = () => { if (ref.current) setTop(ref.current.offsetTop) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const progress = Math.max(0, Math.min(1, (scrollY - top) / (vh * 2)))
  const step = Math.min(Math.floor(progress * 3.2), 2)
  const stepColor = SHOWCASE_STEPS[step].color

  return (
    <div ref={ref} style={{ position: 'relative', minHeight: '320vh' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', background: '#fff' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px', width: '100%', display: 'grid', gridTemplateColumns: '1fr auto', gap: 48, alignItems: 'center' }}>

          {/* Left: step list */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>So funktioniert&apos;s</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, color: '#09090b', lineHeight: 1.1, marginBottom: 40 }}>
              Drei Schritte.<br />
              <span style={{ background: `linear-gradient(135deg, ${stepColor}, #a855f7)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', transition: 'all 0.5s ease' }}>
                Kein Training.
              </span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {SHOWCASE_STEPS.map((s, i) => {
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
          <div style={{ flexShrink: 0 }}>
            <div style={{ width: 260, height: 520, background: '#09090b', borderRadius: 44, border: '2px solid #27272a', boxShadow: `0 32px 100px rgba(0,0,0,0.18), 0 0 60px ${stepColor}30`, position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.6s ease' }}>
              {/* Notch */}
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 88, height: 24, background: '#09090b', borderRadius: '0 0 14px 14px', zIndex: 10 }} />
              {/* Screen */}
              <div style={{ position: 'absolute', inset: 3, background: '#f8fafc', borderRadius: 42, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* App bar */}
                <div style={{ background: '#fff', padding: '34px 14px 10px', borderBottom: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✨</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#09090b', flex: 1 }}>Social Poster AI</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i <= step ? SHOWCASE_STEPS[Math.min(i, step)].color : '#e4e4e7', transition: 'background 0.4s ease' }} />
                    ))}
                  </div>
                </div>
                <PhoneScreen step={step} />
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
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [cryptoOpen, setCryptoOpen] = useState(false)
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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#18181b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(248,250,252,0.92)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #e4e4e7' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <defs><linearGradient id="ig-g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f09433" /><stop offset="100%" stopColor="#bc1888" /></linearGradient></defs>
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-g)" strokeWidth="2" fill="none" />
                <circle cx="12" cy="12" r="4" stroke="url(#ig-g)" strokeWidth="2" fill="none" />
                <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig-g)" />
              </svg>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Social Poster AI</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link href="/tool" style={{ fontSize: 14, color: '#71717a', textDecoration: 'none', padding: '8px 14px' }}>Tool →</Link>
              <a href="#kaufen" style={{ background: '#6366f1', color: 'white', padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                Jetzt starten
              </a>
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
          {/* Hero content — floats upward on scroll */}
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '112px 24px 96px', textAlign: 'center', position: 'relative', transform: `translateY(${heroTextY}px)`, willChange: 'transform' }}>
            <div className="hero-fadeup" style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 999, background: '#f3f4f6', border: '1px solid #e4e4e7', color: '#6366f1', fontSize: 13, fontWeight: 600, marginBottom: 28 }}>
              Für Restaurants · Cafés · Bars
            </div>
            <h1 className="hero-fadeup-2" style={{ fontSize: 'clamp(38px, 7vw, 72px)', fontWeight: 800, lineHeight: 1.08, marginBottom: 24, letterSpacing: '-2px', color: '#09090b' }}>
              Täglich präsent.<br />
              <span style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Ohne Aufwand.
              </span>
            </h1>
            <p className="hero-fadeup-3" style={{ fontSize: 19, color: '#52525b', maxWidth: 560, margin: '0 auto 20px', lineHeight: 1.75 }}>
              Dein Restaurant verdient starke Social-Media-Präsenz — aber du hast keine Zeit dafür.
              Bild hochladen, fertig. <strong style={{ color: '#09090b' }}>In 30 Sekunden auf bis zu 5 Plattformen gepostet.</strong>
            </p>
            {/* Platform logos strip */}
            <div className="hero-fadeup-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 36, flexWrap: 'wrap' }}>
              {[
                { Icon: IgIcon, label: 'Instagram', color: '#e1306c' },
                { Icon: TikTokIcon, label: 'TikTok', color: '#010101' },
                { Icon: FbIcon, label: 'Facebook', color: '#1877f2' },
                { Icon: YtIcon, label: 'YouTube', color: '#ff0000' },
                { Icon: XIcon, label: 'X', color: '#000' },
              ].map(({ Icon, label, color }, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e4e4e7', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: '#18181b' }}>
                  <span style={{ color, display: 'flex' }}><Icon /></span>
                  {label}
                  {i < 4 && <span style={{ color: '#d4d4d8', marginLeft: 4 }}>·</span>}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                1 Upload
              </div>
            </div>
            <div className="hero-fadeup-3" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="#kaufen" style={{ background: '#6366f1', color: 'white', padding: '15px 36px', borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 24px rgba(99,102,241,0.4)' }}>
                Jetzt Zugang sichern →
              </a>
              <Link href="/tool" style={{ border: '1px solid #d4d4d8', color: '#3f3f46', background: '#fff', padding: '15px 36px', borderRadius: 12, fontSize: 16, fontWeight: 600, textDecoration: 'none' }}>
                Tool ansehen
              </Link>
            </div>
          </div>
        </section>

        {/* ── TICKER ──────────────────────────────────────────────────────── */}
        <Ticker />

        {/* ── STATS ───────────────────────────────────────────────────────── */}
        <StatsStrip />

        {/* ── STICKY SHOWCASE ─────────────────────────────────────────────── */}
        <StickyShowcase scrollY={scrollY} vh={vh} />

        {/* ── WIE ES SICH ANFÜHLT ──────────────────────────────────────────── */}
        <section style={{ background: '#fff', borderTop: '1px solid #e4e4e7', borderBottom: '1px solid #e4e4e7' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 24px' }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 10, color: '#09090b' }}>Wie es sich anfühlt</h2>
            <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 48, fontSize: 16 }}>Der Unterschied zwischen Social Media mit und ohne uns.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 720, margin: '0 auto' }}>
              <HoverCard style={{ padding: 28, background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#a1a1aa' }}>Ohne Social Poster AI</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {['Stundenlang nach Ideen suchen', 'Posts vergessen oder aufschieben', 'Unregelmäßig posten = weniger Reichweite', '2–4 Stunden pro Woche verloren', 'Agentur zu teuer, selber zu aufwändig'].map(t => (
                    <li key={t} style={{ display: 'flex', gap: 10, fontSize: 14, color: '#71717a', alignItems: 'flex-start' }}>
                      <span style={{ color: '#ef4444', flexShrink: 0, fontWeight: 700 }}>✗</span>{t}
                    </li>
                  ))}
                </ul>
              </HoverCard>
              <HoverCard accent style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#6366f1' }}>Mit Social Poster AI</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {['Bild hochladen — fertig. 30 Sekunden.', 'Jeden Tag automatisch präsent', 'Regelmäßige Posts = mehr neue Gäste', 'Stunden zurückgewinnen, Küche im Fokus', 'Günstiger als jede Agentur weltweit'].map(t => (
                    <li key={t} style={{ display: 'flex', gap: 10, fontSize: 14, color: '#18181b', alignItems: 'flex-start' }}>
                      <span style={{ color: '#22c55e', flexShrink: 0, fontWeight: 700 }}>✓</span>{t}
                    </li>
                  ))}
                </ul>
              </HoverCard>
            </div>
          </div>
        </section>

        {/* ── FÜR WEN ──────────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 10, color: '#09090b' }}>Für wen ist das?</h2>
          <p style={{ color: '#71717a', marginBottom: 16, fontSize: 16 }}>
            Für alle, die auf Instagram, TikTok und Facebook präsent sein wollen — ohne Stunden dafür aufzuwenden.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
            {['📸 Instagram', '🎵 TikTok', '👥 Facebook'].map(p => (
              <span key={p} style={{ padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366f1' }}>{p}</span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {['🍝 Restaurants', '☕ Cafés', '🍹 Cocktailbars', '🍦 Eisdielen', '🚚 Food Trucks', '🥐 Bäckereien', '🍣 Sushi', '🍔 Burger', '🌮 Mexican'].map(item => (
              <span key={item} style={{ padding: '10px 22px', borderRadius: 999, fontSize: 14, fontWeight: 500, background: '#fff', border: '1px solid #e4e4e7', color: '#3f3f46' }}>{item}</span>
            ))}
          </div>
        </section>

        {/* ── KAUFEN / PRICING ─────────────────────────────────────────────── */}
        <section id="kaufen" style={{ background: '#fff', borderTop: '1px solid #e4e4e7', borderBottom: '1px solid #e4e4e7' }}>
          <div style={{ maxWidth: 1080, margin: '0 auto', padding: '80px 24px' }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 10, color: '#09090b' }}>Jetzt starten</h2>
            <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 32, fontSize: 16 }}>
              Einmal einrichten — für immer nutzen. Sofortiger Zugang nach Zahlung.
            </p>

            {/* Billing toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 48 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: yearly ? '#71717a' : '#09090b' }}>Monatlich</span>
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
                Jährlich
                <span style={{ marginLeft: 6, background: '#dcfce7', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>2 Monate gratis</span>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, maxWidth: 780, margin: '0 auto' }}>

              {/* Lite */}
              <HoverCard style={{ padding: 40, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Lite</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 52, fontWeight: 800, color: '#09090b', lineHeight: 1 }}>149 €</span>
                  <span style={{ fontSize: 15, color: '#71717a', marginBottom: 6 }}>einmalig</span>
                </div>
                <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 32 }}>+ ~15–18 € / Monat eigene API-Kosten</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  {['Lifetime-Zugang zum Tool', 'Unbegrenzte Posts', 'Instagram, TikTok, Facebook', 'KI-Captions in eurer Sprache', 'Persönliche Einrichtung', 'E-Mail Support'].map(item => (
                    <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14 }}>
                      <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>✓</span>
                      <span style={{ color: '#18181b' }}>{item}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="https://paypal.me/YOUR_PAYPAL/149EUR"
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#0070ba', color: 'white', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none', marginBottom: 10 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/></svg>
                  Mit PayPal zahlen
                </a>
                <button
                  onClick={() => setCryptoOpen(!cryptoOpen)}
                  style={{ background: 'none', border: '1px solid #e4e4e7', borderRadius: 12, padding: '11px', fontSize: 14, color: '#71717a', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                >
                  {cryptoOpen ? '✕ Crypto schließen' : '₿  Mit Crypto zahlen'}
                </button>
                {cryptoOpen && (
                  <div style={{ marginTop: 12, background: '#f8fafc', borderRadius: 12, padding: 16, fontSize: 12, color: '#52525b' }}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontWeight: 600, color: '#09090b', marginBottom: 4 }}>ETH (Ethereum)</div>
                      <code style={{ wordBreak: 'break-all', background: '#e4e4e7', padding: '4px 8px', borderRadius: 6, display: 'block' }}>0xYOUR_ETH_WALLET_ADDRESS</code>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#09090b', marginBottom: 4 }}>BTC (Bitcoin)</div>
                      <code style={{ wordBreak: 'break-all', background: '#e4e4e7', padding: '4px 8px', borderRadius: 6, display: 'block' }}>YOUR_BTC_WALLET_ADDRESS</code>
                    </div>
                    <p style={{ margin: '10px 0 0', color: '#a1a1aa', fontSize: 11 }}>Nach der Zahlung bitte Screenshot + E-Mail an uns senden.</p>
                  </div>
                )}
              </HoverCard>

              {/* Pro */}
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 700, padding: '5px 16px', borderRadius: 999, letterSpacing: '0.06em', zIndex: 1, whiteSpace: 'nowrap' }}>★ BELIEBT</div>
                <HoverCard accent style={{ padding: 40, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Pro</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 52, fontWeight: 800, color: '#09090b', lineHeight: 1 }}>149 €</span>
                    <span style={{ fontSize: 15, color: '#71717a', marginBottom: 6 }}>einmalig</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 26, fontWeight: 700, color: '#09090b' }}>+ {yearly ? '29' : '39'} €</span>
                    <span style={{ fontSize: 14, color: '#71717a' }}>/ Monat</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 32 }}>
                    {yearly ? 'Jährlich 348 € — 2 Monate gespart' : 'Monatlich kündbar'}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                    {['Alles aus Lite', 'Wir managen alle API-Keys', 'Telegram Bot — posten per Sprachnachricht', 'Caption-Stil auf euer Restaurant angepasst', 'WhatsApp Support', 'Monatlicher Check-in'].map(item => (
                      <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14 }}>
                        <span style={{ color: '#6366f1', fontWeight: 700, flexShrink: 0 }}>✓</span>
                        <span style={{ color: '#18181b' }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {yearly ? (
                    <a
                      href="https://paypal.me/YOUR_PAYPAL/348EUR"
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#0070ba', color: 'white', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none', marginBottom: 10 }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/></svg>
                      348 € / Jahr mit PayPal
                    </a>
                  ) : (
                    <a
                      href="https://paypal.me/YOUR_PAYPAL/188EUR"
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#0070ba', color: 'white', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/></svg>
                      Mit PayPal starten
                    </a>
                  )}
                </HoverCard>
              </div>
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#a1a1aa', marginTop: 28 }}>
              Zum Vergleich: Social-Media-Agenturen in Deutschland kosten 500–2.000 € / Monat.
            </p>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px' }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 10, color: '#09090b' }}>Häufige Fragen</h2>
          <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 48, fontSize: 16 }}>Alles was ihr wissen müsst, bevor ihr loslegt.</p>
          <div>
            {FAQS.map((f, i) => (
              <FaqItem key={i} q={f.q} a={f.a} open={faqOpen === i} onToggle={() => setFaqOpen(faqOpen === i ? null : i)} />
            ))}
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid #e4e4e7', padding: '28px 24px', textAlign: 'center', background: '#f8fafc' }}>
          <p style={{ color: '#a1a1aa', fontSize: 13, margin: 0 }}>© 2026 Social Poster AI</p>
        </footer>

      </div>
    </>
  )
}

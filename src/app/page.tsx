'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

// ── Scroll-in animation hook ──────────────────────────────────────────────────
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

// ── Parallax gradient blob ────────────────────────────────────────────────────
function ParallaxBlob() {
  const [offsetY, setOffsetY] = useState(0)
  useEffect(() => {
    const onScroll = () => setOffsetY(window.scrollY * 0.25)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <>
      <div style={{
        position: 'absolute', top: -120 + offsetY, right: -160,
        width: 580, height: 580, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', bottom: -80 - offsetY * 0.5, left: -120,
        width: 420, height: 420, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(168,85,247,0.09) 0%, transparent 70%)',
      }} />
    </>
  )
}

// ── Step card ─────────────────────────────────────────────────────────────────
function StepCard({ n, icon, title, desc, delay }: {
  n: string; icon: string; title: string; desc: string; delay: number
}) {
  const { ref, style } = useScrollIn(delay)
  return (
    <div ref={ref} style={{
      ...style,
      background: '#fff',
      border: '1px solid #e4e4e7',
      borderRadius: 20,
      padding: '36px 28px',
      boxShadow: '0 2px 20px rgba(0,0,0,0.05)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 18, right: 22,
        fontSize: 52, fontWeight: 800, lineHeight: 1,
        color: 'rgba(99,102,241,0.07)', userSelect: 'none',
      }}>{n}</div>
      <div style={{ fontSize: 38, marginBottom: 18 }}>{icon}</div>
      <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10, color: '#09090b' }}>{title}</h3>
      <p style={{ fontSize: 15, color: '#71717a', lineHeight: 1.7, margin: 0 }}>{desc}</p>
    </div>
  )
}

// ── Feature pill ──────────────────────────────────────────────────────────────
function Pill({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: '#fff', border: '1px solid #e4e4e7', borderRadius: 999,
      padding: '10px 20px', fontSize: 14, color: '#18181b', fontWeight: 500,
      boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>{text}
    </div>
  )
}

const INPUT: React.CSSProperties = {
  background: '#fff', border: '1px solid #d4d4d8', borderRadius: 10,
  padding: '12px 16px', color: '#18181b', fontSize: 14, width: '100%',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [form, setForm] = useState({ name: '', restaurant: '', email: '', message: '' })
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        const d = await res.json()
        setError(d.error ?? 'Fehler beim Senden.')
      }
    } catch {
      setError('Netzwerkfehler – bitte erneut versuchen.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#18181b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(248,250,252,0.92)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid #e4e4e7',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', padding: '0 24px', height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="ig-nav" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f09433" />
                  <stop offset="100%" stopColor="#bc1888" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-nav)" strokeWidth="2" fill="none" />
              <circle cx="12" cy="12" r="4" stroke="url(#ig-nav)" strokeWidth="2" fill="none" />
              <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig-nav)" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Social Poster AI</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/tool" style={{ fontSize: 14, color: '#71717a', textDecoration: 'none', padding: '8px 14px' }}>
              Tool →
            </Link>
            <a href="#kontakt" style={{
              background: '#6366f1', color: 'white',
              padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              textDecoration: 'none',
            }}>
              Demo anfragen
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', overflow: 'hidden', background: '#fff', borderBottom: '1px solid #e4e4e7' }}>
        <ParallaxBlob />
        <div style={{
          maxWidth: 1080, margin: '0 auto', padding: '108px 24px 88px',
          textAlign: 'center', position: 'relative',
        }}>
          <div style={{
            display: 'inline-block', padding: '5px 16px', borderRadius: 999,
            background: '#f3f4f6', border: '1px solid #e4e4e7',
            color: '#6366f1', fontSize: 13, fontWeight: 600, marginBottom: 28,
          }}>
            Für Restaurants · Cafés · Bars
          </div>
          <h1 style={{
            fontSize: 'clamp(38px, 7vw, 68px)', fontWeight: 800,
            lineHeight: 1.1, marginBottom: 24, letterSpacing: '-1.5px', color: '#09090b',
          }}>
            Täglich präsent.<br />
            <span style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Ohne Aufwand.</span>
          </h1>
          <p style={{ fontSize: 19, color: '#52525b', maxWidth: 560, margin: '0 auto 44px', lineHeight: 1.75 }}>
            Dein Restaurant verdient eine starke Social-Media-Präsenz —
            aber du hast keine Zeit dafür. Wir übernehmen das.
            Einfach Bild hochladen, fertig. <strong style={{ color: '#09090b' }}>In 30 Sekunden gepostet.</strong>
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#kontakt" style={{
              background: '#6366f1', color: 'white',
              padding: '15px 36px', borderRadius: 12, fontSize: 16, fontWeight: 700,
              textDecoration: 'none', boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
            }}>
              Kostenlose Demo anfragen
            </a>
            <Link href="/tool" style={{
              border: '1px solid #d4d4d8', color: '#3f3f46', background: '#fff',
              padding: '15px 36px', borderRadius: 12, fontSize: 16, fontWeight: 600,
              textDecoration: 'none',
            }}>
              Tool ansehen →
            </Link>
          </div>
        </div>
      </section>

      {/* ── PILLS ───────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '44px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          <Pill icon="⏱️" text="2–3 Stunden / Woche gespart" />
          <Pill icon="📈" text="Mehr Reichweite, mehr Gäste" />
          <Pill icon="📱" text="Instagram · TikTok · Facebook" />
          <Pill icon="🎨" text="3 Varianten zur Auswahl" />
          <Pill icon="🗣️" text="Euer Ton, eure Stimme" />
          <Pill icon="💸" text="Ohne Agentur, ohne Abo-Falle" />
        </div>
      </section>

      {/* ── SO FUNKTIONIERT'S — Animated Steps ──────────────────────────────── */}
      <section style={{ background: '#fff', borderTop: '1px solid #e4e4e7', borderBottom: '1px solid #e4e4e7' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 10, color: '#09090b' }}>Volles Social Media — minimalster Aufwand</h2>
            <p style={{ color: '#71717a', fontSize: 16, margin: 0 }}>Drei Schritte. Kein Training. Keine Agentur. Keine Ahnung von Marketing nötig.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <StepCard n="01" icon="📸" title="Bild oder Video hochladen" delay={0}
              desc="Foto vom Tagesgericht, Video einer Aktion, direkt vom Handy. Optional: kurze Notiz dazu — wir schreiben den Rest." />
            <StepCard n="02" icon="✨" title="3 Varianten — ihr wählt die beste" delay={140}
              desc="Die KI erstellt drei verschiedene Texte in eurem Stil und eurer Sprache. Ihr pickt euren Favoriten — oder postet direkt. Immer in eurer eigenen Stimme." />
            <StepCard n="03" icon="📈" title="Ihr wachst — während ihr kocht" delay={280}
              desc="Regelmäßige Posts auf Instagram, TikTok und Facebook bedeuten mehr Sichtbarkeit, mehr neue Gäste. Ohne dass ihr täglich daran denken müsst." />
          </div>
        </div>
      </section>

      {/* ── VORHER / NACHHER ────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 24px' }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 10, color: '#09090b' }}>
          Wie es sich anfühlt
        </h2>
        <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 48, fontSize: 16 }}>
          Der Unterschied zwischen Social Media mit und ohne uns.
        </p>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20, maxWidth: 720, margin: '0 auto',
        }}>
          <div style={{ background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: 20, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#a1a1aa' }}>Ohne Social Poster AI</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Stundenlang nach Ideen suchen',
                'Posts vergessen oder aufschieben',
                'Unregelmäßig posten = weniger Reichweite',
                '2–4 Stunden pro Woche verloren',
                'Agentur zu teuer, selber machen zu aufwändig',
              ].map(t => (
                <li key={t} style={{ display: 'flex', gap: 10, fontSize: 14, color: '#71717a', alignItems: 'flex-start' }}>
                  <span style={{ color: '#ef4444', flexShrink: 0, fontWeight: 700 }}>✗</span>{t}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background: '#fff', border: '2px solid rgba(99,102,241,0.3)', borderRadius: 20, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#6366f1' }}>Mit Social Poster AI</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Bild hochladen — fertig. 30 Sekunden.',
                'Jeden Tag automatisch präsent',
                'Regelmäßige Posts = mehr neue Gäste',
                'Stunden zurückgewinnen, Küche im Fokus',
                'Günstiger als jede Agentur',
              ].map(t => (
                <li key={t} style={{ display: 'flex', gap: 10, fontSize: 14, color: '#18181b', alignItems: 'flex-start' }}>
                  <span style={{ color: '#22c55e', flexShrink: 0, fontWeight: 700 }}>✓</span>{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FÜR WEN ─────────────────────────────────────────────────────────── */}
      <section style={{ background: '#fff', borderTop: '1px solid #e4e4e7', borderBottom: '1px solid #e4e4e7' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 10, color: '#09090b' }}>Für wen ist das?</h2>
          <p style={{ color: '#71717a', marginBottom: 16, fontSize: 16 }}>
            Für alle, die regelmäßig auf Instagram, TikTok und Facebook präsent sein wollen — ohne Stunden dafür aufzuwenden.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
            {['📸 Instagram', '🎵 TikTok', '👥 Facebook'].map(p => (
              <span key={p} style={{
                padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366f1',
              }}>{p}</span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {['🍝 Restaurants', '☕ Cafés', '🍹 Cocktailbars', '🍦 Eisdielen', '🚚 Food Trucks', '🥐 Bäckereien', '🍣 Sushi', '🍔 Burger', '🌮 Mexican'].map(item => (
              <span key={item} style={{
                padding: '10px 22px', borderRadius: 999, fontSize: 14, fontWeight: 500,
                background: '#f8fafc', border: '1px solid #e4e4e7', color: '#3f3f46',
              }}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PREIS ───────────────────────────────────────────────────────────── */}
      <section id="preis" style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 24px' }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 10, color: '#09090b' }}>Preis</h2>
        <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 56, fontSize: 16 }}>
          Einmal einrichten — für immer nutzen. Oder wir übernehmen alles.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, maxWidth: 780, margin: '0 auto' }}>

          {/* Lite */}
          <div style={{
            background: '#fff', border: '1px solid #e4e4e7', borderRadius: 24, padding: 40,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Lite</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 52, fontWeight: 800, color: '#09090b', lineHeight: 1 }}>149 €</span>
              <span style={{ fontSize: 15, color: '#71717a', marginBottom: 6 }}>einmalig</span>
            </div>
            <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 32 }}>+ ~5–10 € / Monat Betriebskosten (selbst verwaltet)</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              {[
                'Lifetime-Zugang zum Tool',
                'Unbegrenzte Posts',
                'KI-Captions in eurer Sprache',
                'Instagram & mehr',
                'Persönliche Einrichtung',
                'E-Mail Support',
              ].map(item => (
                <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14 }}>
                  <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>✓</span>
                  <span style={{ color: '#18181b' }}>{item}</span>
                </li>
              ))}
            </ul>
            <a href="#kontakt" style={{
              display: 'block', textAlign: 'center',
              border: '1px solid #d4d4d8', color: '#3f3f46', background: '#f8fafc',
              padding: '13px', borderRadius: 12, fontWeight: 600, fontSize: 15,
              textDecoration: 'none',
            }}>
              Anfragen
            </a>
          </div>

          {/* Pro */}
          <div style={{
            background: '#fff', border: '2px solid rgba(99,102,241,0.4)', borderRadius: 24, padding: 40,
            boxShadow: '0 8px 48px rgba(99,102,241,0.1)', display: 'flex', flexDirection: 'column',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 18, right: 18,
              background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 700,
              padding: '4px 12px', borderRadius: 999, letterSpacing: '0.05em',
            }}>BELIEBT</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Pro</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 52, fontWeight: 800, color: '#09090b', lineHeight: 1 }}>149 €</span>
              <span style={{ fontSize: 15, color: '#71717a', marginBottom: 6 }}>einmalig</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 32 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: '#09090b' }}>+ 39 €</span>
              <span style={{ fontSize: 14, color: '#71717a' }}>/ Monat</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              {[
                'Alles aus Lite',
                'Wir managen alle API-Keys',
                'Telegram Bot — posten per Sprachnachricht',
                'Caption-Stil auf euer Restaurant angepasst',
                'WhatsApp Support',
                'Monatlicher Check-in',
              ].map(item => (
                <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14 }}>
                  <span style={{ color: '#6366f1', fontWeight: 700, flexShrink: 0 }}>✓</span>
                  <span style={{ color: '#18181b' }}>{item}</span>
                </li>
              ))}
            </ul>
            <a href="#kontakt" style={{
              display: 'block', textAlign: 'center',
              background: '#6366f1', color: 'white',
              padding: '13px', borderRadius: 12, fontWeight: 700, fontSize: 15,
              textDecoration: 'none', boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
            }}>
              Anfragen
            </a>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#a1a1aa', marginTop: 28 }}>
          Zum Vergleich: Social-Media-Agenturen in Deutschland kosten 500–2.000 € / Monat.
        </p>
      </section>

      {/* ── KONTAKT ─────────────────────────────────────────────────────────── */}
      <section id="kontakt" style={{ background: '#fff', borderTop: '1px solid #e4e4e7' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 24px 96px' }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, textAlign: 'center', marginBottom: 10, color: '#09090b' }}>
            Demo anfragen
          </h2>
          <p style={{ color: '#71717a', textAlign: 'center', marginBottom: 48, fontSize: 16 }}>
            Kurze Nachricht genügt — ich melde mich innerhalb von 24 Stunden.
          </p>

          {submitted ? (
            <div style={{
              maxWidth: 420, margin: '0 auto', textAlign: 'center',
              background: '#fff', border: '1px solid #22c55e',
              borderRadius: 20, padding: 56,
            }}>
              <div style={{ fontSize: 48, marginBottom: 18 }}>✓</div>
              <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Anfrage gesendet!</h3>
              <p style={{ color: '#71717a', margin: 0 }}>Ich melde mich innerhalb von 24 Stunden.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input required placeholder="Euer Name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT} />
              <input required placeholder="Restaurant / Bar / Café" value={form.restaurant}
                onChange={e => setForm(f => ({ ...f, restaurant: e.target.value }))} style={INPUT} />
              <input required type="email" placeholder="E-Mail-Adresse" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={INPUT} />
              <textarea placeholder="Kurze Nachricht (optional)" value={form.message} rows={4}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                style={{ ...INPUT, resize: 'vertical' }} />
              {error && <p style={{ color: '#ef4444', fontSize: 14, margin: 0 }}>{error}</p>}
              <button type="submit" disabled={sending} style={{
                background: sending ? '#a5b4fc' : '#6366f1', color: 'white',
                padding: '15px', borderRadius: 12, fontWeight: 700, fontSize: 15,
                border: 'none', cursor: sending ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
              }}>
                {sending ? 'Wird gesendet...' : 'Anfrage senden'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#a1a1aa', margin: 0 }}>
                Kein Spam. Keine Newsletter. Einfach eine direkte Antwort.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #e4e4e7', padding: '28px 24px', textAlign: 'center', background: '#f8fafc' }}>
        <p style={{ color: '#a1a1aa', fontSize: 13, margin: 0 }}>© 2026 Social Poster AI</p>
      </footer>
    </div>
  )
}

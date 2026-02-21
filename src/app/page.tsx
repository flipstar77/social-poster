'use client'

import Link from 'next/link'
import { useState } from 'react'

const INPUT_STYLE: React.CSSProperties = {
  background: '#0d0d0d',
  border: '1px solid #262626',
  borderRadius: 10,
  padding: '12px 16px',
  color: '#fafafa',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export default function LandingPage() {
  const [form, setForm] = useState({ name: '', restaurant: '', email: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const subject = encodeURIComponent(`Demo-Anfrage: ${form.restaurant}`)
    const body = encodeURIComponent(
      `Name: ${form.name}\nRestaurant: ${form.restaurant}\nE-Mail: ${form.email}\n\n${form.message || 'Ich möchte eine Demo anfragen.'}`
    )
    window.location.href = `mailto:deine@email.de?subject=${subject}&body=${body}`
    setSubmitted(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fafafa' }}>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,10,0.88)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #262626',
      }}>
        <div style={{
          maxWidth: 1024, margin: '0 auto', padding: '0 24px', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="ig-nav" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f09433" />
                  <stop offset="50%" stopColor="#e6683c" />
                  <stop offset="100%" stopColor="#bc1888" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-nav)" strokeWidth="2" fill="none" />
              <circle cx="12" cy="12" r="4" stroke="url(#ig-nav)" strokeWidth="2" fill="none" />
              <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig-nav)" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Social Poster AI</span>
          </div>
          <a
            href="#kontakt"
            style={{
              background: '#6366f1', color: 'white',
              padding: '9px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Demo anfragen
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ maxWidth: 1024, margin: '0 auto', padding: '96px 24px 72px', textAlign: 'center' }}
        className="fade-in">
        <div style={{
          display: 'inline-block', padding: '5px 16px', borderRadius: 999,
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
          color: '#818cf8', fontSize: 13, fontWeight: 500, marginBottom: 28,
        }}>
          Für Restaurants · Cafés · Cocktailbars
        </div>
        <h1 style={{
          fontSize: 'clamp(34px, 6vw, 56px)', fontWeight: 800,
          lineHeight: 1.15, marginBottom: 24, letterSpacing: '-0.5px',
        }}>
          Instagram-Posts für euer Restaurant<br />
          <span style={{ color: '#818cf8' }}>– vollautomatisch.</span>
        </h1>
        <p style={{
          fontSize: 18, color: '#a1a1aa', maxWidth: 560,
          margin: '0 auto 44px', lineHeight: 1.75,
        }}>
          Bild hochladen. KI schreibt die Caption. Direkt auf Instagram posten.<br />
          Spart euch <strong style={{ color: '#fafafa' }}>2–3 Stunden pro Woche</strong> – ohne Agentur, ohne Aufwand.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#kontakt" style={{
            background: '#6366f1', color: 'white',
            padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 700,
            textDecoration: 'none',
          }}>
            Kostenlose Demo anfragen
          </a>
          <Link href="/tool" style={{
            border: '1px solid #262626', color: '#a1a1aa',
            padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            textDecoration: 'none',
          }}>
            Tool ansehen →
          </Link>
        </div>
      </section>

      {/* VORHER / NACHHER */}
      <section style={{ maxWidth: 1024, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 10 }}>
          Vorher vs. Nachher
        </h2>
        <p style={{ color: '#a1a1aa', textAlign: 'center', marginBottom: 48 }}>
          Was typischerweise gepostet wird – und was möglich wäre.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

          {/* Vorher */}
          <div style={{ background: '#141414', border: '1px solid #262626', borderRadius: 20, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#71717a' }}>Typisch bisher</span>
            </div>
            <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 12, padding: 18 }}>
              <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, margin: 0 }}>
                "Schönen Abend! ☀️"
              </p>
            </div>
            <p style={{ fontSize: 12, color: '#3f3f46', marginTop: 14, marginBottom: 0 }}>
              Kein CTA · Keine Hashtags · Keine Reichweite
            </p>
          </div>

          {/* Nachher */}
          <div style={{ background: '#141414', border: '1px solid rgba(99,102,241,0.45)', borderRadius: 20, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#818cf8' }}>Mit Social Poster AI</span>
            </div>
            <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 12, padding: 18 }}>
              <p style={{ fontSize: 14, color: '#fafafa', lineHeight: 1.75, margin: 0 }}>
                🍝 Frisch aus der Küche – unser Pasta del Giorno mit Steinpilzen und Parmesan-Creme. Heute ab 17 Uhr.
                <br /><br />
                Tisch reservieren: +49 69 123 456<br />
                📍 Innenstadt Frankfurt
                <br /><br />
                <span style={{ color: '#71717a', fontSize: 13 }}>
                  #frankfurtfood #restaurant #pasta #ffmfood #italianfood #frankfurtrestaurant #frischgekocht
                </span>
              </p>
            </div>
            <p style={{ fontSize: 12, color: '#22c55e', marginTop: 14, marginBottom: 0 }}>
              ✓ CTA enthalten · ✓ Lokale Hashtags · ✓ Professionell
            </p>
          </div>
        </div>
      </section>

      {/* WIE ES FUNKTIONIERT */}
      <section style={{ maxWidth: 1024, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 10 }}>
          So funktioniert&apos;s
        </h2>
        <p style={{ color: '#a1a1aa', textAlign: 'center', marginBottom: 48 }}>
          Drei Schritte. Kein Training. Kein Aufwand.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {[
            {
              n: '01',
              title: 'Bild hochladen',
              desc: 'Foto vom Gericht, dem Lokal oder eurer Tagesaktion – per Drag & Drop oder Klick.',
            },
            {
              n: '02',
              title: 'KI schreibt Caption',
              desc: 'Das Tool erstellt automatisch eine passende Caption in eurem Stil – auf Deutsch, mit Hashtags.',
            },
            {
              n: '03',
              title: 'Direkt posten',
              desc: 'Per Klick auf Instagram und optional TikTok veröffentlichen. Fertig – keine App nötig.',
            },
          ].map(item => (
            <div key={item.n} style={{ background: '#141414', border: '1px solid #262626', borderRadius: 20, padding: 28 }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: 'rgba(99,102,241,0.22)', marginBottom: 16, lineHeight: 1 }}>
                {item.n}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{item.title}</h3>
              <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FÜR WEN */}
      <section style={{ maxWidth: 1024, margin: '0 auto', padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 10 }}>Für wen ist das?</h2>
        <p style={{ color: '#a1a1aa', marginBottom: 40 }}>
          Für alle, die regelmäßig auf Instagram posten wollen – ohne Stunden dafür aufzuwenden.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {['🍝 Restaurants', '☕ Cafés', '🍹 Cocktailbars', '🍦 Eisdielen', '🚚 Food Trucks', '🥐 Bäckereien'].map(item => (
            <span key={item} style={{
              padding: '10px 22px', borderRadius: 999, fontSize: 14, fontWeight: 500,
              background: '#141414', border: '1px solid #262626', color: '#a1a1aa',
            }}>
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* PREIS */}
      <section id="preis" style={{ maxWidth: 1024, margin: '0 auto', padding: '64px 24px' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 10 }}>Preis</h2>
        <p style={{ color: '#a1a1aa', textAlign: 'center', marginBottom: 48 }}>
          Transparent. Fair. Monatlich kündbar.
        </p>
        <div style={{
          maxWidth: 380, margin: '0 auto', background: '#141414',
          border: '1px solid rgba(99,102,241,0.45)', borderRadius: 24, padding: 40,
        }}>
          <div style={{ fontSize: 52, fontWeight: 800, marginBottom: 4 }}>149 €</div>
          <div style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 28 }}>einmalige Einrichtung</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
            + 10 € <span style={{ fontSize: 16, fontWeight: 400, color: '#a1a1aa' }}>/ Monat</span>
          </div>
          <div style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 36 }}>für API & Betrieb</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 36px', display: 'flex', flexDirection: 'column', gap: 13 }}>
            {[
              'Unbegrenzte Posts',
              'Instagram & TikTok',
              'KI-Captions auf Deutsch',
              'Einrichtung & Support inklusive',
              'Keine Mindestlaufzeit',
            ].map(item => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
          <a href="#kontakt" style={{
            display: 'block', textAlign: 'center',
            background: '#6366f1', color: 'white',
            padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15,
            textDecoration: 'none',
          }}>
            Jetzt anfragen
          </a>
        </div>
      </section>

      {/* KONTAKT */}
      <section id="kontakt" style={{ maxWidth: 1024, margin: '0 auto', padding: '64px 24px 96px' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 10 }}>Demo anfragen</h2>
        <p style={{ color: '#a1a1aa', textAlign: 'center', marginBottom: 48 }}>
          Kurze Nachricht genügt. Ich melde mich innerhalb von 24 Stunden.
        </p>

        {submitted ? (
          <div style={{
            maxWidth: 420, margin: '0 auto', textAlign: 'center',
            background: '#141414', border: '1px solid #22c55e',
            borderRadius: 20, padding: 56,
          }}>
            <div style={{ fontSize: 48, marginBottom: 18 }}>✓</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Anfrage gesendet!</h3>
            <p style={{ color: '#a1a1aa', margin: 0 }}>Ich melde mich innerhalb von 24 Stunden.</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <input
              required
              placeholder="Euer Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={INPUT_STYLE}
            />
            <input
              required
              placeholder="Restaurant / Bar / Café"
              value={form.restaurant}
              onChange={e => setForm(f => ({ ...f, restaurant: e.target.value }))}
              style={INPUT_STYLE}
            />
            <input
              required
              type="email"
              placeholder="E-Mail-Adresse"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={INPUT_STYLE}
            />
            <textarea
              placeholder="Kurze Nachricht (optional)"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={4}
              style={{ ...INPUT_STYLE, resize: 'vertical' }}
            />
            <button type="submit" style={{
              background: '#6366f1', color: 'white',
              padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Anfrage senden
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#3f3f46', margin: 0 }}>
              Kein Spam. Keine Newsletter. Einfach eine direkte Antwort.
            </p>
          </form>
        )}
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #1a1a1a', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ color: '#3f3f46', fontSize: 13, margin: 0 }}>
          © 2025 Social Poster AI
        </p>
      </footer>
    </div>
  )
}

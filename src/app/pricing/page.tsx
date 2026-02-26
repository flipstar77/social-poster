import Link from 'next/link'

export const metadata = {
  title: 'Preise – FlowingPost',
  description: 'FlowingPost Preispläne für Restaurants. Automatisches Social-Media-Marketing ab €29/Monat.',
}

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem' }}>
          FlowingPost
        </Link>
      </nav>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, marginBottom: '16px' }}>
            Einfache, faire Preise
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem' }}>
            Kein verstecktes Kleingedrucktes. Jederzeit kündbar.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          {[
            {
              name: 'Starter',
              price: '€29',
              period: '/Monat',
              description: 'Für einzelne Restaurants die gerade anfangen.',
              features: [
                '30 Posts pro Monat',
                'Instagram & Google Business',
                'KI-Textgenerierung',
                'E-Mail Support',
              ],
              cta: 'Jetzt starten',
              accent: false,
            },
            {
              name: 'Pro',
              price: '€59',
              period: '/Monat',
              description: 'Für aktive Restaurants die wachsen wollen.',
              features: [
                'Unbegrenzte Posts',
                'Instagram, TikTok & Google',
                'KI-Texte & Hashtags',
                'WhatsApp-Support',
                'Erweiterte Analysen',
              ],
              cta: 'Pro starten',
              accent: true,
            },
            {
              name: 'Multi',
              price: '€79',
              period: '/Monat',
              description: 'Für Gastronomen mit mehreren Standorten.',
              features: [
                'Bis zu 5 Standorte',
                'Alle Pro-Features',
                'Prioritäts-Support',
                'Onboarding-Gespräch',
              ],
              cta: 'Kontakt aufnehmen',
              accent: false,
            },
          ].map(plan => (
            <div key={plan.name} style={{
              background: plan.accent ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${plan.accent ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '16px',
              padding: '32px',
            }}>
              {plan.accent && (
                <div style={{
                  display: 'inline-block', marginBottom: '12px',
                  background: 'linear-gradient(135deg, #a78bfa, #6d28d9)',
                  color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                  padding: '4px 12px', borderRadius: '99px', letterSpacing: '0.5px',
                }}>
                  BELIEBTESTE WAHL
                </div>
              )}
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' }}>{plan.name}</h2>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>{plan.price}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1rem' }}>{plan.period}</span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '24px' }}>
                {plan.description}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: '32px' }}>
                {plan.features.map(f => (
                  <li key={f} style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', marginBottom: '10px' }}>
                    ✓ {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" style={{
                display: 'block', textAlign: 'center',
                background: plan.accent ? 'linear-gradient(135deg, #a78bfa, #6d28d9)' : 'rgba(255,255,255,0.08)',
                color: '#fff', padding: '12px', borderRadius: '10px',
                textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem',
              }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: '48px', fontSize: '0.85rem' }}>
          Alle Preise zzgl. MwSt. · Monatlich kündbar · Keine Einrichtungsgebühr
        </p>
      </main>
    </div>
  )
}

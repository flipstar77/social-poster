export const metadata = {
  title: 'Refund Policy – FlowingPost',
  description: 'FlowingPost Refund and Cancellation Policy',
}

const LAST_UPDATED = '2026-02-27'
const CONTACT_EMAIL = 'hello@flowingpost.com'

export default function RefundPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <a href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem' }}>
          FlowingPost
        </a>
      </nav>
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 24px 100px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Refund Policy</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '48px', fontSize: '0.9rem' }}>
          Last updated: {LAST_UPDATED}
        </p>

        {[
          {
            title: '14-Day Money-Back Guarantee',
            body: 'If you are not satisfied with FlowingPost, you may request a full refund within 14 days of your initial purchase. No questions asked. To request a refund, contact us at ' + CONTACT_EMAIL + ' with your order details.',
          },
          {
            title: 'Cancellation',
            body: 'You can cancel your subscription at any time from your account settings. After cancellation, you will continue to have access to the Service until the end of the current billing period. No further charges will be made.',
          },
          {
            title: 'Renewals',
            body: 'Subscriptions renew automatically at the end of each billing period. You will receive an email reminder before renewal. To avoid renewal, cancel your subscription before the renewal date.',
          },
          {
            title: 'Refunds After 14 Days',
            body: 'After the 14-day period, we do not offer refunds for partial subscription periods. If you believe you were charged in error, contact us and we will review your case individually.',
          },
          {
            title: 'Annual Plans',
            body: 'For annual subscriptions, a full refund is available within 14 days of purchase. After 14 days, we may offer a pro-rated refund at our discretion if you contact us within 30 days of purchase.',
          },
          {
            title: 'How to Request a Refund',
            body: 'Email ' + CONTACT_EMAIL + ' with your account email and order number. Refunds are processed within 5–10 business days and credited back to the original payment method.',
          },
        ].map(section => (
          <section key={section.title} style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '10px', color: '#a78bfa' }}>
              {section.title}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, fontSize: '0.95rem' }}>
              {section.body}
            </p>
          </section>
        ))}

        <div style={{
          marginTop: '48px', padding: '24px',
          background: 'rgba(167,139,250,0.06)',
          border: '1px solid rgba(167,139,250,0.2)',
          borderRadius: '12px',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Questions? Write to us at{' '}
            <a href={'mailto:' + CONTACT_EMAIL} style={{ color: '#a78bfa' }}>{CONTACT_EMAIL}</a>
            {' '}and we\'ll get back to you within 24 hours.
          </p>
        </div>
      </main>
    </div>
  )
}

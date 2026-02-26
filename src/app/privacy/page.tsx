export const metadata = {
  title: 'Privacy Policy – FlowingPost',
  description: 'FlowingPost Privacy Policy – GDPR compliant',
}

const LAST_UPDATED = '2026-02-27'
const CONTACT_EMAIL = 'hello@flowingpost.com'

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <a href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem' }}>
          FlowingPost
        </a>
      </nav>
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 24px 100px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Privacy Policy</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '48px', fontSize: '0.9rem' }}>
          Last updated: {LAST_UPDATED}
        </p>

        {[
          {
            title: '1. Data Controller',
            body: 'FlowingPost ("we", "us") operates the website flowingpost.com and the related SaaS platform. For questions regarding data protection, contact us at: ' + CONTACT_EMAIL,
          },
          {
            title: '2. Data We Collect',
            body: 'We collect: (a) Account data — name, email address, and password when you register. (b) Payment data — processed exclusively by Paddle (paddle.com); we do not store credit card details. (c) Usage data — how you interact with the platform (pages visited, features used). (d) Uploaded content — photos you upload to generate social media posts. (e) Technical data — IP address, browser type, device information.',
          },
          {
            title: '3. How We Use Your Data',
            body: 'We use your data to: provide and improve the Service, process payments, send transactional emails (receipts, password resets), and send product updates (you can opt out at any time). We do not sell your personal data to third parties.',
          },
          {
            title: '4. Legal Basis (GDPR)',
            body: 'We process your data based on: (a) Contract performance — to provide the Service you subscribed to. (b) Legitimate interest — to improve the Service and prevent fraud. (c) Consent — for marketing emails.',
          },
          {
            title: '5. Third-Party Services',
            body: 'We use the following sub-processors: Supabase (database, EU region), Vercel (hosting, EU region), Paddle (payment processing), xAI/Grok (AI content generation — only content you explicitly submit is processed). Each sub-processor is bound by data processing agreements.',
          },
          {
            title: '6. Data Retention',
            body: 'We retain your account data as long as your account is active. Uploaded photos are retained for 30 days after deletion. You may request deletion of your data at any time by contacting ' + CONTACT_EMAIL + '.',
          },
          {
            title: '7. Your Rights (GDPR)',
            body: 'As a resident of the EU/EEA, you have the right to: access your personal data, correct inaccurate data, request deletion ("right to be forgotten"), object to processing, and data portability. To exercise these rights, contact us at ' + CONTACT_EMAIL + '.',
          },
          {
            title: '8. Cookies',
            body: 'We use essential cookies for authentication and session management. We do not use tracking or advertising cookies. You can disable cookies in your browser settings, but this may affect the functionality of the Service.',
          },
          {
            title: '9. Changes to This Policy',
            body: 'We may update this Privacy Policy from time to time. We will notify you of significant changes via email. Continued use of the Service after changes constitutes acceptance.',
          },
          {
            title: '10. Contact',
            body: 'For privacy-related questions or to exercise your rights: ' + CONTACT_EMAIL,
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
      </main>
    </div>
  )
}

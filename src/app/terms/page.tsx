export const metadata = {
  title: 'Terms of Service – FlowingPost',
  description: 'FlowingPost Terms of Service',
}

const LAST_UPDATED = '2026-02-27'
const CONTACT_EMAIL = 'hello@flowingpost.com'

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <a href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem' }}>
          FlowingPost
        </a>
      </nav>
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 24px 100px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Terms of Service</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '48px', fontSize: '0.9rem' }}>
          Last updated: {LAST_UPDATED}
        </p>

        {[
          {
            title: '1. Acceptance of Terms',
            body: 'By accessing or using FlowingPost ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.',
          },
          {
            title: '2. Description of Service',
            body: 'FlowingPost is a software-as-a-service (SaaS) platform that helps restaurant owners automate social media content creation and scheduling for Instagram, TikTok, and Google Business Profile. The Service uses artificial intelligence to generate captions, hashtags, and posts from uploaded photos.',
          },
          {
            title: '3. Subscription and Payment',
            body: 'FlowingPost offers monthly and annual subscription plans. Subscriptions are billed in advance. Payments are processed securely via Paddle (paddle.com), our authorized reseller and merchant of record. By subscribing, you agree to Paddle\'s terms and conditions. All prices are exclusive of VAT unless stated otherwise.',
          },
          {
            title: '4. Free Trial',
            body: 'FlowingPost may offer a free trial period. No payment information is required to start a trial. At the end of the trial, you will be asked to subscribe to continue using the Service.',
          },
          {
            title: '5. Cancellation',
            body: 'You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period. No refunds are issued for partial months except as described in the Refund Policy.',
          },
          {
            title: '6. User Content',
            body: 'You retain all ownership rights to photos and content you upload. By uploading content, you grant FlowingPost a limited license to process and use that content solely to provide the Service. FlowingPost does not sell or share your content with third parties.',
          },
          {
            title: '7. Acceptable Use',
            body: 'You agree not to use the Service to generate illegal, harmful, or misleading content. You are solely responsible for reviewing and approving all AI-generated content before publishing it on your social media channels.',
          },
          {
            title: '8. Limitation of Liability',
            body: 'FlowingPost is provided "as is." To the maximum extent permitted by law, FlowingPost shall not be liable for indirect, incidental, or consequential damages arising from your use of the Service.',
          },
          {
            title: '9. Changes to Terms',
            body: 'We may update these Terms from time to time. We will notify you of significant changes via email or in-app notice. Continued use of the Service after changes constitutes acceptance of the new Terms.',
          },
          {
            title: '10. Contact',
            body: `For questions regarding these Terms, contact us at: ${CONTACT_EMAIL}`,
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

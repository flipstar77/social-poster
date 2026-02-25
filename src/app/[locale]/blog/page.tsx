'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'

type PostMeta = {
  slug: string
  title: string
  description: string
  date: string
  category: string
  readingTime: string
  image?: string
  imageMedium?: string
}

const CATEGORIES = ['Alle', 'Instagram', 'TikTok', 'Google Maps', 'SEO', 'Strategie']

export default function BlogPage() {
  const params = useParams()
  const locale = (params?.locale as string) || 'de'
  const [posts, setPosts] = useState<PostMeta[]>([])
  const [activeCategory, setActiveCategory] = useState('Alle')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/blog?locale=${locale}`)
      .then(r => r.json())
      .then(data => {
        setPosts(data.posts || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [locale])

  const filtered = activeCategory === 'Alle'
    ? posts
    : posts.filter(p => p.category === activeCategory)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '1.1rem' }}>
          FlowingPost
        </Link>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <Link href="/blog" style={{ color: '#a78bfa', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
            Blog
          </Link>
          <Link href="/login" style={{
            background: 'linear-gradient(135deg, #a78bfa, #6d28d9)',
            color: '#fff', padding: '8px 20px', borderRadius: '8px',
            textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem',
          }}>
            Jetzt starten →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header style={{
        textAlign: 'center', padding: 'clamp(60px, 10vw, 120px) 24px 48px',
        maxWidth: '800px', margin: '0 auto',
      }}>
        <div style={{
          display: 'inline-block', padding: '6px 16px', borderRadius: '99px',
          background: 'rgba(167,139,250,0.12)', color: '#a78bfa',
          fontSize: '0.85rem', fontWeight: 600, marginBottom: '20px',
        }}>
          FlowingPost Blog
        </div>
        <h1 style={{
          fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 800,
          lineHeight: 1.15, marginBottom: '16px',
        }}>
          Social Media & SEO{' '}
          <span style={{ color: '#a78bfa' }}>für Gastronomen</span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', lineHeight: 1.6 }}>
          Praxisnahe Tipps für Instagram, TikTok, Google Maps und mehr — speziell für Restaurants, Cafés und Bars.
        </p>
      </header>

      {/* Category Filter */}
      <div style={{
        display: 'flex', gap: '8px', justifyContent: 'center',
        padding: '0 24px 48px', flexWrap: 'wrap',
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '8px 20px', borderRadius: '99px', border: 'none',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              transition: 'all 0.2s',
              background: activeCategory === cat
                ? 'linear-gradient(135deg, #a78bfa, #6d28d9)'
                : 'rgba(255,255,255,0.06)',
              color: activeCategory === cat ? '#fff' : 'rgba(255,255,255,0.6)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Posts Grid */}
      <main style={{
        maxWidth: '1100px', margin: '0 auto', padding: '0 24px 80px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '24px',
      }}>
        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', gridColumn: '1 / -1', textAlign: 'center' }}>
            Laden...
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', gridColumn: '1 / -1', textAlign: 'center' }}>
            Noch keine Artikel in dieser Kategorie.
          </p>
        ) : (
          filtered.map(post => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <article style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '16px',
                overflow: 'hidden',
                transition: 'all 0.25s',
                cursor: 'pointer',
                height: '100%',
                display: 'flex', flexDirection: 'column',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(167,139,250,0.3)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(167,139,250,0.08)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Thumbnail */}
                {post.imageMedium && post.imageMedium.startsWith('http') ? (
                  <div style={{
                    width: '100%', aspectRatio: '16/9',
                    background: 'rgba(255,255,255,0.04)',
                    overflow: 'hidden',
                  }}>
                    <img
                      src={post.imageMedium}
                      alt={post.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div style={{
                    width: '100%', aspectRatio: '16/9',
                    background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(109,40,217,0.08))',
                  }} />
                )}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: '99px',
                    background: 'rgba(167,139,250,0.12)', color: '#a78bfa',
                    fontSize: '0.75rem', fontWeight: 600,
                  }}>
                    {post.category}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
                    {post.readingTime}
                  </span>
                </div>
                <h2 style={{
                  fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.3,
                  marginBottom: '12px', flex: 1,
                }}>
                  {post.title}
                </h2>
                <p style={{
                  color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem',
                  lineHeight: 1.5, marginBottom: '16px',
                }}>
                  {post.description}
                </p>
                <div style={{
                  color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem',
                  marginTop: 'auto',
                }}>
                  {new Date(post.date).toLocaleDateString('de-DE', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </div>
                </div>
              </article>
            </Link>
          ))
        )}
      </main>

      {/* CTA */}
      <section style={{
        textAlign: 'center', padding: '60px 24px 80px',
        background: 'rgba(167,139,250,0.04)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px' }}>
          Keine Zeit für Social Media?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>
          FlowingPost übernimmt das für dich — Foto hochladen, fertig.
        </p>
        <Link href="/" style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, #a78bfa, #6d28d9)',
          color: '#fff', padding: '14px 32px', borderRadius: '12px',
          textDecoration: 'none', fontWeight: 700, fontSize: '1rem',
        }}>
          Kostenlos testen →
        </Link>
      </section>
    </div>
  )
}

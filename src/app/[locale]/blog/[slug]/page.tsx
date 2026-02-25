'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { MDXRemote, MDXRemoteSerializeResult } from 'next-mdx-remote'
import { Link } from '@/i18n/navigation'

type PostData = {
  slug: string
  title: string
  description: string
  date: string
  category: string
  readingTime: string
  mdxSource: MDXRemoteSerializeResult
}

export default function BlogPostPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [post, setPost] = useState<PostData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/blog/render?slug=${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.post) setPost(data.post)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Laden...</p>
      </div>
    )
  }

  if (!post) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <p>Artikel nicht gefunden.</p>
        <Link href="/blog" style={{ color: '#a78bfa' }}>← Zurück zum Blog</Link>
      </div>
    )
  }

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

      {/* Article */}
      <article style={{ maxWidth: '720px', margin: '0 auto', padding: 'clamp(40px, 6vw, 80px) 24px 80px' }}>
        {/* Back link */}
        <Link href="/blog" style={{
          color: 'rgba(255,255,255,0.4)', textDecoration: 'none',
          fontSize: '0.85rem', display: 'inline-block', marginBottom: '32px',
        }}>
          ← Alle Artikel
        </Link>

        {/* Meta */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            padding: '4px 14px', borderRadius: '99px',
            background: 'rgba(167,139,250,0.12)', color: '#a78bfa',
            fontSize: '0.8rem', fontWeight: 600,
          }}>
            {post.category}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
            {post.readingTime}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
            {new Date(post.date).toLocaleDateString('de-DE', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800,
          lineHeight: 1.2, marginBottom: '16px',
        }}>
          {post.title}
        </h1>

        <p style={{
          color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem',
          lineHeight: 1.6, marginBottom: '40px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: '32px',
        }}>
          {post.description}
        </p>

        {/* MDX Content */}
        <div className="blog-content">
          <MDXRemote {...post.mdxSource} />
        </div>

        {/* CTA */}
        <div style={{
          marginTop: '60px', padding: '32px',
          background: 'rgba(167,139,250,0.06)',
          border: '1px solid rgba(167,139,250,0.15)',
          borderRadius: '16px', textAlign: 'center',
        }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
            Kein Bock mehr auf stundenlang posten?
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '20px', fontSize: '0.95rem' }}>
            FlowingPost übernimmt dein Social Media — Foto hochladen, fertig.
          </p>
          <Link href="/" style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #a78bfa, #6d28d9)',
            color: '#fff', padding: '12px 28px', borderRadius: '10px',
            textDecoration: 'none', fontWeight: 700,
          }}>
            Kostenlos testen →
          </Link>
        </div>
      </article>
    </div>
  )
}

'use client'

import { useState } from 'react'

interface RecycleVariant {
  caption: string
  hashtags: string[]
  category: string
}

interface ContentRecyclerProps {
  /** Existing posts that can be recycled */
  posts: { id: string; caption: string; platform: string; preview: string }[]
  platforms: { id: string; label: string; color: string }[]
  businessType: string
  language: string
  tone: string
  onVariantAccepted: (originalId: string, platform: string, caption: string, hashtags: string[], category: string, preview: string) => void
}

export default function ContentRecycler({
  posts,
  platforms,
  businessType,
  language,
  tone,
  onVariantAccepted,
}: ContentRecyclerProps) {
  const [selectedPost, setSelectedPost] = useState<string | null>(null)
  const [targetPlatform, setTargetPlatform] = useState(platforms[0]?.id || 'instagram')
  const [variants, setVariants] = useState<RecycleVariant[]>([])
  const [loading, setLoading] = useState(false)
  const [accepted, setAccepted] = useState(0)

  const handleRecycle = async (postId: string) => {
    const post = posts.find(p => p.id === postId)
    if (!post) return

    setSelectedPost(postId)
    setLoading(true)
    setVariants([])

    try {
      const res = await fetch('/api/recycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalCaption: post.caption,
          originalPlatform: post.platform,
          targetPlatform,
          businessType,
          language,
          tone,
        }),
      })

      const data = await res.json()
      if (data.variants) {
        setVariants(data.variants)
      }
    } catch (err) {
      console.error('[Recycle] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptVariant = (variant: RecycleVariant) => {
    const post = posts.find(p => p.id === selectedPost)
    if (!post) return
    onVariantAccepted(post.id, targetPlatform, variant.caption, variant.hashtags, variant.category, post.preview)
    setAccepted(prev => prev + 1)
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-[var(--text-muted)]">
        Noch keine Posts zum Recyclen. Erstelle zuerst Content.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h3 className="text-sm font-bold mb-1">Content Recycling</h3>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        Waehle einen bestehenden Post — AI erstellt 3 neue Varianten daraus.
      </p>

      {/* Target platform selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-[var(--text-muted)]">Zielplattform:</span>
        {platforms.map(p => (
          <button
            key={p.id}
            onClick={() => setTargetPlatform(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              targetPlatform === p.id
                ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-white'
                : 'border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Post list */}
      {!selectedPost && (
        <div className="space-y-2">
          {posts.map(post => (
            <button
              key={post.id}
              onClick={() => handleRecycle(post.id)}
              className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/50 transition-all"
            >
              <img src={post.preview} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-muted)] mb-0.5">{post.platform}</p>
                <p className="text-sm line-clamp-2">{post.caption}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[var(--text-muted)]">
                <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--text-muted)]">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full loading-spin" />
          Recycling...
        </div>
      )}

      {/* Variants */}
      {selectedPost && variants.length > 0 && (
        <div>
          <button
            onClick={() => { setSelectedPost(null); setVariants([]) }}
            className="text-xs text-[var(--text-muted)] hover:text-white mb-3 transition-colors"
          >
            &larr; Zurueck zur Auswahl
          </button>

          <div className="space-y-3">
            {variants.map((v, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">
                    {v.category}
                  </span>
                  <button
                    onClick={() => handleAcceptVariant(v)}
                    className="px-3 py-1 rounded-lg bg-[var(--accent)] text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors"
                  >
                    Uebernehmen
                  </button>
                </div>
                <p className="text-sm leading-relaxed mb-2">{v.caption}</p>
                <p className="text-xs text-[var(--accent)] line-clamp-1">
                  {v.hashtags.slice(0, 8).map(h => `#${h}`).join(' ')}
                  {v.hashtags.length > 8 && ` +${v.hashtags.length - 8}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {accepted > 0 && (
        <p className="text-xs text-[var(--success)] text-center mt-4">
          {accepted} recycelte Posts uebernommen
        </p>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'

interface CompetitorIdea {
  hook: string
  caption: string
  hashtags: string[]
  category: string
  platform: string
  whyItWorks: string
}

interface CompetitorAnalysis {
  avgLikes: number
  avgComments: number
  topHashtags: string[]
  bestHours: string[]
  contentMix: { type: string; count: number; pct: number }[]
  topHooks: string[]
  postsAnalyzed: number
}

interface CompetitorProfile {
  username: string
  fullName: string
  followers: number
  posts: number
}

interface CompetitorScannerProps {
  platforms: { id: string; label: string; color: string }[]
  businessType: string
  language: string
  onIdeaAccepted: (caption: string, hashtags: string[], category: string, platform: string) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  'Storytelling / Emotion': '#F59E0B',
  'Wissen / Mehrwert': '#3B82F6',
  'Community / FOMO': '#EC4899',
  'Behind the Scenes': '#8B5CF6',
  'Produkt-Highlight': '#10B981',
}

export default function CompetitorScanner({
  platforms,
  businessType,
  language,
  onIdeaAccepted,
}: CompetitorScannerProps) {
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<CompetitorProfile | null>(null)
  const [analysis, setAnalysis] = useState<CompetitorAnalysis | null>(null)
  const [ideas, setIdeas] = useState<CompetitorIdea[]>([])
  const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set())

  const scan = async () => {
    if (!handle.trim()) return
    setLoading(true)
    setError('')
    setProfile(null)
    setAnalysis(null)
    setIdeas([])
    setAcceptedIds(new Set())

    try {
      const res = await fetch('/api/competitor-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: handle.trim(),
          businessType,
          language,
          platforms: platforms.map(p => p.id),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Scan fehlgeschlagen')
        return
      }

      setProfile(data.profile)
      setAnalysis(data.analysis)
      setIdeas(data.ideas || [])
    } catch (err) {
      console.error('[CompetitorScanner] Error:', err)
      setError('Verbindungsfehler')
    } finally {
      setLoading(false)
    }
  }

  const acceptIdea = (idea: CompetitorIdea, index: number) => {
    onIdeaAccepted(
      `${idea.hook}\n\n${idea.caption}`,
      idea.hashtags,
      idea.category,
      idea.platform
    )
    setAcceptedIds(prev => new Set(prev).add(index))
  }

  const getCategoryColor = (cat: string) => {
    for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
      if (cat.includes(key.split(' / ')[0])) return color
    }
    return '#888'
  }

  // Initial state — show input
  if (!profile) {
    return (
      <div className="post-card p-6 text-center max-w-lg mx-auto">
        <h3 className="text-lg font-bold mb-2">Competitor Scanner</h3>
        <p className="text-sm text-[var(--text-muted)] mb-5">
          Analysiere den Instagram-Account eines Mitbewerbers und lass dir davon inspirierte Content-Ideen generieren.
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && scan()}
            placeholder="@username"
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
          <button
            onClick={scan}
            disabled={loading || !handle.trim()}
            className="px-6 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full loading-spin" />
                Scannt...
              </span>
            ) : (
              'Scannen'
            )}
          </button>
        </div>

        {loading && (
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Profil wird ueber Apify gescraped — kann 30-60 Sekunden dauern...
          </p>
        )}

        {error && (
          <p className="text-sm text-red-400 mt-3">{error}</p>
        )}
      </div>
    )
  }

  // Results view
  return (
    <div>
      {/* Profile header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center text-sm font-bold">
            {profile.username[0]?.toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold">@{profile.username}</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {profile.followers?.toLocaleString()} Follower · {profile.posts?.toLocaleString()} Posts
            </p>
          </div>
        </div>
        <button
          onClick={() => { setProfile(null); setHandle('') }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors"
        >
          Neuer Scan
        </button>
      </div>

      {/* Analysis cards */}
      {analysis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="post-card p-3 text-center">
            <div className="text-lg font-bold">{analysis.avgLikes.toLocaleString()}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Avg. Likes</div>
          </div>
          <div className="post-card p-3 text-center">
            <div className="text-lg font-bold">{analysis.avgComments.toLocaleString()}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Avg. Kommentare</div>
          </div>
          <div className="post-card p-3 text-center">
            <div className="text-lg font-bold">{analysis.postsAnalyzed}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Posts analysiert</div>
          </div>
          <div className="post-card p-3 text-center">
            <div className="text-lg font-bold">{analysis.bestHours[0] || '-'}</div>
            <div className="text-[10px] text-[var(--text-muted)]">Beste Posting-Zeit</div>
          </div>
        </div>
      )}

      {/* Top hooks */}
      {analysis && analysis.topHooks.length > 0 && (
        <div className="post-card p-4 mb-5">
          <h4 className="text-xs font-bold mb-2 text-[var(--text-muted)]">TOP HOOKS DES COMPETITORS</h4>
          <div className="space-y-1.5">
            {analysis.topHooks.map((hook, i) => (
              <div key={i} className="text-xs text-white/80 flex items-start gap-2">
                <span className="text-[var(--accent)] font-bold shrink-0">{i + 1}.</span>
                <span className="line-clamp-1">&ldquo;{hook}&rdquo;</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content mix + hashtags */}
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          {/* Content mix */}
          <div className="post-card p-4">
            <h4 className="text-xs font-bold mb-3 text-[var(--text-muted)]">CONTENT-MIX</h4>
            <div className="space-y-2">
              {analysis.contentMix.map(c => (
                <div key={c.type} className="flex items-center gap-2">
                  <span className="text-xs w-16 text-[var(--text-muted)]">{c.type}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--text-muted)] w-10 text-right">{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top hashtags */}
          <div className="post-card p-4">
            <h4 className="text-xs font-bold mb-3 text-[var(--text-muted)]">TOP HASHTAGS</h4>
            <div className="flex flex-wrap gap-1.5">
              {analysis.topHashtags.slice(0, 12).map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generated ideas */}
      {ideas.length > 0 && (
        <div>
          <h4 className="text-sm font-bold mb-3">Inspirierte Content-Ideen</h4>
          <div className="space-y-3">
            {ideas.map((idea, i) => {
              const accepted = acceptedIds.has(i)
              const catColor = getCategoryColor(idea.category)
              return (
                <div
                  key={i}
                  className={`post-card p-4 transition-all ${accepted ? 'border-green-500/30 bg-green-500/5' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block text-[10px] font-medium px-2 py-0.5 rounded"
                        style={{ color: catColor, background: catColor + '15' }}
                      >
                        {idea.category?.split(' / ')[0] || 'Content'}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {platforms.find(p => p.id === idea.platform)?.label || idea.platform}
                      </span>
                    </div>
                    <button
                      onClick={() => acceptIdea(idea, i)}
                      disabled={accepted}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        accepted
                          ? 'bg-green-500/20 text-green-400 cursor-default'
                          : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                      }`}
                    >
                      {accepted ? 'Uebernommen' : 'Uebernehmen'}
                    </button>
                  </div>

                  <p className="text-sm font-medium text-white mb-1">{idea.hook}</p>
                  <p className="text-xs text-white/70 mb-2 whitespace-pre-line line-clamp-3">{idea.caption}</p>

                  {idea.whyItWorks && (
                    <p className="text-[10px] text-[var(--accent)]/80 italic mb-2">
                      Warum das funktioniert: {idea.whyItWorks}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {idea.hashtags?.slice(0, 6).map(tag => (
                      <span key={tag} className="text-[10px] text-[var(--text-muted)]">#{tag}</span>
                    ))}
                    {idea.hashtags?.length > 6 && (
                      <span className="text-[10px] text-[var(--text-muted)]">+{idea.hashtags.length - 6}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

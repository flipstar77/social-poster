'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { scorePost, getScoreColor } from '@/lib/post-score'
import { learnFromPost } from '@/lib/content-dna'

// --- Types ---

interface CaptionVariant {
  caption: string
  hashtags: string[]
  category?: string
}

interface GeneratedPost {
  id: string
  photoId: string
  preview: string
  caption: string
  hashtags: string[]
  platform: string
  scheduledDate: string
  scheduledTime: string
  status: 'draft' | 'scheduled' | 'posted'
}

interface SwipeCard {
  photo: { id: string; preview: string; description: string }
  platform: string
  variant: CaptionVariant
  variantIndex: number
  totalVariants: number
}

interface PreferenceData {
  [key: string]: { likes: number; skips: number; superLikes: number }
}

interface PostSwiperProps {
  cards: SwipeCard[]
  onAccept: (card: SwipeCard) => void
  onSkip: (card: SwipeCard) => void
  onSuperLike?: (card: SwipeCard) => void
  onEdit: (card: SwipeCard, edited: { caption: string; hashtags: string[] }) => void
  onComplete: (accepted: number, skipped: number) => void
  platformColors: Record<string, string>
  platformLabels: Record<string, string>
}

// --- Preference Learning (localStorage) ---

const PREF_KEY = 'flowingpost-swipe-preferences'

function loadPreferences(): PreferenceData {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePreference(platform: string, category: string, action: 'like' | 'skip' | 'superlike') {
  const prefs = loadPreferences()
  const key = `${platform}::${category}`
  if (!prefs[key]) prefs[key] = { likes: 0, skips: 0, superLikes: 0 }
  if (action === 'like') prefs[key].likes++
  else if (action === 'superlike') { prefs[key].likes++; prefs[key].superLikes = (prefs[key].superLikes || 0) + 1 }
  else prefs[key].skips++
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
  } catch {}
}

export function getPreferenceScore(platform: string, category: string): number {
  const prefs = loadPreferences()
  const key = `${platform}::${category}`
  const p = prefs[key]
  if (!p || (p.likes + p.skips === 0)) return 0.5
  // Super likes count as 2x weight
  const weightedLikes = p.likes + (p.superLikes || 0)
  return weightedLikes / (weightedLikes + p.skips)
}

// --- Sort cards by preference (higher score first) ---

export function sortByPreference(cards: SwipeCard[]): SwipeCard[] {
  return [...cards].sort((a, b) => {
    const scoreA = getPreferenceScore(a.platform, a.variant.category || 'unknown')
    const scoreB = getPreferenceScore(b.platform, b.variant.category || 'unknown')
    return scoreB - scoreA
  })
}

// --- Component ---

export default function PostSwiper({
  cards: rawCards,
  onAccept,
  onSkip,
  onSuperLike,
  onEdit,
  onComplete,
  platformColors,
  platformLabels,
}: PostSwiperProps) {
  const cards = sortByPreference(rawCards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [accepted, setAccepted] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [superLiked, setSuperLiked] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editCaption, setEditCaption] = useState('')
  const [editHashtags, setEditHashtags] = useState('')
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | null>(null)
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const isComplete = currentIndex >= cards.length
  const card = !isComplete ? cards[currentIndex] : null

  // Summary screen
  useEffect(() => {
    if (isComplete && cards.length > 0) {
      onComplete(accepted, skipped)
    }
  }, [isComplete])

  const advance = useCallback((direction: 'left' | 'right' | 'up') => {
    if (!card) return
    setSwipeDirection(direction)

    if (direction === 'up') {
      savePreference(card.platform, card.variant.category || 'unknown', 'superlike')
      learnFromPost({ caption: card.variant.caption, hashtags: card.variant.hashtags, platform: card.platform, category: card.variant.category || 'unknown', isSuperLike: true })
      onSuperLike?.(card)
      onAccept(card)
      setAccepted(prev => prev + 1)
      setSuperLiked(prev => prev + 1)
    } else {
      const liked = direction === 'right'
      savePreference(card.platform, card.variant.category || 'unknown', liked ? 'like' : 'skip')

      if (liked) {
        learnFromPost({ caption: card.variant.caption, hashtags: card.variant.hashtags, platform: card.platform, category: card.variant.category || 'unknown', isSuperLike: false })
        onAccept(card)
        setAccepted(prev => prev + 1)
      } else {
        onSkip(card)
        setSkipped(prev => prev + 1)
      }
    }

    setTimeout(() => {
      setSwipeDirection(null)
      setDragX(0)
      setDragY(0)
      setCurrentIndex(prev => prev + 1)
      setEditing(false)
    }, 300)
  }, [card, onAccept, onSkip, onSuperLike])

  // Touch / mouse drag
  const handleStart = (clientX: number, clientY: number) => {
    if (editing) return
    startX.current = clientX
    startY.current = clientY
    setIsDragging(true)
  }

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || editing) return
    setDragX(clientX - startX.current)
    setDragY(clientY - startY.current)
  }

  const handleEnd = () => {
    if (!isDragging || editing) return
    setIsDragging(false)
    // Super like: swipe up (negative Y, more than X)
    if (dragY < -80 && Math.abs(dragY) > Math.abs(dragX)) {
      advance('up')
    } else if (Math.abs(dragX) > 100) {
      advance(dragX > 0 ? 'right' : 'left')
    } else {
      setDragX(0)
      setDragY(0)
    }
  }

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editing || isComplete) return
      if (e.key === 'ArrowRight') advance('right')
      if (e.key === 'ArrowLeft') advance('left')
      if (e.key === 'ArrowUp') advance('up')
      if (e.key === 'e' || e.key === 'E') {
        if (card) {
          setEditing(true)
          setEditCaption(card.variant.caption)
          setEditHashtags(card.variant.hashtags.join(', '))
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [advance, editing, isComplete, card])

  const handleSaveEdit = () => {
    if (!card) return
    const hashtags = editHashtags.split(',').map(h => h.trim().replace(/^#/, '')).filter(Boolean)
    onEdit(card, { caption: editCaption, hashtags })
    // Update the card in-place for display
    card.variant.caption = editCaption
    card.variant.hashtags = hashtags
    setEditing(false)
  }

  // Card transform
  const getTransform = () => {
    if (swipeDirection === 'right') return 'translateX(120%) rotate(15deg)'
    if (swipeDirection === 'left') return 'translateX(-120%) rotate(-15deg)'
    if (swipeDirection === 'up') return 'translateY(-120%) scale(0.8)'
    if (dragX !== 0 || dragY !== 0) {
      const rotate = dragX * 0.05
      return `translateX(${dragX}px) translateY(${Math.min(dragY, 0)}px) rotate(${rotate}deg)`
    }
    return 'translateX(0) rotate(0deg)'
  }

  const getOverlayOpacity = () => Math.min(Math.abs(dragX) / 150, 1)
  const getSuperLikeOpacity = () => Math.min(Math.abs(Math.min(dragY, 0)) / 100, 1)

  // --- Summary Screen ---
  if (isComplete) {
    const total = accepted + skipped
    const pct = total > 0 ? Math.round((accepted / total) * 100) : 0
    return (
      <div className="flex flex-col items-center py-12 fade-in">
        <div className="post-card max-w-md w-full p-8 text-center">
          <div className="text-5xl mb-4">
            {pct >= 70 ? '🔥' : pct >= 40 ? '👍' : '🤔'}
          </div>
          <h2 className="text-2xl font-bold mb-2">Review abgeschlossen</h2>
          <p className="text-[var(--text-muted)] mb-6">
            {accepted} eingeplant, {skipped} uebersprungen
          </p>

          {/* Stats bar */}
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-6">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, var(--accent), var(--success))',
              }}
            />
          </div>

          <div className={`grid ${superLiked > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-4 mb-6`}>
            <div className="bg-[var(--success)]/10 rounded-xl p-4">
              <div className="text-2xl font-bold text-[var(--success)]">{accepted}</div>
              <div className="text-xs text-[var(--text-muted)]">Eingeplant</div>
            </div>
            {superLiked > 0 && (
              <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.1))' }}>
                <div className="text-2xl font-bold text-purple-400">{superLiked}</div>
                <div className="text-xs text-[var(--text-muted)]">Super Likes</div>
              </div>
            )}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-2xl font-bold text-[var(--text-muted)]">{skipped}</div>
              <div className="text-xs text-[var(--text-muted)]">Uebersprungen</div>
            </div>
          </div>

          {/* Preference insight */}
          <PreferenceInsight />

          {/* Content DNA insight */}
          <DNAInsight />
        </div>
      </div>
    )
  }

  if (!card) return null

  const platformColor = platformColors[card.platform] || '#888'

  return (
    <div className="flex flex-col items-center">
      {/* Progress bar */}
      <div className="w-full max-w-md mb-4">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1.5">
          <span>{currentIndex + 1} / {cards.length}</span>
          <span className="flex items-center gap-3">
            <span className="text-[var(--success)]">{accepted} eingeplant</span>
            <span>{skipped} skip</span>
          </span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex) / cards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Swipe card */}
      <div
        className="relative w-full max-w-md select-none"
        style={{ minHeight: 480 }}
      >
        {/* Next card preview (behind) */}
        {currentIndex + 1 < cards.length && (
          <div
            className="absolute inset-0 rounded-2xl overflow-hidden border border-[var(--border)]"
            style={{
              transform: 'scale(0.95) translateY(12px)',
              opacity: 0.5,
              background: 'var(--card)',
              zIndex: 0,
            }}
          />
        )}

        {/* Current card */}
        <div
          ref={cardRef}
          className="relative rounded-2xl overflow-hidden border border-[var(--border)] cursor-grab active:cursor-grabbing"
          style={{
            background: 'var(--card)',
            transform: getTransform(),
            transition: swipeDirection || !isDragging ? 'transform 0.3s ease' : 'none',
            zIndex: 1,
          }}
          onMouseDown={e => handleStart(e.clientX, e.clientY)}
          onMouseMove={e => handleMove(e.clientX, e.clientY)}
          onMouseUp={handleEnd}
          onMouseLeave={() => { if (isDragging) handleEnd() }}
          onTouchStart={e => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={e => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={handleEnd}
        >
          {/* Swipe overlays */}
          {dragY < -30 && Math.abs(dragY) > Math.abs(dragX) && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
              style={{ opacity: getSuperLikeOpacity(), background: 'linear-gradient(to top, rgba(139,92,246,0.3), rgba(236,72,153,0.2))' }}
            >
              <span className="text-5xl font-bold text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>SUPER</span>
            </div>
          )}
          {dragX > 0 && !(dragY < -30 && Math.abs(dragY) > Math.abs(dragX)) && (
            <div
              className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-10 pointer-events-none"
              style={{ opacity: getOverlayOpacity() }}
            >
              <span className="text-6xl font-bold text-green-400 rotate-[-15deg]">PLAN</span>
            </div>
          )}
          {dragX < 0 && !(dragY < -30 && Math.abs(dragY) > Math.abs(dragX)) && (
            <div
              className="absolute inset-0 bg-red-500/20 flex items-center justify-center z-10 pointer-events-none"
              style={{ opacity: getOverlayOpacity() }}
            >
              <span className="text-6xl font-bold text-red-400 rotate-[15deg]">SKIP</span>
            </div>
          )}

          {/* Photo */}
          <div className="relative aspect-[4/3] overflow-hidden">
            <img
              src={card.photo.preview}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
            {/* Platform badge */}
            <div
              className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
              style={{ background: platformColor + '22', color: platformColor, border: `1px solid ${platformColor}44` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: platformColor }} />
              {platformLabels[card.platform] || card.platform}
            </div>
            {/* Category badge */}
            {card.variant.category && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-medium bg-black/60 text-white/80 backdrop-blur-sm">
                {card.variant.category}
              </div>
            )}
            {/* Post Score badge */}
            {(() => {
              const { score } = scorePost({ caption: card.variant.caption, hashtags: card.variant.hashtags, platform: card.platform })
              const color = getScoreColor(score)
              return (
                <div
                  className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-sm flex items-center gap-1"
                  style={{ background: 'rgba(0,0,0,0.7)', color, border: `1px solid ${color}44` }}
                >
                  <span>{score}</span>
                  <span className="text-[9px] font-normal text-white/60">/100</span>
                </div>
              )
            })()}
            {/* Variant indicator */}
            {card.totalVariants > 1 && (
              <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full text-[10px] font-medium bg-black/60 text-white/70 backdrop-blur-sm">
                Variante {card.variantIndex + 1}/{card.totalVariants}
              </div>
            )}
          </div>

          {/* Caption */}
          <div className="p-5">
            {!editing ? (
              <>
                <p className="text-sm leading-relaxed mb-3 line-clamp-4">{card.variant.caption}</p>
                <p className="text-xs text-[var(--accent)] mb-3 line-clamp-2">
                  {card.variant.hashtags.slice(0, 8).map(h => `#${h}`).join(' ')}
                  {card.variant.hashtags.length > 8 && ` +${card.variant.hashtags.length - 8}`}
                </p>
                {/* Score breakdown */}
                {(() => {
                  const { score, factors } = scorePost({ caption: card.variant.caption, hashtags: card.variant.hashtags, platform: card.platform })
                  const color = getScoreColor(score)
                  return (
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {factors.map(f => (
                        <span
                          key={f.label}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: f.points >= f.max * 0.7 ? 'rgba(34,197,94,0.1)' : f.points >= f.max * 0.4 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)',
                            color: f.points >= f.max * 0.7 ? '#22c55e' : f.points >= f.max * 0.4 ? '#eab308' : '#ef4444',
                          }}
                        >
                          {f.label} {f.points}/{f.max}
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </>
            ) : (
              <div className="space-y-3" onClick={e => e.stopPropagation()}>
                <textarea
                  value={editCaption}
                  onChange={e => setEditCaption(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg bg-white/5 border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none resize-y"
                  rows={4}
                  onMouseDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                />
                <input
                  value={editHashtags}
                  onChange={e => setEditHashtags(e.target.value)}
                  placeholder="hashtag1, hashtag2, ..."
                  className="w-full text-xs px-3 py-2 rounded-lg bg-white/5 border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
                  onMouseDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-xs font-medium"
                  >
                    Speichern
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-1.5 rounded-lg bg-white/10 text-xs font-medium"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!editing && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => advance('left')}
                  className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors text-xl"
                  title="Skip (Pfeil links)"
                >
                  &#x2715;
                </button>
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => advance('up')}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-colors text-sm"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.15))',
                      border: '1px solid rgba(139,92,246,0.3)',
                      color: '#a78bfa',
                    }}
                    title="Super Like (Pfeil hoch)"
                  >
                    &#9733;
                  </button>
                  <button
                    onClick={() => {
                      setEditing(true)
                      setEditCaption(card.variant.caption)
                      setEditHashtags(card.variant.hashtags.join(', '))
                    }}
                    className="w-8 h-8 rounded-full bg-white/5 border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-white transition-colors text-xs"
                    title="Bearbeiten (E)"
                  >
                    &#9998;
                  </button>
                </div>
                <button
                  onClick={() => advance('right')}
                  className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center text-green-400 hover:bg-green-500/20 transition-colors text-xl"
                  title="Einplanen (Pfeil rechts)"
                >
                  &#x2713;
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="flex items-center gap-6 mt-4 text-[10px] text-[var(--text-muted)]">
        <span>&#8592; Skip</span>
        <span>&#8593; Super Like</span>
        <span>E = Bearbeiten</span>
        <span>&#8594; Einplanen</span>
      </div>
    </div>
  )
}

// --- Preference Insight ---

function PreferenceInsight() {
  const [prefs, setPrefs] = useState<PreferenceData>({})

  useEffect(() => {
    setPrefs(loadPreferences())
  }, [])

  const entries = Object.entries(prefs)
    .filter(([, v]) => v.likes + v.skips >= 2)
    .sort(([, a], [, b]) => {
      const scoreA = a.likes / (a.likes + a.skips)
      const scoreB = b.likes / (b.likes + b.skips)
      return scoreB - scoreA
    })
    .slice(0, 3)

  if (entries.length === 0) return null

  return (
    <div className="text-left mt-4 pt-4 border-t border-[var(--border)]">
      <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Deine Vorlieben</p>
      <div className="space-y-1.5">
        {entries.map(([key, val]) => {
          const [platform, category] = key.split('::')
          const score = Math.round((val.likes / (val.likes + val.skips)) * 100)
          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-muted)] w-20 truncate">{platform}</span>
              <span className="flex-1 truncate">{category}</span>
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${score}%`,
                    background: score >= 60 ? 'var(--success)' : 'var(--accent)',
                  }}
                />
              </div>
              <span className="w-8 text-right" style={{ color: score >= 60 ? 'var(--success)' : 'var(--text-muted)' }}>
                {score}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- DNA Insight ---

function DNAInsight() {
  const [dna, setDna] = useState<{ totalPosts: number; superLikes: number; avgLength: number; topCategories: string[]; hookStyles: string[]; maturity: string } | null>(null)

  useEffect(() => {
    import('@/lib/content-dna').then(mod => {
      if (mod.hasDNAInsights()) {
        const summary = mod.getDNASummary()
        setDna({
          totalPosts: summary.totalPosts,
          superLikes: summary.superLikes,
          avgLength: summary.avgLength,
          topCategories: summary.topCategories,
          hookStyles: summary.hookStyles,
          maturity: summary.maturity,
        })
      }
    })
  }, [])

  if (!dna) return null

  const maturityLabel = dna.maturity === 'new' ? 'Lernphase' : dna.maturity === 'learning' ? 'AI lernt...' : 'Profil aktiv'
  const maturityColor = dna.maturity === 'mature' ? '#22c55e' : dna.maturity === 'learning' ? '#eab308' : '#6b7280'

  return (
    <div className="text-left mt-4 pt-4 border-t border-[var(--border)]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-[var(--text-muted)]">Content DNA</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: maturityColor, background: maturityColor + '15' }}>
          {maturityLabel} ({dna.totalPosts} Posts)
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-[var(--text-muted)]">
        {dna.avgLength > 0 && (
          <p>Avg. Laenge: ~{dna.avgLength} Zeichen</p>
        )}
        {dna.topCategories.length > 0 && (
          <p>Lieblings-Typen: {dna.topCategories.map(c => c.split(' / ')[0]).join(', ')}</p>
        )}
        {dna.hookStyles.length > 0 && (
          <p>Hook-Stile: {dna.hookStyles.join(', ')}</p>
        )}
        {dna.superLikes > 0 && (
          <p>Super Likes: {dna.superLikes}</p>
        )}
      </div>
    </div>
  )
}

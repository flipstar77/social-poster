'use client'

import { useState } from 'react'

interface Hook {
  text: string
  strategy: string
}

interface HookGeneratorProps {
  photos: { id: string; preview: string; description: string }[]
  platform: string
  businessType: string
  tone: string
  language: string
  whatsappNumber?: string
  onCaptionGenerated: (photoId: string, platform: string, caption: string, hashtags: string[], category: string) => void
  platformColor: string
  platformLabel: string
}

export default function HookGenerator({
  photos,
  platform,
  businessType,
  tone,
  language,
  whatsappNumber,
  onCaptionGenerated,
  platformColor,
  platformLabel,
}: HookGeneratorProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [hooks, setHooks] = useState<Hook[]>([])
  const [loading, setLoading] = useState(false)
  const [expanding, setExpanding] = useState<string | null>(null)
  const [completed, setCompleted] = useState(0)

  const photo = photos[currentPhotoIndex]
  const isComplete = currentPhotoIndex >= photos.length

  const generateHooks = async () => {
    if (!photo) return
    setLoading(true)
    setHooks([])

    try {
      const res = await fetch('/api/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: photo.description || 'ein Foto des Restaurants',
          businessType,
          platform,
          language,
          tone,
        }),
      })

      const data = await res.json()
      if (data.hooks) {
        setHooks(data.hooks)
      }
    } catch (err) {
      console.error('[HookGenerator] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectHook = async (hook: Hook) => {
    if (!photo) return
    setExpanding(hook.text)

    try {
      const res = await fetch('/api/hooks/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook: hook.text,
          description: photo.description || 'ein Foto des Restaurants',
          businessType,
          platform,
          language,
          tone,
          whatsappNumber,
        }),
      })

      const data = await res.json()
      if (data.caption) {
        onCaptionGenerated(photo.id, platform, data.caption, data.hashtags || [], data.category || hook.strategy)
        setCompleted(prev => prev + 1)
        // Move to next photo
        setCurrentPhotoIndex(prev => prev + 1)
        setHooks([])
      }
    } catch (err) {
      console.error('[HookGenerator] Expand error:', err)
    } finally {
      setExpanding(null)
    }
  }

  const skipPhoto = () => {
    setCurrentPhotoIndex(prev => prev + 1)
    setHooks([])
  }

  // --- Summary ---
  if (isComplete) {
    return (
      <div className="flex flex-col items-center py-12 fade-in">
        <div className="post-card max-w-md w-full p-8 text-center">
          <div className="text-5xl mb-4">{completed > 0 ? '⚡' : '🤔'}</div>
          <h2 className="text-2xl font-bold mb-2">Hooks fertig</h2>
          <p className="text-[var(--text-muted)]">
            {completed} Posts aus Hooks erstellt
          </p>
        </div>
      </div>
    )
  }

  if (!photo) return null

  // Strategy label colors
  const strategyColors: Record<string, string> = {
    storytelling: '#F59E0B',
    frage: '#3B82F6',
    kontrovers: '#EF4444',
    pov: '#8B5CF6',
    statistik: '#10B981',
    geheimnis: '#EC4899',
    dringlichkeit: '#F97316',
    emotion: '#6366F1',
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-4">
        <span>Foto {currentPhotoIndex + 1} / {photos.length}</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: platformColor }} />
          {platformLabel}
        </span>
      </div>

      {/* Photo preview */}
      <div className="post-card overflow-hidden mb-4">
        <div className="relative aspect-[4/3]">
          <img src={photo.preview} alt="" className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-sm text-white/80">{photo.description || 'Kein Beschreibung'}</p>
          </div>
        </div>
      </div>

      {/* Generate hooks button */}
      {hooks.length === 0 && !loading && (
        <div className="flex gap-3 justify-center mb-4">
          <button
            onClick={generateHooks}
            className="px-6 py-3 rounded-xl font-medium transition-all"
            style={{
              background: `linear-gradient(135deg, ${platformColor}, ${platformColor}cc)`,
              boxShadow: `0 4px 15px ${platformColor}33`,
            }}
          >
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              8 Hooks generieren
            </span>
          </button>
          <button
            onClick={skipPhoto}
            className="px-4 py-3 rounded-xl bg-white/5 border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-white transition-colors"
          >
            Skip
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--text-muted)]">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full loading-spin" />
          Generiere Hooks...
        </div>
      )}

      {/* Hook list */}
      {hooks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)] mb-2">Waehle deinen Hook — AI baut die Caption daraus:</p>
          {hooks.map((hook, i) => (
            <button
              key={i}
              onClick={() => selectHook(hook)}
              disabled={!!expanding}
              className={`w-full text-left rounded-xl p-4 border transition-all ${
                expanding === hook.text
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]/50 hover:bg-white/5'
              } disabled:opacity-60`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-0.5"
                  style={{
                    color: strategyColors[hook.strategy] || '#888',
                    background: (strategyColors[hook.strategy] || '#888') + '15',
                  }}
                >
                  {hook.strategy}
                </span>
                <span className="text-sm font-medium flex-1">
                  {expanding === hook.text ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full loading-spin" />
                      Caption wird generiert...
                    </span>
                  ) : (
                    `"${hook.text}"`
                  )}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

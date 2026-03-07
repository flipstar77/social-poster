'use client'

import { useState } from 'react'

interface StrategySlot {
  day: number
  platform: string
  category: string
  time: string
  tip: string
}

interface WeeklyStrategyProps {
  platforms: { id: string; label: string; color: string }[]
  businessType: string
  language: string
  onApplyStrategy: (slots: StrategySlot[]) => void
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const WEEKDAYS_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

const CATEGORY_COLORS: Record<string, string> = {
  'Storytelling / Emotion': '#F59E0B',
  'Wissen / Mehrwert': '#3B82F6',
  'Community / FOMO': '#EC4899',
  'Behind the Scenes': '#8B5CF6',
  'Produkt-Highlight': '#10B981',
}

export default function WeeklyStrategy({
  platforms,
  businessType,
  language,
  onApplyStrategy,
}: WeeklyStrategyProps) {
  const [strategy, setStrategy] = useState<StrategySlot[]>([])
  const [weeklyTip, setWeeklyTip] = useState('')
  const [loading, setLoading] = useState(false)
  const [postsPerWeek, setPostsPerWeek] = useState(7)
  const [generated, setGenerated] = useState(false)

  // Load preferences from localStorage
  const getPreferences = () => {
    try {
      const raw = localStorage.getItem('flowingpost-swipe-preferences')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }

  const generateStrategy = async () => {
    setLoading(true)
    setStrategy([])
    setWeeklyTip('')

    try {
      const res = await fetch('/api/weekly-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: platforms.map(p => p.id),
          businessType,
          language,
          postsPerWeek,
          preferences: getPreferences(),
        }),
      })

      const data = await res.json()
      if (data.strategy) {
        setStrategy(data.strategy)
        setWeeklyTip(data.weeklyTip || '')
        setGenerated(true)
      }
    } catch (err) {
      console.error('[WeeklyStrategy] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getPlatformColor = (id: string) => platforms.find(p => p.id === id)?.color || '#888'
  const getPlatformLabel = (id: string) => platforms.find(p => p.id === id)?.label || id

  if (!generated) {
    return (
      <div className="post-card p-6 text-center">
        <h3 className="text-lg font-bold mb-2">Wochen-Strategie</h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          AI erstellt einen optimalen Content-Plan basierend auf deinen Praeferenzen.
        </p>

        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-xs text-[var(--text-muted)]">Posts pro Woche:</span>
          <div className="flex items-center bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
            {[5, 7, 10, 14].map(n => (
              <button
                key={n}
                onClick={() => setPostsPerWeek(n)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  postsPerWeek === n ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generateStrategy}
          disabled={loading}
          className="px-6 py-3 rounded-xl font-medium transition-all"
          style={{
            background: 'linear-gradient(135deg, var(--accent), #8b5cf6)',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
          }}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full loading-spin" />
              Strategie wird erstellt...
            </span>
          ) : (
            'AI Strategie generieren'
          )}
        </button>
      </div>
    )
  }

  // Group by day
  const byDay = new Map<number, StrategySlot[]>()
  for (const slot of strategy) {
    if (!byDay.has(slot.day)) byDay.set(slot.day, [])
    byDay.get(slot.day)!.push(slot)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold">Deine Wochen-Strategie</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={generateStrategy}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors"
          >
            {loading ? '...' : 'Neu generieren'}
          </button>
          <button
            onClick={() => onApplyStrategy(strategy)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            Plan uebernehmen
          </button>
        </div>
      </div>

      {/* Weekly tip */}
      {weeklyTip && (
        <div className="rounded-xl p-3 mb-4 border border-[var(--accent)]/20 bg-[var(--accent)]/5">
          <p className="text-xs text-[var(--accent)]">Tipp der Woche: {weeklyTip}</p>
        </div>
      )}

      {/* Strategy grid */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, day) => {
          const slots = byDay.get(day) || []
          return (
            <div
              key={day}
              className={`rounded-xl p-2.5 border ${
                slots.length > 0 ? 'border-[var(--border)] bg-[var(--card)]' : 'border-dashed border-[var(--border)]/50 bg-white/[0.01]'
              }`}
            >
              <div className="text-xs font-bold text-center mb-2">{WEEKDAYS[day]}</div>

              {slots.length === 0 && (
                <div className="text-[10px] text-[var(--text-muted)] text-center py-4">Frei</div>
              )}

              {slots.map((slot, i) => (
                <div
                  key={i}
                  className="rounded-lg p-2 mb-1.5 last:mb-0"
                  style={{
                    background: `${getPlatformColor(slot.platform)}10`,
                    borderLeft: `3px solid ${getPlatformColor(slot.platform)}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: getPlatformColor(slot.platform) }}
                    >
                      {getPlatformLabel(slot.platform)}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">{slot.time}</span>
                  </div>
                  <span
                    className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                      color: CATEGORY_COLORS[slot.category] || '#888',
                      background: (CATEGORY_COLORS[slot.category] || '#888') + '15',
                    }}
                  >
                    {slot.category?.split(' / ')[0] || 'Content'}
                  </span>
                  {slot.tip && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1 line-clamp-2">{slot.tip}</p>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {cat.split(' / ')[0]}
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'

// Categories that match our generation system
const CATEGORIES = [
  'Storytelling / Emotion',
  'Wissen / Mehrwert',
  'Community / FOMO',
  'Behind the Scenes',
  'Produkt-Highlight',
] as const

interface BalanceData {
  category: string
  count: number
  percentage: number
}

interface ContentBalanceProps {
  /** All posts that have been scheduled/accepted */
  posts: { category?: string; platform: string }[]
  /** Compact mode for sidebar/widget display */
  compact?: boolean
}

export default function ContentBalance({ posts, compact = false }: ContentBalanceProps) {
  const total = posts.length

  if (total === 0) return null

  // Count by category
  const counts = new Map<string, number>()
  for (const post of posts) {
    const cat = post.category || 'Sonstige'
    counts.set(cat, (counts.get(cat) || 0) + 1)
  }

  const data: BalanceData[] = CATEGORIES.map(cat => ({
    category: cat,
    count: counts.get(cat) || 0,
    percentage: Math.round(((counts.get(cat) || 0) / total) * 100),
  })).sort((a, b) => b.count - a.count)

  // Detect imbalances
  const idealPct = 100 / CATEGORIES.length // ~20% each
  const gaps = data.filter(d => d.percentage < idealPct * 0.4 && total >= 5) // under 8% when ideal is 20%
  const overRepresented = data.filter(d => d.percentage > idealPct * 2.5) // over 50%

  const categoryColors: Record<string, string> = {
    'Storytelling / Emotion': '#F59E0B',
    'Wissen / Mehrwert': '#3B82F6',
    'Community / FOMO': '#EC4899',
    'Behind the Scenes': '#8B5CF6',
    'Produkt-Highlight': '#10B981',
    'Sonstige': '#6B7280',
  }

  if (compact) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Content-Mix</p>
        {data.filter(d => d.count > 0).map(d => (
          <div key={d.category} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: categoryColors[d.category] || '#888' }}
            />
            <span className="flex-1 truncate text-[var(--text-muted)]">{d.category.split(' / ')[0]}</span>
            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${d.percentage}%`,
                  background: categoryColors[d.category] || '#888',
                }}
              />
            </div>
            <span className="w-6 text-right text-[10px]">{d.count}</span>
          </div>
        ))}
        {gaps.length > 0 && (
          <p className="text-[10px] text-amber-400 mt-2">
            Wenig: {gaps.map(g => g.category.split(' / ')[0]).join(', ')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="post-card p-5">
      <h3 className="text-sm font-bold mb-3">Content-Balance</h3>
      <p className="text-xs text-[var(--text-muted)] mb-4">{total} Posts analysiert</p>

      {/* Bar chart */}
      <div className="space-y-2.5 mb-4">
        {data.map(d => (
          <div key={d.category}>
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: categoryColors[d.category] || '#888' }}
                />
                <span>{d.category}</span>
              </div>
              <span className="text-[var(--text-muted)]">{d.count} ({d.percentage}%)</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${d.percentage}%`,
                  background: categoryColors[d.category] || '#888',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Warnings */}
      {gaps.length > 0 && (
        <div className="rounded-lg p-3 mb-3 border border-amber-500/30 bg-amber-500/5">
          <p className="text-xs font-medium text-amber-400 mb-1">Unterrepresentiert</p>
          {gaps.map(g => (
            <p key={g.category} className="text-xs text-[var(--text-muted)]">
              {g.category} — nur {g.percentage}% deiner Posts
            </p>
          ))}
        </div>
      )}

      {overRepresented.length > 0 && (
        <div className="rounded-lg p-3 border border-blue-500/30 bg-blue-500/5">
          <p className="text-xs font-medium text-blue-400 mb-1">Dominiert</p>
          {overRepresented.map(d => (
            <p key={d.category} className="text-xs text-[var(--text-muted)]">
              {d.category} — {d.percentage}% deiner Posts
            </p>
          ))}
        </div>
      )}

      {gaps.length === 0 && overRepresented.length === 0 && total >= 5 && (
        <div className="rounded-lg p-3 border border-green-500/30 bg-green-500/5">
          <p className="text-xs font-medium text-green-400">Gute Balance! Dein Content-Mix ist ausgewogen.</p>
        </div>
      )}
    </div>
  )
}

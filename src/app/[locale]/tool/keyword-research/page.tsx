'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'

import type { KeywordResult, KeywordIntent, ResearchResult } from '@/lib/keyword-research/constants'

type SortField = 'keyword' | 'intent' | 'words' | 'source' | 'coverage'
type SortDir = 'asc' | 'desc'
type CoverageStatus = 'covered' | 'partial' | 'gap'

const CATEGORIES = ['Instagram', 'TikTok', 'Google Maps', 'SEO', 'Strategie'] as const
type Category = (typeof CATEGORIES)[number]

const INTENT_COLORS: Record<KeywordIntent, string> = {
  commercial: '#f59e0b',
  transactional: '#22c55e',
  informational: '#3b82f6',
}

const COVERAGE_COLORS: Record<CoverageStatus, string> = {
  covered: '#22c55e',
  partial: '#f59e0b',
  gap: '#ef4444',
}

const COVERAGE_LABELS: Record<CoverageStatus, string> = {
  covered: 'Covered',
  partial: 'Partial',
  gap: 'Gap',
}

interface BlogPostInfo {
  slug: string
  title: string
  category: string
}

interface EnrichedKeyword extends KeywordResult {
  coverage: CoverageStatus
  matchedSlug?: string
  matchedTitle?: string
}

function IntentBadge({ intent }: { intent: KeywordIntent }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${INTENT_COLORS[intent]}22`, color: INTENT_COLORS[intent] }}
    >
      {intent}
    </span>
  )
}

function CoverageBadge({ status, title }: { status: CoverageStatus; title?: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium cursor-default"
      style={{ backgroundColor: `${COVERAGE_COLORS[status]}22`, color: COVERAGE_COLORS[status] }}
      title={title}
    >
      {COVERAGE_LABELS[status]}
    </span>
  )
}

function matchKeywordToPost(keyword: string, posts: BlogPostInfo[]): { status: CoverageStatus; post?: BlogPostInfo } {
  const kwWords = keyword.toLowerCase().split(/\s+/)

  for (const post of posts) {
    const titleLower = post.title.toLowerCase()
    const slugWords = post.slug.replace(/-/g, ' ')

    // Exact: all keyword words appear in title or slug
    if (kwWords.every((w) => titleLower.includes(w) || slugWords.includes(w))) {
      return { status: 'covered', post }
    }
  }

  // Partial: >50% of keyword words appear in any title/slug
  for (const post of posts) {
    const titleLower = post.title.toLowerCase()
    const slugWords = post.slug.replace(/-/g, ' ')
    const matchCount = kwWords.filter((w) => titleLower.includes(w) || slugWords.includes(w)).length
    if (matchCount / kwWords.length > 0.5) {
      return { status: 'partial', post }
    }
  }

  return { status: 'gap' }
}

export default function KeywordResearchPage() {
  const [seed, setSeed] = useState('')
  const [lang, setLang] = useState<'de' | 'en'>('de')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [error, setError] = useState('')
  const [blogPosts, setBlogPosts] = useState<BlogPostInfo[]>([])

  // Selection & save
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saveCategory, setSaveCategory] = useState<Category>('Strategie')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // Filters
  const [intentFilter, setIntentFilter] = useState<KeywordIntent | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [coverageFilter, setCoverageFilter] = useState<CoverageStatus | 'all'>('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [minWords, setMinWords] = useState(1)

  // Sorting
  const [sortField, setSortField] = useState<SortField>('words')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Load existing blog posts on mount
  useEffect(() => {
    fetch('/api/keyword-research/gaps')
      .then((res) => res.json())
      .then((data) => setBlogPosts(data.posts || []))
      .catch(() => {})
  }, [])

  const runResearch = useCallback(async () => {
    if (!seed.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setSelected(new Set())
    setSaveMessage('')

    try {
      const res = await fetch('/api/keyword-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: seed.trim(), lang }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Research failed')
      }
      setResult(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [seed, lang])

  const enrichedKeywords: EnrichedKeyword[] = useMemo(() => {
    if (!result) return []
    return result.keywords.map((kw) => {
      const match = matchKeywordToPost(kw.keyword, blogPosts)
      return {
        ...kw,
        coverage: match.status,
        matchedSlug: match.post?.slug,
        matchedTitle: match.post?.title,
      }
    })
  }, [result, blogPosts])

  const filteredKeywords = useMemo(() => {
    let kws = enrichedKeywords

    if (intentFilter !== 'all') {
      kws = kws.filter((k) => k.intent === intentFilter)
    }
    if (sourceFilter !== 'all') {
      kws = kws.filter((k) => k.source === sourceFilter)
    }
    if (coverageFilter !== 'all') {
      kws = kws.filter((k) => k.coverage === coverageFilter)
    }
    if (searchFilter) {
      const lower = searchFilter.toLowerCase()
      kws = kws.filter((k) => k.keyword.includes(lower))
    }
    if (minWords > 1) {
      kws = kws.filter((k) => k.words >= minWords)
    }

    return [...kws].sort((a, b) => {
      if (sortField === 'coverage') {
        const order: Record<CoverageStatus, number> = { gap: 0, partial: 1, covered: 2 }
        const diff = order[a.coverage] - order[b.coverage]
        return sortDir === 'asc' ? diff : -diff
      }
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
  }, [enrichedKeywords, intentFilter, sourceFilter, coverageFilter, searchFilter, minWords, sortField, sortDir])

  const gapStats = useMemo(() => {
    const covered = enrichedKeywords.filter((k) => k.coverage === 'covered').length
    const partial = enrichedKeywords.filter((k) => k.coverage === 'partial').length
    const gap = enrichedKeywords.filter((k) => k.coverage === 'gap').length
    return { covered, partial, gap }
  }, [enrichedKeywords])

  const sources = useMemo(() => {
    if (!result) return []
    return [...new Set(result.keywords.map((k) => k.source))]
  }, [result])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'coverage' ? 'asc' : 'desc')
    }
  }

  function toggleSelect(keyword: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(keyword)) next.delete(keyword)
      else next.add(keyword)
      return next
    })
  }

  function selectAllGaps() {
    const gaps = filteredKeywords
      .filter((k) => k.coverage === 'gap')
      .map((k) => k.keyword)
    setSelected(new Set(gaps))
  }

  function selectAll() {
    setSelected(new Set(filteredKeywords.map((k) => k.keyword)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  async function saveSelected() {
    if (selected.size === 0) return
    setSaving(true)
    setSaveMessage('')

    const keywords = enrichedKeywords
      .filter((k) => selected.has(k.keyword))
      .map((k) => ({
        keyword: k.keyword,
        category: saveCategory,
        intent: k.intent,
        parent_keyword: result?.seed || seed,
      }))

    try {
      const res = await fetch('/api/keyword-research/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, seed: result?.seed || seed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaveMessage(`${data.saved} keywords saved to pipeline`)
      setSelected(new Set())
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function exportCsv() {
    if (!filteredKeywords.length) return
    const header = 'keyword,intent,words,source,coverage,matched_article'
    const rows = filteredKeywords.map(
      (k) => `"${k.keyword}","${k.intent}",${k.words},"${k.source}","${k.coverage}","${k.matchedSlug || ''}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `keywords-${result?.seed || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-zinc-950 border-b border-zinc-700">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Keyword Research</h2>
          {blogPosts.length > 0 && (
            <span className="text-xs text-zinc-500">{blogPosts.length} articles loaded</span>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Search bar */}
        <div className="flex gap-3">
          <input
            type="text"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && runResearch()}
            placeholder="Seed keyword, z.B. 'restaurant instagram'"
            className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as 'de' | 'en')}
            className="px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
          >
            <option value="de">DE</option>
            <option value="en">EN</option>
          </select>
          <button
            onClick={runResearch}
            disabled={loading || !seed.trim()}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Searching...' : 'Research'}
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-12 text-zinc-400">
            <div className="inline-block w-8 h-8 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin mb-3" />
            <p>Mining Google Autocomplete... This takes ~15 seconds.</p>
          </div>
        )}

        {result && !loading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <SummaryCard label="Total" value={result.summary.total} color="#fff" />
              <SummaryCard label="Commercial" value={result.summary.commercial} color={INTENT_COLORS.commercial} />
              <SummaryCard label="Transactional" value={result.summary.transactional} color={INTENT_COLORS.transactional} />
              <SummaryCard label="Informational" value={result.summary.informational} color={INTENT_COLORS.informational} />
              <SummaryCard label="Covered" value={gapStats.covered} color={COVERAGE_COLORS.covered} />
              <SummaryCard label="Partial" value={gapStats.partial} color={COVERAGE_COLORS.partial} />
              <SummaryCard label="Gaps" value={gapStats.gap} color={COVERAGE_COLORS.gap} />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={intentFilter}
                onChange={(e) => setIntentFilter(e.target.value as KeywordIntent | 'all')}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
              >
                <option value="all">All Intents</option>
                <option value="commercial">Commercial</option>
                <option value="transactional">Transactional</option>
                <option value="informational">Informational</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
              >
                <option value="all">All Sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={coverageFilter}
                onChange={(e) => setCoverageFilter(e.target.value as CoverageStatus | 'all')}
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
              >
                <option value="all">All Coverage</option>
                <option value="gap">Gaps only</option>
                <option value="partial">Partial</option>
                <option value="covered">Covered</option>
              </select>

              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter keywords..."
                className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none"
              />

              <label className="flex items-center gap-2 text-sm text-zinc-400">
                Min words:
                <input
                  type="number"
                  value={minWords}
                  onChange={(e) => setMinWords(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  max={10}
                  className="w-16 px-2 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-center focus:outline-none"
                />
              </label>

              <div className="ml-auto flex items-center gap-3">
                <span className="text-sm text-zinc-400">
                  {filteredKeywords.length} results
                </span>
                <button
                  onClick={exportCsv}
                  disabled={!filteredKeywords.length}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* Selection & Save bar */}
            <div className="flex flex-wrap gap-3 items-center px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg">
              <div className="flex gap-2">
                <button onClick={selectAllGaps} className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-800 rounded text-xs text-red-300 transition-colors">
                  Select Gaps
                </button>
                <button onClick={selectAll} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-zinc-300 transition-colors">
                  Select All
                </button>
                <button onClick={clearSelection} className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-zinc-300 transition-colors">
                  Clear
                </button>
              </div>

              <span className="text-sm text-zinc-400">
                {selected.size} selected
              </span>

              <div className="ml-auto flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  Category:
                  <select
                    value={saveCategory}
                    onChange={(e) => setSaveCategory(e.target.value as Category)}
                    className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-white focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={saveSelected}
                  disabled={selected.size === 0 || saving}
                  className="px-4 py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving...' : 'Save to Pipeline'}
                </button>
              </div>

              {saveMessage && (
                <span className={`text-xs ${saveMessage.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
                  {saveMessage}
                </span>
              )}
            </div>

            {/* Results table */}
            <div className="border border-zinc-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-800 text-zinc-400">
                      <th className="px-3 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={filteredKeywords.length > 0 && filteredKeywords.every((k) => selected.has(k.keyword))}
                          onChange={(e) => {
                            if (e.target.checked) selectAll()
                            else clearSelection()
                          }}
                          className="accent-blue-500"
                        />
                      </th>
                      <SortHeader label="Keyword" field="keyword" current={sortField} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Intent" field="intent" current={sortField} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Coverage" field="coverage" current={sortField} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Words" field="words" current={sortField} dir={sortDir} onClick={toggleSort} />
                      <SortHeader label="Source" field="source" current={sortField} dir={sortDir} onClick={toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKeywords.slice(0, 500).map((kw) => (
                      <tr
                        key={kw.keyword}
                        className={`border-t border-zinc-800 hover:bg-zinc-800/50 cursor-pointer ${selected.has(kw.keyword) ? 'bg-blue-900/20' : ''}`}
                        onClick={() => toggleSelect(kw.keyword)}
                      >
                        <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(kw.keyword)}
                            onChange={() => toggleSelect(kw.keyword)}
                            className="accent-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-white">{kw.keyword}</td>
                        <td className="px-4 py-2.5"><IntentBadge intent={kw.intent} /></td>
                        <td className="px-4 py-2.5">
                          <CoverageBadge status={kw.coverage} title={kw.matchedTitle} />
                          {kw.matchedSlug && (
                            <a
                              href={`/de/blog/${kw.matchedSlug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-xs text-zinc-500 hover:text-zinc-300 underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              view
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400 text-center">{kw.words}</td>
                        <td className="px-4 py-2.5 text-zinc-500">{kw.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredKeywords.length > 500 && (
                <div className="px-4 py-2 bg-zinc-800 text-zinc-500 text-sm text-center">
                  Showing 500 of {filteredKeywords.length} results. Export CSV for full list.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg">
      <div className="text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  )
}

function SortHeader({
  label,
  field,
  current,
  dir,
  onClick,
}: {
  label: string
  field: SortField
  current: SortField
  dir: SortDir
  onClick: (field: SortField) => void
}) {
  const active = current === field
  return (
    <th
      className="px-4 py-3 text-left font-medium cursor-pointer hover:text-white select-none"
      onClick={() => onClick(field)}
    >
      {label}
      {active && (
        <span className="ml-1">{dir === 'asc' ? '\u2191' : '\u2193'}</span>
      )}
    </th>
  )
}

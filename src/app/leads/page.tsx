'use client'

import { useState, useRef, useEffect } from 'react'

const DEFAULT_HASHTAGS = [
  'restaurantfrankfurt',
  'frankfurtfood',
  'ffmessen',
  'ffmfood',
  'frankfurtrestaurant',
  'cocktailbarfrankfurt',
  'frankfurtcafe',
]

interface Lead {
  username: string
  fullName: string
  caption: string
  likesCount: number
  commentsCount: number
  postUrl: string
  postImageUrl: string
  timestamp: string
  profileUrl: string
}

interface ProfilePost {
  caption: string
  displayUrl: string
  postUrl: string
  likesCount: number
  commentsCount: number
  timestamp: string
}

interface Evaluation {
  score: number
  reason: string
  recommendation: string
}

type RunStatus = 'idle' | 'starting' | 'running' | 'done' | 'error'

const SCORE_COLOR = (s: number) =>
  s >= 7 ? '#22c55e' : s >= 5 ? '#f59e0b' : '#ef4444'

const CARD: React.CSSProperties = {
  background: '#141414',
  border: '1px solid #262626',
  borderRadius: 16,
  overflow: 'hidden',
}

const BTN: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export default function LeadsPage() {
  const [hashtags, setHashtags] = useState<string[]>(DEFAULT_HASHTAGS)
  const [newTag, setNewTag] = useState('')
  const [limit, setLimit] = useState(25)

  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [statusText, setStatusText] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])

  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({})
  const [evaluating, setEvaluating] = useState<Set<string>>(new Set())
  const [contacted, setContacted] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  // Profile deep-dive state
  const [profiles, setProfiles] = useState<Record<string, ProfilePost[]>>({})
  const [profileLoading, setProfileLoading] = useState<Set<string>>(new Set())
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const profilePollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  // Persist state in localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('leads-state')
      if (stored) {
        const s = JSON.parse(stored)
        if (s.evaluations) setEvaluations(s.evaluations)
        if (s.contacted) setContacted(new Set(s.contacted))
        if (s.dismissed) setDismissed(new Set(s.dismissed))
        if (s.profiles) setProfiles(s.profiles)
      }
    } catch {}
  }, [])

  function persist(
    evals: Record<string, Evaluation>,
    cont: Set<string>,
    dism: Set<string>,
    profs: Record<string, ProfilePost[]>
  ) {
    try {
      localStorage.setItem(
        'leads-state',
        JSON.stringify({
          evaluations: evals,
          contacted: [...cont],
          dismissed: [...dism],
          profiles: profs,
        })
      )
    } catch {}
  }

  function addTag() {
    const tag = newTag.trim().replace(/^#/, '')
    if (tag && !hashtags.includes(tag)) setHashtags(prev => [...prev, tag])
    setNewTag('')
  }

  function removeTag(tag: string) {
    setHashtags(prev => prev.filter(t => t !== tag))
  }

  async function startScrape() {
    if (pollRef.current) clearInterval(pollRef.current)
    setRunStatus('starting')
    setStatusText('Starte Apify...')
    setLeads([])

    try {
      const res = await fetch('/api/scrape/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtags, limit }),
      })
      const data = await res.json()

      if (data.error) {
        setRunStatus('error')
        setStatusText(`Fehler beim Start: ${data.error}`)
        return
      }

      setRunStatus('running')
      setStatusText('Scraping läuft... (1–3 Minuten)')

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(
            `/api/scrape/poll?runId=${data.runId}&datasetId=${data.datasetId}`
          )
          const pollData = await pollRes.json()

          if (pollData.status === 'SUCCEEDED') {
            clearInterval(pollRef.current!)
            const newLeads: Lead[] = pollData.leads ?? []
            setLeads(newLeads)
            setRunStatus('done')
            setStatusText(`${newLeads.length} Profile gefunden`)
          } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(pollData.status)) {
            clearInterval(pollRef.current!)
            setRunStatus('error')
            setStatusText(`Scraping fehlgeschlagen (${pollData.status})`)
          }
        } catch {}
      }, 5000)
    } catch (err) {
      setRunStatus('error')
      setStatusText(`Netzwerkfehler: ${err}`)
    }
  }

  async function loadProfile(lead: Lead) {
    const { username } = lead
    setProfileLoading(prev => new Set(prev).add(username))
    setExpandedProfile(username)

    try {
      const startRes = await fetch('/api/profile/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const { runId, datasetId, error } = await startRes.json()

      if (error) {
        setProfileLoading(prev => { const n = new Set(prev); n.delete(username); return n })
        return
      }

      profilePollRefs.current[username] = setInterval(async () => {
        try {
          const pollRes = await fetch(
            `/api/profile/poll?runId=${runId}&datasetId=${datasetId}`
          )
          const pollData = await pollRes.json()

          if (pollData.status === 'SUCCEEDED') {
            clearInterval(profilePollRefs.current[username])
            const posts: ProfilePost[] = pollData.posts ?? []
            setProfiles(prev => {
              const next = { ...prev, [username]: posts }
              persist(evaluations, contacted, dismissed, next)
              return next
            })
            setProfileLoading(prev => { const n = new Set(prev); n.delete(username); return n })

            // Re-evaluate with the richer captionSample
            if (pollData.captionSample) {
              evaluateLead(lead, pollData.captionSample)
            }
          } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(pollData.status)) {
            clearInterval(profilePollRefs.current[username])
            setProfileLoading(prev => { const n = new Set(prev); n.delete(username); return n })
          }
        } catch {}
      }, 5000)
    } catch {
      setProfileLoading(prev => { const n = new Set(prev); n.delete(username); return n })
    }
  }

  async function evaluateLead(lead: Lead, captionSample?: string) {
    const { username } = lead
    setEvaluating(prev => new Set(prev).add(username))
    try {
      const res = await fetch('/api/evaluate-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, captionSample }),
      })
      const ev: Evaluation = await res.json()
      setEvaluations(prev => {
        const next = { ...prev, [username]: ev }
        persist(next, contacted, dismissed, profiles)
        return next
      })
    } finally {
      setEvaluating(prev => { const n = new Set(prev); n.delete(username); return n })
    }
  }

  async function evaluateAll() {
    const queue = leads.filter(l => !evaluations[l.username] && !dismissed.has(l.username))
    for (const lead of queue) await evaluateLead(lead)
  }

  function markContacted(username: string) {
    setContacted(prev => {
      const next = new Set(prev).add(username)
      persist(evaluations, next, dismissed, profiles)
      return next
    })
  }

  function dismiss(username: string) {
    setDismissed(prev => {
      const next = new Set(prev).add(username)
      persist(evaluations, contacted, next, profiles)
      return next
    })
  }

  function restore(username: string) {
    setDismissed(prev => {
      const next = new Set(prev)
      next.delete(username)
      persist(evaluations, contacted, next, profiles)
      return next
    })
    setContacted(prev => {
      const next = new Set(prev)
      next.delete(username)
      persist(evaluations, contacted, next, profiles)
      return next
    })
  }

  const visible = leads.filter(l => !dismissed.has(l.username))
  const hiddenCount = dismissed.size
  const pendingEval = visible.filter(l => !evaluations[l.username]).length

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fafafa' }}>
      {/* NAV */}
      <nav style={{
        borderBottom: '1px solid #1a1a1a', padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'rgba(10,10,10,0.9)',
        backdropFilter: 'blur(10px)', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{ color: '#555', textDecoration: 'none', fontSize: 13 }}>← Zurück</a>
          <span style={{ color: '#333' }}>|</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>🔍 Lead Research – Frankfurt</span>
        </div>
        <div style={{ fontSize: 12, color: '#555' }}>
          {leads.length > 0 && `${visible.length} sichtbar · ${hiddenCount} ausgeblendet`}
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* SEARCH CONFIG */}
        <div style={{ ...CARD, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>Hashtag-Suche</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {hashtags.map(tag => (
              <span key={tag} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 999, fontSize: 13,
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                color: '#818cf8',
              }}>
                #{tag}
                <button onClick={() => removeTag(tag)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#555', padding: 0, lineHeight: 1, fontSize: 15,
                }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              placeholder="Neuen Hashtag hinzufügen..."
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              style={{
                flex: 1, background: '#0d0d0d', border: '1px solid #262626',
                borderRadius: 8, padding: '8px 12px', color: '#fafafa',
                fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button onClick={addTag} style={{ ...BTN, background: '#262626', color: '#a1a1aa' }}>
              + Hinzufügen
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#a1a1aa' }}>
              Posts pro Hashtag:
              <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{
                background: '#0d0d0d', border: '1px solid #262626',
                borderRadius: 6, padding: '5px 8px', color: '#fafafa',
                fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }}>
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button
              onClick={startScrape}
              disabled={runStatus === 'starting' || runStatus === 'running'}
              style={{
                ...BTN, padding: '9px 20px', fontSize: 14,
                background: runStatus === 'running' || runStatus === 'starting' ? '#1e1e1e' : '#6366f1',
                color: runStatus === 'running' || runStatus === 'starting' ? '#555' : 'white',
              }}
            >
              {runStatus === 'starting' ? '⏳ Starte...' : runStatus === 'running' ? '⏳ Läuft...' : '🔍 Suche starten'}
            </button>
            {runStatus !== 'idle' && (
              <span style={{ fontSize: 13, color: runStatus === 'error' ? '#ef4444' : runStatus === 'done' ? '#22c55e' : '#f59e0b' }}>
                {statusText}
              </span>
            )}
          </div>
        </div>

        {/* RESULTS */}
        {visible.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 14, color: '#a1a1aa' }}>
                {visible.length} Profile · {Object.keys(evaluations).length} bewertet · {Object.keys(profiles).length} tief analysiert
              </span>
              <button
                onClick={evaluateAll}
                disabled={evaluating.size > 0 || pendingEval === 0}
                style={{
                  ...BTN, padding: '8px 18px',
                  background: evaluating.size > 0 || pendingEval === 0 ? '#1a1a1a' : '#6366f1',
                  color: evaluating.size > 0 || pendingEval === 0 ? '#444' : 'white',
                }}
              >
                {evaluating.size > 0 ? `⏳ Bewerte... (${evaluating.size} aktiv)` : `✦ Alle schnell bewerten (${pendingEval})`}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {visible
                .sort((a, b) => (evaluations[b.username]?.score ?? 0) - (evaluations[a.username]?.score ?? 0))
                .map(lead => {
                  const ev = evaluations[lead.username]
                  const isEval = evaluating.has(lead.username)
                  const isContacted = contacted.has(lead.username)
                  const isExpanded = expandedProfile === lead.username
                  const profPosts = profiles[lead.username]
                  const isLoadingProfile = profileLoading.has(lead.username)

                  return (
                    <div key={lead.username} style={{
                      ...CARD,
                      border: `1px solid ${ev
                        ? (ev.score >= 7 ? 'rgba(34,197,94,0.3)' : ev.score >= 5 ? 'rgba(245,158,11,0.25)' : '#262626')
                        : '#262626'}`,
                      opacity: isContacted ? 0.55 : 1,
                      gridColumn: isExpanded && profPosts ? 'span 2' : undefined,
                    }}>
                      {/* Post thumbnail */}
                      {lead.postImageUrl && (
                        <div style={{ height: 150, overflow: 'hidden', position: 'relative' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={lead.postImageUrl} alt={lead.username}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                          {ev && (
                            <div style={{
                              position: 'absolute', top: 8, right: 8,
                              background: 'rgba(0,0,0,0.85)', border: `2px solid ${SCORE_COLOR(ev.score)}`,
                              borderRadius: 8, padding: '3px 9px', fontSize: 14,
                              fontWeight: 800, color: SCORE_COLOR(ev.score),
                            }}>
                              {ev.score}/10
                            </div>
                          )}
                          {profPosts && (
                            <div style={{
                              position: 'absolute', top: 8, left: 8,
                              background: 'rgba(99,102,241,0.9)', borderRadius: 6,
                              padding: '3px 8px', fontSize: 11, fontWeight: 600,
                            }}>
                              📊 Tiefanalyse
                            </div>
                          )}
                          {isContacted && (
                            <div style={{
                              position: 'absolute', bottom: 8, left: 8,
                              background: 'rgba(34,197,94,0.85)', borderRadius: 6,
                              padding: '3px 8px', fontSize: 11, fontWeight: 600,
                            }}>
                              ✓ Kontaktiert
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ padding: '14px 16px 14px' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div>
                            <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer"
                              style={{ fontWeight: 700, fontSize: 15, color: '#fafafa', textDecoration: 'none' }}>
                              @{lead.username}
                            </a>
                            {lead.fullName && (
                              <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{lead.fullName}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#555' }}>
                            <span>❤️ {lead.likesCount}</span>
                            <span>💬 {lead.commentsCount}</span>
                          </div>
                        </div>

                        {/* Caption from hashtag scrape */}
                        <div style={{
                          background: '#0d0d0d', border: '1px solid #1e1e1e',
                          borderRadius: 8, padding: '9px 11px', marginBottom: 10,
                          fontSize: 12, color: lead.caption ? '#a1a1aa' : '#444',
                          lineHeight: 1.6, maxHeight: 72, overflow: 'hidden',
                        }}>
                          {lead.caption
                            ? lead.caption.slice(0, 160) + (lead.caption.length > 160 ? '...' : '')
                            : '(keine Caption)'}
                        </div>

                        {/* Grok evaluation */}
                        {ev && (
                          <div style={{
                            background: `${SCORE_COLOR(ev.score)}12`,
                            border: `1px solid ${SCORE_COLOR(ev.score)}30`,
                            borderRadius: 8, padding: '7px 11px', marginBottom: 10,
                            fontSize: 12, color: '#a1a1aa', lineHeight: 1.5,
                          }}>
                            <span style={{ color: SCORE_COLOR(ev.score), fontWeight: 700, marginRight: 6 }}>
                              {ev.recommendation}
                            </span>
                            {ev.reason}
                            {profPosts && <span style={{ color: '#555', fontSize: 11, marginLeft: 6 }}>(basiert auf {profPosts.length} Posts)</span>}
                          </div>
                        )}

                        {isEval && (
                          <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 10 }}>
                            ⏳ Grok bewertet{profPosts ? ' (mit Tiefanalyse)' : ''}...
                          </div>
                        )}

                        {/* Profile deep-dive posts */}
                        {isExpanded && profPosts && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, color: '#555', marginBottom: 8, fontWeight: 600 }}>
                              Letzte {profPosts.length} Posts:
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 10 }}>
                              {profPosts.map((post, i) => (
                                <a key={i} href={post.postUrl} target="_blank" rel="noopener noreferrer"
                                  style={{ textDecoration: 'none', display: 'block' }}>
                                  <div style={{
                                    height: 80, borderRadius: 6, overflow: 'hidden',
                                    background: '#1a1a1a', position: 'relative',
                                  }}>
                                    {post.displayUrl && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={post.displayUrl} alt={`Post ${i + 1}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                      />
                                    )}
                                    {!post.caption && (
                                      <div style={{
                                        position: 'absolute', bottom: 3, right: 3,
                                        background: 'rgba(239,68,68,0.85)', borderRadius: 4,
                                        padding: '1px 5px', fontSize: 9, fontWeight: 700,
                                      }}>NO TXT</div>
                                    )}
                                  </div>
                                  <div style={{
                                    fontSize: 10, color: '#555', marginTop: 4, lineHeight: 1.4,
                                    overflow: 'hidden', maxHeight: 30,
                                  }}>
                                    {post.caption ? post.caption.slice(0, 50) + '...' : '—'}
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {isExpanded && isLoadingProfile && (
                          <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 10 }}>
                            ⏳ Lade Profil-Posts... (30–90 Sek.)
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {/* Profile deep-dive button */}
                          {!profPosts && !isLoadingProfile && (
                            <button
                              onClick={() => loadProfile(lead)}
                              style={{ ...BTN, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', fontSize: 12 }}
                            >
                              📊 Profil laden
                            </button>
                          )}
                          {profPosts && (
                            <button
                              onClick={() => setExpandedProfile(isExpanded ? null : lead.username)}
                              style={{ ...BTN, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', fontSize: 12 }}
                            >
                              {isExpanded ? '▲ Einklappen' : '📊 Posts ansehen'}
                            </button>
                          )}
                          {isLoadingProfile && !profPosts && (
                            <span style={{ fontSize: 12, color: '#f59e0b', padding: '7px 0' }}>⏳ Lädt...</span>
                          )}

                          {!ev && !isEval && (
                            <button onClick={() => evaluateLead(lead)}
                              style={{ ...BTN, background: '#6366f1', color: 'white', fontSize: 12 }}>
                              ✦ Bewerten
                            </button>
                          )}
                          {lead.postUrl && (
                            <a href={lead.postUrl} target="_blank" rel="noopener noreferrer"
                              style={{ ...BTN, background: '#1a1a1a', color: '#a1a1aa', textDecoration: 'none', fontSize: 12 }}>
                              Post →
                            </a>
                          )}
                          {!isContacted ? (
                            <button onClick={() => markContacted(lead.username)}
                              style={{ ...BTN, background: '#1a1a1a', color: '#22c55e', fontSize: 12 }}>
                              ✓ Kontaktiert
                            </button>
                          ) : (
                            <button onClick={() => restore(lead.username)}
                              style={{ ...BTN, background: '#1a1a1a', color: '#555', fontSize: 12 }}>
                              Zurücksetzen
                            </button>
                          )}
                          <button onClick={() => dismiss(lead.username)}
                            style={{ ...BTN, background: '#1a1a1a', color: '#3f3f46', fontSize: 12 }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>

            {hiddenCount > 0 && (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <span style={{ fontSize: 13, color: '#3f3f46' }}>
                  {hiddenCount} ausgeblendet ·{' '}
                  <button onClick={() => { setDismissed(new Set()); persist(evaluations, contacted, new Set(), profiles) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 13, textDecoration: 'underline' }}>
                    Alle zurücksetzen
                  </button>
                </span>
              </div>
            )}
          </>
        )}

        {runStatus === 'done' && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
            Keine Profile gefunden. Versuche andere Hashtags.
          </div>
        )}

        {runStatus === 'idle' && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <p style={{ color: '#555', fontSize: 14 }}>
              Hashtags konfigurieren und Suche starten,<br />um Restaurants zu finden.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

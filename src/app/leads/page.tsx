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

interface DiscoveredTag {
  tag: string
  count: number
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

const LS_KEY = 'leads-state-v2'

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function saveState(data: object) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch {}
}

export default function LeadsPage() {
  const [hashtags, setHashtags] = useState<string[]>(DEFAULT_HASHTAGS)
  const [newTag, setNewTag] = useState('')
  const [limit, setLimit] = useState(25)

  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [statusText, setStatusText] = useState('')
  const [leads, setLeads] = useState<Lead[]>([])
  const [discoveredHashtags, setDiscoveredHashtags] = useState<DiscoveredTag[]>([])

  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({})
  const [evaluating, setEvaluating] = useState<Set<string>>(new Set())
  const [contacted, setContacted] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const [profiles, setProfiles] = useState<Record<string, ProfilePost[]>>({})
  const [profileLoading, setProfileLoading] = useState<Set<string>>(new Set())
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const profilePollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  // Restore from localStorage on mount
  useEffect(() => {
    const s = loadState()
    if (!s) return
    if (s.leads) setLeads(s.leads)
    if (s.evaluations) setEvaluations(s.evaluations)
    if (s.contacted) setContacted(new Set(s.contacted))
    if (s.dismissed) setDismissed(new Set(s.dismissed))
    if (s.profiles) setProfiles(s.profiles)
    if (s.discoveredHashtags) setDiscoveredHashtags(s.discoveredHashtags)
    if (s.leads?.length > 0) {
      setRunStatus('done')
      setStatusText(`${s.leads.length} Profile (gespeichert)`)
    }
  }, [])

  function persist(updates: {
    leads?: Lead[]
    evaluations?: Record<string, Evaluation>
    contacted?: Set<string>
    dismissed?: Set<string>
    profiles?: Record<string, ProfilePost[]>
    discoveredHashtags?: DiscoveredTag[]
  }) {
    const s = loadState() ?? {}
    saveState({
      ...s,
      ...(updates.leads !== undefined && { leads: updates.leads }),
      ...(updates.evaluations !== undefined && { evaluations: updates.evaluations }),
      ...(updates.contacted !== undefined && { contacted: [...updates.contacted] }),
      ...(updates.dismissed !== undefined && { dismissed: [...updates.dismissed] }),
      ...(updates.profiles !== undefined && { profiles: updates.profiles }),
      ...(updates.discoveredHashtags !== undefined && { discoveredHashtags: updates.discoveredHashtags }),
    })
  }

  function addTag(tag?: string) {
    const t = (tag ?? newTag).trim().replace(/^#/, '')
    if (t && !hashtags.includes(t)) setHashtags(prev => [...prev, t])
    if (!tag) setNewTag('')
  }

  function removeTag(tag: string) {
    setHashtags(prev => prev.filter(t => t !== tag))
  }

  function resetAllStatus() {
    setContacted(new Set())
    setDismissed(new Set())
    persist({ contacted: new Set(), dismissed: new Set() })
  }

  function clearLeads() {
    setLeads([])
    setDiscoveredHashtags([])
    setEvaluations({})
    setContacted(new Set())
    setDismissed(new Set())
    setProfiles({})
    setRunStatus('idle')
    setStatusText('')
    saveState({})
  }

  async function startScrape() {
    if (pollRef.current) clearInterval(pollRef.current)
    setRunStatus('starting')
    setStatusText('Starte Apify...')
    setLeads([])
    setDiscoveredHashtags([])

    try {
      const res = await fetch('/api/scrape/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtags, limit }),
      })
      const data = await res.json()

      if (data.error) {
        setRunStatus('error')
        setStatusText(`Fehler: ${data.error}`)
        return
      }

      setRunStatus('running')
      setStatusText('Scraping läuft... (1–3 Minuten)')

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/scrape/poll?runId=${data.runId}&datasetId=${data.datasetId}`)
          const pollData = await pollRes.json()

          if (pollData.status === 'SUCCEEDED') {
            clearInterval(pollRef.current!)
            const newLeads: Lead[] = pollData.leads ?? []
            const newTags: DiscoveredTag[] = pollData.discoveredHashtags ?? []
            setLeads(newLeads)
            setDiscoveredHashtags(newTags)
            setRunStatus('done')
            setStatusText(`${newLeads.length} Profile gefunden`)
            persist({ leads: newLeads, discoveredHashtags: newTags })
          } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(pollData.status)) {
            clearInterval(pollRef.current!)
            setRunStatus('error')
            setStatusText(`Fehlgeschlagen (${pollData.status})`)
          }
        } catch {}
      }, 5000)
    } catch (err) {
      setRunStatus('error')
      setStatusText(`Fehler: ${err}`)
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
      if (error) { setProfileLoading(prev => { const n = new Set(prev); n.delete(username); return n }); return }

      profilePollRefs.current[username] = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/profile/poll?runId=${runId}&datasetId=${datasetId}`)
          const pollData = await pollRes.json()

          if (pollData.status === 'SUCCEEDED') {
            clearInterval(profilePollRefs.current[username])
            const posts: ProfilePost[] = pollData.posts ?? []
            setProfiles(prev => {
              const next = { ...prev, [username]: posts }
              persist({ profiles: next })
              return next
            })
            setProfileLoading(prev => { const n = new Set(prev); n.delete(username); return n })
            if (pollData.captionSample) evaluateLead(lead, pollData.captionSample)
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
        persist({ evaluations: next })
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
    setContacted(prev => { const n = new Set(prev).add(username); persist({ contacted: n }); return n })
  }

  function unmarkContacted(username: string) {
    setContacted(prev => { const n = new Set(prev); n.delete(username); persist({ contacted: n }); return n })
  }

  function dismiss(username: string) {
    setDismissed(prev => { const n = new Set(prev).add(username); persist({ dismissed: n }); return n })
  }

  function restoreDismissed(username: string) {
    setDismissed(prev => { const n = new Set(prev); n.delete(username); persist({ dismissed: n }); return n })
  }

  const visible = leads.filter(l => !dismissed.has(l.username))
  const contactedCount = leads.filter(l => contacted.has(l.username)).length
  const pendingEval = visible.filter(l => !evaluations[l.username]).length

  // Hashtags not already in the search list
  const newDiscoveredTags = discoveredHashtags.filter(d => !hashtags.includes(d.tag))

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fafafa' }}>
      {/* NAV */}
      <nav style={{
        borderBottom: '1px solid #1a1a1a', padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(10px)', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{ color: '#555', textDecoration: 'none', fontSize: 13 }}>← Zurück</a>
          <span style={{ color: '#333' }}>|</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>🔍 Lead Research – Frankfurt</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {leads.length > 0 && (
            <>
              <span style={{ fontSize: 12, color: '#555' }}>
                {visible.length} sichtbar · {contactedCount} kontaktiert · {dismissed.size} ausgeblendet
              </span>
              <button onClick={resetAllStatus} style={{ ...BTN, background: '#1a1a1a', color: '#f59e0b', fontSize: 12 }}>
                ↺ Status reset
              </button>
              <button onClick={clearLeads} style={{ ...BTN, background: '#1a1a1a', color: '#ef4444', fontSize: 12 }}>
                ✕ Alles löschen
              </button>
            </>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* SEARCH CONFIG */}
        <div style={{ ...CARD, padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Hashtag-Suche</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {hashtags.map(tag => (
              <span key={tag} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 999, fontSize: 13,
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8',
              }}>
                #{tag}
                <button onClick={() => removeTag(tag)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, lineHeight: 1, fontSize: 15,
                }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              placeholder="Neuen Hashtag hinzufügen..."
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              style={{
                flex: 1, background: '#0d0d0d', border: '1px solid #262626',
                borderRadius: 8, padding: '8px 12px', color: '#fafafa', fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button onClick={() => addTag()} style={{ ...BTN, background: '#262626', color: '#a1a1aa' }}>
              + Hinzufügen
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#a1a1aa' }}>
              Posts pro Hashtag:
              <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{
                background: '#0d0d0d', border: '1px solid #262626', borderRadius: 6,
                padding: '5px 8px', color: '#fafafa', fontSize: 13, fontFamily: 'inherit', outline: 'none',
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
              {runStatus === 'starting' ? '⏳ Starte...' : runStatus === 'running' ? '⏳ Läuft...' : '🔍 Neue Suche starten'}
            </button>
            {runStatus !== 'idle' && (
              <span style={{ fontSize: 13, color: runStatus === 'error' ? '#ef4444' : runStatus === 'done' ? '#22c55e' : '#f59e0b' }}>
                {statusText}
              </span>
            )}
          </div>
        </div>

        {/* DISCOVERED HASHTAGS */}
        {newDiscoveredTags.length > 0 && (
          <div style={{ ...CARD, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', marginBottom: 12 }}>
              💡 In den Ergebnissen gefundene Hashtags – zum Verfeinern der Suche:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {newDiscoveredTags.map(({ tag, count }) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  style={{
                    ...BTN,
                    padding: '4px 11px',
                    background: '#1a1a1a', border: '1px solid #2a2a2a',
                    color: '#71717a', fontSize: 12,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span>#{tag}</span>
                  <span style={{ color: '#3f3f46', fontSize: 11 }}>{count}×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {visible.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 13, color: '#a1a1aa' }}>
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
                {evaluating.size > 0 ? `⏳ Bewerte... (${evaluating.size})` : `✦ Alle schnell bewerten (${pendingEval})`}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
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
                      opacity: isContacted ? 0.5 : 1,
                    }}>
                      {/* Post thumbnail */}
                      {lead.postImageUrl ? (
                        <div style={{ height: 140, overflow: 'hidden', position: 'relative', background: '#1a1a1a' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={lead.postImageUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { (e.target as HTMLElement).style.display = 'none' }}
                          />
                          {ev && (
                            <div style={{
                              position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.88)',
                              border: `2px solid ${SCORE_COLOR(ev.score)}`, borderRadius: 7,
                              padding: '3px 9px', fontSize: 14, fontWeight: 800, color: SCORE_COLOR(ev.score),
                            }}>
                              {ev.score}/10
                            </div>
                          )}
                          {profPosts && (
                            <div style={{
                              position: 'absolute', top: 8, left: 8,
                              background: 'rgba(99,102,241,0.88)', borderRadius: 5,
                              padding: '2px 7px', fontSize: 10, fontWeight: 600,
                            }}>📊 {profPosts.length} Posts</div>
                          )}
                          {isContacted && (
                            <div style={{
                              position: 'absolute', bottom: 8, left: 8,
                              background: 'rgba(34,197,94,0.88)', borderRadius: 5,
                              padding: '2px 7px', fontSize: 10, fontWeight: 600,
                            }}>✓ Kontaktiert</div>
                          )}
                        </div>
                      ) : (
                        <div style={{ height: 48, background: '#111' }} />
                      )}

                      <div style={{ padding: '13px 14px 13px' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 9 }}>
                          <div>
                            <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer"
                              style={{ fontWeight: 700, fontSize: 14, color: '#fafafa', textDecoration: 'none' }}>
                              @{lead.username}
                            </a>
                            {lead.fullName && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{lead.fullName}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#555' }}>
                            <span>❤️ {lead.likesCount}</span>
                            <span>💬 {lead.commentsCount}</span>
                          </div>
                        </div>

                        {/* Caption */}
                        <div style={{
                          background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 7,
                          padding: '8px 10px', marginBottom: 9, fontSize: 12,
                          color: lead.caption ? '#a1a1aa' : '#3f3f46', lineHeight: 1.6,
                          maxHeight: 68, overflow: 'hidden',
                        }}>
                          {lead.caption ? lead.caption.slice(0, 160) + (lead.caption.length > 160 ? '...' : '') : '(keine Caption)'}
                        </div>

                        {/* Grok evaluation */}
                        {ev && (
                          <div style={{
                            background: `${SCORE_COLOR(ev.score)}10`, border: `1px solid ${SCORE_COLOR(ev.score)}28`,
                            borderRadius: 7, padding: '7px 10px', marginBottom: 9,
                            fontSize: 12, color: '#a1a1aa', lineHeight: 1.5,
                          }}>
                            <span style={{ color: SCORE_COLOR(ev.score), fontWeight: 700, marginRight: 5 }}>{ev.recommendation}</span>
                            {ev.reason}
                            {profPosts && <span style={{ color: '#3f3f46', fontSize: 10, marginLeft: 5 }}>({profPosts.length} Posts)</span>}
                          </div>
                        )}

                        {isEval && <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 9 }}>⏳ Grok bewertet...</div>}
                        {isLoadingProfile && !profPosts && <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 9 }}>⏳ Lade Profil... (30–90 Sek.)</div>}

                        {/* Profile deep-dive post grid */}
                        {isExpanded && profPosts && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, color: '#555', marginBottom: 7, fontWeight: 600 }}>
                              Letzte {profPosts.length} Posts:
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 8 }}>
                              {profPosts.map((post, i) => (
                                <a key={i} href={post.postUrl || '#'} target="_blank" rel="noopener noreferrer"
                                  style={{ textDecoration: 'none' }}>
                                  <div style={{ height: 72, borderRadius: 5, overflow: 'hidden', background: '#1a1a1a', position: 'relative' }}>
                                    {post.displayUrl && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={post.displayUrl} alt=""
                                        referrerPolicy="no-referrer"
                                        crossOrigin="anonymous"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={e => { (e.target as HTMLElement).style.display = 'none' }}
                                      />
                                    )}
                                    {!post.caption && (
                                      <div style={{
                                        position: 'absolute', bottom: 2, right: 2,
                                        background: 'rgba(239,68,68,0.9)', borderRadius: 3,
                                        padding: '1px 4px', fontSize: 8, fontWeight: 700,
                                      }}>KEIN TEXT</div>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 10, color: '#444', marginTop: 3, lineHeight: 1.4, overflow: 'hidden', maxHeight: 28 }}>
                                    {post.caption ? post.caption.slice(0, 45) + '...' : '—'}
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {!profPosts && !isLoadingProfile && (
                            <button onClick={() => loadProfile(lead)}
                              style={{ ...BTN, background: 'rgba(99,102,241,0.14)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.28)', fontSize: 12 }}>
                              📊 Profil laden
                            </button>
                          )}
                          {profPosts && (
                            <button onClick={() => setExpandedProfile(isExpanded ? null : lead.username)}
                              style={{ ...BTN, background: 'rgba(99,102,241,0.14)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.28)', fontSize: 12 }}>
                              {isExpanded ? '▲ Einklappen' : `📊 Posts (${profPosts.length})`}
                            </button>
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
                            <button onClick={() => unmarkContacted(lead.username)}
                              style={{ ...BTN, background: '#1a1a1a', color: '#555', fontSize: 12 }}>
                              ↺ Rückgängig
                            </button>
                          )}
                          <button onClick={() => dismiss(lead.username)}
                            style={{ ...BTN, background: '#1a1a1a', color: '#3f3f46', fontSize: 12 }}>✕</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>

            {dismissed.size > 0 && (
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#3f3f46' }}>
                  {dismissed.size} ausgeblendet ·{' '}
                  <button onClick={() => { setDismissed(new Set()); persist({ dismissed: new Set() }) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 12, textDecoration: 'underline' }}>
                    Alle einblenden
                  </button>
                </span>
              </div>
            )}
          </>
        )}

        {runStatus === 'idle' && leads.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔍</div>
            <p style={{ color: '#555', fontSize: 14 }}>Hashtags konfigurieren und Suche starten.</p>
          </div>
        )}
      </div>
    </div>
  )
}

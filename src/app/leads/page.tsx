'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const DEFAULT_HASHTAGS = [
  'restaurantfrankfurt', 'frankfurtfood', 'ffmessen',
  'ffmfood', 'frankfurtrestaurant', 'cocktailbarfrankfurt', 'frankfurtcafe',
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

interface ProfileInfo {
  biography: string
  externalUrl: string
  followersCount?: number
  followingCount?: number
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

interface DiscoveredTag { tag: string; count: number }
type RunStatus = 'idle' | 'starting' | 'running' | 'done' | 'error'
type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error'

const SCORE_COLOR = (s: number) => s >= 7 ? '#22c55e' : s >= 5 ? '#f59e0b' : '#ef4444'
const CARD: React.CSSProperties = { background: '#141414', border: '1px solid #262626', borderRadius: 16, overflow: 'hidden' }
const BTN: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const LS_KEY = 'leads-state-v3'

function loadLS() { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null } catch { return null } }
function saveLS(data: object) { try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch {} }

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
  const [profileInfos, setProfileInfos] = useState<Record<string, ProfileInfo>>({})
  const [profileLoading, setProfileLoading] = useState<Set<string>>(new Set())
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null)

  // Airtable
  const [airtableIds, setAirtableIds] = useState<Record<string, string>>({})
  const [airtableSync, setAirtableSync] = useState<Record<string, SyncStatus>>({})

  // Notes per lead
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [notesEditing, setNotesEditing] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const profilePollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  useEffect(() => {
    const s = loadLS()
    if (!s) return
    if (s.leads) setLeads(s.leads)
    if (s.evaluations) setEvaluations(s.evaluations)
    if (s.contacted) setContacted(new Set(s.contacted))
    if (s.dismissed) setDismissed(new Set(s.dismissed))
    if (s.profiles) setProfiles(s.profiles)
    if (s.profileInfos) setProfileInfos(s.profileInfos)
    if (s.discoveredHashtags) setDiscoveredHashtags(s.discoveredHashtags)
    if (s.airtableIds) setAirtableIds(s.airtableIds)
    if (s.notes) setNotes(s.notes)
    if (s.leads?.length > 0) { setRunStatus('done'); setStatusText(`${s.leads.length} Profile (gespeichert)`) }
  }, [])

  function persist(updates: Record<string, unknown>) {
    const s = loadLS() ?? {}
    saveLS({ ...s, ...updates })
  }

  // ─── Airtable sync ───────────────────────────────────────────
  const syncToAirtable = useCallback(async (
    lead: Lead,
    extra: Record<string, unknown> = {}
  ) => {
    const { username } = lead
    setAirtableSync(prev => ({ ...prev, [username]: 'syncing' }))
    try {
      const recordId = airtableIds[username]
      const res = await fetch('/api/airtable/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          username: lead.username,
          fullName: lead.fullName,
          profileUrl: lead.profileUrl,
          caption: lead.caption,
          likesCount: lead.likesCount,
          postUrl: lead.postUrl,
          ...extra,
        }),
      })
      const data = await res.json()
      if (data.recordId) {
        setAirtableIds(prev => {
          const next = { ...prev, [username]: data.recordId }
          persist({ airtableIds: next })
          return next
        })
        setAirtableSync(prev => ({ ...prev, [username]: 'synced' }))
      } else {
        setAirtableSync(prev => ({ ...prev, [username]: 'error' }))
      }
    } catch {
      setAirtableSync(prev => ({ ...prev, [username]: 'error' }))
    }
  }, [airtableIds])

  // ─── Hashtag helpers ─────────────────────────────────────────
  function addTag(tag?: string) {
    const t = (tag ?? newTag).trim().replace(/^#/, '')
    if (t && !hashtags.includes(t)) setHashtags(prev => [...prev, t])
    if (!tag) setNewTag('')
  }
  function removeTag(t: string) { setHashtags(prev => prev.filter(x => x !== t)) }

  // ─── Reset helpers ───────────────────────────────────────────
  function resetStatus() {
    setContacted(new Set()); setDismissed(new Set())
    persist({ contacted: [], dismissed: [] })
  }
  function clearAll() {
    setLeads([]); setDiscoveredHashtags([]); setEvaluations({})
    setContacted(new Set()); setDismissed(new Set()); setProfiles({})
    setProfileInfos({}); setAirtableIds({}); setAirtableSync({}); setNotes({})
    setRunStatus('idle'); setStatusText(''); saveLS({})
  }

  // ─── Scrape ──────────────────────────────────────────────────
  async function startScrape() {
    if (pollRef.current) clearInterval(pollRef.current)
    setRunStatus('starting'); setStatusText('Starte Apify...'); setLeads([]); setDiscoveredHashtags([])

    try {
      const res = await fetch('/api/scrape/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashtags, limit }),
      })
      const data = await res.json()
      if (data.error) { setRunStatus('error'); setStatusText(`Fehler: ${data.error}`); return }

      setRunStatus('running'); setStatusText('Scraping läuft... (1–3 Minuten)')

      pollRef.current = setInterval(async () => {
        try {
          const p = await fetch(`/api/scrape/poll?runId=${data.runId}&datasetId=${data.datasetId}`)
          const pd = await p.json()
          if (pd.status === 'SUCCEEDED') {
            clearInterval(pollRef.current!)
            const newLeads: Lead[] = pd.leads ?? []
            const newTags: DiscoveredTag[] = pd.discoveredHashtags ?? []
            setLeads(newLeads); setDiscoveredHashtags(newTags)
            setRunStatus('done'); setStatusText(`${newLeads.length} Profile gefunden`)
            persist({ leads: newLeads, discoveredHashtags: newTags })
            // Auto-push all leads to Airtable
            for (const lead of newLeads) {
              await syncToAirtable(lead, { status: 'Neu' })
              await new Promise(r => setTimeout(r, 300)) // rate limit
            }
          } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(pd.status)) {
            clearInterval(pollRef.current!)
            setRunStatus('error'); setStatusText(`Fehlgeschlagen (${pd.status})`)
          }
        } catch {}
      }, 5000)
    } catch (err) { setRunStatus('error'); setStatusText(`Fehler: ${err}`) }
  }

  // ─── Profile deep-dive ───────────────────────────────────────
  async function loadProfile(lead: Lead) {
    const { username } = lead
    setProfileLoading(prev => new Set(prev).add(username))
    setExpandedProfile(username)
    try {
      const startRes = await fetch('/api/profile/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const { runId, datasetId, error } = await startRes.json()
      if (error) { setProfileLoading(prev => { const n = new Set(prev); n.delete(username); return n }); return }

      profilePollRefs.current[username] = setInterval(async () => {
        try {
          const p = await fetch(`/api/profile/poll?runId=${runId}&datasetId=${datasetId}`)
          const pd = await p.json()
          if (pd.status === 'SUCCEEDED') {
            clearInterval(profilePollRefs.current[username])
            const posts: ProfilePost[] = pd.posts ?? []
            const info: ProfileInfo = pd.profileInfo ?? { biography: '', externalUrl: '' }

            setProfiles(prev => { const n = { ...prev, [username]: posts }; persist({ profiles: n }); return n })
            setProfileInfos(prev => { const n = { ...prev, [username]: info }; persist({ profileInfos: n }); return n })
            setProfileLoading(prev => { const n = new Set(prev); n.delete(username); return n })

            // Re-evaluate with multi-post context
            if (pd.captionSample) evaluateLead(lead, pd.captionSample)

            // Sync profile info to Airtable
            syncToAirtable(lead, {
              bio: info.biography || undefined,
              website: info.externalUrl || undefined,
              followers: info.followersCount,
            })
          } else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(pd.status)) {
            clearInterval(profilePollRefs.current[username])
            setProfileLoading(prev => { const n = new Set(prev); n.delete(username); return n })
          }
        } catch {}
      }, 5000)
    } catch { setProfileLoading(prev => { const n = new Set(prev); n.delete(username); return n }) }
  }

  // ─── Evaluate ────────────────────────────────────────────────
  async function evaluateLead(lead: Lead, captionSample?: string) {
    const { username } = lead
    setEvaluating(prev => new Set(prev).add(username))
    try {
      const res = await fetch('/api/evaluate-lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, captionSample }),
      })
      const ev: Evaluation = await res.json()
      setEvaluations(prev => { const n = { ...prev, [username]: ev }; persist({ evaluations: n }); return n })
      // Sync evaluation to Airtable
      syncToAirtable(lead, { score: ev.score, reason: ev.reason, recommendation: ev.recommendation })
    } finally {
      setEvaluating(prev => { const n = new Set(prev); n.delete(username); return n })
    }
  }

  async function evaluateAll() {
    const queue = leads.filter(l => !evaluations[l.username] && !dismissed.has(l.username))
    for (const lead of queue) await evaluateLead(lead)
  }

  // ─── Status helpers ──────────────────────────────────────────
  function markContacted(lead: Lead) {
    setContacted(prev => { const n = new Set(prev).add(lead.username); persist({ contacted: [...n] }); return n })
    syncToAirtable(lead, { status: 'Kontaktiert' })
  }
  function unmarkContacted(lead: Lead) {
    setContacted(prev => { const n = new Set(prev); n.delete(lead.username); persist({ contacted: [...n] }); return n })
    syncToAirtable(lead, { status: 'Neu' })
  }
  function dismiss(lead: Lead) {
    setDismissed(prev => { const n = new Set(prev).add(lead.username); persist({ dismissed: [...n] }); return n })
    syncToAirtable(lead, { status: 'Nicht interessant' })
  }
  function restoreDismissed(lead: Lead) {
    setDismissed(prev => { const n = new Set(prev); n.delete(lead.username); persist({ dismissed: [...n] }); return n })
    syncToAirtable(lead, { status: 'Neu' })
  }

  // ─── Notes ───────────────────────────────────────────────────
  function saveNote(lead: Lead) {
    const note = notes[lead.username] ?? ''
    persist({ notes })
    syncToAirtable(lead, { notes: note })
    setNotesEditing(null)
  }

  const visible = leads.filter(l => !dismissed.has(l.username))
  const pendingEval = visible.filter(l => !evaluations[l.username]).length
  const newDiscoveredTags = discoveredHashtags.filter(d => !hashtags.includes(d.tag))
  const syncedCount = Object.values(airtableSync).filter(s => s === 'synced').length

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fafafa' }}>
      {/* NAV */}
      <nav style={{
        borderBottom: '1px solid #1a1a1a', padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(10px)', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/" style={{ color: '#555', textDecoration: 'none', fontSize: 13 }}>← Zurück</a>
          <span style={{ color: '#333' }}>|</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>🔍 Lead Research</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {leads.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: '#3f3f46' }}>
                {visible.length} sichtbar · {contacted.size} kontaktiert · {syncedCount}/{leads.length} in Airtable
              </span>
              <a
                href={`https://airtable.com/${process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID ?? 'appeFF8GsXuX5Lia3'}`}
                target="_blank" rel="noopener noreferrer"
                style={{ ...BTN, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', textDecoration: 'none', fontSize: 12 }}
              >
                📋 Airtable öffnen
              </a>
              <button onClick={resetStatus} style={{ ...BTN, background: '#1a1a1a', color: '#f59e0b', fontSize: 12 }}>
                ↺ Status reset
              </button>
              <button onClick={clearAll} style={{ ...BTN, background: '#1a1a1a', color: '#ef4444', fontSize: 12 }}>
                ✕ Alles löschen
              </button>
            </>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

        {/* SEARCH CONFIG */}
        <div style={{ ...CARD, padding: 22, marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Hashtag-Suche</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
            {hashtags.map(tag => (
              <span key={tag} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 11px', borderRadius: 999, fontSize: 12,
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8',
              }}>
                #{tag}
                <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input placeholder="Neuen Hashtag..." value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()}
              style={{ flex: 1, background: '#0d0d0d', border: '1px solid #262626', borderRadius: 8, padding: '7px 11px', color: '#fafafa', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={() => addTag()} style={{ ...BTN, background: '#262626', color: '#a1a1aa', fontSize: 12 }}>+ Add</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#a1a1aa' }}>
              Posts/Tag:
              <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{ background: '#0d0d0d', border: '1px solid #262626', borderRadius: 6, padding: '4px 8px', color: '#fafafa', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button onClick={startScrape} disabled={runStatus === 'starting' || runStatus === 'running'}
              style={{ ...BTN, padding: '8px 18px', fontSize: 14, background: runStatus === 'running' || runStatus === 'starting' ? '#1e1e1e' : '#6366f1', color: runStatus === 'running' || runStatus === 'starting' ? '#555' : 'white' }}>
              {runStatus === 'starting' ? '⏳ Starte...' : runStatus === 'running' ? '⏳ Läuft...' : '🔍 Suche starten'}
            </button>
            {runStatus !== 'idle' && (
              <span style={{ fontSize: 13, color: runStatus === 'error' ? '#ef4444' : runStatus === 'done' ? '#22c55e' : '#f59e0b' }}>{statusText}</span>
            )}
          </div>
        </div>

        {/* DISCOVERED HASHTAGS */}
        {newDiscoveredTags.length > 0 && (
          <div style={{ ...CARD, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 10 }}>
              💡 Häufige Hashtags in den Ergebnissen – zum Verfeinern:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {newDiscoveredTags.map(({ tag, count }) => (
                <button key={tag} onClick={() => addTag(tag)} style={{ ...BTN, padding: '3px 10px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#71717a', fontSize: 11 }}>
                  #{tag} <span style={{ color: '#3f3f46' }}>{count}×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {visible.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#a1a1aa' }}>
                {visible.length} Profile · {Object.keys(evaluations).length} bewertet · {Object.keys(profileInfos).length} tief analysiert
              </span>
              <button onClick={evaluateAll} disabled={evaluating.size > 0 || pendingEval === 0}
                style={{ ...BTN, padding: '7px 16px', background: evaluating.size > 0 || pendingEval === 0 ? '#1a1a1a' : '#6366f1', color: evaluating.size > 0 || pendingEval === 0 ? '#444' : 'white' }}>
                {evaluating.size > 0 ? `⏳ Bewerte... (${evaluating.size})` : `✦ Alle bewerten (${pendingEval})`}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {visible
                .sort((a, b) => (evaluations[b.username]?.score ?? 0) - (evaluations[a.username]?.score ?? 0))
                .map(lead => {
                  const ev = evaluations[lead.username]
                  const isEval = evaluating.has(lead.username)
                  const isContacted = contacted.has(lead.username)
                  const isExpanded = expandedProfile === lead.username
                  const profPosts = profiles[lead.username]
                  const profInfo = profileInfos[lead.username]
                  const isLoadingProfile = profileLoading.has(lead.username)
                  const syncStatus = airtableSync[lead.username]
                  const noteVal = notes[lead.username] ?? ''
                  const isEditingNote = notesEditing === lead.username

                  return (
                    <div key={lead.username} style={{
                      ...CARD,
                      border: `1px solid ${ev ? (ev.score >= 7 ? 'rgba(34,197,94,0.3)' : ev.score >= 5 ? 'rgba(245,158,11,0.25)' : '#262626') : '#262626'}`,
                      opacity: isContacted ? 0.5 : 1,
                    }}>
                      {/* Thumbnail */}
                      {lead.postImageUrl ? (
                        <div style={{ height: 130, overflow: 'hidden', position: 'relative', background: '#1a1a1a' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={lead.postImageUrl} alt="" referrerPolicy="no-referrer" crossOrigin="anonymous"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { (e.target as HTMLElement).style.display = 'none' }} />
                          {ev && (
                            <div style={{ position: 'absolute', top: 7, right: 7, background: 'rgba(0,0,0,0.88)', border: `2px solid ${SCORE_COLOR(ev.score)}`, borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 800, color: SCORE_COLOR(ev.score) }}>
                              {ev.score}/10
                            </div>
                          )}
                          {profPosts && <div style={{ position: 'absolute', top: 7, left: 7, background: 'rgba(99,102,241,0.9)', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>📊 {profPosts.length} Posts</div>}
                          {isContacted && <div style={{ position: 'absolute', bottom: 7, left: 7, background: 'rgba(34,197,94,0.88)', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>✓ Kontaktiert</div>}
                          {/* Airtable sync indicator */}
                          <div style={{ position: 'absolute', bottom: 7, right: 7, fontSize: 10, color: syncStatus === 'synced' ? '#22c55e' : syncStatus === 'syncing' ? '#f59e0b' : syncStatus === 'error' ? '#ef4444' : '#3f3f46' }}>
                            {syncStatus === 'synced' ? '🔗' : syncStatus === 'syncing' ? '⏳' : syncStatus === 'error' ? '⚠' : ''}
                          </div>
                        </div>
                      ) : <div style={{ height: 36, background: '#111' }} />}

                      <div style={{ padding: '12px 14px 12px' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: 14, color: '#fafafa', textDecoration: 'none' }}>
                              @{lead.username}
                            </a>
                            {lead.fullName && <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{lead.fullName}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 7, fontSize: 11, color: '#555' }}>
                            <span>❤️ {lead.likesCount}</span>
                            <span>💬 {lead.commentsCount}</span>
                            {profInfo?.followersCount && <span>👥 {profInfo.followersCount.toLocaleString()}</span>}
                          </div>
                        </div>

                        {/* Profile info: website + bio */}
                        {profInfo && (profInfo.externalUrl || profInfo.biography) && (
                          <div style={{ marginBottom: 8 }}>
                            {profInfo.externalUrl && (
                              <a href={profInfo.externalUrl.startsWith('http') ? profInfo.externalUrl : `https://${profInfo.externalUrl}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#818cf8', textDecoration: 'none', marginBottom: 4, wordBreak: 'break-all' }}>
                                🌐 {profInfo.externalUrl}
                              </a>
                            )}
                            {profInfo.biography && (
                              <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5, overflow: 'hidden', maxHeight: 40 }}>
                                {profInfo.biography.slice(0, 100)}{profInfo.biography.length > 100 ? '...' : ''}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Caption */}
                        <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 7, padding: '7px 10px', marginBottom: 8, fontSize: 11, color: lead.caption ? '#a1a1aa' : '#3f3f46', lineHeight: 1.55, maxHeight: 60, overflow: 'hidden' }}>
                          {lead.caption ? lead.caption.slice(0, 150) + (lead.caption.length > 150 ? '...' : '') : '(keine Caption)'}
                        </div>

                        {/* Evaluation */}
                        {ev && (
                          <div style={{ background: `${SCORE_COLOR(ev.score)}10`, border: `1px solid ${SCORE_COLOR(ev.score)}28`, borderRadius: 7, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#a1a1aa', lineHeight: 1.5 }}>
                            <span style={{ color: SCORE_COLOR(ev.score), fontWeight: 700, marginRight: 5 }}>{ev.recommendation}</span>
                            {ev.reason}
                            {profPosts && <span style={{ color: '#3f3f46', fontSize: 10, marginLeft: 4 }}>({profPosts.length} Posts)</span>}
                          </div>
                        )}

                        {isEval && <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 8 }}>⏳ Grok bewertet...</div>}
                        {isLoadingProfile && !profPosts && <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 8 }}>⏳ Lade Profil... (30–90s)</div>}

                        {/* Profile post grid */}
                        {isExpanded && profPosts && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginBottom: 6 }}>
                              {profPosts.map((post, i) => (
                                <a key={i} href={post.postUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                                  <div style={{ height: 68, borderRadius: 4, overflow: 'hidden', background: '#1a1a1a', position: 'relative' }}>
                                    {post.displayUrl && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={post.displayUrl} alt="" referrerPolicy="no-referrer" crossOrigin="anonymous"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={e => { (e.target as HTMLElement).style.display = 'none' }} />
                                    )}
                                    {!post.caption && <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(239,68,68,0.9)', borderRadius: 3, padding: '1px 4px', fontSize: 8, fontWeight: 700 }}>NO TXT</div>}
                                  </div>
                                  <div style={{ fontSize: 9, color: '#444', marginTop: 2, overflow: 'hidden', maxHeight: 24, lineHeight: 1.4 }}>
                                    {post.caption ? post.caption.slice(0, 40) + '...' : '—'}
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {isEditingNote ? (
                          <div style={{ marginBottom: 8 }}>
                            <textarea
                              value={noteVal}
                              onChange={e => setNotes(prev => ({ ...prev, [lead.username]: e.target.value }))}
                              placeholder="Notiz: z.B. Angefragt am 15.2., keine Antwort..."
                              rows={3}
                              style={{ width: '100%', background: '#0d0d0d', border: '1px solid #262626', borderRadius: 7, padding: '7px 10px', color: '#fafafa', fontSize: 11, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                              <button onClick={() => saveNote(lead)} style={{ ...BTN, background: '#22c55e', color: '#000', fontSize: 11, padding: '5px 12px' }}>💾 Speichern</button>
                              <button onClick={() => setNotesEditing(null)} style={{ ...BTN, background: '#1a1a1a', color: '#555', fontSize: 11, padding: '5px 12px' }}>Abbrechen</button>
                            </div>
                          </div>
                        ) : noteVal ? (
                          <div onClick={() => setNotesEditing(lead.username)} style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#71717a', cursor: 'text', lineHeight: 1.5 }}>
                            📝 {noteVal.slice(0, 80)}{noteVal.length > 80 ? '...' : ''}
                          </div>
                        ) : null}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {!profPosts && !isLoadingProfile && (
                            <button onClick={() => loadProfile(lead)} style={{ ...BTN, background: 'rgba(99,102,241,0.14)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.28)', fontSize: 11 }}>
                              📊 Profil laden
                            </button>
                          )}
                          {profPosts && (
                            <button onClick={() => setExpandedProfile(isExpanded ? null : lead.username)} style={{ ...BTN, background: 'rgba(99,102,241,0.14)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.28)', fontSize: 11 }}>
                              {isExpanded ? '▲' : `📊 ${profPosts.length} Posts`}
                            </button>
                          )}
                          {!ev && !isEval && (
                            <button onClick={() => evaluateLead(lead)} style={{ ...BTN, background: '#6366f1', color: 'white', fontSize: 11 }}>✦ Bewerten</button>
                          )}
                          {lead.postUrl && (
                            <a href={lead.postUrl} target="_blank" rel="noopener noreferrer" style={{ ...BTN, background: '#1a1a1a', color: '#a1a1aa', textDecoration: 'none', fontSize: 11 }}>Post →</a>
                          )}
                          <button onClick={() => setNotesEditing(lead.username)} style={{ ...BTN, background: '#1a1a1a', color: '#71717a', fontSize: 11 }}>📝</button>
                          {!isContacted ? (
                            <button onClick={() => markContacted(lead)} style={{ ...BTN, background: '#1a1a1a', color: '#22c55e', fontSize: 11 }}>✓ Kontaktiert</button>
                          ) : (
                            <button onClick={() => unmarkContacted(lead)} style={{ ...BTN, background: '#1a1a1a', color: '#555', fontSize: 11 }}>↺</button>
                          )}
                          <button onClick={() => dismiss(lead)} style={{ ...BTN, background: '#1a1a1a', color: '#3f3f46', fontSize: 11 }}>✕</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>

            {dismissed.size > 0 && (
              <div style={{ marginTop: 18, textAlign: 'center' }}>
                <span style={{ fontSize: 12, color: '#3f3f46' }}>
                  {dismissed.size} ausgeblendet ·{' '}
                  <button onClick={() => { setDismissed(new Set()); persist({ dismissed: [] }) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 12, textDecoration: 'underline' }}>einblenden</button>
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

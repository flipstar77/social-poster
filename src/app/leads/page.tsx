'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const DEFAULT_HASHTAGS = [
  'restaurantfrankfurt', 'frankfurtfood', 'ffmessen',
  'ffmfood', 'frankfurtrestaurant', 'cocktailbarfrankfurt', 'frankfurtcafe',
]

interface Lead {
  username: string; fullName: string; caption: string
  likesCount: number; commentsCount: number
  postUrl: string; postImageUrl: string; timestamp: string; profileUrl: string
}
interface ProfilePost { caption: string; displayUrl: string; postUrl: string; likesCount: number; commentsCount: number; timestamp: string }
interface ProfileInfo { biography: string; externalUrl: string; followersCount?: number }
interface Evaluation { score: number; reason: string; recommendation: string }
interface DiscoveredTag { tag: string; count: number }

type Phase =
  | 'idle' | 'scraping'
  | 'syncing' | 'evaluating' | 'batch-loading' | 'deep-evaluating'
  | 'done' | 'error'

const SCORE_COLOR = (s: number) => s >= 7 ? '#22c55e' : s >= 5 ? '#f59e0b' : '#ef4444'
const CARD: React.CSSProperties = { background: '#141414', border: '1px solid #262626', borderRadius: 16, overflow: 'hidden' }
const BTN: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const LS_KEY = 'leads-state-v4'

function loadLS() { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null } catch { return null } }
function saveLS(d: object) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)) } catch {} }

export default function LeadsPage() {
  const [hashtags, setHashtags] = useState<string[]>(DEFAULT_HASHTAGS)
  const [newTag, setNewTag] = useState('')
  const [limit, setLimit] = useState(25)
  const [topN, setTopN] = useState(12) // how many top leads to deep-profile

  const [phase, setPhase] = useState<Phase>('idle')
  const [phaseText, setPhaseText] = useState('')
  const [phaseDetail, setPhaseDetail] = useState('')

  const [leads, setLeads] = useState<Lead[]>([])
  const [discoveredHashtags, setDiscoveredHashtags] = useState<DiscoveredTag[]>([])
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({})
  const [evaluating, setEvaluating] = useState<Set<string>>(new Set())
  const [contacted, setContacted] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [profiles, setProfiles] = useState<Record<string, ProfilePost[]>>({})
  const [profileInfos, setProfileInfos] = useState<Record<string, ProfileInfo>>({})
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null)
  const [airtableIds, setAirtableIds] = useState<Record<string, string>>({})
  const [airtableSync, setAirtableSync] = useState<Record<string, 'pending' | 'synced' | 'error'>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [notesEditing, setNotesEditing] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Restore from localStorage
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
    if (s.leads?.length > 0) { setPhase('done'); setPhaseText(`${s.leads.length} Profile (gespeichert)`) }
  }, [])

  function persist(updates: Record<string, unknown>) {
    saveLS({ ...(loadLS() ?? {}), ...updates })
  }

  // ─── Airtable ────────────────────────────────────────────────
  const syncToAirtable = useCallback(async (lead: Lead, extra: Record<string, unknown> = {}) => {
    try {
      const recordId = airtableIds[lead.username]
      const res = await fetch('/api/airtable/upsert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, username: lead.username, fullName: lead.fullName, profileUrl: lead.profileUrl, caption: lead.caption, likesCount: lead.likesCount, postUrl: lead.postUrl, ...extra }),
      })
      const data = await res.json()
      if (data.recordId) {
        setAirtableIds(prev => { const n = { ...prev, [lead.username]: data.recordId }; persist({ airtableIds: n }); return n })
        setAirtableSync(prev => ({ ...prev, [lead.username]: 'synced' }))
      } else {
        setAirtableSync(prev => ({ ...prev, [lead.username]: 'error' }))
      }
    } catch { setAirtableSync(prev => ({ ...prev, [lead.username]: 'error' })) }
  }, [airtableIds])

  // ─── Evaluate (single lead) ──────────────────────────────────
  const evaluateLead = useCallback(async (lead: Lead, captionSample?: string): Promise<Evaluation | null> => {
    setEvaluating(prev => new Set(prev).add(lead.username))
    try {
      const res = await fetch('/api/evaluate-lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lead, captionSample }),
      })
      const ev: Evaluation = await res.json()
      setEvaluations(prev => { const n = { ...prev, [lead.username]: ev }; persist({ evaluations: n }); return n })
      return ev
    } finally {
      setEvaluating(prev => { const n = new Set(prev); n.delete(lead.username); return n })
    }
  }, [])

  // ─── Evaluate batch (concurrent) ─────────────────────────────
  async function evaluateBatch(batch: Lead[], captionSamples?: Record<string, string>, concurrency = 4): Promise<Record<string, Evaluation>> {
    const results: Record<string, Evaluation> = {}
    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency)
      setPhaseDetail(`${Math.min(i + concurrency, batch.length)}/${batch.length}`)
      const evs = await Promise.all(chunk.map(lead => evaluateLead(lead, captionSamples?.[lead.username])))
      chunk.forEach((lead, j) => { if (evs[j]) results[lead.username] = evs[j]! })
    }
    return results
  }

  // ─── Poll helper ─────────────────────────────────────────────
  function pollUntilDone(url: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const iv = setInterval(async () => {
        try {
          const r = await fetch(url)
          const d = await r.json()
          if (d.status === 'SUCCEEDED') { clearInterval(iv); resolve(d) }
          else if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(d.status)) { clearInterval(iv); reject(new Error(d.status)) }
        } catch (e) { clearInterval(iv); reject(e) }
      }, 5000)
      pollRef.current = iv
    })
  }

  // ─── MAIN AUTO FLOW ──────────────────────────────────────────
  async function startAutoFlow() {
    if (pollRef.current) clearInterval(pollRef.current)

    try {
      // ① Hashtag scrape
      setPhase('scraping'); setPhaseText('Suche läuft...'); setPhaseDetail('Instagram scraping (1–3 Min.)')
      setLeads([]); setDiscoveredHashtags([])

      const startRes = await fetch('/api/scrape/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hashtags, limit }) })
      const startData = await startRes.json()
      if (startData.error) throw new Error(startData.error)

      const scrapeResult = await pollUntilDone(`/api/scrape/poll?runId=${startData.runId}&datasetId=${startData.datasetId}`)
      const newLeads: Lead[] = (scrapeResult.leads as Lead[]) ?? []
      const newTags: DiscoveredTag[] = (scrapeResult.discoveredHashtags as DiscoveredTag[]) ?? []

      setLeads(newLeads); setDiscoveredHashtags(newTags)
      persist({ leads: newLeads, discoveredHashtags: newTags })
      setPhaseDetail(`${newLeads.length} Profile gefunden`)

      if (newLeads.length === 0) { setPhase('done'); setPhaseText('Keine Profile gefunden'); return }

      // ② Airtable sync (alle Leads)
      setPhase('syncing'); setPhaseText('Airtable sync...'); setPhaseDetail(`0/${newLeads.length}`)
      for (let i = 0; i < newLeads.length; i++) {
        await syncToAirtable(newLeads[i], { status: 'Neu' })
        setPhaseDetail(`${i + 1}/${newLeads.length}`)
        await new Promise(r => setTimeout(r, 250))
      }

      // ③ Schnell-Bewertung aller Leads (parallel, 4 gleichzeitig)
      setPhase('evaluating'); setPhaseText('Schnellbewertung...')
      const quickEvs = await evaluateBatch(newLeads)

      // Sync evaluations to Airtable
      for (const lead of newLeads) {
        const ev = quickEvs[lead.username]
        if (ev) syncToAirtable(lead, { score: ev.score, reason: ev.reason, recommendation: ev.recommendation })
      }

      // ④ Top-Leads: Batch-Profil-Scrape
      const topLeads = newLeads
        .filter(l => (quickEvs[l.username]?.score ?? 0) >= 6)
        .slice(0, topN)

      if (topLeads.length > 0) {
        setPhase('batch-loading')
        setPhaseText(`Profile laden...`)
        setPhaseDetail(`${topLeads.length} Top-Leads (Score ≥ 6)`)

        const batchStart = await fetch('/api/profile/batch-start', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames: topLeads.map(l => l.username), postsPerProfile: 6 }),
        })
        const batchData = await batchStart.json()

        if (!batchData.error) {
          const batchResult = await pollUntilDone(`/api/profile/batch-poll?runId=${batchData.runId}&datasetId=${batchData.datasetId}`)

          const batchProfiles = batchResult.profiles as Record<string, ProfilePost[]>
          const batchInfos = batchResult.profileInfos as Record<string, ProfileInfo>
          const captionSamples = batchResult.captionSamples as Record<string, string>

          setProfiles(prev => { const n = { ...prev, ...batchProfiles }; persist({ profiles: n }); return n })
          setProfileInfos(prev => { const n = { ...prev, ...batchInfos }; persist({ profileInfos: n }); return n })

          // Sync profile info to Airtable
          for (const lead of topLeads) {
            const info = batchInfos[lead.username]
            if (info) syncToAirtable(lead, { bio: info.biography || undefined, website: info.externalUrl || undefined, followers: info.followersCount })
          }

          // ⑤ Tiefbewertung der Top-Leads mit Multi-Post-Kontext
          setPhase('deep-evaluating'); setPhaseText('Tiefbewertung...')
          const deepEvs = await evaluateBatch(topLeads, captionSamples)
          for (const lead of topLeads) {
            const ev = deepEvs[lead.username]
            if (ev) syncToAirtable(lead, { score: ev.score, reason: ev.reason, recommendation: ev.recommendation })
          }
        }
      }

      const recommended = newLeads.filter(l => {
        const ev = evaluations[l.username] ?? quickEvs[l.username]
        return ev?.score >= 7
      }).length

      setPhase('done')
      setPhaseText(`Fertig: ${newLeads.length} Profile · ${topLeads.length} tief analysiert · ${recommended} empfohlen`)
      setPhaseDetail('')

    } catch (err) {
      setPhase('error')
      setPhaseText(`Fehler: ${err}`)
      setPhaseDetail('')
    }
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
  function addTag(tag?: string) {
    const t = (tag ?? newTag).trim().replace(/^#/, '')
    if (t && !hashtags.includes(t)) setHashtags(prev => [...prev, t])
    if (!tag) setNewTag('')
  }
  function clearAll() {
    setLeads([]); setDiscoveredHashtags([]); setEvaluations({})
    setContacted(new Set()); setDismissed(new Set()); setProfiles({})
    setProfileInfos({}); setAirtableIds({}); setAirtableSync({}); setNotes({})
    setPhase('idle'); setPhaseText(''); setPhaseDetail(''); saveLS({})
  }
  function saveNote(lead: Lead) {
    persist({ notes })
    syncToAirtable(lead, { notes: notes[lead.username] ?? '' })
    setNotesEditing(null)
  }

  const isRunning = ['scraping', 'syncing', 'evaluating', 'batch-loading', 'deep-evaluating'].includes(phase)
  const visible = leads.filter(l => !dismissed.has(l.username))
  const newDiscoveredTags = discoveredHashtags.filter(d => !hashtags.includes(d.tag))
  const syncedCount = Object.values(airtableSync).filter(s => s === 'synced').length

  // Phase progress bar color
  const phaseColor = phase === 'error' ? '#ef4444' : phase === 'done' ? '#22c55e' : '#f59e0b'
  const phaseSteps: Phase[] = ['scraping', 'syncing', 'evaluating', 'batch-loading', 'deep-evaluating']
  const phaseIdx = phaseSteps.indexOf(phase as Phase)
  const progress = isRunning ? Math.round(((phaseIdx + 1) / phaseSteps.length) * 100) : phase === 'done' ? 100 : 0

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fafafa' }}>
      {/* NAV */}
      <nav style={{ borderBottom: '1px solid #1a1a1a', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(10px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/" style={{ color: '#555', textDecoration: 'none', fontSize: 13 }}>← Zurück</a>
          <span style={{ color: '#333' }}>|</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>🔍 Lead Research</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {leads.length > 0 && <>
            <span style={{ fontSize: 11, color: '#3f3f46' }}>{visible.length} sichtbar · {syncedCount}/{leads.length} in Airtable</span>
            <a href="https://airtable.com/appeFF8GsXuX5Lia3" target="_blank" rel="noopener noreferrer"
              style={{ ...BTN, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', textDecoration: 'none', fontSize: 12 }}>
              📋 Airtable
            </a>
            <button onClick={clearAll} style={{ ...BTN, background: '#1a1a1a', color: '#ef4444', fontSize: 12 }}>✕ Reset</button>
          </>}
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>

        {/* SEARCH CONFIG */}
        <div style={{ ...CARD, padding: 20, marginBottom: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
            {hashtags.map(tag => (
              <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 999, fontSize: 12, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}>
                #{tag}
                <button onClick={() => setHashtags(p => p.filter(t => t !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input placeholder="Hashtag hinzufügen..." value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()}
              style={{ flex: 1, background: '#0d0d0d', border: '1px solid #262626', borderRadius: 8, padding: '7px 11px', color: '#fafafa', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={() => addTag()} style={{ ...BTN, background: '#262626', color: '#a1a1aa', fontSize: 12 }}>+ Add</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#a1a1aa' }}>
              Posts/Tag:
              <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{ background: '#0d0d0d', border: '1px solid #262626', borderRadius: 6, padding: '4px 8px', color: '#fafafa', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#a1a1aa' }}>
              Top-Profile tiefscanen:
              <select value={topN} onChange={e => setTopN(Number(e.target.value))} style={{ background: '#0d0d0d', border: '1px solid #262626', borderRadius: 6, padding: '4px 8px', color: '#fafafa', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button onClick={startAutoFlow} disabled={isRunning}
              style={{ ...BTN, padding: '9px 22px', fontSize: 14, background: isRunning ? '#1e1e1e' : '#6366f1', color: isRunning ? '#555' : 'white' }}>
              {isRunning ? '⏳ Läuft...' : '🚀 Auto-Analyse starten'}
            </button>
          </div>
        </div>

        {/* PROGRESS */}
        {(isRunning || phase === 'done' || phase === 'error') && (
          <div style={{ ...CARD, padding: '14px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: phaseColor }}>{phaseText}</span>
              {phaseDetail && <span style={{ fontSize: 12, color: '#555' }}>{phaseDetail}</span>}
            </div>
            <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: phaseColor, borderRadius: 2, width: `${progress}%`, transition: 'width 0.5s ease' }} />
            </div>
            {isRunning && (
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                {([
                  ['scraping', '🔍 Scrape'],
                  ['syncing', '🔗 Airtable'],
                  ['evaluating', '✦ Schnellbewertung'],
                  ['batch-loading', '📊 Profile'],
                  ['deep-evaluating', '✦ Tiefbewertung'],
                ] as [Phase, string][]).map(([p, label]) => (
                  <span key={p} style={{ fontSize: 11, color: phaseSteps.indexOf(p) < phaseIdx ? '#22c55e' : phaseSteps.indexOf(p) === phaseIdx ? '#f59e0b' : '#3f3f46' }}>
                    {phaseSteps.indexOf(p) < phaseIdx ? '✓' : phaseSteps.indexOf(p) === phaseIdx ? '→' : '·'} {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DISCOVERED HASHTAGS */}
        {newDiscoveredTags.length > 0 && (
          <div style={{ ...CARD, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 8 }}>💡 Entdeckte Hashtags aus den Ergebnissen:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {newDiscoveredTags.slice(0, 20).map(({ tag, count }) => (
                <button key={tag} onClick={() => addTag(tag)} style={{ ...BTN, padding: '3px 9px', background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#71717a', fontSize: 11 }}>
                  #{tag} <span style={{ color: '#3f3f46' }}>{count}×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {visible.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
            {visible
              .sort((a, b) => (evaluations[b.username]?.score ?? 0) - (evaluations[a.username]?.score ?? 0))
              .map(lead => {
                const ev = evaluations[lead.username]
                const isContacted = contacted.has(lead.username)
                const isExpanded = expandedProfile === lead.username
                const profPosts = profiles[lead.username]
                const profInfo = profileInfos[lead.username]
                const syncStatus = airtableSync[lead.username]
                const noteVal = notes[lead.username] ?? ''
                const isEditingNote = notesEditing === lead.username

                return (
                  <div key={lead.username} style={{
                    ...CARD,
                    border: `1px solid ${ev ? (ev.score >= 7 ? 'rgba(34,197,94,0.3)' : ev.score >= 5 ? 'rgba(245,158,11,0.2)' : '#262626') : '#262626'}`,
                    opacity: isContacted ? 0.48 : 1,
                  }}>
                    {/* Thumbnail */}
                    <div style={{ height: 120, overflow: 'hidden', position: 'relative', background: '#111' }}>
                      {lead.postImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={lead.postImageUrl} alt="" referrerPolicy="no-referrer" crossOrigin="anonymous"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLElement).style.display = 'none' }} />
                      )}
                      {ev && <div style={{ position: 'absolute', top: 7, right: 7, background: 'rgba(0,0,0,0.88)', border: `2px solid ${SCORE_COLOR(ev.score)}`, borderRadius: 6, padding: '2px 8px', fontSize: 13, fontWeight: 800, color: SCORE_COLOR(ev.score) }}>{ev.score}/10</div>}
                      {profPosts && <div style={{ position: 'absolute', top: 7, left: 7, background: 'rgba(99,102,241,0.9)', borderRadius: 5, padding: '2px 6px', fontSize: 10, fontWeight: 600 }}>📊 {profPosts.length}</div>}
                      {isContacted && <div style={{ position: 'absolute', bottom: 7, left: 7, background: 'rgba(34,197,94,0.88)', borderRadius: 5, padding: '2px 6px', fontSize: 10, fontWeight: 600 }}>✓</div>}
                      <div style={{ position: 'absolute', bottom: 7, right: 7, fontSize: 10 }}>
                        {syncStatus === 'synced' ? <span style={{ color: '#22c55e' }}>🔗</span> : syncStatus === 'error' ? <span style={{ color: '#ef4444' }}>⚠</span> : null}
                      </div>
                    </div>

                    <div style={{ padding: '12px 13px' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 }}>
                        <div>
                          <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: 13, color: '#fafafa', textDecoration: 'none' }}>@{lead.username}</a>
                          {lead.fullName && <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>{lead.fullName}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, fontSize: 10, color: '#555' }}>
                          <span>❤️ {lead.likesCount}</span>
                          {profInfo?.followersCount && <span>👥 {profInfo.followersCount.toLocaleString()}</span>}
                        </div>
                      </div>

                      {/* Website + Bio */}
                      {profInfo && (profInfo.externalUrl || profInfo.biography) && (
                        <div style={{ marginBottom: 7 }}>
                          {profInfo.externalUrl && (
                            <a href={profInfo.externalUrl.startsWith('http') ? profInfo.externalUrl : `https://${profInfo.externalUrl}`}
                              target="_blank" rel="noopener noreferrer"
                              style={{ display: 'block', fontSize: 11, color: '#818cf8', textDecoration: 'none', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🌐 {profInfo.externalUrl}
                            </a>
                          )}
                          {profInfo.biography && (
                            <div style={{ fontSize: 10, color: '#71717a', lineHeight: 1.5, overflow: 'hidden', maxHeight: 34 }}>
                              {profInfo.biography.slice(0, 90)}{profInfo.biography.length > 90 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Caption */}
                      <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 6, padding: '6px 9px', marginBottom: 7, fontSize: 11, color: lead.caption ? '#a1a1aa' : '#3f3f46', lineHeight: 1.55, maxHeight: 52, overflow: 'hidden' }}>
                        {lead.caption ? lead.caption.slice(0, 130) + (lead.caption.length > 130 ? '...' : '') : '(keine Caption)'}
                      </div>

                      {/* Evaluation */}
                      {ev && (
                        <div style={{ background: `${SCORE_COLOR(ev.score)}10`, border: `1px solid ${SCORE_COLOR(ev.score)}25`, borderRadius: 6, padding: '5px 9px', marginBottom: 7, fontSize: 11, color: '#a1a1aa', lineHeight: 1.5 }}>
                          <span style={{ color: SCORE_COLOR(ev.score), fontWeight: 700, marginRight: 4 }}>{ev.recommendation}</span>
                          {ev.reason}
                          {profPosts && <span style={{ color: '#3f3f46', fontSize: 10, marginLeft: 4 }}>({profPosts.length} Posts)</span>}
                        </div>
                      )}

                      {evaluating.has(lead.username) && <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 7 }}>⏳ Bewertet...</div>}

                      {/* Profile grid */}
                      {isExpanded && profPosts && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginBottom: 7 }}>
                          {profPosts.map((post, i) => (
                            <a key={i} href={post.postUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                              <div style={{ height: 60, borderRadius: 4, overflow: 'hidden', background: '#1a1a1a', position: 'relative' }}>
                                {post.displayUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={post.displayUrl} alt="" referrerPolicy="no-referrer" crossOrigin="anonymous"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={e => { (e.target as HTMLElement).style.display = 'none' }} />
                                )}
                                {!post.caption && <div style={{ position: 'absolute', bottom: 1, right: 1, background: 'rgba(239,68,68,0.9)', borderRadius: 2, padding: '1px 3px', fontSize: 7, fontWeight: 700 }}>NO TXT</div>}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {isEditingNote ? (
                        <div style={{ marginBottom: 7 }}>
                          <textarea value={noteVal} onChange={e => setNotes(p => ({ ...p, [lead.username]: e.target.value }))}
                            placeholder="Notiz: z.B. Angefragt 15.2., keine Antwort..."
                            rows={2} style={{ width: '100%', background: '#0d0d0d', border: '1px solid #262626', borderRadius: 6, padding: '6px 9px', color: '#fafafa', fontSize: 11, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                          <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                            <button onClick={() => saveNote(lead)} style={{ ...BTN, background: '#22c55e', color: '#000', fontSize: 11, padding: '4px 10px' }}>💾</button>
                            <button onClick={() => setNotesEditing(null)} style={{ ...BTN, background: '#1a1a1a', color: '#555', fontSize: 11, padding: '4px 10px' }}>✕</button>
                          </div>
                        </div>
                      ) : noteVal ? (
                        <div onClick={() => setNotesEditing(lead.username)} style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 5, padding: '5px 9px', marginBottom: 7, fontSize: 11, color: '#71717a', cursor: 'text' }}>
                          📝 {noteVal.slice(0, 70)}{noteVal.length > 70 ? '...' : ''}
                        </div>
                      ) : null}

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {profPosts && (
                          <button onClick={() => setExpandedProfile(isExpanded ? null : lead.username)}
                            style={{ ...BTN, background: 'rgba(99,102,241,0.14)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)', fontSize: 11 }}>
                            {isExpanded ? '▲' : `📊 ${profPosts.length}`}
                          </button>
                        )}
                        {lead.postUrl && (
                          <a href={lead.postUrl} target="_blank" rel="noopener noreferrer" style={{ ...BTN, background: '#1a1a1a', color: '#a1a1aa', textDecoration: 'none', fontSize: 11 }}>Post →</a>
                        )}
                        <button onClick={() => setNotesEditing(lead.username)} style={{ ...BTN, background: '#1a1a1a', color: '#71717a', fontSize: 11 }}>📝</button>
                        {!isContacted ? (
                          <button onClick={() => markContacted(lead)} style={{ ...BTN, background: '#1a1a1a', color: '#22c55e', fontSize: 11 }}>✓</button>
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
        )}

        {dismissed.size > 0 && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <span style={{ fontSize: 12, color: '#3f3f46' }}>{dismissed.size} ausgeblendet · <button onClick={() => { setDismissed(new Set()); persist({ dismissed: [] }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 12, textDecoration: 'underline' }}>einblenden</button></span>
          </div>
        )}

        {phase === 'idle' && leads.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🚀</div>
            <p style={{ color: '#555', fontSize: 14, marginBottom: 6 }}>Einmal klicken – alles läuft automatisch.</p>
            <p style={{ color: '#3f3f46', fontSize: 12 }}>Scrape → Bewertung → Profil-Analyse → Airtable-Sync</p>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

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
interface ContactInfo { emails: string[]; phones: string[] }

type Phase =
  | 'idle' | 'scraping'
  | 'syncing' | 'evaluating' | 'batch-loading' | 'website-scraping' | 'deep-evaluating'
  | 'done' | 'error'

const SCORE_COLOR = (s: number) => s >= 7 ? '#22c55e' : s >= 5 ? '#f59e0b' : '#ef4444'
const CARD: React.CSSProperties = { background: '#141414', border: '1px solid #262626', borderRadius: 16, overflow: 'hidden' }
const BTN: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const LS_KEY = 'leads-state-v5'

function loadLS() { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null } catch { return null } }
function saveLS(d: object) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)) } catch {} }

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#22c55e' : '#555', fontSize: 11, padding: '0 2px' }}>
      {copied ? '✓' : '⎘'}
    </button>
  )
}

export default function LeadsPage() {
  const t = useTranslations('leads')

  const [hashtags, setHashtags] = useState<string[]>(DEFAULT_HASHTAGS)
  const [newTag, setNewTag] = useState('')
  const [limit, setLimit] = useState(25)
  const [topN, setTopN] = useState(50) // safety ceiling for deep-profile batch

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
  const [contactInfo, setContactInfo] = useState<Record<string, ContactInfo>>({})
  const [icebreakers, setIcebreakers] = useState<Record<string, string>>({})
  const [icebreakerLoading, setIcebreakerLoading] = useState<Set<string>>(new Set())
  const [expandedIcebreaker, setExpandedIcebreaker] = useState<string | null>(null)
  const [emailCompose, setEmailCompose] = useState<string | null>(null)
  const [emailSubjects, setEmailSubjects] = useState<Record<string, string>>({})
  const [emailBodies, setEmailBodies] = useState<Record<string, string>>({})
  const [emailSending, setEmailSending] = useState<Set<string>>(new Set())
  const [emailSent, setEmailSent] = useState<Set<string>>(new Set())

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
    if (s.contactInfo) setContactInfo(s.contactInfo)
    if (s.icebreakers) setIcebreakers(s.icebreakers)
    if (s.leads?.length > 0) { setPhase('done'); setPhaseText(t('profilesSaved', { count: s.leads.length })) }
  }, [t])

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
        signal: AbortSignal.timeout(12000),
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
        signal: AbortSignal.timeout(30000),
      })
      const ev: Evaluation = await res.json()
      setEvaluations(prev => { const n = { ...prev, [lead.username]: ev }; persist({ evaluations: n }); return n })
      return ev
    } catch {
      // Fallback so one failed call doesn't break the whole batch
      const fallback: Evaluation = { score: 5, reason: t('evalFailed'), recommendation: t('manualCheck') }
      setEvaluations(prev => { const n = { ...prev, [lead.username]: fallback }; persist({ evaluations: n }); return n })
      return fallback
    } finally {
      setEvaluating(prev => { const n = new Set(prev); n.delete(lead.username); return n })
    }
  }, [t])

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

  // ─── Send Email ──────────────────────────────────────────────
  async function sendEmail(lead: Lead, to: string) {
    setEmailSending(prev => new Set(prev).add(lead.username))
    try {
      const subject = emailSubjects[lead.username] || t('defaultSubject')
      const body = emailBodies[lead.username] || ''
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      if (data.error) { alert(`${t('error')}: ${data.error}`); return }
      setEmailSent(prev => new Set(prev).add(lead.username))
      setEmailCompose(null)
      markContacted(lead)
    } finally {
      setEmailSending(prev => { const n = new Set(prev); n.delete(lead.username); return n })
    }
  }

  function openEmailCompose(lead: Lead) {
    const ib = icebreakers[lead.username]
    if (!emailBodies[lead.username]) {
      setEmailBodies(prev => ({ ...prev, [lead.username]: ib || '' }))
    }
    if (!emailSubjects[lead.username]) {
      setEmailSubjects(prev => ({ ...prev, [lead.username]: t('defaultSubject') }))
    }
    setEmailCompose(lead.username)
  }

  // ─── Icebreaker ──────────────────────────────────────────────
  async function generateIcebreaker(lead: Lead) {
    setIcebreakerLoading(prev => new Set(prev).add(lead.username))
    try {
      const profInfo = profileInfos[lead.username]
      const ev = evaluations[lead.username]
      const captionSample = profiles[lead.username]
        ?.map((p, i) => `Post ${i + 1}: "${p.caption.slice(0, 120) || t('noCaption')}"`)
        .join('\n')

      const res = await fetch('/api/generate-icebreaker', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: lead.username,
          fullName: lead.fullName,
          bio: profInfo?.biography,
          captionSample,
          reason: ev?.reason,
          score: ev?.score,
          followersCount: profInfo?.followersCount,
        }),
      })
      const data = await res.json()
      if (data.icebreaker) {
        setIcebreakers(prev => { const n = { ...prev, [lead.username]: data.icebreaker }; persist({ icebreakers: n }); return n })
        setExpandedIcebreaker(lead.username)
      }
    } finally {
      setIcebreakerLoading(prev => { const n = new Set(prev); n.delete(lead.username); return n })
    }
  }

  // ─── ENRICH EXISTING AIRTABLE LEADS (Stage 2+3 only) ────────
  async function startEnrichFlow() {
    if (pollRef.current) clearInterval(pollRef.current)
    try {
      setPhase('syncing'); setPhaseText(t('loadingFromAirtable')); setPhaseDetail('')

      const res = await fetch('/api/airtable/fetch-leads')
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Convert Airtable records to Lead format
      const atLeads: Lead[] = (data.records as Record<string, unknown>[]).map(r => ({
        username: String(r['Username'] ?? ''),
        fullName: String(r['Full Name'] ?? ''),
        caption: String(r['Caption'] ?? ''),
        likesCount: Number(r['Likes'] ?? 0),
        commentsCount: 0,
        postUrl: String(r['Post URL'] ?? ''),
        postImageUrl: '',
        timestamp: '',
        profileUrl: String(r['Profile URL'] ?? '') || `https://instagram.com/${r['Username']}`,
      })).filter(l => l.username)

      // Restore airtable IDs from fetched records
      const newIds: Record<string, string> = {}
      for (const r of data.records as Record<string, unknown>[]) {
        const username = String(r['Username'] ?? '')
        const id = String(r['id'] ?? '')
        if (username && id) newIds[username] = id
      }
      setAirtableIds(prev => { const n = { ...prev, ...newIds }; persist({ airtableIds: n }); return n })

      // Restore contact info from Airtable fields
      const restoredContactInfo: Record<string, ContactInfo> = {}
      for (const r of data.records as Record<string, unknown>[]) {
        const username = String(r['Username'] ?? '')
        const email = String(r['Email'] ?? '').trim()
        const phone = String(r['Phone'] ?? '').trim()
        if (username && (email || phone)) {
          restoredContactInfo[username] = { emails: email ? [email] : [], phones: phone ? [phone] : [] }
        }
      }
      if (Object.keys(restoredContactInfo).length > 0) {
        setContactInfo(prev => { const n = { ...prev, ...restoredContactInfo }; persist({ contactInfo: n }); return n })
      }

      if (atLeads.length === 0) { setPhase('done'); setPhaseText(t('noLeadsInAirtable')); return }

      setLeads(atLeads)
      persist({ leads: atLeads })
      setPhaseDetail(t('leadsLoaded', { count: atLeads.length }))

      // Stage 2: batch profile scrape for all leads
      setPhase('batch-loading'); setPhaseText(t('loadingProfiles')); setPhaseDetail(t('leadsCount', { count: atLeads.length }))

      const batchStart = await fetch('/api/profile/batch-start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: atLeads.slice(0, topN).map(l => l.username), postsPerProfile: 6 }),
      })
      const batchData = await batchStart.json()
      if (batchData.error) throw new Error(batchData.error)

      const batchResult = await pollUntilDone(`/api/profile/batch-poll?runId=${batchData.runId}&datasetId=${batchData.datasetId}`)
      const batchProfiles = batchResult.profiles as Record<string, ProfilePost[]>
      const batchInfos = batchResult.profileInfos as Record<string, ProfileInfo>
      const captionSamples = batchResult.captionSamples as Record<string, string>

      setProfiles(prev => { const n = { ...prev, ...batchProfiles }; persist({ profiles: n }); return n })
      setProfileInfos(prev => { const n = { ...prev, ...batchInfos }; persist({ profileInfos: n }); return n })

      // Sync profile info to Airtable
      for (const lead of atLeads) {
        const info = batchInfos[lead.username]
        if (info) {
          const extra: Record<string, unknown> = {}
          if (info.biography) extra.bio = info.biography
          if (info.externalUrl) extra.website = info.externalUrl
          if (info.followersCount !== undefined) extra.followers = info.followersCount
          if (Object.keys(extra).length > 0) syncToAirtable(lead, extra)
        }
      }

      // Stage 3: website scraping (has URL) + Google/DDG search (no URL)
      const leadsWithUrl = atLeads.filter(l => batchInfos[l.username]?.externalUrl)
      const leadsNoUrl = atLeads.filter(l => !batchInfos[l.username]?.externalUrl)
      const stage3Leads = [...leadsWithUrl, ...leadsNoUrl]

      if (stage3Leads.length > 0) {
        setPhase('website-scraping'); setPhaseText(t('searchingContacts')); setPhaseDetail(`0/${stage3Leads.length}`)
        const newContactInfo: Record<string, ContactInfo> = {}
        const chunkSize = 5
        for (let i = 0; i < stage3Leads.length; i += chunkSize) {
          const chunk = stage3Leads.slice(i, i + chunkSize)
          setPhaseDetail(`${Math.min(i + chunkSize, stage3Leads.length)}/${stage3Leads.length}`)
          await Promise.all(chunk.map(async lead => {
            const url = batchInfos[lead.username]?.externalUrl
            try {
              if (url) {
                // Has website URL → scrape directly
                const r = await fetch(`/api/scrape-website?url=${encodeURIComponent(url)}`)
                const d = await r.json()
                if (d.emails?.length || d.phones?.length) newContactInfo[lead.username] = { emails: d.emails ?? [], phones: d.phones ?? [] }
              } else {
                // No website → DuckDuckGo search
                const r = await fetch(`/api/search-contact?username=${encodeURIComponent(lead.username)}&fullName=${encodeURIComponent(lead.fullName)}`)
                const d = await r.json()
                if (d.emails?.length || d.phones?.length) newContactInfo[lead.username] = { emails: d.emails ?? [], phones: d.phones ?? [] }
                // Also store found website URL in profileInfos for display
                if (d.website && !batchInfos[lead.username]) {
                  setProfileInfos(prev => ({ ...prev, [lead.username]: { biography: '', externalUrl: d.website, followersCount: undefined } }))
                  syncToAirtable(lead, { website: d.website })
                }
              }
            } catch { /* ignore per-lead errors */ }
          }))
        }
        setContactInfo(prev => { const n = { ...prev, ...newContactInfo }; persist({ contactInfo: n }); return n })

        // Sync contact info to Airtable
        for (const lead of stage3Leads) {
          const ci = newContactInfo[lead.username]
          if (ci) syncToAirtable(lead, { email: ci.emails[0] ?? undefined, phone: ci.phones[0] ?? undefined })
        }
      }

      // Deep evaluation with multi-post context
      setPhase('deep-evaluating'); setPhaseText(t('deepEvaluation'))
      const deepEvs = await evaluateBatch(atLeads.slice(0, topN), captionSamples)
      for (const lead of atLeads) {
        const ev = deepEvs[lead.username]
        if (ev) syncToAirtable(lead, { score: ev.score, reason: ev.reason, recommendation: ev.recommendation })
      }

      await fetch('/api/airtable/dedup').catch(() => {})

      setPhase('done')
      setPhaseText(t('doneEnriched', { count: atLeads.length }))
      setPhaseDetail('')
    } catch (err) {
      setPhase('error'); setPhaseText(`${t('error')}: ${err}`); setPhaseDetail('')
    }
  }

  // ─── WEBSITE SEARCH ONLY (no Apify) ─────────────────────────
  async function startWebSearchFlow() {
    if (pollRef.current) clearInterval(pollRef.current)
    try {
      setPhase('syncing'); setPhaseText(t('loadingFromAirtable')); setPhaseDetail('')

      const res = await fetch('/api/airtable/fetch-leads')
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const records = data.records as Record<string, unknown>[]

      // Build leads list + restore IDs
      const searchLeads: Lead[] = records.map(r => ({
        username: String(r['Username'] ?? ''),
        fullName: String(r['Full Name'] ?? ''),
        caption: String(r['Caption'] ?? ''),
        likesCount: Number(r['Likes'] ?? 0),
        commentsCount: 0,
        postUrl: String(r['Post URL'] ?? ''),
        postImageUrl: '',
        timestamp: '',
        profileUrl: String(r['Profile URL'] ?? '') || `https://instagram.com/${r['Username']}`,
      })).filter(l => l.username)

      const newIds: Record<string, string> = {}
      for (const r of records) {
        const username = String(r['Username'] ?? '')
        const id = String(r['id'] ?? '')
        if (username && id) newIds[username] = id
      }
      setAirtableIds(prev => { const n = { ...prev, ...newIds }; persist({ airtableIds: n }); return n })

      // Restore website + bio from Airtable into profileInfos so cards show it immediately
      const restoredInfos: Record<string, ProfileInfo> = {}
      for (const r of records) {
        const username = String(r['Username'] ?? '')
        const website = String(r['Website'] ?? '').trim()
        const bio = String(r['Bio'] ?? '').trim()
        const followers = r['Followers'] ? Number(r['Followers']) : undefined
        if (username && (website || bio || followers !== undefined)) {
          restoredInfos[username] = { biography: bio, externalUrl: website, followersCount: followers }
        }
      }
      if (Object.keys(restoredInfos).length > 0) {
        setProfileInfos(prev => { const n = { ...prev, ...restoredInfos }; persist({ profileInfos: n }); return n })
      }

      if (searchLeads.length === 0) { setPhase('done'); setPhaseText(t('noLeadsFound')); return }

      setLeads(searchLeads)
      persist({ leads: searchLeads })

      setPhase('website-scraping')
      setPhaseText(t('googleSearchRunning'))
      setPhaseDetail(`0/${searchLeads.length}`)

      const newContactInfo: Record<string, ContactInfo> = {}
      const chunkSize = 3 // slower = less likely to get rate-limited by DDG
      for (let i = 0; i < searchLeads.length; i += chunkSize) {
        const chunk = searchLeads.slice(i, i + chunkSize)
        setPhaseDetail(`${Math.min(i + chunkSize, searchLeads.length)}/${searchLeads.length}`)

        await Promise.all(chunk.map(async lead => {
          // Check if we already have a website URL from Airtable
          const existingWebsite = String(records.find(r => r['Username'] === lead.username)?.['Website'] ?? '').trim()

          try {
            if (existingWebsite) {
              // Already has website → scrape it for email/phone
              const r = await fetch(`/api/scrape-website?url=${encodeURIComponent(existingWebsite)}`)
              const d = await r.json()
              if (d.emails?.length || d.phones?.length) {
                newContactInfo[lead.username] = { emails: d.emails ?? [], phones: d.phones ?? [] }
                syncToAirtable(lead, { email: d.emails[0], phone: d.phones[0] })
              }
            } else {
              // No website → DDG search to find website + contacts
              const r = await fetch(`/api/search-contact?username=${encodeURIComponent(lead.username)}&fullName=${encodeURIComponent(lead.fullName)}`)
              const d = await r.json()

              let emails: string[] = d.emails ?? []
              let phones: string[] = d.phones ?? []
              const extra: Record<string, unknown> = {}

              // If DDG found a website URL → scrape it for better contact data
              if (d.website) {
                extra.website = d.website
                // Update profileInfos so the card shows the website immediately + persist it
                setProfileInfos(prev => { const n = { ...prev, [lead.username]: { biography: prev[lead.username]?.biography ?? '', externalUrl: d.website, followersCount: prev[lead.username]?.followersCount } }; persist({ profileInfos: n }); return n })
                try {
                  const sr = await fetch(`/api/scrape-website?url=${encodeURIComponent(d.website)}`)
                  const sd = await sr.json()
                  // Merge: prefer scraped results, fall back to DDG results
                  if (sd.emails?.length) emails = sd.emails
                  if (sd.phones?.length) phones = sd.phones
                } catch { /* ignore scrape errors */ }
              }

              if (emails.length || phones.length) {
                newContactInfo[lead.username] = { emails, phones }
                extra.email = emails[0]
                extra.phone = phones[0]
              }
              if (Object.keys(extra).length > 0) syncToAirtable(lead, extra)
            }
          } catch { /* ignore */ }
        }))

        // Small delay between chunks to be nice to DDG
        if (i + chunkSize < searchLeads.length) await new Promise(r => setTimeout(r, 1200))
      }

      setContactInfo(prev => { const n = { ...prev, ...newContactInfo }; persist({ contactInfo: n }); return n })

      const found = Object.keys(newContactInfo).length
      setPhase('done')
      setPhaseText(t('doneContacts', { found, total: searchLeads.length }))
      setPhaseDetail('')
    } catch (err) {
      setPhase('error'); setPhaseText(`${t('error')}: ${err}`); setPhaseDetail('')
    }
  }

  // ─── MAIN AUTO FLOW ──────────────────────────────────────────
  async function startAutoFlow() {
    if (pollRef.current) clearInterval(pollRef.current)

    try {
      // ① Hashtag scrape
      setPhase('scraping'); setPhaseText(t('searchRunning')); setPhaseDetail(t('instagramScraping'))
      setLeads([]); setDiscoveredHashtags([])

      const startRes = await fetch('/api/scrape/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hashtags, limit }) })
      const startData = await startRes.json()
      if (startData.error) throw new Error(startData.error)

      const scrapeResult = await pollUntilDone(`/api/scrape/poll?runId=${startData.runId}&datasetId=${startData.datasetId}`)
      const newLeads: Lead[] = (scrapeResult.leads as Lead[]) ?? []
      const newTags: DiscoveredTag[] = (scrapeResult.discoveredHashtags as DiscoveredTag[]) ?? []

      setLeads(newLeads); setDiscoveredHashtags(newTags)
      persist({ leads: newLeads, discoveredHashtags: newTags })
      setPhaseDetail(t('profilesFound', { count: newLeads.length }))

      if (newLeads.length === 0) { setPhase('done'); setPhaseText(t('noProfilesFound')); return }

      // ② Airtable sync (alle Leads)
      setPhase('syncing'); setPhaseText(t('airtableSync')); setPhaseDetail(`0/${newLeads.length}`)
      for (let i = 0; i < newLeads.length; i++) {
        await syncToAirtable(newLeads[i], { status: 'Neu' })
        setPhaseDetail(`${i + 1}/${newLeads.length}`)
        await new Promise(r => setTimeout(r, 320))
      }

      // ③ Schnell-Bewertung aller Leads (parallel, 4 gleichzeitig)
      setPhase('evaluating'); setPhaseText(t('quickEvaluation'))
      const quickEvs = await evaluateBatch(newLeads)

      // Sync evaluations to Airtable
      for (const lead of newLeads) {
        const ev = quickEvs[lead.username]
        if (ev) syncToAirtable(lead, { score: ev.score, reason: ev.reason, recommendation: ev.recommendation })
      }

      // ④ Stage 2: deep-profile ALL leads marked "Kontaktieren" (+ unscored as fallback), capped at topN
      const toContact = newLeads.filter(l => quickEvs[l.username]?.recommendation === 'Kontaktieren')
      const unscored = newLeads.filter(l => !quickEvs[l.username])
      const topLeads = [...toContact, ...unscored].slice(0, topN)

      if (topLeads.length > 0) {
        setPhase('batch-loading')
        setPhaseText(t('loadingProfiles'))
        setPhaseDetail(t('leadsToContact', { count: topLeads.length }))

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
            if (info) {
              const extra: Record<string, unknown> = {}
              if (info.biography) extra.bio = info.biography
              if (info.externalUrl) extra.website = info.externalUrl
              if (info.followersCount !== undefined) extra.followers = info.followersCount
              if (Object.keys(extra).length > 0) syncToAirtable(lead, extra)
            }
          }

          // ⑤ Kontaktdaten: Website scrape (hat URL) + DDG search (keine URL)
          const stage3WithUrl = topLeads.filter(l => batchInfos[l.username]?.externalUrl)
          const stage3NoUrl = topLeads.filter(l => !batchInfos[l.username]?.externalUrl)
          const stage3All = [...stage3WithUrl, ...stage3NoUrl]

          setPhase('website-scraping')
          setPhaseText(t('searchingContacts'))
          setPhaseDetail(`0/${stage3All.length}`)

          const newContactInfo: Record<string, ContactInfo> = {}
          const concurrency = 5
          for (let i = 0; i < stage3All.length; i += concurrency) {
            const chunk = stage3All.slice(i, i + concurrency)
            setPhaseDetail(`${Math.min(i + concurrency, stage3All.length)}/${stage3All.length}`)
            await Promise.all(chunk.map(async lead => {
              const url = batchInfos[lead.username]?.externalUrl
              try {
                if (url) {
                  const r = await fetch(`/api/scrape-website?url=${encodeURIComponent(url)}`)
                  const d = await r.json()
                  if (d.emails?.length || d.phones?.length) newContactInfo[lead.username] = { emails: d.emails ?? [], phones: d.phones ?? [] }
                } else {
                  const r = await fetch(`/api/search-contact?username=${encodeURIComponent(lead.username)}&fullName=${encodeURIComponent(lead.fullName)}`)
                  const d = await r.json()
                  if (d.emails?.length || d.phones?.length) newContactInfo[lead.username] = { emails: d.emails ?? [], phones: d.phones ?? [] }
                  if (d.website) syncToAirtable(lead, { website: d.website })
                }
              } catch { /* ignore per-lead errors */ }
            }))
          }
          setContactInfo(prev => { const n = { ...prev, ...newContactInfo }; persist({ contactInfo: n }); return n })

          // Sync contact info to Airtable
          for (const lead of stage3All) {
            const ci = newContactInfo[lead.username]
            if (ci) syncToAirtable(lead, { email: ci.emails[0] ?? undefined, phone: ci.phones[0] ?? undefined })
          }

          // ⑥ Tiefbewertung der Top-Leads mit Multi-Post-Kontext
          setPhase('deep-evaluating'); setPhaseText(t('deepEvaluation'))
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

      // Auto-dedup Airtable
      await fetch('/api/airtable/dedup').catch(() => {})

      setPhase('done')
      setPhaseText(t('doneAutoFlow', { total: newLeads.length, deep: topLeads.length, recommended }))
      setPhaseDetail('')

    } catch (err) {
      setPhase('error')
      setPhaseText(`${t('error')}: ${err}`)
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
    const tVal = (tag ?? newTag).trim().replace(/^#/, '')
    if (tVal && !hashtags.includes(tVal)) setHashtags(prev => [...prev, tVal])
    if (!tag) setNewTag('')
  }
  function clearAll() {
    setLeads([]); setDiscoveredHashtags([]); setEvaluations({})
    setContacted(new Set()); setDismissed(new Set()); setProfiles({})
    setProfileInfos({}); setAirtableIds({}); setAirtableSync({}); setNotes({})
    setContactInfo({}); setIcebreakers({}); setExpandedIcebreaker(null)
    setPhase('idle'); setPhaseText(''); setPhaseDetail(''); saveLS({})
  }
  function saveNote(lead: Lead) {
    persist({ notes })
    syncToAirtable(lead, { notes: notes[lead.username] ?? '' })
    setNotesEditing(null)
  }

  const isRunning = ['scraping', 'syncing', 'evaluating', 'batch-loading', 'website-scraping', 'deep-evaluating'].includes(phase)
  const visible = leads.filter(l => !dismissed.has(l.username))
  const newDiscoveredTags = discoveredHashtags.filter(d => !hashtags.includes(d.tag))
  const syncedCount = Object.values(airtableSync).filter(s => s === 'synced').length

  const phaseColor = phase === 'error' ? '#ef4444' : phase === 'done' ? '#22c55e' : '#f59e0b'
  const phaseSteps: Phase[] = ['scraping', 'syncing', 'evaluating', 'batch-loading', 'website-scraping', 'deep-evaluating']
  const phaseIdx = phaseSteps.indexOf(phase as Phase)
  const progress = isRunning ? Math.round(((phaseIdx + 1) / phaseSteps.length) * 100) : phase === 'done' ? 100 : 0

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fafafa' }}>
      {/* NAV */}
      <nav style={{ borderBottom: '1px solid #1a1a1a', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(10px)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/" style={{ color: '#555', textDecoration: 'none', fontSize: 13 }}>{t('back')}</Link>
          <span style={{ color: '#333' }}>|</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t('title')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {leads.length > 0 && <>
            <span style={{ fontSize: 11, color: '#3f3f46' }}>{visible.length} {t('visible')} · {syncedCount}/{leads.length} {t('inAirtable')}</span>
            <a href="https://airtable.com/appeFF8GsXuX5Lia3" target="_blank" rel="noopener noreferrer"
              style={{ ...BTN, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', textDecoration: 'none', fontSize: 12 }}>
              {t('airtableButton')}
            </a>
            <button onClick={clearAll} style={{ ...BTN, background: '#1a1a1a', color: '#ef4444', fontSize: 12 }}>{t('reset')}</button>
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
                <button onClick={() => setHashtags(p => p.filter(tVal => tVal !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input placeholder={t('addHashtag')} value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()}
              style={{ flex: 1, background: '#0d0d0d', border: '1px solid #262626', borderRadius: 8, padding: '7px 11px', color: '#fafafa', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={() => addTag()} style={{ ...BTN, background: '#262626', color: '#a1a1aa', fontSize: 12 }}>{t('add')}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#a1a1aa' }}>
              {t('postsPerDay')}
              <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{ background: '#0d0d0d', border: '1px solid #262626', borderRadius: 6, padding: '4px 8px', color: '#fafafa', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#a1a1aa' }}>
              {t('maxDeepScan')}
              <select value={topN} onChange={e => setTopN(Number(e.target.value))} style={{ background: '#0d0d0d', border: '1px solid #262626', borderRadius: 6, padding: '4px 8px', color: '#fafafa', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                {[20, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button onClick={startAutoFlow} disabled={isRunning}
              style={{ ...BTN, padding: '9px 22px', fontSize: 14, background: isRunning ? '#1e1e1e' : '#6366f1', color: isRunning ? '#555' : 'white' }}>
              {isRunning ? t('running') : t('autoAnalyze')}
            </button>
            <button onClick={startEnrichFlow} disabled={isRunning}
              style={{ ...BTN, padding: '9px 16px', fontSize: 13, background: isRunning ? '#1e1e1e' : '#1a1a2e', color: isRunning ? '#555' : '#818cf8', border: '1px solid rgba(99,102,241,0.35)' }}>
              {isRunning ? '⏳' : t('enrichAirtable')}
            </button>
            <button onClick={startWebSearchFlow} disabled={isRunning}
              style={{ ...BTN, padding: '9px 16px', fontSize: 13, background: isRunning ? '#1e1e1e' : '#0d1f0d', color: isRunning ? '#555' : '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
              {isRunning ? '⏳' : t('searchWebsites')}
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
              <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                {([
                  ['scraping', t('phaseScrape')],
                  ['syncing', t('phaseAirtable')],
                  ['evaluating', t('phaseQuickEval')],
                  ['batch-loading', t('phaseProfiles')],
                  ['website-scraping', t('phaseWebsites')],
                  ['deep-evaluating', t('phaseDeepEval')],
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
            <div style={{ fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 8 }}>{t('discoveredHashtags')}</div>
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
                const contact = contactInfo[lead.username]
                const icebreaker = icebreakers[lead.username]
                const icebreakerExpanded = expandedIcebreaker === lead.username
                const icebreakerIsLoading = icebreakerLoading.has(lead.username)
                const isEmailCompose = emailCompose === lead.username
                const isEmailSending = emailSending.has(lead.username)
                const isEmailSent = emailSent.has(lead.username)
                const emailTarget = contact?.emails?.[0] ?? ''

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
                      {isContacted && <div style={{ position: 'absolute', bottom: 7, left: 7, background: 'rgba(34,197,94,0.88)', borderRadius: 5, padding: '2px 6px', fontSize: 10, fontWeight: 600 }}>✓ {t('contacted')}</div>}
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
                          {profInfo?.followersCount && <span>👥 {profInfo.followersCount.toLocaleString('de')}</span>}
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

                      {/* Contact Info (email / phone) */}
                      {contact && (contact.emails.length > 0 || contact.phones.length > 0) && (
                        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '6px 9px', marginBottom: 7 }}>
                          {contact.emails.map(email => (
                            <div key={email} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#86efac', marginBottom: 2 }}>
                              <span>✉️</span>
                              <a href={`mailto:${email}`} style={{ color: '#86efac', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</a>
                              <CopyBtn text={email} />
                            </div>
                          ))}
                          {contact.phones.map(phone => (
                            <div key={phone} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#86efac' }}>
                              <span>📞</span>
                              <span style={{ flex: 1 }}>{phone}</span>
                              <CopyBtn text={phone} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Caption */}
                      <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 6, padding: '6px 9px', marginBottom: 7, fontSize: 11, color: lead.caption ? '#a1a1aa' : '#3f3f46', lineHeight: 1.55, maxHeight: 52, overflow: 'hidden' }}>
                        {lead.caption ? lead.caption.slice(0, 130) + (lead.caption.length > 130 ? '...' : '') : t('noCaption')}
                      </div>

                      {/* Evaluation */}
                      {ev && (
                        <div style={{ background: `${SCORE_COLOR(ev.score)}10`, border: `1px solid ${SCORE_COLOR(ev.score)}25`, borderRadius: 6, padding: '5px 9px', marginBottom: 7, fontSize: 11, color: '#a1a1aa', lineHeight: 1.5 }}>
                          <span style={{ color: SCORE_COLOR(ev.score), fontWeight: 700, marginRight: 4 }}>{ev.recommendation}</span>
                          {ev.reason}
                          {profPosts && <span style={{ color: '#3f3f46', fontSize: 10, marginLeft: 4 }}>({profPosts.length} Posts)</span>}
                        </div>
                      )}

                      {evaluating.has(lead.username) && <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 7 }}>{t('evaluating')}</div>}

                      {/* Icebreaker */}
                      {icebreaker && icebreakerExpanded && (
                        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 6, padding: '8px 10px', marginBottom: 7 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#818cf8' }}>{t('icebreaker')}</span>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <CopyBtn text={icebreaker} />
                              <button onClick={() => setExpandedIcebreaker(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 11 }}>✕</button>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: '#c4b5fd', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{icebreaker}</div>
                        </div>
                      )}

                      {/* Email Compose */}
                      {isEmailCompose && emailTarget && (
                        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, padding: '9px 10px', marginBottom: 7 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80' }}>{t('emailTo', { target: emailTarget })}</span>
                            <button onClick={() => setEmailCompose(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 11 }}>✕</button>
                          </div>
                          <input
                            value={emailSubjects[lead.username] || ''}
                            onChange={e => setEmailSubjects(p => ({ ...p, [lead.username]: e.target.value }))}
                            placeholder={t('subject')}
                            style={{ width: '100%', background: '#0d0d0d', border: '1px solid #262626', borderRadius: 5, padding: '5px 8px', color: '#fafafa', fontSize: 11, fontFamily: 'inherit', outline: 'none', marginBottom: 5, boxSizing: 'border-box' }}
                          />
                          <textarea
                            value={emailBodies[lead.username] || ''}
                            onChange={e => setEmailBodies(p => ({ ...p, [lead.username]: e.target.value }))}
                            placeholder={t('message')}
                            rows={5}
                            style={{ width: '100%', background: '#0d0d0d', border: '1px solid #262626', borderRadius: 5, padding: '5px 8px', color: '#fafafa', fontSize: 11, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 6 }}
                          />
                          <button
                            onClick={() => sendEmail(lead, emailTarget)}
                            disabled={isEmailSending || !emailBodies[lead.username]}
                            style={{ ...BTN, background: isEmailSending ? '#1a1a1a' : '#16a34a', color: isEmailSending ? '#555' : 'white', fontSize: 11, width: '100%' }}>
                            {isEmailSending ? t('sending') : t('send')}
                          </button>
                        </div>
                      )}

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
                            placeholder={t('notePlaceholder')}
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
                        {/* Icebreaker button */}
                        <button
                          onClick={() => icebreaker ? setExpandedIcebreaker(icebreakerExpanded ? null : lead.username) : generateIcebreaker(lead)}
                          disabled={icebreakerIsLoading}
                          style={{ ...BTN, background: icebreaker ? 'rgba(99,102,241,0.2)' : '#1a1a1a', color: icebreaker ? '#c4b5fd' : '#71717a', border: icebreaker ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent', fontSize: 11 }}>
                          {icebreakerIsLoading ? '⏳' : icebreaker ? (icebreakerExpanded ? '💬▲' : '💬') : '✉️ DM'}
                        </button>
                        {emailTarget && (
                          <button onClick={() => isEmailCompose ? setEmailCompose(null) : openEmailCompose(lead)}
                            style={{ ...BTN, background: isEmailSent ? 'rgba(34,197,94,0.2)' : isEmailCompose ? 'rgba(34,197,94,0.15)' : '#1a1a1a', color: isEmailSent ? '#4ade80' : isEmailCompose ? '#4ade80' : '#71717a', border: isEmailCompose ? '1px solid rgba(34,197,94,0.35)' : '1px solid transparent', fontSize: 11 }}>
                            {isEmailSent ? t('sent') : '📧'}
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
            <span style={{ fontSize: 12, color: '#3f3f46' }}>{dismissed.size} {t('hidden')} · <button onClick={() => { setDismissed(new Set()); persist({ dismissed: [] }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 12, textDecoration: 'underline' }}>{t('show')}</button></span>
          </div>
        )}

        {phase === 'idle' && leads.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🚀</div>
            <p style={{ color: '#555', fontSize: 14, marginBottom: 6 }}>{t('idleTitle')}</p>
            <p style={{ color: '#3f3f46', fontSize: 12 }}>{t('idleSubtitle')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

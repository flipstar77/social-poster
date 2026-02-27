/**
 * Instagram DM Bot — läuft lokal mit Playwright + Supabase
 *
 * Erster Start: Browser öffnet sich, manuell bei Instagram einloggen,
 * dann Script neu starten. Session wird lokal gespeichert.
 *
 * Starten:    npx tsx scripts/send-ig-dms.ts --account 0
 * Dry-run:    npx tsx scripts/send-ig-dms.ts --account 0 --dry-run
 * Follow-ups: npx tsx scripts/send-ig-dms.ts --account 0 --mode followup
 */

import { chromium } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

// ── Load .env.local early ─────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

// ── Supabase ───────────────────────────────────────────────────────────────────
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SB_HDR = { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY, 'Content-Type': 'application/json' }

async function sbGet<T>(table: string, filter = ''): Promise<T[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${table}${filter ? '?' + filter : ''}`, { headers: SB_HDR })
  const d = await r.json()
  if (!Array.isArray(d)) { console.warn('sbGet error:', JSON.stringify(d)); return [] }
  return d
}

async function sbPatch(table: string, filter: string, data: object) {
  await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH', headers: SB_HDR, body: JSON.stringify(data),
  })
}

async function sbInsert(table: string, data: object) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...SB_HDR, Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  })
  if (!r.ok) console.warn(`sbInsert ${table} failed:`, await r.text())
}

async function sbCount(table: string, filter: string): Promise<number> {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${filter}&select=id`, {
    headers: { ...SB_HDR, Prefer: 'count=exact', Range: '0-0' },
  })
  const cr = r.headers.get('content-range') ?? ''
  const m = cr.match(/\/(\d+)$/)
  return m ? Number(m[1]) : 0
}

// ── Grok (xAI) ────────────────────────────────────────────────────────────────
const XAI_KEY = process.env.XAI_API_KEY ?? ''

// ── CLI flags ─────────────────────────────────────────────────────────────────
const DRY_RUN      = process.argv.includes('--dry-run')
const accountArg   = process.argv.indexOf('--account')
const ACCOUNT_IDX  = accountArg !== -1 ? Number(process.argv[accountArg + 1]) : -1
const dmLimitArg   = process.argv.indexOf('--dm-limit')
const DM_LIMIT_ARG = dmLimitArg !== -1 ? Number(process.argv[dmLimitArg + 1]) : null
const modeArg      = process.argv.indexOf('--mode')
const MODE         = modeArg !== -1 ? process.argv[modeArg + 1] : 'dm'

// ── Runtime state (set in main) ────────────────────────────────────────────────
let SESSION_DIR       = path.join(process.cwd(), '.ig-session')
let MAX_PER_RUN       = 20
let ACCOUNT_USERNAME  = ''
let ACCOUNT_PASSWORD  = ''
let PROXY_SERVER: string | null = null
let PROXY_USERNAME: string | null = null
let PROXY_PASSWORD: string | null = null

// ── Constants ─────────────────────────────────────────────────────────────────
const WARMUP_SCHEDULE    = [5, 10, 20, 40]
// Days between contacts: FU1=+2d, FU2=+2d, FU3=+3d, FU4=+3d, FU5=+4d → total day 2,4,7,10,14
const FOLLOWUP_INTERVALS = [2, 2, 3, 3, 4]

// ── Types ─────────────────────────────────────────────────────────────────────
interface AccountRow {
  id: number
  username: string
  ig_password: string | null
  session_dir: string
  proxy_host: string
  proxy_port: number
  proxy_username: string
  proxy_password: string
  enabled: boolean
  dm_limit: number
  warmup_start_date: string | null
  schedule: string | null
}

interface Lead {
  id: string
  username: string
  full_name: string
  bio: string
  caption: string
  score: number | null
  reason: string | null
  recommendation: string
  status: string
  followed_at: string | null
}

interface FollowupRow {
  id: string
  lead_id: string
  account_id: number
  first_contact_date: string
  last_contact_date: string
  followup_count: number
  next_followup_date: string | null
  status: 'pending' | 'replied' | 'done'
  leads?: {
    id: string
    username: string
    full_name: string
    bio: string
    caption: string
  }
}

// ── Human-like helpers ────────────────────────────────────────────────────────
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function sleep(minMs: number, maxMs: number) {
  const ms = rand(minMs, maxMs)
  await new Promise(r => setTimeout(r, ms))
}

async function dismissCookieDialog(page: import('playwright').Page): Promise<boolean> {
  try {
    // Use JS eval for reliable text matching (avoids selector encoding issues)
    const clicked = await page.evaluate(() => {
      const keywords = ['Alle Cookies erlauben', 'Allow all cookies', 'Allow essential and optional cookies',
        'Optionale Cookies ablehnen', 'Decline optional cookies', 'Nur notwendige Cookies']
      const btns = Array.from(document.querySelectorAll('button'))
      const btn = btns.find(b => keywords.some(k => b.textContent?.includes(k)))
      if (btn) { (btn as HTMLElement).click(); return true }
      return false
    })
    if (clicked) {
      console.log('   Cookie-Dialog geschlossen.')
      await sleep(800, 1500)
      return true
    }
  } catch { /* ignore */ }
  return false
}

// ── Database: Leads ───────────────────────────────────────────────────────────
const MIN_SCORE = 5  // Score-Skala ist 0–10 (nicht 0–100)

async function fetchLeadsFromSupabase(): Promise<Lead[]> {
  // Only fetch leads assigned to this account + already followed, sorted by score
  const accountFilter = ACCOUNT_IDX >= 0 ? `&assigned_account_id=eq.${ACCOUNT_IDX}` : ''
  const rows = await sbGet<Lead>('leads', `status=eq.Neu&followed_at=not.is.null${accountFilter}&order=score.desc.nullslast&select=*`)
  return rows.filter(l => l.username)
}

async function markContacted(lead: Lead) {
  const today = new Date().toISOString().slice(0, 10)

  // Update lead status
  await sbPatch('leads', `id=eq.${lead.id}`, {
    status: 'Kontaktiert (IG)',
    ...(ACCOUNT_USERNAME ? { contacted_by: ACCOUNT_USERNAME } : {}),
    contacted_at: today,
  })

  // Add followup entry
  if (!DRY_RUN) await addFollowupEntry(lead)

  // Log DM
  if (!DRY_RUN) await sbInsert('dm_log', {
    lead_id: lead.id,
    account_id: ACCOUNT_IDX >= 0 ? ACCOUNT_IDX : null,
    mode: 'dm',
    followup_num: 0,
    dry_run: false,
  })
}

async function markNoReply(leadId: string) {
  await sbPatch('leads', `id=eq.${leadId}`, { status: 'Kein Reply' })
}

async function checkLeadStatus(leadId: string): Promise<string> {
  const rows = await sbGet<{ status: string }>('leads', `id=eq.${leadId}&select=status`)
  return rows[0]?.status ?? 'Kontaktiert (IG)'
}

// ── Database: Followups ───────────────────────────────────────────────────────
async function addFollowupEntry(lead: Lead) {
  const today = new Date().toISOString().slice(0, 10)
  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + FOLLOWUP_INTERVALS[0])
  await sbInsert('followups', {
    lead_id: lead.id,
    username: lead.username,
    account_id: ACCOUNT_IDX >= 0 ? ACCOUNT_IDX : null,
    first_contact_date: today,
    last_contact_date: today,
    followup_count: 0,
    next_followup_date: nextDate.toISOString().slice(0, 10),
    status: 'pending',
  })
}

async function fetchFollowupsDue(): Promise<FollowupRow[]> {
  const today = new Date().toISOString().slice(0, 10)
  const filters = [
    'status=eq.pending',
    `next_followup_date=lte.${today}`,
    'select=*,leads(id,username,full_name,bio,caption)',
  ]
  if (ACCOUNT_IDX >= 0) filters.push(`account_id=eq.${ACCOUNT_IDX}`)
  return sbGet<FollowupRow>('followups', filters.join('&'))
}

async function markFollowupSent(fu: FollowupRow) {
  if (DRY_RUN) return
  const newCount = fu.followup_count + 1
  const today = new Date().toISOString().slice(0, 10)

  if (newCount >= FOLLOWUP_INTERVALS.length) {
    await sbPatch('followups', `id=eq.${fu.id}`, {
      followup_count: newCount,
      last_contact_date: today,
      next_followup_date: null,
      status: 'done',
    })
    await markNoReply(fu.lead_id)
  } else {
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + FOLLOWUP_INTERVALS[newCount])
    await sbPatch('followups', `id=eq.${fu.id}`, {
      followup_count: newCount,
      last_contact_date: today,
      next_followup_date: nextDate.toISOString().slice(0, 10),
    })
  }

  await sbInsert('dm_log', {
    lead_id: fu.lead_id,
    account_id: fu.account_id,
    mode: 'followup',
    followup_num: newCount,
    dry_run: false,
  })
}

async function markFollowupReplied(followupId: string) {
  await sbPatch('followups', `id=eq.${followupId}`, { status: 'replied' })
}

// ── Message generation ────────────────────────────────────────────────────────
const ICEBREAKER_FALLBACKS = [
  `Macht ihr die Instagram-Posts eigentlich selbst oder habt ihr jemanden dafür?`,
  `Wie viel Zeit steckt ihr pro Woche ins Social-Media-Thema — lohnt sich das für euch?`,
  `Läuft bei euch die Tischreservierung eigentlich über Instagram oder eher über andere Kanäle?`,
  `Bekommt ihr über Instagram eigentlich echte Neukunden oder ist das eher für Stammgäste?`,
]

async function generateIcebreaker(lead: Lead): Promise<string> {
  const name = lead.full_name?.trim() || lead.username

  const prompt = `Schreibe eine Instagram-DM von "Tobi" an "@${lead.username}" (${name}).

Infos über den Account:
- Letzter Post: "${lead.caption?.slice(0, 150) || '(nicht verfügbar)'}"
${lead.reason ? `- Account-Analyse: "${lead.reason.slice(0, 200)}"` : ''}
${lead.bio ? `- Bio: "${lead.bio.slice(0, 100)}"` : ''}

REGELN:
1. GENAU 1-2 Sätze — nicht mehr
2. KEIN Pitch, KEIN Produkt, KEIN Link, KEIN "Hallo", KEIN "Hey"
3. Beziehe dich auf etwas Konkretes aus den Infos oben
4. Ende mit einer kurzen Frage (Ja/Nein oder 1 Wort Antwort möglich)
5. Deutsch, "ihr"-Anrede, locker wie eine echte Nachricht von jemandem der neugierig ist
6. Klingt wie eine echte Person — KEIN Template, KEIN Marketing-Ton

Nur den DM-Text, keine Erklärungen.`

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${XAI_KEY}` },
      body: JSON.stringify({
        model: 'grok-4-1-fast-non-reasoning',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.95, max_tokens: 80,
      }),
    })
    const data = await res.json() as { choices?: { message?: { content?: string } }[] }
    const msg = data.choices?.[0]?.message?.content?.trim()
    return msg ?? ICEBREAKER_FALLBACKS[Math.floor(Math.random() * ICEBREAKER_FALLBACKS.length)]
  } catch {
    return ICEBREAKER_FALLBACKS[Math.floor(Math.random() * ICEBREAKER_FALLBACKS.length)]
  }
}

async function generateFollowupMessage(fu: FollowupRow): Promise<string> {
  const fuNum = fu.followup_count + 1
  const lead  = fu.leads
  const name  = lead?.full_name?.trim() || lead?.username || 'dem Restaurant'

  const FALLBACKS = [
    `Kurze Nachfrage nochmal 🙂 Macht ihr die Posts eigentlich selbst oder habt ihr jemanden dafür?`,
    `Hey, noch eine Frage — wie viel Zeit steckt ihr pro Woche ins Social-Media-Thema?`,
    `Habt ihr eigentlich ein System für eure Posts oder läuft das eher spontan?`,
    `Ok, ich muss kurz ehrlich sein 😄 Ich helfe Restaurants dabei, Instagram-Content zu automatisieren und mehr Gäste zu gewinnen. Würde euch eine kurze 10-Min-Demo interessieren?`,
    `Letzter Versuch! Falls ihr irgendwann Interesse habt, euren Instagram-Workflow zu vereinfachen — einfach melden 🙂 Viel Erfolg weiterhin!`,
  ]

  const stageInstructions = [
    `Follow-up #1 (2 Tage nach erster DM, keine Antwort). Kurze freundliche Erinnerung. Eine Frage ob sie Instagram selbst machen.`,
    `Follow-up #2 (4 Tage). Anderer Winkel: Zeitinvestition. Wie viel Zeit pro Woche?`,
    `Follow-up #3 (7 Tage). Echtes Interesse. Haben sie ein System oder ist es spontan?`,
    `Follow-up #4 (10 Tage). Soft reveal: Erwähne kurz dass du Restaurants bei Instagram-Automatisierung hilfst. Frage ob sie eine Demo wollen.`,
    `Follow-up #5 (14 Tage) — LETZTE Nachricht. Freundliche Verabschiedung, kein Druck.`,
  ]

  try {
    const prompt = `Schreibe eine kurze Instagram-DM von "Tobi" an "${name}".

${stageInstructions[fuNum - 1]}

Bio: "${lead?.bio?.slice(0, 80) || '(keine Bio)'}"

REGELN: Max 2 Sätze, kein "Hallo", kein "Sie", Deutsch, locker.
${fuNum <= 3 ? 'Kein Pitch, kein Produkt.' : ''}
${fuNum === 5 ? 'Nur Abschluss, kein Pitch.' : ''}

Nur DM-Text, keine Erklärungen.`

    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${XAI_KEY}` },
      body: JSON.stringify({
        model: 'grok-4-1-fast-non-reasoning',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9, max_tokens: 120,
      }),
    })
    const data = await res.json() as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content?.trim() ?? FALLBACKS[fuNum - 1]
  } catch {
    return FALLBACKS[fuNum - 1]
  }
}

// ── Instagram DM sending ──────────────────────────────────────────────────────
async function sendInstagramDM(
  page: import('playwright').Page,
  username: string,
  message: string
): Promise<boolean> {
  try {
    console.log(`  → Öffne Profil @${username}`)
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await sleep(1500, 3000)
    await dismissCookieDialog(page)

    const notFound = await page.$('text=Diese Seite ist nicht verfügbar') ?? await page.$('text=Sorry, this page')
    if (notFound) { console.log(`  ✗ Profil nicht gefunden`); return false }

    await page.mouse.move(rand(300, 900), rand(200, 600))
    await sleep(300, 700)
    await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 120)))
    await sleep(400, 800)

    const msgBtn = await page.$('div[role="button"]:has-text("Nachricht senden")')
      ?? await page.$('div[role="button"]:has-text("Message")')
      ?? await page.$('a:has-text("Message")')

    if (!msgBtn) { console.log(`  ✗ Kein Message-Button (privates Profil?)`); return false }

    await msgBtn.click()
    await sleep(2000, 4000)
    await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 })
    await sleep(800, 1500)

    const inputSel = 'div[contenteditable="true"][role="textbox"], div[contenteditable="true"]'
    const input = await page.$(inputSel)
    if (!input) { console.log(`  ✗ Kein Eingabefeld`); return false }

    console.log(`  ✎ Tippe (${message.length} Zeichen)...`)
    await input.click()
    await sleep(500, 1000)

    for (const char of message) {
      await page.keyboard.type(char, { delay: rand(35, 130) })
      if (Math.random() < 0.04) await sleep(200, 600)
      if (Math.random() < 0.01) await sleep(500, 1200)
    }

    await sleep(800, 1500)

    if (DRY_RUN) { console.log(`  🔍 DRY RUN — nicht gesendet`); return true }

    await page.keyboard.press('Enter')
    await sleep(1500, 3000)
    console.log(`  ✓ Gesendet`)
    return true
  } catch (err) {
    console.log(`  ✗ Fehler: ${err}`)
    return false
  }
}

// ── Run modes ─────────────────────────────────────────────────────────────────
async function runDMMode(page: import('playwright').Page): Promise<{ sent: number; failed: number }> {
  console.log('📋 Lade Leads aus Supabase...')
  const allLeads = await fetchLeadsFromSupabase()
  const leads = allLeads.filter(l => l.score === null || l.score >= MIN_SCORE)
  const skippedLow = allLeads.length - leads.length
  if (skippedLow > 0) console.log(`   ⚠️  ${skippedLow} Leads übersprungen (Score < ${MIN_SCORE})`)
  console.log(`   ${leads.length} qualifizierte Leads (gefolgt + Score OK) — Top ${MAX_PER_RUN} werden kontaktiert\n`)

  if (!leads.length) { console.log('Keine qualifizierten Leads. Erst folgen, dann DM.'); return { sent: 0, failed: 0 } }

  let sent = 0; let failed = 0

  for (const lead of leads.slice(0, MAX_PER_RUN)) {
    const scoreLabel = lead.score !== null ? ` · Score ${lead.score}` : ''
    console.log(`[${sent + failed + 1}/${Math.min(leads.length, MAX_PER_RUN)}] @${lead.username}${scoreLabel}`)
    const message = await generateIcebreaker(lead)
    console.log(`  💬 "${message.slice(0, 60)}..."`)

    const ok = await sendInstagramDM(page, lead.username, message)
    if (ok) { sent++; if (!DRY_RUN) await markContacted(lead) }
    else { failed++ }

    if (sent + failed < Math.min(leads.length, MAX_PER_RUN)) {
      const delay = rand(4000, 9000)
      console.log(`  ⏳ Warte ${(delay / 1000).toFixed(1)}s...\n`)
      await sleep(delay, delay)
    }
    if (sent % 5 === 0 && sent > 0) {
      const breakMs = rand(30000, 90000)
      console.log(`\n☕ Pause (${Math.round(breakMs / 1000)}s) nach ${sent} DMs...\n`)
      await sleep(breakMs, breakMs)
    }
  }

  if (leads.length > MAX_PER_RUN)
    console.log(`   ${leads.length - MAX_PER_RUN} weitere Leads warten auf nächsten Run`)

  return { sent, failed }
}

async function runFollowupMode(page: import('playwright').Page): Promise<{ sent: number; failed: number; skipped: number }> {
  const due = await fetchFollowupsDue()
  console.log(`📩 ${due.length} Follow-ups fällig\n`)

  if (!due.length) { console.log('Keine Follow-ups heute. Fertig.'); return { sent: 0, failed: 0, skipped: 0 } }

  let sent = 0; let failed = 0; let skipped = 0

  for (const fu of due.slice(0, MAX_PER_RUN)) {
    const fuNum = fu.followup_count + 1
    const username = fu.leads?.username ?? '?'
    console.log(`[FU${fuNum}/5] @${username}`)

    const currentStatus = await checkLeadStatus(fu.lead_id)
    if (!['Neu', 'Kontaktiert (IG)'].includes(currentStatus)) {
      console.log(`  ✓ Hat geantwortet (${currentStatus}) — übersprungen`)
      await markFollowupReplied(fu.id)
      skipped++
      continue
    }

    const message = await generateFollowupMessage(fu)
    console.log(`  💬 "${message.slice(0, 60)}..."`)

    const ok = await sendInstagramDM(page, username, message)
    if (ok) { sent++; await markFollowupSent(fu) }
    else { failed++ }

    if (sent + failed + skipped < Math.min(due.length, MAX_PER_RUN)) {
      const delay = rand(4000, 9000)
      console.log(`  ⏳ Warte ${(delay / 1000).toFixed(1)}s...\n`)
      await sleep(delay, delay)
    }
    if (sent % 5 === 0 && sent > 0) {
      const breakMs = rand(30000, 90000)
      console.log(`\n☕ Pause (${Math.round(breakMs / 1000)}s)...\n`)
      await sleep(breakMs, breakMs)
    }
  }

  return { sent, failed, skipped }
}

// ── Follow mode ───────────────────────────────────────────────────────────────
async function fetchLeadsToFollow(): Promise<Lead[]> {
  const rows = await sbGet<Lead>('leads', 'status=eq.Neu&followed_at=is.null&select=*')
  return rows.filter(l => l.username)
}

async function markFollowed(leadId: string) {
  const today = new Date().toISOString().slice(0, 10)
  await sbPatch('leads', `id=eq.${leadId}`, { followed_at: today })
}

async function browseHomeFeed(page: import('playwright').Page) {
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await sleep(2000, 4000)
  // Scroll through feed naturally
  const scrolls = rand(2, 5)
  for (let i = 0; i < scrolls; i++) {
    await page.mouse.move(rand(400, 800), rand(300, 600))
    await sleep(300, 800)
    await page.evaluate(() => window.scrollBy(0, Math.floor(Math.random() * 400) + 200))
    await sleep(1500, 4000)
  }
}

async function followInstagramUser(
  page: import('playwright').Page,
  username: string
): Promise<boolean> {
  try {
    console.log(`  → Öffne Profil @${username}`)
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await sleep(2000, 4000)

    const notFound = await page.$('text=Diese Seite ist nicht verfügbar') ?? await page.$('text=Sorry, this page')
    if (notFound) { console.log(`  ✗ Profil nicht gefunden`); return false }

    // Scroll down to look at posts, then back up
    await page.mouse.move(rand(300, 900), rand(300, 500))
    await sleep(500, 1200)
    const scrollDown = rand(150, 350)
    await page.evaluate((px) => window.scrollBy(0, px), scrollDown)
    await sleep(1500, 3500)
    await page.mouse.move(rand(200, 800), rand(200, 500))
    await sleep(400, 900)
    await page.evaluate((px) => window.scrollBy(0, -px), scrollDown)
    await sleep(800, 1800)

    // Check if already following
    const alreadyFollowing = await page.$('button:has-text("Gefolgt")')
      ?? await page.$('button:has-text("Following")')
      ?? await page.$('button:has-text("Abonniert")')
    if (alreadyFollowing) { console.log(`  ✓ Bereits gefolgt`); return true }

    const followBtn = await page.$('button:has-text("Folgen")')
      ?? await page.$('button:has-text("Follow")')
    if (!followBtn) { console.log(`  ✗ Kein Folgen-Button`); return false }

    // Move mouse to button area naturally before clicking
    const box = await followBtn.boundingBox()
    if (box) {
      await page.mouse.move(box.x + rand(5, box.width - 5), box.y + rand(3, box.height - 3), { steps: rand(5, 15) })
      await sleep(400, 900)
    }

    if (DRY_RUN) { console.log(`  🔍 DRY RUN — nicht gefolgt`); return true }

    await followBtn.click()
    await sleep(2000, 4000)
    console.log(`  ✓ Gefolgt`)
    return true
  } catch (err) {
    console.log(`  ✗ Fehler: ${err}`)
    return false
  }
}

async function runFollowMode(page: import('playwright').Page): Promise<{ sent: number; failed: number }> {
  console.log('👥 Lade Leads zum Folgen aus Supabase...')
  const leads = await fetchLeadsToFollow()
  console.log(`   ${leads.length} Leads noch nicht gefolgt\n`)

  if (!leads.length) { console.log('Alle Leads bereits gefolgt. Fertig.'); return { sent: 0, failed: 0 } }

  let sent = 0; let failed = 0

  for (const lead of leads.slice(0, MAX_PER_RUN)) {
    console.log(`[${sent + failed + 1}/${Math.min(leads.length, MAX_PER_RUN)}] @${lead.username}`)
    const ok = await followInstagramUser(page, lead.username)
    if (ok) { sent++; if (!DRY_RUN) await markFollowed(lead.id) }
    else { failed++ }

    if (sent + failed < Math.min(leads.length, MAX_PER_RUN)) {
      // Occasionally browse the home feed between profiles (every 3-5 follows)
      if (sent > 0 && sent % rand(3, 5) === 0) {
        console.log(`  🏠 Kurz den Feed durchscrollen...\n`)
        await browseHomeFeed(page)
      }
      const delay = rand(10000, 25000)
      console.log(`  ⏳ Warte ${(delay / 1000).toFixed(1)}s...\n`)
      await sleep(delay, delay)
    }
    if (sent % 10 === 0 && sent > 0) {
      const breakMs = rand(120000, 180000)
      console.log(`\n☕ Pause (${Math.round(breakMs / 1000)}s) nach ${sent} Follows...\n`)
      await sleep(breakMs, breakMs)
    }
  }

  if (leads.length > MAX_PER_RUN)
    console.log(`   ${leads.length - MAX_PER_RUN} weitere Leads warten auf nächsten Run`)

  return { sent, failed }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!SB_URL || !SB_KEY) {
    console.error('Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.')
    process.exit(1)
  }

  // ── Load account config from Supabase ──────────────────────────────────────
  if (ACCOUNT_IDX >= 0) {
    const rows = await sbGet<AccountRow>('bot_accounts', `id=eq.${ACCOUNT_IDX}`)
    const acc = rows[0]
    if (!acc) { console.error(`Account ${ACCOUNT_IDX} nicht gefunden`); process.exit(1) }
    if (!acc.enabled) { console.error(`Account ${ACCOUNT_IDX} ist deaktiviert`); process.exit(1) }

    SESSION_DIR       = path.join(process.cwd(), acc.session_dir)
    ACCOUNT_USERNAME  = acc.username
    ACCOUNT_PASSWORD  = acc.ig_password ?? ''

    // Warmup: set start date on first real DM or Follow run
    if (!acc.warmup_start_date && !DRY_RUN && (MODE === 'dm' || MODE === 'follow')) {
      const today = new Date().toISOString().slice(0, 10)
      await sbPatch('bot_accounts', `id=eq.${ACCOUNT_IDX}`, { warmup_start_date: today })
      acc.warmup_start_date = today
    }

    if (DM_LIMIT_ARG !== null) {
      MAX_PER_RUN = DM_LIMIT_ARG
    } else if (acc.warmup_start_date) {
      const daysSince = Math.floor((Date.now() - new Date(acc.warmup_start_date).getTime()) / 86_400_000)
      const weekIdx   = Math.min(Math.floor(daysSince / 7), WARMUP_SCHEDULE.length - 1)
      MAX_PER_RUN     = WARMUP_SCHEDULE[weekIdx]
      console.log(`🌱 Warmup Woche ${weekIdx + 1} — Limit: ${MAX_PER_RUN} DMs/Run`)
    } else {
      MAX_PER_RUN = acc.dm_limit
    }

    if (acc.proxy_host) {
      PROXY_SERVER   = `http://${acc.proxy_host}:${acc.proxy_port}`
      PROXY_USERNAME = acc.proxy_username || null
      PROXY_PASSWORD = acc.proxy_password || null
    }
  } else if (DM_LIMIT_ARG !== null) {
    MAX_PER_RUN = DM_LIMIT_ARG
  }

  // Follow mode uses its own default limit (less risky than DMs)
  if (MODE === 'follow' && DM_LIMIT_ARG === null) MAX_PER_RUN = 15

  const modeLabel = MODE === 'followup' ? 'FOLLOW-UP MODUS' : MODE === 'follow' ? 'FOLLOW MODUS' : 'DM MODUS'
  console.log(`\n🤖 Instagram DM Bot — ${modeLabel} ${DRY_RUN ? '(DRY RUN)' : ''}`)
  console.log(`   Account:  ${ACCOUNT_USERNAME || '(kein Account)'}`)
  console.log(`   Session:  ${SESSION_DIR}`)
  console.log(`   Max:      ${MAX_PER_RUN} ${MODE === 'follow' ? 'Follows' : 'Nachrichten'}\n`)

  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    args: [
      '--no-first-run',
      '--hide-crash-restore-bubble',
      '--disable-session-crashed-bubble',
    ],
    ...(PROXY_SERVER ? {
      proxy: {
        server: PROXY_SERVER,
        ...(PROXY_USERNAME ? { username: PROXY_USERNAME, password: PROXY_PASSWORD ?? '' } : {}),
      }
    } : {}),
  })

  const page = await browser.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any)['chrome'] = { runtime: {} }
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
    Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en'] })
  })

  // Navigate to Instagram with retry
  let gotoOk = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      gotoOk = true
      break
    } catch (e) {
      console.log(`⚠️  Instagram laden Versuch ${attempt}/3 fehlgeschlagen — warte 5s...`)
      if (attempt < 3) await sleep(5000, 6000)
    }
  }
  if (!gotoOk) {
    console.log('❌ Instagram nicht erreichbar (Proxy-Problem?). Browser bleibt offen — bitte manuell prüfen.')
    await new Promise(() => {}) // keep browser open indefinitely
  }
  await sleep(2000, 3000)
  console.log(`   Seite geladen: ${page.url()}`)

  // Dismiss cookie dialog unconditionally — appears regardless of login state
  await dismissCookieDialog(page)

  const isLoggedIn = await page.$('a[href="/direct/inbox/"]') !== null
    || await page.$('svg[aria-label="Direktnachrichten"]') !== null
    || await page.$('a[href*="/direct"]') !== null

  if (!isLoggedIn) {
    console.log('⚠️  Nicht eingeloggt — versuche Auto-Login...')

    // If on homepage (not login page), click the Log in button
    if (!page.url().includes('/accounts/login')) {
      try {
        const loginLink = await page.waitForSelector(
          'a[href="/accounts/login/"], a:has-text("Log in"), a:has-text("Anmelden")',
          { timeout: 5000 }
        )
        await loginLink.click()
        console.log('   Zur Login-Seite navigiert.')
        await sleep(1500, 2500)
      } catch { /* already on login page or not found */ }
    }

    // Try auto-login if credentials are available
    let loginField = null
    if (ACCOUNT_USERNAME && ACCOUNT_PASSWORD) {
      try {
        loginField = await page.waitForSelector('input[name="username"]', { timeout: 8000 })
      } catch { /* login form not found */ }
    }
    if (loginField && ACCOUNT_USERNAME && ACCOUNT_PASSWORD) {
      console.log(`   Auto-Login als @${ACCOUNT_USERNAME}...`)
      await loginField.fill('')
      await loginField.type(ACCOUNT_USERNAME, { delay: rand(60, 120) })
      await sleep(400, 800)

      const pwField = await page.$('input[name="password"]')
      if (pwField) {
        await pwField.fill('')
        await pwField.type(ACCOUNT_PASSWORD, { delay: rand(60, 120) })
        await sleep(400, 800)
        await pwField.press('Enter')
        console.log('   Credentials eingegeben — warte auf Login...')
      }
    } else {
      console.log('   Kein Passwort gespeichert — bitte manuell einloggen.')
    }

    // Wait up to 90s for login to complete (handles 2FA too)
    try {
      await page.waitForSelector(
        'a[href="/direct/inbox/"], svg[aria-label="Direktnachrichten"], a[href*="/direct"]',
        { timeout: 90_000 }
      )
      console.log('✓ Eingeloggt\n')
    } catch {
      console.log('⚠️  Login-Timeout — Session möglicherweise nicht gespeichert.')
    }
  } else {
    console.log('✓ Eingeloggt\n')
  }

  // Login-only mode: keep browser open for manual use
  if (MODE === 'login') {
    console.log('✓ Session gespeichert — Browser bleibt offen. Schließe das Fenster wenn du fertig bist.')
    await new Promise<void>(resolve => {
      browser.on('close', () => resolve())
    })
    return
  }

  let result: { sent: number; failed: number; skipped?: number }
  if (MODE === 'followup') {
    result = await runFollowupMode(page)
  } else if (MODE === 'follow') {
    result = await runFollowMode(page)
  } else {
    result = await runDMMode(page)
  }

  const { sent, failed } = result
  const skippedNote = result.skipped ? ` · ${result.skipped} übersprungen (replied)` : ''
  const action = MODE === 'follow' ? 'gefolgt' : 'gesendet'
  console.log(`\n✅ Fertig: ${sent} ${action} · ${failed} fehlgeschlagen${skippedNote}`)

  // Update dm stats on account row
  if (sent > 0 && ACCOUNT_IDX >= 0 && !DRY_RUN) {
    const today = new Date().toISOString().slice(0, 10)
    const totalSent = await sbCount('dm_log', `account_id=eq.${ACCOUNT_IDX}&dry_run=eq.false`)
    const todaySent = await sbCount('dm_log', `account_id=eq.${ACCOUNT_IDX}&dry_run=eq.false&sent_at=gte.${today}T00:00:00Z`)
    await sbPatch('bot_accounts', `id=eq.${ACCOUNT_IDX}`, {
      last_run_date: today,
      dms_sent_total: totalSent,
      dms_sent_today: todaySent,
    })
  }

  await browser.close()
}

main().catch(err => { console.error(err); process.exit(1) })

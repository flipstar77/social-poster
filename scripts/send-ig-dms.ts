/**
 * Instagram DM Bot — läuft lokal mit deiner IP und Browser-Session
 *
 * Erster Start: Browser öffnet sich, manuell bei Instagram einloggen,
 * dann Script neu starten. Session wird lokal gespeichert.
 *
 * Starten: npx tsx scripts/send-ig-dms.ts
 * Dry-run:  npx tsx scripts/send-ig-dms.ts --dry-run
 */

import { chromium } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

// ── Config ────────────────────────────────────────────────────────────────────
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID ?? ''
const AIRTABLE_KEY  = process.env.AIRTABLE_API_KEY ?? ''
const XAI_KEY       = process.env.XAI_API_KEY ?? ''

const SESSION_DIR   = path.join(process.cwd(), '.ig-session')
const MAX_PER_RUN   = 20          // max DMs per session
const DRY_RUN       = process.argv.includes('--dry-run')

// ── Human-like helpers ────────────────────────────────────────────────────────

/** Random int between min and max (inclusive) */
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Wait random ms between min and max */
async function sleep(minMs: number, maxMs: number) {
  const ms = rand(minMs, maxMs)
  await new Promise(r => setTimeout(r, ms))
}

/** Type text character by character with human-like timing */
async function humanType(page: import('playwright').Page, selector: string, text: string) {
  await page.click(selector)
  for (const char of text) {
    await page.keyboard.type(char, { delay: rand(40, 160) })
    // Occasional longer pause (thinking pause)
    if (Math.random() < 0.05) await sleep(300, 800)
  }
}

// ── Airtable ──────────────────────────────────────────────────────────────────

interface AirtableLead {
  id: string
  username: string
  fullName: string
  bio: string
  caption: string
  score: number
  recommendation: string
  status: string
  icebreaker?: string
  followers?: number
}

async function fetchLeadsFromAirtable(): Promise<AirtableLead[]> {
  const fields = ['Username', 'Full Name', 'Bio', 'Caption', 'Score', 'Recommendation', 'Status', 'Icebreaker', 'Followers']
  const leads: AirtableLead[] = []
  let offset: string | undefined

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Leads`)
    fields.forEach(f => url.searchParams.append('fields[]', f))
    url.searchParams.set('pageSize', '100')
    // Only fetch leads that should be contacted and haven't been yet
    url.searchParams.set('filterByFormula', `AND({Recommendation}="Kontaktieren",{Status}="Neu")`)
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_KEY}` },
    })
    const data = await res.json() as { records?: { id: string; fields: Record<string, unknown> }[]; offset?: string; error?: unknown }
    if (data.error) throw new Error(`Airtable: ${JSON.stringify(data.error)}`)

    for (const rec of data.records ?? []) {
      const f = rec.fields
      leads.push({
        id: rec.id,
        username: String(f['Username'] ?? ''),
        fullName: String(f['Full Name'] ?? ''),
        bio: String(f['Bio'] ?? ''),
        caption: String(f['Caption'] ?? ''),
        score: Number(f['Score'] ?? 0),
        recommendation: String(f['Recommendation'] ?? ''),
        status: String(f['Status'] ?? ''),
        icebreaker: f['Icebreaker'] ? String(f['Icebreaker']) : undefined,
        followers: f['Followers'] ? Number(f['Followers']) : undefined,
      })
    }
    offset = data.offset
  } while (offset)

  return leads.filter(l => l.username)
}

async function markContacted(recordId: string, username: string) {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Leads/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${AIRTABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { Status: 'Kontaktiert (IG)' } }),
  })
  const data = await res.json()
  if ((data as { error?: unknown }).error) console.warn(`  ⚠ Airtable update failed for ${username}`)
}

// ── Icebreaker generation ─────────────────────────────────────────────────────

async function generateIcebreaker(lead: AirtableLead): Promise<string> {
  if (lead.icebreaker) return lead.icebreaker

  const prompt = `Du bist Outreach-Spezialist für ein Social-Media-Automatisierungstool für Restaurants.
Schreibe eine kurze, persönliche Instagram-DM an @${lead.username}${lead.fullName ? ` (${lead.fullName})` : ''}.

Bio: "${lead.bio || '(keine Bio)'}"
Letzter Post: "${lead.caption?.slice(0, 120) || '(keine Caption)'}"

Regeln:
- 3-4 Sätze, locker und authentisch
- Erwähne konkret etwas aus Bio oder Caption
- Erkläre kurz: wir helfen Restaurants, mehr Zeit zu sparen durch automatische Social-Media-Captions
- Ende mit einer einfachen Frage
- Kein "Hallo" am Anfang, direkt einsteigen
- Auf Deutsch

Antworte nur mit dem DM-Text, kein JSON, kein Markdown.`

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${XAI_KEY}` },
      body: JSON.stringify({
        model: 'grok-4-1-fast-non-reasoning',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 250,
      }),
    })
    const data = await res.json() as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content?.trim() ?? `Hey, euer Restaurant sieht super aus! Wir helfen Lokalen wie euren, Zeit bei Social Media zu sparen. Klingt das interessant?`
  } catch {
    return `Hey, euer Restaurant sieht super aus! Wir helfen Lokalen wie euren, Zeit bei Social Media zu sparen – automatische Captions, weniger Aufwand. Wäre das was für euch?`
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

    // Check if profile exists
    const notFound = await page.$('text=Diese Seite ist nicht verfügbar') ?? await page.$('text=Sorry, this page')
    if (notFound) { console.log(`  ✗ Profil nicht gefunden`); return false }

    // Click "Message" button
    const msgBtn = await page.$('div[role="button"]:has-text("Nachricht senden")')
      ?? await page.$('div[role="button"]:has-text("Message")')
      ?? await page.$('a:has-text("Message")')

    if (!msgBtn) {
      console.log(`  ✗ Kein Message-Button gefunden (privates Profil?)`)
      return false
    }

    await msgBtn.click()
    await sleep(2000, 4000)

    // Wait for DM thread to open / modal
    await page.waitForSelector('div[contenteditable="true"], textarea[placeholder], div[aria-label*="essage"]', { timeout: 10000 })
    await sleep(800, 1500)

    // Find the message input
    const inputSel = 'div[contenteditable="true"][role="textbox"], div[contenteditable="true"][aria-label], div[contenteditable="true"]'
    const input = await page.$(inputSel)
    if (!input) { console.log(`  ✗ Kein Eingabefeld gefunden`); return false }

    // Type message character by character (human-like)
    console.log(`  ✎ Tippe Nachricht (${message.length} Zeichen)...`)
    await input.click()
    await sleep(500, 1000)

    for (const char of message) {
      await page.keyboard.type(char, { delay: rand(35, 130) })
      if (Math.random() < 0.04) await sleep(200, 600)  // thinking pause
      if (Math.random() < 0.01) await sleep(500, 1200) // longer pause
    }

    await sleep(800, 1500)

    if (DRY_RUN) {
      console.log(`  🔍 DRY RUN — Nachricht NICHT gesendet`)
      return true
    }

    // Send with Enter
    await page.keyboard.press('Enter')
    await sleep(1500, 3000)

    console.log(`  ✓ Gesendet`)
    return true

  } catch (err) {
    console.log(`  ✗ Fehler: ${err}`)
    return false
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!AIRTABLE_BASE || !AIRTABLE_KEY) {
    console.error('Fehler: AIRTABLE_BASE_ID und AIRTABLE_API_KEY müssen gesetzt sein.')
    console.error('Erstelle eine .env.local Datei oder exportiere die Variablen.')
    process.exit(1)
  }

  console.log(`\n🤖 Instagram DM Bot ${DRY_RUN ? '(DRY RUN)' : ''}`)
  console.log(`   Session: ${SESSION_DIR}`)
  console.log(`   Max DMs: ${MAX_PER_RUN}\n`)

  // Fetch leads
  console.log('📋 Lade Leads aus Airtable...')
  const leads = await fetchLeadsFromAirtable()
  console.log(`   ${leads.length} Leads gefunden (Kontaktieren + Neu)\n`)

  if (leads.length === 0) {
    console.log('Keine neuen Leads zum Kontaktieren. Fertig.')
    return
  }

  // Launch browser with persistent session
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  })

  const page = await browser.newPage()

  // Check login status
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 })
  await sleep(2000, 3000)

  const isLoggedIn = await page.$('a[href="/direct/inbox/"]') !== null
    || await page.$('svg[aria-label="Direktnachrichten"]') !== null
    || await page.$('a[href*="/direct"]') !== null

  if (!isLoggedIn) {
    console.log('⚠️  Nicht eingeloggt! Bitte jetzt manuell bei Instagram einloggen.')
    console.log('   Drücke Enter wenn du eingeloggt bist...')
    await new Promise(resolve => process.stdin.once('data', resolve))
  } else {
    console.log('✓ Eingeloggt\n')
  }

  // Process leads
  let sent = 0
  let failed = 0

  for (const lead of leads.slice(0, MAX_PER_RUN)) {
    console.log(`[${sent + failed + 1}/${Math.min(leads.length, MAX_PER_RUN)}] @${lead.username}`)

    // Generate icebreaker
    const message = await generateIcebreaker(lead)
    console.log(`  💬 "${message.slice(0, 60)}..."`)

    // Send DM
    const ok = await sendInstagramDM(page, lead.username, message)

    if (ok) {
      sent++
      if (!DRY_RUN) await markContacted(lead.id, lead.username)
    } else {
      failed++
    }

    // Random delay between leads (4-9 seconds) — more human-like
    if (sent + failed < Math.min(leads.length, MAX_PER_RUN)) {
      const delay = rand(4000, 9000)
      console.log(`  ⏳ Warte ${(delay / 1000).toFixed(1)}s...\n`)
      await sleep(delay, delay)
    }

    // Longer break every 5 DMs (like a human checking their phone)
    if (sent % 5 === 0 && sent > 0) {
      const breakMs = rand(30000, 90000)
      console.log(`\n☕ Kurze Pause (${Math.round(breakMs / 1000)}s) nach ${sent} DMs...\n`)
      await sleep(breakMs, breakMs)
    }
  }

  console.log(`\n✅ Fertig: ${sent} gesendet · ${failed} fehlgeschlagen`)
  if (leads.length > MAX_PER_RUN) {
    console.log(`   ${leads.length - MAX_PER_RUN} weitere Leads warten auf den nächsten Run`)
  }

  await browser.close()
}

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

main().catch(err => { console.error(err); process.exit(1) })

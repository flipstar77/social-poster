/**
 * Bot Dashboard — lokaler HTTP-Server auf Port 3001
 * Starten: npm run bot-server
 * Öffnen:  http://localhost:3001
 */

import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { spawn, ChildProcess } from 'child_process'

const PORT    = 3001
const LOGS_DIR = path.join(process.cwd(), 'scripts', 'logs')

// ── Load .env.local ────────────────────────────────────────────────────────────
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
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}${filter ? '?' + filter : ''}`, { headers: SB_HDR })
    const d = await r.json()
    if (!Array.isArray(d)) { console.warn('sbGet error:', JSON.stringify(d)); return [] }
    return d
  } catch (e) {
    console.warn(`sbGet ${table} failed:`, e)
    return []
  }
}

async function sbPatch(table: string, filter: string, data: object) {
  try {
    await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
      method: 'PATCH', headers: SB_HDR, body: JSON.stringify(data),
    })
  } catch (e) {
    console.warn(`sbPatch ${table} failed:`, e)
  }
}

async function sbCount(table: string, filter: string): Promise<number> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${filter}&select=id`, {
      headers: { ...SB_HDR, Prefer: 'count=exact', Range: '0-0' },
    })
    const cr = r.headers.get('content-range') ?? ''
    const m = cr.match(/\/(\d+)$/)
    return m ? Number(m[1]) : 0
  } catch { return -1 }
}

async function sbPost(table: string, data: object): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST', headers: { ...SB_HDR, Prefer: 'return=representation' }, body: JSON.stringify(data),
    })
    const d = await r.json()
    if (r.ok) return { ok: true }
    return { ok: false, error: JSON.stringify(d) }
  } catch (e) { return { ok: false, error: String(e) } }
}

async function sbDelete(table: string, filter: string) {
  try {
    await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: SB_HDR })
  } catch (e) { console.warn(`sbDelete ${table} failed:`, e) }
}

// Ensure logs dir exists
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true })

// ── Types ──────────────────────────────────────────────────────────────────────
interface AccountRow {
  id: number
  username: string
  session_dir: string
  proxy_host: string
  proxy_port: number
  proxy_username: string
  proxy_password: string
  enabled: boolean
  dm_limit: number
  warmup_start_date: string | null
  schedule: string | null
  // Stats columns (added via ALTER TABLE — gracefully handled if missing)
  last_run_date?: string | null
  dms_sent_total?: number
  dms_sent_today?: number
}

interface FollowupRow {
  id: string
  lead_id: string
  account_id: number
  next_followup_date: string | null
  status: 'pending' | 'replied' | 'done'
}

interface BotProcess {
  proc: ChildProcess
  startedAt: number
  mode: string
  log: string[]
}

// ── State ──────────────────────────────────────────────────────────────────────
const processes = new Map<number, BotProcess>()
const scheduleTimers = new Map<number, ReturnType<typeof setTimeout>>()

// Caches
let leadsCache: { count: number; fetchedAt: number } | null = null
let repliesCache: { count: number; fetchedAt: number } | null = null

// ── Helpers ────────────────────────────────────────────────────────────────────
function readLastLines(filePath: string, n: number): string[] {
  if (!fs.existsSync(filePath)) return []
  const content = fs.readFileSync(filePath, 'utf-8')
  return content.split('\n').filter(Boolean).slice(-n)
}

const WARMUP_SCHEDULE = [5, 10, 20, 40]

function getWarmupInfo(acc: AccountRow): { week: number; limit: number } {
  if (!acc.warmup_start_date) return { week: 0, limit: acc.dm_limit }
  const daysSince = Math.floor((Date.now() - new Date(acc.warmup_start_date).getTime()) / 86_400_000)
  const weekIdx   = Math.min(Math.floor(daysSince / 7), WARMUP_SCHEDULE.length - 1)
  return { week: weekIdx + 1, limit: WARMUP_SCHEDULE[weekIdx] }
}

function getNextRunTime(schedule: string): Date {
  const [h, m] = schedule.split(':').map(Number)
  const next = new Date()
  next.setHours(h, m, 0, 0)
  if (next <= new Date()) next.setDate(next.getDate() + 1)
  return next
}

// ── Supabase data fetchers ─────────────────────────────────────────────────────
async function fetchAccounts(): Promise<AccountRow[]> {
  return sbGet<AccountRow>('bot_accounts', 'order=id.asc')
}

async function fetchLeadCount(): Promise<number> {
  const now = Date.now()
  if (leadsCache && now - leadsCache.fetchedAt < 60_000) return leadsCache.count
  const count = await sbCount('leads', 'status=eq.Neu')
  leadsCache = { count, fetchedAt: Date.now() }
  return count
}

async function fetchReplyCount(): Promise<number> {
  const now = Date.now()
  if (repliesCache && now - repliesCache.fetchedAt < 60_000) return repliesCache.count
  const count = await sbCount('leads', 'status=in.(Antwort,Interessiert)')
  repliesCache = { count, fetchedAt: Date.now() }
  return count
}

async function fetchFollowups(): Promise<FollowupRow[]> {
  return sbGet<FollowupRow>('followups', 'status=eq.pending&select=id,lead_id,account_id,next_followup_date,status')
}

// ── Lead assignment (round-robin) ──────────────────────────────────────────────
async function assignUnassignedLeads(): Promise<{ assigned: number }> {
  const accounts = (await fetchAccounts()).filter(a => a.enabled)
  if (!accounts.length) return { assigned: 0 }

  const leads = await sbGet<{ id: string }>('leads', 'status=eq.Neu&assigned_account_id=is.null&select=id')
  if (!leads.length) return { assigned: 0 }

  // Round-robin: lead[0]→account[0], lead[1]→account[1], lead[2]→account[0], …
  for (let i = 0; i < leads.length; i++) {
    const acc = accounts[i % accounts.length]
    await sbPatch('leads', `id=eq.${leads[i].id}`, { assigned_account_id: acc.id })
  }

  leadsCache = null // invalidate cache
  console.log(`✅ ${leads.length} Leads zugewiesen (${accounts.length} Accounts, round-robin)`)
  return { assigned: leads.length }
}

// ── Status API ─────────────────────────────────────────────────────────────────
async function getStatus() {
  const today = new Date().toISOString().slice(0, 10)
  const [accounts, followups, leadCount, replyCount] = await Promise.all([
    fetchAccounts(),
    fetchFollowups(),
    fetchLeadCount(),
    fetchReplyCount(),
  ])

  const accountsWithStatus = accounts.map(acc => {
    const running = processes.has(acc.id)
    const bp      = processes.get(acc.id)
    const warmup  = getWarmupInfo(acc)
    const logFile = path.join(LOGS_DIR, `account-${acc.id}.log`)
    const logLines = running && bp ? bp.log.slice(-15) : readLastLines(logFile, 15)
    const nextRunAt = acc.schedule ? getNextRunTime(acc.schedule).toISOString() : null

    const followupsDue = followups.filter(
      e => e.account_id === acc.id && e.next_followup_date !== null && e.next_followup_date <= today
    ).length
    const followupsPending = followups.filter(e => e.account_id === acc.id).length

    const dmsSentToday = acc.last_run_date === today ? (acc.dms_sent_today ?? 0) : 0

    return {
      id: acc.id,
      username: acc.username,
      proxy_host: acc.proxy_host,
      proxy_port: acc.proxy_port,
      proxy_username: acc.proxy_username,
      session_dir: acc.session_dir,
      enabled: acc.enabled,
      dm_limit: acc.dm_limit,
      warmup_start_date: acc.warmup_start_date,
      schedule: acc.schedule,
      running,
      runMode: bp?.mode ?? null,
      startedAt: bp?.startedAt ?? null,
      log: logLines,
      dmsSentTotal: acc.dms_sent_total ?? 0,
      dmsSentToday,
      lastRunDate: acc.last_run_date ?? null,
      warmupWeek: warmup.week,
      warmupLimit: warmup.limit,
      nextRunAt,
      followupsDue,
      followupsPending,
    }
  })

  const totalDmsToday      = accountsWithStatus.reduce((s, a) => s + a.dmsSentToday, 0)
  const totalDmsAll        = accountsWithStatus.reduce((s, a) => s + a.dmsSentTotal, 0)
  const botsRunning        = processes.size
  const totalFollowupsDue  = followups.filter(e => e.next_followup_date !== null && e.next_followup_date <= today).length
  const totalFollowupsAll  = followups.length
  const avgWarmupWeek = (() => {
    const active = accountsWithStatus.filter(a => a.enabled && a.warmupWeek > 0)
    return active.length ? Math.round(active.reduce((s, a) => s + a.warmupWeek, 0) / active.length) : 0
  })()

  return {
    accounts: accountsWithStatus,
    leadCount,
    replyCount,
    totalDmsToday,
    totalDmsAll,
    botsRunning,
    avgWarmupWeek,
    totalFollowupsDue,
    totalFollowupsAll,
  }
}

// ── Process management ─────────────────────────────────────────────────────────
async function startBot(id: number, dryRun: boolean, dmLimit?: number, mode = 'dm') {
  if (processes.has(id)) return { ok: false, error: 'Already running' }

  const accounts = await fetchAccounts()
  const acc = accounts.find(a => a.id === id)
  if (!acc) return { ok: false, error: 'Account not found' }
  if (!acc.enabled) return { ok: false, error: 'Account disabled' }

  const args = ['tsx', 'scripts/send-ig-dms.ts', '--account', String(id), '--mode', mode]
  if (dmLimit) args.push('--dm-limit', String(dmLimit))
  if (dryRun) args.push('--dry-run')

  const proc = spawn('npx', args, {
    cwd: process.cwd(),
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })

  const bp: BotProcess = { proc, startedAt: Date.now(), mode, log: [] }
  const logFile = path.join(LOGS_DIR, `account-${id}.log`)

  const onData = (chunk: Buffer) => {
    const text = chunk.toString()
    const lines = text.split('\n').filter(Boolean)
    bp.log.push(...lines)
    if (bp.log.length > 200) bp.log = bp.log.slice(-200)
    fs.appendFileSync(logFile, text)
    process.stdout.write(`[Account ${id}] ${text}`)
  }
  proc.stdout?.on('data', onData)
  proc.stderr?.on('data', onData)

  proc.on('exit', code => {
    console.log(`[Account ${id}] Process exited with code ${code}`)
    processes.delete(id)
  })

  processes.set(id, bp)
  return { ok: true }
}

/** Wait for a running bot process to exit. Resolves immediately if not running. */
function waitForBot(id: number): Promise<number | null> {
  const bp = processes.get(id)
  if (!bp) return Promise.resolve(null)
  return new Promise(resolve => {
    bp.proc.on('exit', code => resolve(code))
  })
}

function stopBot(id: number) {
  const bp = processes.get(id)
  if (!bp) return { ok: false, error: 'Not running' }
  if (process.platform === 'win32' && bp.proc.pid) {
    spawn('taskkill', ['/PID', String(bp.proc.pid), '/T', '/F'], { shell: true })
  } else {
    bp.proc.kill('SIGTERM')
  }
  processes.delete(id)
  return { ok: true }
}

async function toggleAccount(id: number): Promise<{ ok: boolean; enabled?: boolean; error?: string }> {
  const accounts = await fetchAccounts()
  const acc = accounts.find(a => a.id === id)
  if (!acc) return { ok: false, error: 'Account not found' }
  const newEnabled = !acc.enabled
  await sbPatch('bot_accounts', `id=eq.${id}`, { enabled: newEnabled })
  return { ok: true, enabled: newEnabled }
}

function clearLog(id: number) {
  const logFile = path.join(LOGS_DIR, `account-${id}.log`)
  if (fs.existsSync(logFile)) fs.writeFileSync(logFile, '')
  const bp = processes.get(id)
  if (bp) bp.log = []
  return { ok: true }
}

async function createAccount(data: Partial<AccountRow>): Promise<{ ok: boolean; error?: string }> {
  const accounts = await fetchAccounts()
  const nextId = accounts.length > 0 ? Math.max(...accounts.map(a => a.id)) + 1 : 0
  const newAcc: Record<string, unknown> = {
    id: nextId,
    username: data.username ?? '',
    ig_password: (data as Record<string, unknown>).ig_password ?? null,
    session_dir: data.session_dir || `.ig-session-${nextId}`,
    proxy_host: data.proxy_host ?? '',
    proxy_port: data.proxy_port ?? 8080,
    proxy_username: data.proxy_username ?? '',
    proxy_password: data.proxy_password ?? '',
    enabled: true,
    dm_limit: data.dm_limit ?? 5,
    warmup_start_date: null,
    schedule: data.schedule ?? null,
  }
  return sbPost('bot_accounts', newAcc)
}

async function updateAccount(id: number, data: Partial<AccountRow> & { proxy_password?: string }): Promise<{ ok: boolean; error?: string }> {
  const allowed = ['username', 'ig_password', 'session_dir', 'proxy_host', 'proxy_port', 'proxy_username', 'proxy_password', 'enabled', 'dm_limit', 'schedule']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in data) patch[key] = (data as Record<string, unknown>)[key]
  }
  await sbPatch('bot_accounts', `id=eq.${id}`, patch)
  return { ok: true }
}

async function deleteAccount(id: number): Promise<{ ok: boolean; error?: string }> {
  if (processes.has(id)) return { ok: false, error: 'Bot läuft noch' }
  await sbDelete('bot_accounts', `id=eq.${id}`)
  return { ok: true }
}

// ── Auto-schedule ──────────────────────────────────────────────────────────────
async function initSchedules() {
  const accounts = await fetchAccounts()
  for (const acc of accounts) {
    if (!acc.enabled || !acc.schedule) continue
    scheduleNextRun(acc)
  }
}

function scheduleNextRun(acc: AccountRow) {
  const next = getNextRunTime(acc.schedule!)
  const msUntil = next.getTime() - Date.now()
  console.log(`⏰ Account ${acc.id} (@${acc.username}) scheduled daily at ${acc.schedule} (in ${Math.round(msUntil / 60000)}m)`)
  const timer = setTimeout(async () => {
    // Run follow mode first to follow new leads, then DM mode to message followed leads
    console.log(`[Schedule] Account ${acc.id}: starting follow mode...`)
    await startBot(acc.id, false, undefined, 'follow')
    await waitForBot(acc.id)
    console.log(`[Schedule] Account ${acc.id}: follow done, starting DM mode...`)
    await startBot(acc.id, false)
    await waitForBot(acc.id)
    console.log(`[Schedule] Account ${acc.id}: DM done.`)
    const updated = await fetchAccounts()
    const updatedAcc = updated.find(a => a.id === acc.id)
    if (updatedAcc?.schedule) scheduleNextRun(updatedAcc)
  }, msUntil)
  scheduleTimers.set(acc.id, timer)
}

// ── Dashboard HTML ─────────────────────────────────────────────────────────────
function dashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FlowingPost Bot Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg-base: #09090f;
    --bg-surface: #111119;
    --bg-elevated: #16161f;
    --bg-hover: #1c1c28;
    --border: #1e1e2e;
    --border-subtle: #161624;
    --text-primary: #ececf1;
    --text-secondary: #8b8ba0;
    --text-muted: #53536b;
    --accent: #7c3aed;
    --accent-hover: #6d28d9;
    --accent-subtle: rgba(124, 58, 237, 0.12);
    --green: #22c55e;
    --green-subtle: rgba(34, 197, 94, 0.12);
    --green-border: rgba(34, 197, 94, 0.25);
    --amber: #f59e0b;
    --amber-subtle: rgba(245, 158, 11, 0.12);
    --amber-border: rgba(245, 158, 11, 0.25);
    --red: #ef4444;
    --red-subtle: rgba(239, 68, 68, 0.12);
    --blue: #3b82f6;
    --blue-subtle: rgba(59, 130, 246, 0.12);
    --cyan: #06b6d4;
    --cyan-subtle: rgba(6, 182, 212, 0.12);
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
    --shadow-lg: 0 8px 30px rgba(0,0,0,0.5);
    --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: 'Inter', -apple-system, system-ui, sans-serif;
    min-height: 100vh;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #3a3a4a; }

  /* ── Header ──────────────────────────────────────────────── */
  header {
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    padding: 0 28px;
    height: 56px;
    display: flex;
    align-items: center;
    gap: 14px;
    position: sticky;
    top: 0;
    z-index: 50;
    backdrop-filter: blur(12px);
    background: rgba(17,17,25,0.85);
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo-icon {
    width: 28px; height: 28px;
    background: linear-gradient(135deg, var(--accent), #a78bfa);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; color: #fff;
  }
  header h1 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .header-badges {
    display: flex; gap: 8px; align-items: center; margin-left: 8px;
  }
  .badge {
    font-size: 0.68rem;
    padding: 3px 10px;
    border-radius: 20px;
    font-weight: 500;
    letter-spacing: 0.01em;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: all var(--transition);
  }
  .badge-green  { background: var(--green-subtle); color: var(--green); border: 1px solid var(--green-border); }
  .badge-purple { background: var(--accent-subtle); color: #a78bfa; border: 1px solid rgba(124,58,237,0.25); }
  .badge-amber  { background: var(--amber-subtle); color: var(--amber); border: 1px solid var(--amber-border); }
  .badge-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
  .badge-dot.green { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .badge-dot.amber { background: var(--amber); box-shadow: 0 0 6px var(--amber); }

  .header-actions {
    display: flex; gap: 8px; margin-left: auto; align-items: center;
  }
  .btn-header {
    padding: 7px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 500;
    transition: all var(--transition);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: inherit;
  }
  .btn-header:hover { background: var(--bg-hover); border-color: #2e2e42; }
  .btn-header-assign { background: var(--cyan-subtle); color: var(--cyan); border-color: rgba(6,182,212,0.25); }
  .btn-header-assign:hover { background: rgba(6,182,212,0.2); }
  .btn-header-add { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn-header-add:hover { background: var(--accent-hover); border-color: var(--accent-hover); }

  /* ── Main Content ────────────────────────────────────────── */
  .main { max-width: 1440px; margin: 0 auto; padding: 24px 28px 40px; }

  /* ── Global Stats ────────────────────────────────────────── */
  .global-stats {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 14px;
    margin-bottom: 28px;
  }
  @media (max-width: 1100px) { .global-stats { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 600px) { .global-stats { grid-template-columns: repeat(2, 1fr); } }

  .stat {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 18px 20px;
    transition: all var(--transition);
    position: relative;
    overflow: hidden;
  }
  .stat:hover {
    border-color: #2a2a3e;
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
  .stat-icon {
    width: 32px; height: 32px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px;
    margin-bottom: 12px;
  }
  .stat-icon.purple { background: var(--accent-subtle); }
  .stat-icon.green  { background: var(--green-subtle); }
  .stat-icon.amber  { background: var(--amber-subtle); }
  .stat-icon.blue   { background: var(--blue-subtle); }
  .stat-icon.cyan   { background: var(--cyan-subtle); }
  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.1;
    margin-bottom: 4px;
    font-variant-numeric: tabular-nums;
  }
  .stat-value.purple { color: #a78bfa; }
  .stat-value.green  { color: var(--green); }
  .stat-value.amber  { color: var(--amber); }
  .stat-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    font-weight: 500;
  }

  /* ── Section Header ──────────────────────────────────────── */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .section-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .refresh-info {
    font-size: 0.72rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .refresh-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--green);
    animation: refresh-pulse 2s infinite;
  }
  @keyframes refresh-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

  /* ── Account Cards ───────────────────────────────────────── */
  .accounts {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  @media (max-width: 900px) { .accounts { grid-template-columns: 1fr; } }
  @media (min-width: 1400px) { .accounts { grid-template-columns: repeat(3, 1fr); } }

  .card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 20px;
    transition: all var(--transition);
    position: relative;
  }
  .card:hover {
    border-color: #2a2a3e;
    box-shadow: var(--shadow-md);
  }
  .card.running {
    border-color: var(--green-border);
    box-shadow: 0 0 20px rgba(34,197,94,0.06);
  }
  .card.running-fu {
    border-color: var(--amber-border);
    box-shadow: 0 0 20px rgba(245,158,11,0.06);
  }
  .card.disabled { opacity: 0.5; }

  /* Card Header */
  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
  }
  .status-dot-wrap {
    width: 36px; height: 36px;
    border-radius: 10px;
    background: var(--bg-elevated);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .status-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: var(--text-muted);
    transition: all var(--transition);
  }
  .status-dot.running {
    background: var(--green);
    box-shadow: 0 0 8px var(--green), 0 0 16px rgba(34,197,94,0.3);
    animation: glow-green 2s ease-in-out infinite;
  }
  .status-dot.running-fu {
    background: var(--amber);
    box-shadow: 0 0 8px var(--amber), 0 0 16px rgba(245,158,11,0.3);
    animation: glow-amber 2s ease-in-out infinite;
  }
  .status-dot.error {
    background: var(--red);
    box-shadow: 0 0 8px var(--red);
  }
  @keyframes glow-green {
    0%,100% { box-shadow: 0 0 8px var(--green), 0 0 16px rgba(34,197,94,0.3); }
    50% { box-shadow: 0 0 12px var(--green), 0 0 24px rgba(34,197,94,0.4); }
  }
  @keyframes glow-amber {
    0%,100% { box-shadow: 0 0 8px var(--amber), 0 0 16px rgba(245,158,11,0.3); }
    50% { box-shadow: 0 0 12px var(--amber), 0 0 24px rgba(245,158,11,0.4); }
  }
  .card-info { flex: 1; min-width: 0; }
  .card-title {
    font-weight: 600;
    font-size: 0.92rem;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 8px;
    line-height: 1.3;
  }
  .run-label {
    font-size: 0.68rem;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 20px;
    white-space: nowrap;
  }
  .run-label.dm { background: var(--green-subtle); color: var(--green); }
  .run-label.followup { background: var(--amber-subtle); color: var(--amber); }
  .run-label.follow { background: var(--cyan-subtle); color: var(--cyan); }
  .card-sub {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .proxy-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.66rem;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 500;
  }
  .proxy-badge.ok { background: var(--green-subtle); color: var(--green); }
  .proxy-badge.warn { background: var(--amber-subtle); color: var(--amber); }
  .card-edit-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: var(--radius-sm);
    transition: all var(--transition);
    font-size: 14px;
    line-height: 1;
  }
  .card-edit-btn:hover { background: var(--bg-hover); color: var(--text-secondary); }

  /* Warmup Row */
  .warmup-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    padding: 10px 12px;
    background: var(--bg-base);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
  }
  .warmup-label {
    font-size: 0.72rem;
    color: var(--text-secondary);
    white-space: nowrap;
    font-weight: 500;
    min-width: 0;
  }
  .warmup-bar-track {
    flex: 1;
    height: 6px;
    background: var(--bg-elevated);
    border-radius: 3px;
    overflow: hidden;
    display: flex;
    gap: 3px;
  }
  .warmup-seg {
    height: 100%;
    flex: 1;
    border-radius: 3px;
    background: #1e1e2e;
    transition: background 0.5s ease, box-shadow 0.5s ease;
  }
  .warmup-seg.filled {
    background: linear-gradient(90deg, var(--green), #34d399);
    box-shadow: 0 0 6px rgba(34,197,94,0.3);
  }
  .schedule-tag {
    font-size: 0.68rem;
    color: var(--text-muted);
    white-space: nowrap;
    margin-left: auto;
    font-weight: 500;
  }

  /* Card Stats Chips */
  .card-stats {
    display: flex;
    gap: 8px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.72rem;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .chip strong { color: var(--text-primary); font-weight: 600; }
  .chip.fu-due {
    background: var(--amber-subtle);
    border-color: var(--amber-border);
    color: var(--amber);
  }
  .chip.fu-due strong { color: var(--amber); }
  .chip.fu-pending { color: var(--text-muted); }

  /* Action Buttons */
  .actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }
  .act-btn, .act-link {
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 0.74rem;
    font-weight: 500;
    transition: all var(--transition);
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    text-decoration: none;
    line-height: 1.4;
  }
  .act-btn:hover, .act-link:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
  .act-btn:active { transform: translateY(0); }
  .act-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none !important; box-shadow: none !important; }

  .act-btn.start    { background: var(--green); color: #000; }
  .act-btn.start:hover { background: #16a34a; }
  .act-btn.follow   { background: var(--cyan-subtle); color: var(--cyan); border-color: rgba(6,182,212,0.25); }
  .act-btn.follow:hover { background: rgba(6,182,212,0.2); }
  .act-btn.followup { background: var(--amber-subtle); color: var(--amber); border-color: var(--amber-border); }
  .act-btn.followup:hover { background: rgba(245,158,11,0.2); }
  .act-btn.login    { background: var(--accent-subtle); color: #a78bfa; border-color: rgba(124,58,237,0.25); }
  .act-btn.login:hover { background: rgba(124,58,237,0.2); }
  .act-btn.dry      { background: var(--blue-subtle); color: var(--blue); border-color: rgba(59,130,246,0.25); }
  .act-btn.dry:hover { background: rgba(59,130,246,0.2); }
  .act-btn.stop     { background: var(--red-subtle); color: var(--red); border-color: rgba(239,68,68,0.25); }
  .act-btn.stop:hover { background: rgba(239,68,68,0.2); }
  .act-link.inbox   { background: var(--bg-elevated); color: var(--text-secondary); border-color: var(--border); }
  .act-link.inbox:hover { background: var(--bg-hover); }

  .act-btn.toggle {
    background: var(--bg-elevated);
    color: var(--text-muted);
    border-color: var(--border);
  }
  .act-btn.toggle:hover { background: var(--bg-hover); color: var(--text-secondary); }
  .act-btn.toggle.active {
    background: var(--green-subtle);
    color: var(--green);
    border-color: var(--green-border);
  }

  /* Log Terminal */
  .log-wrap { margin-top: 14px; }
  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .log-label {
    font-size: 0.68rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .log-label::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--text-muted);
    display: inline-block;
  }
  .log-label.live::before { background: var(--green); box-shadow: 0 0 4px var(--green); }
  .log-actions { display: flex; gap: 2px; }
  .log-btn {
    font-size: 0.7rem;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all var(--transition);
    font-family: inherit;
  }
  .log-btn:hover { background: var(--bg-hover); color: var(--text-secondary); }
  .log-btn.copied { color: var(--green); }
  .log-btn.clear:hover { color: var(--red); }
  .log-box {
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    font-family: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;
    font-size: 0.7rem;
    color: var(--text-muted);
    max-height: 180px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.6;
    transition: border-color var(--transition);
  }
  .card.running .log-box,
  .card.running-fu .log-box { border-color: #1e1e2e; }
  .log-box:empty::after {
    content: 'Kein Output vorhanden';
    color: var(--text-muted);
    opacity: 0.4;
    font-style: italic;
  }

  /* ── Modal ───────────────────────────────────────────────── */
  .modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 100;
    align-items: center;
    justify-content: center;
    animation: fade-in 0.15s ease;
  }
  .modal-overlay.open { display: flex; }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

  .modal {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 28px;
    width: 480px;
    max-width: 94vw;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
    animation: slide-up 0.2s ease;
  }
  .modal h2 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 24px;
    letter-spacing: -0.01em;
  }
  .form-row { margin-bottom: 14px; }
  .form-row label {
    display: block;
    font-size: 0.72rem;
    color: var(--text-secondary);
    font-weight: 500;
    margin-bottom: 6px;
  }
  .form-row input {
    width: 100%;
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 9px 12px;
    color: var(--text-primary);
    font-size: 0.82rem;
    font-family: inherit;
    outline: none;
    transition: all var(--transition);
  }
  .form-row input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-subtle);
  }
  .form-row input::placeholder { color: var(--text-muted); }
  .form-hint {
    font-size: 0.68rem;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .form-section {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    font-weight: 600;
    margin: 20px 0 12px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .form-section::before {
    content: '';
    width: 3px;
    height: 12px;
    border-radius: 2px;
    background: var(--accent);
  }
  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
  .modal-btn {
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    transition: all var(--transition);
    font-family: inherit;
  }
  .modal-btn:hover { background: var(--bg-hover); }
  .modal-btn.cancel { background: var(--bg-elevated); color: var(--text-secondary); }
  .modal-btn.danger { background: var(--red-subtle); color: var(--red); border-color: rgba(239,68,68,0.25); }
  .modal-btn.danger:hover { background: rgba(239,68,68,0.2); }
  .modal-btn.save { background: var(--accent); color: #fff; border-color: var(--accent); }
  .modal-btn.save:hover { background: var(--accent-hover); }

  /* ── Loading Overlay ─────────────────────────────────────── */
  .loading-overlay {
    display: none;
    position: fixed;
    top: 56px; left: 0; right: 0;
    height: 2px;
    z-index: 60;
    background: var(--bg-base);
    overflow: hidden;
  }
  .loading-overlay.active { display: block; }
  .loading-bar {
    height: 100%;
    width: 30%;
    background: linear-gradient(90deg, var(--accent), #a78bfa);
    border-radius: 2px;
    animation: loading-slide 1s ease-in-out infinite;
  }
  @keyframes loading-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }

  /* ── Toast ───────────────────────────────────────────────── */
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .toast {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 16px;
    font-size: 0.78rem;
    color: var(--text-primary);
    box-shadow: var(--shadow-md);
    animation: toast-in 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  @keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
</style>
</head>
<body>

<header>
  <div class="logo">
    <div class="logo-icon">FP</div>
    <h1>Bot Dashboard</h1>
  </div>
  <div class="header-badges">
    <span class="badge badge-green" id="botsRunning"><span class="badge-dot green"></span> 0 laufen</span>
    <span class="badge badge-purple" id="avgWarmup">Warmup &empty; ?</span>
    <span class="badge badge-amber" id="fuDueBadge" style="display:none"><span class="badge-dot amber"></span> 0 FU f&auml;llig</span>
  </div>
  <div class="header-actions">
    <button class="btn-header btn-header-assign" id="btnAssign" onclick="assignLeads(this)">Leads zuweisen</button>
    <button class="btn-header btn-header-add" onclick="openCreateModal()">+ Account</button>
  </div>
</header>

<div class="loading-overlay" id="loadingBar"><div class="loading-bar"></div></div>

<div class="main">
  <div class="global-stats">
    <div class="stat">
      <div class="stat-icon purple">&#128203;</div>
      <div class="stat-value purple" id="leadCount">&hellip;</div>
      <div class="stat-label">Leads &uuml;brig</div>
    </div>
    <div class="stat">
      <div class="stat-icon blue">&#9993;</div>
      <div class="stat-value" id="totalDmsToday">&hellip;</div>
      <div class="stat-label">DMs heute</div>
    </div>
    <div class="stat">
      <div class="stat-icon cyan">&#128200;</div>
      <div class="stat-value" id="totalDmsAll">&hellip;</div>
      <div class="stat-label">DMs gesamt</div>
    </div>
    <div class="stat">
      <div class="stat-icon green">&#128172;</div>
      <div class="stat-value green" id="replyCount">&hellip;</div>
      <div class="stat-label">Replies</div>
    </div>
    <div class="stat">
      <div class="stat-icon amber">&#128229;</div>
      <div class="stat-value amber" id="followupsDue">&hellip;</div>
      <div class="stat-label">Follow-ups f&auml;llig</div>
    </div>
    <div class="stat">
      <div class="stat-icon purple">&#128100;</div>
      <div class="stat-value" id="activeAccounts">&hellip;</div>
      <div class="stat-label">Aktive Accounts</div>
    </div>
  </div>

  <div class="section-header">
    <div class="section-title">Accounts</div>
    <div class="refresh-info" id="refreshBar">
      <span class="refresh-dot"></span>
      L&auml;dt&hellip;
    </div>
  </div>

  <div class="accounts" id="accounts"></div>
</div>

<div class="toast-container" id="toasts"></div>

<script>
let lastData = null
let isLoading = false

function showLoading(on) {
  isLoading = on
  document.getElementById('loadingBar').classList.toggle('active', on)
}

function showToast(msg, duration) {
  duration = duration || 2500
  var c = document.getElementById('toasts')
  var t = document.createElement('div')
  t.className = 'toast'
  t.textContent = msg
  c.appendChild(t)
  setTimeout(function() { t.remove() }, duration)
}

async function loadStatus() {
  showLoading(true)
  try {
    const res = await fetch('/api/status')
    const data = await res.json()
    lastData = data
    render(data)
  } catch(e) {
    document.getElementById('refreshBar').innerHTML = '<span class="refresh-dot" style="background:var(--red);box-shadow:0 0 4px var(--red)"></span> Verbindungsfehler'
  }
  showLoading(false)
}

function warmupBar(week) {
  return [1,2,3,4].map(i => \`<div class="warmup-seg\${i <= week ? ' filled' : ''}"></div>\`).join('')
}

function formatNextRun(isoStr) {
  if (!isoStr) return 'manuell'
  const d = new Date(isoStr)
  const now = new Date()
  const diffH = Math.round((d - now) / 3600000)
  const hhmm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  if (diffH < 24) return \`heute \${hhmm}\`
  return \`morgen \${hhmm}\`
}

function render(data) {
  // Header badges
  document.getElementById('botsRunning').innerHTML = '<span class="badge-dot green"></span> ' + data.botsRunning + ' laufen'
  document.getElementById('avgWarmup').textContent = data.avgWarmupWeek > 0 ? \`Warmup \\u2300 Woche \${data.avgWarmupWeek}\` : 'Warmup \\u2014 '
  const fuBadge = document.getElementById('fuDueBadge')
  if (data.totalFollowupsDue > 0) {
    fuBadge.innerHTML = '<span class="badge-dot amber"></span> ' + data.totalFollowupsDue + ' FU f\\u00e4llig'
    fuBadge.style.display = 'inline-flex'
  } else {
    fuBadge.style.display = 'none'
  }

  // Global stats
  document.getElementById('leadCount').textContent = data.leadCount < 0 ? '?' : data.leadCount
  document.getElementById('totalDmsToday').textContent = data.totalDmsToday
  document.getElementById('totalDmsAll').textContent = data.totalDmsAll
  document.getElementById('replyCount').textContent = data.replyCount < 0 ? '?' : data.replyCount
  document.getElementById('followupsDue').textContent = data.totalFollowupsDue
  document.getElementById('activeAccounts').textContent = data.accounts.filter(a => a.enabled).length
  document.getElementById('refreshBar').innerHTML = '<span class="refresh-dot"></span> ' + new Date().toLocaleTimeString('de-DE')

  const container = document.getElementById('accounts')
  container.innerHTML = ''

  for (const acc of data.accounts) {
    const isRunningFU     = acc.running && acc.runMode === 'followup'
    const isRunningFollow = acc.running && acc.runMode === 'follow'
    const card = document.createElement('div')
    card.className = [
      'card',
      acc.running && !isRunningFU && !isRunningFollow ? 'running' : '',
      isRunningFU ? 'running-fu' : '',
      isRunningFollow ? 'running' : '',
      !acc.enabled ? 'disabled' : ''
    ].filter(Boolean).join(' ')

    const proxyHtml = acc.proxy_host
      ? '<span class="proxy-badge ok">\\u2713 Proxy</span>'
      : '<span class="proxy-badge warn">! kein Proxy</span>'
    const warmupLabel = acc.warmupWeek > 0
      ? \`Woche \${acc.warmupWeek} \\u00b7 \${acc.warmupLimit} DMs/Tag\`
      : (acc.enabled ? 'Nicht gestartet' : '\\u2014')

    const dotClass = isRunningFU ? 'running-fu' : acc.running ? 'running' : ''
    const runLabelHtml = isRunningFU
      ? '<span class="run-label followup">Follow-ups</span>'
      : isRunningFollow
        ? '<span class="run-label follow">Folgt...</span>'
        : acc.running
          ? '<span class="run-label dm">l\\u00e4uft...</span>'
          : ''

    const fuChip = acc.followupsDue > 0
      ? \`<span class="chip fu-due"><strong>\${acc.followupsDue}</strong> FU f\\u00e4llig</span>\`
      : acc.followupsPending > 0
        ? \`<span class="chip fu-pending">\${acc.followupsPending} FU ausstehend</span>\`
        : ''

    card.innerHTML = \`
      <div class="card-header">
        <div class="status-dot-wrap">
          <div class="status-dot\${dotClass ? ' ' + dotClass : ''}"></div>
        </div>
        <div class="card-info">
          <div class="card-title">@\${acc.username || '(nicht gesetzt)'} \${runLabelHtml}</div>
          <div class="card-sub">#\${acc.id} \${proxyHtml}</div>
        </div>
        <button class="card-edit-btn" onclick="openEditModal(\${acc.id})" title="Bearbeiten">\\u270E</button>
      </div>
      <div class="warmup-row">
        <span class="warmup-label">\${warmupLabel}</span>
        <div class="warmup-bar-track">\${warmupBar(acc.warmupWeek)}</div>
        <span class="schedule-tag">\${formatNextRun(acc.nextRunAt)}</span>
      </div>
      <div class="card-stats">
        <span class="chip"><strong>\${acc.dmsSentToday}</strong> heute</span>
        <span class="chip"><strong>\${acc.dmsSentTotal}</strong> gesamt</span>
        <span class="chip">Letzter Run: <strong>\${acc.lastRunDate || '\\u2014'}</strong></span>
        \${fuChip}
      </div>
      <div class="actions">
        <button class="act-btn start"    onclick="startBot(\${acc.id}, false)"    \${acc.running || !acc.enabled ? 'disabled' : ''}>\\u25B6 Start</button>
        <button class="act-btn follow"   onclick="startFollow(\${acc.id})"        \${acc.running || !acc.enabled ? 'disabled' : ''}>Folgen</button>
        <button class="act-btn followup" onclick="startFollowup(\${acc.id})"      \${acc.running || !acc.enabled ? 'disabled' : ''}>Follow-ups</button>
        <button class="act-btn login"    onclick="loginAccount(\${acc.id})"       \${acc.running || !acc.enabled ? 'disabled' : ''}>Login</button>
        <button class="act-btn dry"      onclick="startBot(\${acc.id}, true)"     \${acc.running || !acc.enabled ? 'disabled' : ''}>Dry Run</button>
        <button class="act-btn stop"     onclick="stopBot(\${acc.id})"            \${!acc.running ? 'disabled' : ''}>\\u25A0 Stop</button>
        <a class="act-link inbox" href="https://www.instagram.com/direct/inbox/" target="_blank">Inbox</a>
        <button class="act-btn toggle\${acc.enabled ? ' active' : ''}" onclick="toggleAccount(\${acc.id})">\${acc.enabled ? '\\u2713 Aktiv' : '\\u2717 Aus'}</button>
      </div>
      <div class="log-wrap">
        <div class="log-header">
          <span class="log-label\${acc.running ? ' live' : ''}">Terminal</span>
          <div class="log-actions">
            <button class="log-btn" onclick="copyLog(\${acc.id}, this)">Kopieren</button>
            <button class="log-btn clear" onclick="clearLog(\${acc.id})">L\\u00f6schen</button>
          </div>
        </div>
        <div class="log-box" id="log-\${acc.id}">\${(acc.log || []).join('\\n')}</div>
      </div>
    \`
    container.appendChild(card)
  }
}

async function startBot(id, dryRun) {
  await fetch(\`/api/accounts/\${id}/start\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun })
  })
  setTimeout(loadStatus, 800)
}

async function loginAccount(id) {
  await fetch(\`/api/accounts/\${id}/login\`, { method: 'POST' })
  setTimeout(loadStatus, 800)
}

async function startFollow(id) {
  await fetch(\`/api/accounts/\${id}/follow\`, { method: 'POST' })
  setTimeout(loadStatus, 800)
}

async function startFollowup(id) {
  await fetch(\`/api/accounts/\${id}/followup\`, { method: 'POST' })
  setTimeout(loadStatus, 800)
}

async function stopBot(id) {
  await fetch(\`/api/accounts/\${id}/stop\`, { method: 'POST' })
  setTimeout(loadStatus, 800)
}

async function toggleAccount(id) {
  await fetch(\`/api/accounts/\${id}/toggle\`, { method: 'POST' })
  setTimeout(loadStatus, 400)
}

async function clearLog(id) {
  await fetch(\`/api/accounts/\${id}/clear-log\`, { method: 'POST' })
  document.getElementById('log-' + id).textContent = ''
}

async function assignLeads(btn) {
  btn.disabled = true
  btn.textContent = 'Zuweisen...'
  try {
    const res = await fetch('/api/leads/assign', { method: 'POST' })
    const d = await res.json()
    var msg = d.assigned > 0 ? d.assigned + ' Leads zugewiesen' : 'Keine neuen Leads'
    btn.textContent = msg
    showToast(msg)
    setTimeout(function() { btn.textContent = 'Leads zuweisen'; btn.disabled = false }, 2500)
    loadStatus()
  } catch {
    btn.textContent = 'Fehler'
    showToast('Zuweisung fehlgeschlagen')
    setTimeout(function() { btn.textContent = 'Leads zuweisen'; btn.disabled = false }, 2000)
  }
}

function copyLog(id, btn) {
  const text = document.getElementById('log-' + id).textContent
  navigator.clipboard.writeText(text).then(function() {
    btn.textContent = '\\u2713 Kopiert'
    btn.classList.add('copied')
    showToast('Log kopiert')
    setTimeout(function() { btn.textContent = 'Kopieren'; btn.classList.remove('copied') }, 2000)
  })
}

function openCreateModal() {
  document.getElementById('modalTitle').textContent = 'Neuer Account'
  document.getElementById('modalId').value = ''
  document.getElementById('fUsername').value = ''
  document.getElementById('fSessionDir').value = ''
  document.getElementById('fProxyHost').value = ''
  document.getElementById('fProxyPort').value = '8080'
  document.getElementById('fProxyUser').value = ''
  document.getElementById('fProxyPass').value = ''
  document.getElementById('fSchedule').value = ''
  document.getElementById('fDmLimit').value = '5'
  document.getElementById('btnDelete').style.display = 'none'
  document.getElementById('modalOverlay').classList.add('open')
}

function openEditModal(id) {
  const acc = lastData && lastData.accounts && lastData.accounts.find(function(a) { return a.id === id })
  if (!acc) return
  document.getElementById('modalTitle').textContent = 'Account bearbeiten \\u2014 @' + acc.username
  document.getElementById('modalId').value = id
  document.getElementById('fUsername').value = acc.username || ''
  document.getElementById('fSessionDir').value = acc.session_dir || ''
  document.getElementById('fProxyHost').value = acc.proxy_host || ''
  document.getElementById('fProxyPort').value = acc.proxy_port || '8080'
  document.getElementById('fProxyUser').value = acc.proxy_username || ''
  document.getElementById('fProxyPass').value = ''
  document.getElementById('fIgPass').value = ''
  document.getElementById('fSchedule').value = acc.schedule || ''
  document.getElementById('fDmLimit').value = acc.dm_limit || '5'
  document.getElementById('btnDelete').style.display = 'inline-block'
  document.getElementById('modalOverlay').classList.add('open')
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open')
}

async function saveModal() {
  const id = document.getElementById('modalId').value
  const pass = document.getElementById('fProxyPass').value
  const igPass = document.getElementById('fIgPass').value
  var data = {
    username: document.getElementById('fUsername').value.trim(),
    session_dir: document.getElementById('fSessionDir').value.trim(),
    proxy_host: document.getElementById('fProxyHost').value.trim(),
    proxy_port: parseInt(document.getElementById('fProxyPort').value) || 8080,
    proxy_username: document.getElementById('fProxyUser').value.trim(),
    schedule: document.getElementById('fSchedule').value.trim() || null,
    dm_limit: parseInt(document.getElementById('fDmLimit').value) || 5,
  }
  if (pass) data.proxy_password = pass
  if (igPass) data.ig_password = igPass
  var url = id ? '/api/accounts/' + id : '/api/accounts'
  var method = id ? 'PATCH' : 'POST'
  await fetch(url, { method: method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) })
  closeModal()
  showToast(id ? 'Account aktualisiert' : 'Account erstellt')
  loadStatus()
}

async function deleteAccountModal() {
  const id = document.getElementById('modalId').value
  if (!id) return
  if (!confirm('Account #' + id + ' wirklich l\\u00f6schen? Session-Daten bleiben erhalten.')) return
  await fetch('/api/accounts/' + id, { method: 'DELETE' })
  closeModal()
  showToast('Account gel\\u00f6scht')
  loadStatus()
}

loadStatus()
setInterval(loadStatus, 10000)
</script>

<div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <h2 id="modalTitle">Account</h2>
    <input type="hidden" id="modalId" value="">
    <div class="form-row">
      <label>Instagram Username</label>
      <input id="fUsername" type="text" placeholder="mein_account">
    </div>
    <div class="form-row">
      <label>Instagram Passwort</label>
      <input id="fIgPass" type="text" autocomplete="off" placeholder="f&uuml;r Auto-Login">
      <div class="form-hint">Wird f&uuml;r automatisches Einloggen verwendet</div>
    </div>
    <div class="form-row">
      <label>Session-Verzeichnis</label>
      <input id="fSessionDir" type="text" placeholder=".ig-session-1">
      <div class="form-hint">Leer lassen &rarr; wird automatisch gesetzt</div>
    </div>
    <div class="form-row">
      <label>DM-Limit (manuell)</label>
      <input id="fDmLimit" type="number" placeholder="5" min="1" max="100">
      <div class="form-hint">Wird durch Warmup-Schedule &uuml;berschrieben</div>
    </div>
    <div class="form-row">
      <label>Auto-Schedule (optional)</label>
      <input id="fSchedule" type="text" placeholder="09:00">
      <div class="form-hint">T&auml;glich automatisch starten, z.B. &quot;09:00&quot;</div>
    </div>
    <div class="form-section">Proxy (optional)</div>
    <div class="form-row">
      <label>Proxy Host</label>
      <input id="fProxyHost" type="text" placeholder="proxy.beispiel.com">
    </div>
    <div class="form-row">
      <label>Proxy Port</label>
      <input id="fProxyPort" type="number" placeholder="8080">
    </div>
    <div class="form-row">
      <label>Proxy Benutzername</label>
      <input id="fProxyUser" type="text" placeholder="">
    </div>
    <div class="form-row">
      <label>Proxy Passwort</label>
      <input id="fProxyPass" type="password" placeholder="leer lassen = unver&auml;ndert">
    </div>
    <div class="modal-actions">
      <button class="modal-btn cancel" onclick="closeModal()">Abbrechen</button>
      <button id="btnDelete" class="modal-btn danger" onclick="deleteAccountModal()" style="display:none">L&ouml;schen</button>
      <button class="modal-btn save" onclick="saveModal()">Speichern</button>
    </div>
  </div>
</div>
</body>
</html>`
}

// ── HTTP Server ────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url    = req.url ?? '/'
  const method = req.method ?? 'GET'

  if (method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(dashboardHtml())
    return
  }

  if (method === 'GET' && url === '/api/status') {
    try {
      const status = await getStatus()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(status))
    } catch (e) {
      console.error('getStatus error:', e)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Supabase unavailable', accounts: [], leadCount: -1, replyCount: -1, totalDmsToday: 0, totalDmsAll: 0, botsRunning: processes.size, avgWarmupWeek: 0, totalFollowupsDue: 0, totalFollowupsAll: 0 }))
    }
    return
  }

  const readBody = (): Promise<string> => new Promise(resolve => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => resolve(body))
  })

  const startMatch = url.match(/^\/api\/accounts\/(\d+)\/start$/)
  if (method === 'POST' && startMatch) {
    const id = Number(startMatch[1])
    const body = await readBody()
    let dryRun = false; let dmLimit: number | undefined
    try { const j = JSON.parse(body); dryRun = !!j.dryRun; dmLimit = j.dmLimit } catch { /* ignore */ }
    const result = await startBot(id, dryRun, dmLimit, 'dm')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  const loginMatch = url.match(/^\/api\/accounts\/(\d+)\/login$/)
  if (method === 'POST' && loginMatch) {
    const id = Number(loginMatch[1])
    const result = await startBot(id, false, undefined, 'login')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  const followMatch = url.match(/^\/api\/accounts\/(\d+)\/follow$/)
  if (method === 'POST' && followMatch) {
    const id = Number(followMatch[1])
    const result = await startBot(id, false, undefined, 'follow')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  const followupMatch = url.match(/^\/api\/accounts\/(\d+)\/followup$/)
  if (method === 'POST' && followupMatch) {
    const id = Number(followupMatch[1])
    const result = await startBot(id, false, undefined, 'followup')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  const stopMatch = url.match(/^\/api\/accounts\/(\d+)\/stop$/)
  if (method === 'POST' && stopMatch) {
    const id = Number(stopMatch[1])
    const result = stopBot(id)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  const toggleMatch = url.match(/^\/api\/accounts\/(\d+)\/toggle$/)
  if (method === 'POST' && toggleMatch) {
    const id = Number(toggleMatch[1])
    const result = await toggleAccount(id)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  const clearLogMatch = url.match(/^\/api\/accounts\/(\d+)\/clear-log$/)
  if (method === 'POST' && clearLogMatch) {
    const id = Number(clearLogMatch[1])
    const result = clearLog(id)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  if (method === 'POST' && url === '/api/accounts') {
    const body = await readBody()
    let data: Partial<AccountRow> = {}
    try { data = JSON.parse(body) } catch { /* ignore */ }
    const result = await createAccount(data)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  const accountPatchMatch = url.match(/^\/api\/accounts\/(\d+)$/)
  if (method === 'PATCH' && accountPatchMatch) {
    const id = Number(accountPatchMatch[1])
    const body = await readBody()
    let data: Partial<AccountRow> = {}
    try { data = JSON.parse(body) } catch { /* ignore */ }
    const result = await updateAccount(id, data)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  if (method === 'DELETE' && accountPatchMatch) {
    const id = Number(accountPatchMatch[1])
    const result = await deleteAccount(id)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  if (method === 'POST' && url === '/api/leads/assign') {
    const result = await assignUnassignedLeads()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, ...result }))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log(`\n🤖 Bot Dashboard läuft auf http://localhost:${PORT}\n`)
  initSchedules().catch(console.error)
})

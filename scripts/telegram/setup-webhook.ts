/**
 * Register Telegram Bot webhook
 *
 * Usage:
 *   npx tsx scripts/telegram/setup-webhook.ts <URL>
 *
 * Examples:
 *   npx tsx scripts/telegram/setup-webhook.ts https://flowingpost.com
 *   npx tsx scripts/telegram/setup-webhook.ts https://abc123.ngrok.io   # local dev
 *
 * This calls Telegram's setWebhook API with your bot token and webhook secret.
 */

import * as fs from 'fs'
import * as path from 'path'

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env.local')
  process.exit(1)
}

const baseUrl = process.argv[2]

async function main() {
  // If no URL provided, show current webhook info
  if (!baseUrl) {
    console.log('📡 Current webhook info:\n')
    const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)
    const info = await infoRes.json()
    console.log(JSON.stringify(info.result, null, 2))

    if (!info.result?.url) {
      console.log('\n⚠️  No webhook set. Run with a URL to register:')
      console.log('   npx tsx scripts/telegram/setup-webhook.ts https://your-domain.com')
    }
    return
  }

  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`

  console.log(`🔗 Setting webhook to: ${webhookUrl}`)

  const params: Record<string, string> = {
    url: webhookUrl,
    allowed_updates: JSON.stringify(['message', 'callback_query']),
    max_connections: '40',
  }

  if (WEBHOOK_SECRET) {
    params.secret_token = WEBHOOK_SECRET
    console.log('🔒 Using webhook secret from TELEGRAM_WEBHOOK_SECRET')
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  const data = await res.json()

  if (data.ok) {
    console.log('✅ Webhook registered successfully!')
    console.log(`\n📋 Bot info:`)
    const meRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)
    const me = await meRes.json()
    if (me.ok) {
      console.log(`   Name: ${me.result.first_name}`)
      console.log(`   Username: @${me.result.username}`)
    }
  } else {
    console.error('❌ Failed to set webhook:', data.description)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})

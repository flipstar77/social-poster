import { webhookCallback } from 'grammy'
import { getBot } from '@/lib/telegram/bot'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request): Promise<Response> {
  // Validate secret token
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  const envSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (envSecret && secret !== envSecret) {
    console.warn('[Telegram Webhook] Invalid secret token')
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const handler = webhookCallback(getBot(), 'std/http')
    return await handler(req)
  } catch (err) {
    console.error('[Telegram Webhook] Error:', err)
    return new Response('OK', { status: 200 }) // Always return 200 to Telegram
  }
}

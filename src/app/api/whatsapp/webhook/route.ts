import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { sendText, markAsRead, type WaCredentials } from '@/lib/whatsapp/client'
import { routeMessage, type RouterConfig } from '@/lib/whatsapp/router'

export const runtime = 'nodejs'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET — Meta Webhook Verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WhatsApp Webhook] Verification successful')
    return new NextResponse(challenge, { status: 200 })
  }

  console.error('[WhatsApp Webhook] Verification failed — token mismatch')
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — Incoming Messages
export async function POST(request: NextRequest) {
  const body = await request.text()

  // Verify signature if META_APP_SECRET is configured
  const appSecret = process.env.META_APP_SECRET
  if (appSecret) {
    const signature = request.headers.get('x-hub-signature-256')
    if (!signature) {
      console.error('[WhatsApp Webhook] Missing signature')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    const expectedSig = 'sha256=' + createHmac('sha256', appSecret).update(body).digest('hex')
    if (signature !== expectedSig) {
      console.error('[WhatsApp Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  // Always return 200 to Meta — even on internal errors
  try {
    const payload = JSON.parse(body)
    const entry = payload.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value

    // Only process actual messages, not status updates
    if (!value?.messages?.length) {
      return NextResponse.json({ received: true })
    }

    const message = value.messages[0]
    const senderPhone = message.from
    const messageId = message.id
    const phoneNumberId = value.metadata?.phone_number_id

    // Only handle text messages for now
    if (message.type !== 'text') {
      return NextResponse.json({ received: true })
    }

    const messageText = message.text?.body || ''

    console.log(`[WhatsApp Webhook] Message from ${senderPhone}: "${messageText}"`)

    // Look up WhatsApp account from DB, with env fallback for test mode
    const account = await findAccountForPhone(phoneNumberId)
    if (!account) {
      console.error(`[WhatsApp Webhook] No account found for phone_number_id: ${phoneNumberId}`)
      return NextResponse.json({ received: true })
    }

    const creds: WaCredentials = {
      accessToken: account.accessToken,
      phoneNumberId: account.phoneNumberId,
    }

    // Mark as read (non-blocking)
    markAsRead(messageId, creds).catch(() => {})

    const admin = getAdmin()

    // Log inbound message
    await admin.from('whatsapp_messages').insert({
      profile_id: account.profileId,
      wa_message_id: messageId,
      direction: 'inbound',
      from_number: senderPhone,
      to_number: phoneNumberId,
      content: messageText,
      status: 'received',
    })

    // Load router config from profile
    const { data: profile } = await admin
      .from('profiles')
      .select('wa_greeting, wa_opening_hours, wa_menu_url, wa_keywords, wa_auto_reply_enabled')
      .eq('id', account.profileId)
      .single()

    if (!profile?.wa_auto_reply_enabled) {
      return NextResponse.json({ received: true })
    }

    const config: RouterConfig = {
      greetingMessage: profile.wa_greeting || 'Willkommen! Wie können wir Ihnen helfen?',
      openingHours: profile.wa_opening_hours || null,
      menuUrl: profile.wa_menu_url || null,
      keywords: (profile.wa_keywords as Record<string, string>) || {},
    }

    const reply = routeMessage(messageText, config)

    // Send reply using per-account credentials
    await sendText(senderPhone, reply, creds)

    // Log outbound message
    await admin.from('whatsapp_messages').insert({
      profile_id: account.profileId,
      direction: 'outbound',
      from_number: phoneNumberId,
      to_number: senderPhone,
      content: reply,
      status: 'sent',
    })

    console.log(`[WhatsApp Webhook] Reply sent to ${senderPhone}`)
  } catch (err) {
    console.error('[WhatsApp Webhook] Processing error:', err)
  }

  return NextResponse.json({ received: true })
}

interface AccountInfo {
  profileId: string
  accessToken: string
  phoneNumberId: string
}

// Look up WhatsApp account by phone_number_id
// First checks whatsapp_accounts table, then falls back to env (test mode)
async function findAccountForPhone(phoneNumberId: string): Promise<AccountInfo | null> {
  const admin = getAdmin()

  // 1) Check whatsapp_accounts table
  const { data: account } = await admin
    .from('whatsapp_accounts')
    .select('profile_id, access_token, phone_number_id')
    .eq('phone_number_id', phoneNumberId)
    .eq('status', 'active')
    .maybeSingle()

  if (account) {
    return {
      profileId: (account as { profile_id: string }).profile_id,
      accessToken: (account as { access_token: string }).access_token,
      phoneNumberId: (account as { phone_number_id: string }).phone_number_id,
    }
  }

  // 2) Fallback: env-based test mode
  if (phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
    if (!accessToken) return null

    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('wa_auto_reply_enabled', true)
      .limit(1)
      .single()

    if (profile) {
      return {
        profileId: (profile as { id: string }).id,
        accessToken,
        phoneNumberId,
      }
    }
  }

  return null
}

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { sendText, markAsRead } from '@/lib/whatsapp/client'
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

    // Mark as read (non-blocking)
    markAsRead(messageId).catch(() => {})

    const admin = getAdmin()

    // For test mode: find the profile that owns this phone number ID
    // In production this would look up whatsapp_accounts table
    const profileId = await findProfileForPhone(phoneNumberId)
    if (!profileId) {
      console.error(`[WhatsApp Webhook] No profile found for phone_number_id: ${phoneNumberId}`)
      return NextResponse.json({ received: true })
    }

    // Log inbound message
    await admin.from('whatsapp_messages').insert({
      profile_id: profileId,
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
      .eq('id', profileId)
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

    // Send reply
    await sendText(senderPhone, reply)

    // Log outbound message
    await admin.from('whatsapp_messages').insert({
      profile_id: profileId,
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

// Test mode: match phone_number_id from env to find the owner profile
// In production this would query a whatsapp_accounts table
async function findProfileForPhone(phoneNumberId: string): Promise<string | null> {
  // In test mode, the phone number ID is stored in env
  // Find the first profile with whatsapp features enabled
  if (phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID) {
    const admin = getAdmin()
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('wa_auto_reply_enabled', true)
      .limit(1)
      .single()
    return (data as { id: string } | null)?.id || null
  }
  return null
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars (0/O/1/I)
  let token = ''
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

// GET — Check if Telegram account is linked
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const { data: account } = await admin
    .from('telegram_accounts')
    .select('chat_id, username, linked_at')
    .eq('profile_id', user.id)
    .maybeSingle()

  return NextResponse.json({ account: account ?? null })
}

// POST — Generate a new link token
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()

  // Invalidate any existing unused tokens for this profile
  await admin
    .from('telegram_link_tokens')
    .update({ used: true })
    .eq('profile_id', user.id)
    .eq('used', false)

  const token = generateToken()
  await admin.from('telegram_link_tokens').insert({
    token,
    profile_id: user.id,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    used: false,
  })

  return NextResponse.json({ token })
}

// DELETE — Unlink Telegram account
export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  await admin.from('telegram_accounts').delete().eq('profile_id', user.id)

  return NextResponse.json({ success: true })
}

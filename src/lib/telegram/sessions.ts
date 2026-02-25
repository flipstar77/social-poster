import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type BotState =
  | 'idle'
  | 'awaiting_description_confirm'
  | 'awaiting_description_input'
  | 'awaiting_template'
  | 'awaiting_platforms'
  | 'awaiting_caption_confirm'
  | 'awaiting_caption_edit'
  | 'awaiting_schedule'
  | 'awaiting_schedule_input'

export interface SessionData {
  photo_file_id?: string
  is_video?: boolean
  description?: string
  template_id?: number | null
  platforms?: string[]
  caption?: string
  hashtags?: string[]
  scheduled_at?: string
  caption_msg_id?: number
}

export interface BotSession {
  state: BotState
  data: SessionData
}

export async function getSession(chatId: number): Promise<BotSession> {
  const admin = getAdmin()
  const { data } = await admin
    .from('telegram_sessions')
    .select('state, data')
    .eq('chat_id', chatId)
    .maybeSingle()

  if (data) {
    return { state: data.state as BotState, data: (data.data as SessionData) || {} }
  }
  return { state: 'idle', data: {} }
}

export async function setSession(chatId: number, session: BotSession): Promise<void> {
  const admin = getAdmin()
  await admin
    .from('telegram_sessions')
    .upsert(
      { chat_id: chatId, state: session.state, data: session.data, updated_at: new Date().toISOString() },
      { onConflict: 'chat_id' }
    )
}

export async function clearSession(chatId: number): Promise<void> {
  const admin = getAdmin()
  await admin.from('telegram_sessions').delete().eq('chat_id', chatId)
}

export async function getProfileId(chatId: number): Promise<string | null> {
  const admin = getAdmin()
  const { data } = await admin
    .from('telegram_accounts')
    .select('profile_id')
    .eq('chat_id', chatId)
    .maybeSingle()
  return (data as { profile_id: string } | null)?.profile_id ?? null
}

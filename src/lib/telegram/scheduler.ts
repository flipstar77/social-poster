import { parseDate } from 'chrono-node'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function parseNaturalDate(text: string, referenceDate = new Date()): Date | null {
  return parseDate(text, referenceDate, { forwardDate: true })
}

export async function getNextAvailableSlot(profileId: string): Promise<Date> {
  const admin = getAdmin()

  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { data: posts } = await admin
    .from('scheduled_posts')
    .select('scheduled_at')
    .eq('profile_id', profileId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', in30Days.toISOString())

  const occupiedDays = new Set(
    (posts || []).map(p => new Date(p.scheduled_at as string).toDateString())
  )

  // Start from tomorrow at 18:00
  const slot = new Date(now)
  slot.setDate(slot.getDate() + 1)
  slot.setHours(18, 0, 0, 0)

  for (let i = 0; i < 30; i++) {
    if (!occupiedDays.has(slot.toDateString())) {
      return new Date(slot)
    }
    slot.setDate(slot.getDate() + 1)
  }

  // Fallback: tomorrow at 18:00
  const fallback = new Date(now)
  fallback.setDate(fallback.getDate() + 1)
  fallback.setHours(18, 0, 0, 0)
  return fallback
}

export function formatDateDE(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

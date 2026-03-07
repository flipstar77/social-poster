/**
 * Tina posting scheduler — 3x daily at optimal times.
 * Slots: 10:00 (morning engagement), 14:00 (lunch scroll), 19:00 (evening peak)
 */

export const TINA_DAILY_SLOTS = ['10:00', '14:00', '19:00'] as const
export type TinaSlot = typeof TINA_DAILY_SLOTS[number]

export const TINA_PLATFORMS = ['instagram', 'facebook'] as const
export type TinaPlatform = typeof TINA_PLATFORMS[number]

export interface ScheduledTinaPost {
  imageId: string
  imagePath: string
  category: string
  platform: TinaPlatform
  caption: string
  hashtags: string[]
  vibe: string
  scheduledDate: string // YYYY-MM-DD
  scheduledTime: TinaSlot
  status: 'draft' | 'approved' | 'scheduled' | 'posted'
}

/**
 * Generate schedule slots for N days starting from tomorrow.
 * Each day gets 3 slots. Each slot can serve both IG + FB (same image, different caption).
 */
export function generateSlots(days: number, startFrom?: Date): Array<{ date: string; time: TinaSlot }> {
  const start = startFrom ?? new Date()
  const slots: Array<{ date: string; time: TinaSlot }> = []

  for (let d = 1; d <= days; d++) {
    const date = new Date(start)
    date.setDate(date.getDate() + d)
    const dateStr = date.toISOString().split('T')[0]

    for (const time of TINA_DAILY_SLOTS) {
      slots.push({ date: dateStr, time })
    }
  }

  return slots
}

/**
 * Pick the next available slot that doesn't conflict with existing posts.
 */
export function getNextFreeSlot(
  existingPosts: ScheduledTinaPost[],
  platform: TinaPlatform,
): { date: string; time: TinaSlot } | null {
  const occupied = new Set(
    existingPosts
      .filter(p => p.platform === platform && p.status !== 'draft')
      .map(p => `${p.scheduledDate}_${p.scheduledTime}`)
  )

  const slots = generateSlots(14)
  return slots.find(s => !occupied.has(`${s.date}_${s.time}`)) ?? null
}

/**
 * Auto-assign images to slots for batch scheduling.
 * Distributes images evenly across days, 3 per day.
 * Each image gets posted to both IG and FB (same slot, different captions).
 */
export function autoSchedule(
  images: Array<{ id: string; path: string; category: string }>,
  existingPosts: ScheduledTinaPost[],
): Array<{ imageId: string; imagePath: string; category: string; date: string; time: TinaSlot }> {
  const occupied = new Set(
    existingPosts
      .filter(p => p.status !== 'draft')
      .map(p => `${p.scheduledDate}_${p.scheduledTime}`)
  )

  const slots = generateSlots(Math.ceil(images.length / 3) + 2)
  const freeSlots = slots.filter(s => !occupied.has(`${s.date}_${s.time}`))

  return images.map((img, i) => {
    const slot = freeSlots[i]
    if (!slot) {
      // Fallback: just keep going beyond the generated range
      const extraSlots = generateSlots(30)
      const fallback = extraSlots[i] ?? { date: '2026-12-31', time: '10:00' as TinaSlot }
      return { ...img, imageId: img.id, imagePath: img.path, ...fallback }
    }
    return { ...img, imageId: img.id, imagePath: img.path, ...slot }
  })
}

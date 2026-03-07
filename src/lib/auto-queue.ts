/**
 * Auto-Queue: Generate a week of content from uploaded photos.
 * Takes N photos + selected platforms → creates a balanced weekly plan
 * with multiple content angles per photo.
 */

import { getPreferenceScore } from '@/components/PostSwiper'

// Content angle categories (aligned with platform-prompts.ts variant categories)
const CONTENT_ANGLES = [
  'Storytelling / Emotion',
  'Wissen / Mehrwert',
  'Community / FOMO',
  'Behind the Scenes',
  'Produkt-Highlight',
] as const

type ContentAngle = typeof CONTENT_ANGLES[number]

export interface QueueSlot {
  photoIndex: number
  platform: string
  angle: ContentAngle
  dayOffset: number // 0 = tomorrow, 1 = day after, etc.
  timeSlot: string  // HH:MM
}

interface PlatformConfig {
  id: string
  bestTime: string
}

/**
 * Build a balanced weekly content plan from photos and platforms.
 *
 * Strategy:
 * - Each photo gets 2-3 cards (different angles)
 * - Platforms are rotated so no single platform dominates a day
 * - Preference scores influence which angles appear first
 * - Max 3 posts per day to avoid spamming
 */
export function buildQueuePlan(
  photoCount: number,
  platforms: PlatformConfig[],
  postsPerDay: number = 2,
  daysToFill: number = 7,
): QueueSlot[] {
  const slots: QueueSlot[] = []
  const maxSlots = postsPerDay * daysToFill

  // Build all possible photo×platform×angle combinations
  const combos: { photoIndex: number; platform: string; angle: ContentAngle; score: number }[] = []

  for (let pi = 0; pi < photoCount; pi++) {
    for (const plat of platforms) {
      // Pick 2 angles per photo-platform combo (top scoring ones)
      const scoredAngles = CONTENT_ANGLES.map(angle => ({
        angle,
        score: getPreferenceScore(plat.id, angle),
      })).sort((a, b) => b.score - a.score)

      // Take top 2 angles, but ensure variety
      const selected = scoredAngles.slice(0, 2)
      for (const { angle, score } of selected) {
        combos.push({ photoIndex: pi, platform: plat.id, angle, score })
      }
    }
  }

  // Sort by preference score (highest first), then shuffle within same score to add variety
  combos.sort((a, b) => {
    const scoreDiff = b.score - a.score
    if (Math.abs(scoreDiff) < 0.05) return Math.random() - 0.5
    return scoreDiff
  })

  // Distribute into day slots with balance constraints
  const dayPlatformCount: Record<number, Record<string, number>> = {}
  const dayPostCount: Record<number, number> = {}
  let currentDay = 0

  for (const combo of combos) {
    if (slots.length >= maxSlots) break

    // Find next available day for this platform (max 1 per platform per day)
    let day = currentDay
    let placed = false

    for (let attempt = 0; attempt < daysToFill; attempt++) {
      const dayKey = day % daysToFill
      const dayPosts = dayPostCount[dayKey] || 0
      const platCount = dayPlatformCount[dayKey]?.[combo.platform] || 0

      if (dayPosts < postsPerDay && platCount === 0) {
        // Place it
        const platConfig = platforms.find(p => p.id === combo.platform)
        slots.push({
          photoIndex: combo.photoIndex,
          platform: combo.platform,
          angle: combo.angle,
          dayOffset: dayKey,
          timeSlot: platConfig?.bestTime || '12:00',
        })

        dayPostCount[dayKey] = dayPosts + 1
        if (!dayPlatformCount[dayKey]) dayPlatformCount[dayKey] = {}
        dayPlatformCount[dayKey][combo.platform] = platCount + 1

        placed = true
        break
      }

      day++
    }

    if (placed) {
      // Rotate starting day to spread posts evenly
      currentDay = (currentDay + 1) % daysToFill
    }
  }

  // Sort by day offset, then time
  slots.sort((a, b) => a.dayOffset - b.dayOffset || a.timeSlot.localeCompare(b.timeSlot))

  return slots
}

/**
 * Build the system prompt for auto-queue generation.
 * Unlike the regular generate route which creates 3 variants per request,
 * this creates a single targeted caption for a specific angle.
 */
export function buildAutoQueuePrompt(opts: {
  businessType: string
  language: string
  platform: string
  angle: ContentAngle
  whatsappCTA: string
  exampleBlock: string
}): { system: string; user: string } {
  const angleInstructions: Record<ContentAngle, string> = {
    'Storytelling / Emotion': 'Erzaehl eine Geschichte rund ums Gericht oder die Atmosphaere. Wecke Emotionen, Hunger, Nostalgie oder Vorfreude.',
    'Wissen / Mehrwert': 'Teile einen konkreten Fakt, Tipp oder Hintergrund (Zutat, Herkunft, Zubereitungsart). Positioniere das Restaurant als Experte.',
    'Community / FOMO': 'Schaffe ein Gemeinschaftsgefuehl oder Dringlichkeit. Lokaler Bezug, begrenzte Verfuegbarkeit, oder ein Aufruf zur Teilhabe.',
    'Behind the Scenes': 'Zeige was hinter den Kulissen passiert. Kueche, Team, Zubereitung, Lieferanten. Authentisch und nahbar.',
    'Produkt-Highlight': 'Stelle ein konkretes Gericht oder Produkt in den Mittelpunkt. Beschreibe Geschmack, Textur, Zubereitung.',
  }

  const system = `Du bist ein Social-Media-Experte fuer ${opts.businessType || 'Restaurants'} im DACH-Raum.
Erstelle EINE Caption fuer ${opts.platform} mit dem Angle: ${opts.angle}.

ANWEISUNG: ${angleInstructions[opts.angle]}

REGELN:
- Sprache: ${opts.language || 'Deutsch'}
- Erster Satz = Hook (muss Feed-Scroll stoppen)
- 2-4 Saetze Body
- 1 CTA
${opts.whatsappCTA ? `- WhatsApp-CTA: ${opts.whatsappCTA}` : ''}
- 15-25 relevante Hashtags
${opts.exampleBlock}
Gib NUR gueltiges JSON zurueck:
{"caption": "...", "hashtags": ["tag1", "tag2"], "category": "${opts.angle}"}`

  return { system, user: '' } // user prompt is set per-photo in the API route
}

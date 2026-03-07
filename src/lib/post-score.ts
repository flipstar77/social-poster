/**
 * Post Score: Rate generated captions 0-100 based on quality signals.
 * Runs client-side, no API call needed.
 */

interface ScoreInput {
  caption: string
  hashtags: string[]
  platform: string
}

interface ScoreResult {
  score: number
  factors: { label: string; points: number; max: number }[]
}

// Platform-specific optimal lengths
const PLATFORM_LENGTHS: Record<string, { min: number; ideal: number; max: number }> = {
  instagram: { min: 50, ideal: 200, max: 2200 },
  tiktok: { min: 20, ideal: 100, max: 300 },
  facebook: { min: 40, ideal: 150, max: 500 },
  linkedin: { min: 100, ideal: 300, max: 1300 },
  x: { min: 20, ideal: 100, max: 280 },
  threads: { min: 20, ideal: 100, max: 500 },
  pinterest: { min: 50, ideal: 200, max: 500 },
  bluesky: { min: 20, ideal: 100, max: 300 },
  reddit: { min: 50, ideal: 200, max: 1000 },
  youtube: { min: 50, ideal: 200, max: 1000 },
}

const PLATFORM_HASHTAGS: Record<string, { min: number; ideal: number; max: number }> = {
  instagram: { min: 5, ideal: 20, max: 30 },
  tiktok: { min: 3, ideal: 5, max: 10 },
  facebook: { min: 0, ideal: 3, max: 10 },
  linkedin: { min: 3, ideal: 5, max: 10 },
  x: { min: 1, ideal: 2, max: 5 },
  threads: { min: 0, ideal: 3, max: 10 },
  pinterest: { min: 5, ideal: 10, max: 20 },
  bluesky: { min: 0, ideal: 2, max: 5 },
  reddit: { min: 0, ideal: 0, max: 3 },
  youtube: { min: 5, ideal: 10, max: 15 },
}

// CTA patterns (German + English)
const CTA_PATTERNS = [
  /(?:jetzt|sofort|gleich|direkt)\s/i,
  /(?:reservier|bestell|probier|schreib|ruf|komm|besuch|folg|like|teil|sag|zeig)/i,
  /(?:link in bio|link im profil)/i,
  /\?$/m, // ends with question (engagement)
  /(?:book|order|try|write|call|visit|follow|share|tell|show)/i,
  /(?:whatsapp|wa\.me)/i,
  /(?:markier|tag)\s/i,
]

// Hook quality patterns
const STRONG_HOOK_PATTERNS = [
  /^(?:POV|TIL|Fun fact|Wusstest du|Die meisten|Niemand|Jeder|Stopp|Achtung|Geheimnis|Secret)/i,
  /^.{0,3}[0-9]/, // starts with number
  /^"/, // starts with quote
  /^\S+\s\S+\s\S+[\.\?!]$/, // very short first sentence (punchy)
]

export function scorePost({ caption, hashtags, platform }: ScoreInput): ScoreResult {
  const factors: ScoreResult['factors'] = []
  const platLengths = PLATFORM_LENGTHS[platform] || PLATFORM_LENGTHS.instagram
  const platHashtags = PLATFORM_HASHTAGS[platform] || PLATFORM_HASHTAGS.instagram

  // 1. Hook strength (25 points)
  const firstLine = caption.split('\n')[0] || ''
  let hookScore = 10 // base
  if (firstLine.length > 5 && firstLine.length < 80) hookScore += 5 // good length
  if (STRONG_HOOK_PATTERNS.some(p => p.test(firstLine))) hookScore += 10 // strong pattern
  factors.push({ label: 'Hook', points: Math.min(hookScore, 25), max: 25 })

  // 2. Caption length (25 points)
  const len = caption.length
  let lengthScore = 0
  if (len >= platLengths.min && len <= platLengths.max) {
    const distFromIdeal = Math.abs(len - platLengths.ideal) / platLengths.ideal
    lengthScore = Math.round(25 * Math.max(0, 1 - distFromIdeal))
  }
  factors.push({ label: 'Laenge', points: lengthScore, max: 25 })

  // 3. CTA presence (20 points)
  const hasCTA = CTA_PATTERNS.some(p => p.test(caption))
  factors.push({ label: 'CTA', points: hasCTA ? 20 : 5, max: 20 })

  // 4. Hashtag quality (15 points)
  const tagCount = hashtags.length
  let hashScore = 0
  if (tagCount >= platHashtags.min && tagCount <= platHashtags.max) {
    const distFromIdeal = Math.abs(tagCount - platHashtags.ideal) / Math.max(platHashtags.ideal, 1)
    hashScore = Math.round(15 * Math.max(0, 1 - distFromIdeal * 0.5))
  } else if (tagCount > 0) {
    hashScore = 5
  }
  factors.push({ label: 'Hashtags', points: hashScore, max: 15 })

  // 5. Structure (15 points) - paragraphs, emojis, line breaks
  let structScore = 5 // base
  const lineBreaks = (caption.match(/\n/g) || []).length
  if (lineBreaks >= 2) structScore += 5 // well-structured
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(caption)
  if (hasEmoji) structScore += 5 // visual appeal
  factors.push({ label: 'Struktur', points: Math.min(structScore, 15), max: 15 })

  const score = factors.reduce((sum, f) => sum + f.points, 0)
  return { score: Math.min(score, 100), factors }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e' // green
  if (score >= 60) return '#eab308' // yellow
  if (score >= 40) return '#f97316' // orange
  return '#ef4444' // red
}

export function getScoreEmoji(score: number): string {
  if (score >= 80) return '🔥'
  if (score >= 60) return '👍'
  if (score >= 40) return '🤔'
  return '⚠️'
}

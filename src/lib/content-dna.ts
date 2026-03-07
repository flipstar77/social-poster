/**
 * Content DNA: Persistent style profile built from user's content patterns.
 * Stores aggregated signals from accepted/super-liked posts to inform
 * future AI generation with the user's preferred style.
 *
 * Stored in localStorage. Can be synced to Supabase later.
 */

const DNA_KEY = 'flowingpost-content-dna'

export interface ContentDNA {
  // Aggregated from accepted posts
  totalPosts: number
  superLikes: number

  // Tone signals
  avgCaptionLength: number
  usesEmojis: boolean
  usesQuestions: boolean

  // Category preferences (from preference learning)
  topCategories: string[]

  // Hook patterns that get super-liked
  favoriteHookStyles: string[]

  // Platform distribution
  platformMix: Record<string, number>

  // Best performing content angles
  topAngles: { angle: string; score: number }[]

  updatedAt: string
}

const DEFAULT_DNA: ContentDNA = {
  totalPosts: 0,
  superLikes: 0,
  avgCaptionLength: 0,
  usesEmojis: true,
  usesQuestions: true,
  topCategories: [],
  favoriteHookStyles: [],
  platformMix: {},
  topAngles: [],
  updatedAt: new Date().toISOString(),
}

export function loadDNA(): ContentDNA {
  try {
    const raw = localStorage.getItem(DNA_KEY)
    return raw ? { ...DEFAULT_DNA, ...JSON.parse(raw) } : { ...DEFAULT_DNA }
  } catch {
    return { ...DEFAULT_DNA }
  }
}

export function saveDNA(dna: ContentDNA): void {
  try {
    dna.updatedAt = new Date().toISOString()
    localStorage.setItem(DNA_KEY, JSON.stringify(dna))
  } catch {}
}

/**
 * Learn from an accepted post. Call this when a post is swiped right or super-liked.
 */
export function learnFromPost(opts: {
  caption: string
  hashtags: string[]
  platform: string
  category: string
  isSuperLike: boolean
}): void {
  const dna = loadDNA()

  dna.totalPosts++
  if (opts.isSuperLike) dna.superLikes++

  // Update average caption length
  dna.avgCaptionLength = Math.round(
    (dna.avgCaptionLength * (dna.totalPosts - 1) + opts.caption.length) / dna.totalPosts
  )

  // Track emoji usage
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(opts.caption)
  // Keep running average (> 60% = uses emojis)
  dna.usesEmojis = hasEmoji ? true : dna.totalPosts < 5 ? dna.usesEmojis : false

  // Track question usage
  const hasQuestion = /\?/.test(opts.caption)
  dna.usesQuestions = hasQuestion ? true : dna.totalPosts < 5 ? dna.usesQuestions : false

  // Platform mix
  dna.platformMix[opts.platform] = (dna.platformMix[opts.platform] || 0) + 1

  // Top categories (keep top 3)
  if (opts.category && opts.isSuperLike) {
    if (!dna.topCategories.includes(opts.category)) {
      dna.topCategories.push(opts.category)
    }
    // Move super-liked categories to front
    dna.topCategories.sort((a, b) => {
      if (a === opts.category) return -1
      if (b === opts.category) return 1
      return 0
    })
    dna.topCategories = dna.topCategories.slice(0, 3)
  }

  // Learn hook style from super-likes
  if (opts.isSuperLike) {
    const firstLine = opts.caption.split('\n')[0] || ''
    const hookStyle = classifyHookStyle(firstLine)
    if (hookStyle && !dna.favoriteHookStyles.includes(hookStyle)) {
      dna.favoriteHookStyles.push(hookStyle)
      dna.favoriteHookStyles = dna.favoriteHookStyles.slice(-5)
    }
  }

  saveDNA(dna)
}

function classifyHookStyle(hook: string): string {
  if (/^[0-9]/.test(hook)) return 'Zahlen-Hook'
  if (/\?$/.test(hook.trim())) return 'Frage-Hook'
  if (/^POV/i.test(hook)) return 'POV-Hook'
  if (/^"/.test(hook)) return 'Zitat-Hook'
  if (/^(Wusstest|Did you|Hast du)/i.test(hook)) return 'Wissens-Hook'
  if (/^(Stopp|Achtung|Warnung|Stop)/i.test(hook)) return 'Aufmerksamkeits-Hook'
  if (hook.length < 40) return 'Kurzer-Hook'
  return 'Story-Hook'
}

/**
 * Generate a style instruction block for AI prompts based on Content DNA.
 * Returns empty string if not enough data yet.
 */
export function getDNAPromptBlock(): string {
  const dna = loadDNA()

  if (dna.totalPosts < 10) return '' // Need at least 10 posts for meaningful patterns

  const lines: string[] = []
  lines.push('CONTENT-DNA DES NUTZERS (passe deinen Stil daran an):')

  lines.push(`- Bevorzugte Caption-Laenge: ~${dna.avgCaptionLength} Zeichen`)

  if (dna.usesEmojis) lines.push('- Nutzt gerne Emojis')
  else lines.push('- Bevorzugt wenige/keine Emojis')

  if (dna.usesQuestions) lines.push('- Stellt gerne Fragen in Captions')

  if (dna.topCategories.length > 0) {
    lines.push(`- Lieblings-Content-Typen: ${dna.topCategories.join(', ')}`)
  }

  if (dna.favoriteHookStyles.length > 0) {
    lines.push(`- Bevorzugte Hook-Stile: ${dna.favoriteHookStyles.join(', ')}`)
  }

  return lines.join('\n')
}

/**
 * Check if enough data has been collected to show DNA insights.
 */
export function hasDNAInsights(): boolean {
  const dna = loadDNA()
  return dna.totalPosts >= 5
}

/**
 * Get a summary of the user's Content DNA for display.
 */
export function getDNASummary(): {
  totalPosts: number
  superLikes: number
  avgLength: number
  topCategories: string[]
  hookStyles: string[]
  platformMix: { platform: string; count: number }[]
  maturity: 'new' | 'learning' | 'mature'
} {
  const dna = loadDNA()

  const maturity = dna.totalPosts < 10 ? 'new' : dna.totalPosts < 30 ? 'learning' : 'mature'

  const platformMix = Object.entries(dna.platformMix)
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalPosts: dna.totalPosts,
    superLikes: dna.superLikes,
    avgLength: dna.avgCaptionLength,
    topCategories: dna.topCategories,
    hookStyles: dna.favoriteHookStyles,
    platformMix,
    maturity,
  }
}

import type { ApifyInstagramPost, ApifyProfileResult } from '../apify/client'

export interface CityStats {
  city: string
  platform: string
  avgLikes: number
  avgComments: number
  avgEngagementRate: number
  medianFollowers: number
  avgPostingFrequency: number
  topHashtags: { tag: string; count: number }[]
  bestPostingHours: { hour: number; avgEngagement: number }[]
  topContentTypes: { type: string; percentage: number; avgEngagement: number }[]
  sampleSize: number
}

export interface AuditReport {
  handle: string
  city: string
  score: number
  scoreBreakdown: {
    frequency: number
    engagement: number
    hashtags: number
    contentMix: number
    consistency: number
  }
  stats: {
    totalPosts: number
    avgLikes: number
    avgComments: number
    engagementRate: number
    postingFrequency: number
    avgHashtagsPerPost: number
    contentMix: Record<string, number>
    bestPostingHour: number
  }
  comparison: {
    engagementVsCity: number // percentage difference
    frequencyVsCity: number
    hashtagsVsCity: number
  }
  topPosts: { url: string; likes: number; comments: number; reason: string }[]
  bottomPosts: { url: string; likes: number; comments: number; issue: string }[]
  recommendations: string[]
}

/** Aggregate posts into city-level statistics */
export function aggregateCityStats(
  city: string,
  posts: ApifyInstagramPost[]
): CityStats {
  if (posts.length === 0) {
    return {
      city,
      platform: 'instagram',
      avgLikes: 0,
      avgComments: 0,
      avgEngagementRate: 0,
      medianFollowers: 0,
      avgPostingFrequency: 0,
      topHashtags: [],
      bestPostingHours: [],
      topContentTypes: [],
      sampleSize: 0,
    }
  }

  const avgLikes = posts.reduce((sum, p) => sum + (p.likesCount ?? 0), 0) / posts.length
  const avgComments = posts.reduce((sum, p) => sum + (p.commentsCount ?? 0), 0) / posts.length

  // Hashtag frequency
  const hashtagCounts = new Map<string, number>()
  for (const post of posts) {
    for (const tag of post.hashtags ?? []) {
      const lower = tag.toLowerCase()
      hashtagCounts.set(lower, (hashtagCounts.get(lower) ?? 0) + 1)
    }
  }
  const topHashtags = [...hashtagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([tag, count]) => ({ tag, count }))

  // Best posting hours
  const hourEngagement = new Map<number, { total: number; count: number }>()
  for (const post of posts) {
    const hour = new Date(post.timestamp).getHours()
    const existing = hourEngagement.get(hour) ?? { total: 0, count: 0 }
    existing.total += post.likesCount + post.commentsCount
    existing.count++
    hourEngagement.set(hour, existing)
  }
  const bestPostingHours = [...hourEngagement.entries()]
    .map(([hour, { total, count }]) => ({ hour, avgEngagement: total / count }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)

  // Content type breakdown
  const typeCounts = new Map<string, { count: number; engagement: number }>()
  for (const post of posts) {
    const type = normalizeContentType(post.type)
    const existing = typeCounts.get(type) ?? { count: 0, engagement: 0 }
    existing.count++
    existing.engagement += post.likesCount + post.commentsCount
    typeCounts.set(type, existing)
  }
  const topContentTypes = [...typeCounts.entries()]
    .map(([type, { count, engagement }]) => ({
      type,
      percentage: (count / posts.length) * 100,
      avgEngagement: engagement / count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)

  return {
    city,
    platform: 'instagram',
    avgLikes: Math.round(avgLikes),
    avgComments: Math.round(avgComments * 10) / 10,
    avgEngagementRate: 0, // needs follower data per account
    medianFollowers: 0,
    avgPostingFrequency: 0, // needs per-account grouping
    topHashtags,
    bestPostingHours,
    topContentTypes,
    sampleSize: posts.length,
  }
}

/** Analyze a profile against city benchmarks and produce an audit report */
export function analyzeProfile(
  profile: ApifyProfileResult,
  cityStats: CityStats,
  city: string
): AuditReport {
  const posts = profile.latestPosts ?? []
  const handle = profile.username

  // Basic stats
  const avgLikes = posts.length > 0
    ? posts.reduce((s, p) => s + p.likesCount, 0) / posts.length
    : 0
  const avgComments = posts.length > 0
    ? posts.reduce((s, p) => s + p.commentsCount, 0) / posts.length
    : 0
  const engagementRate = profile.followersCount > 0
    ? ((avgLikes + avgComments) / profile.followersCount) * 100
    : 0

  // Posting frequency (posts per week based on date range)
  let postingFrequency = 0
  if (posts.length >= 2) {
    const dates = posts.map(p => new Date(p.timestamp).getTime()).sort()
    const rangeMs = dates[dates.length - 1] - dates[0]
    const rangeWeeks = rangeMs / (7 * 24 * 60 * 60 * 1000)
    postingFrequency = rangeWeeks > 0 ? posts.length / rangeWeeks : posts.length
  }

  // Hashtags per post
  const avgHashtags = posts.length > 0
    ? posts.reduce((s, p) => s + (p.hashtags?.length ?? 0), 0) / posts.length
    : 0

  // Content mix
  const contentMix: Record<string, number> = {}
  for (const post of posts) {
    const type = normalizeContentType(post.type)
    contentMix[type] = (contentMix[type] ?? 0) + 1
  }

  // Best posting hour
  const hourMap = new Map<number, number>()
  for (const post of posts) {
    const hour = new Date(post.timestamp).getHours()
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + post.likesCount + post.commentsCount)
  }
  const bestPostingHour = [...hourMap.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 12

  // Score breakdown (each 0-10)
  const frequencyScore = Math.min(10, (postingFrequency / 5) * 10) // 5x/week = 10
  const engagementScore = Math.min(10, (engagementRate / 5) * 10) // 5% = 10
  const hashtagScore = Math.min(10, (avgHashtags / 15) * 10) // 15 hashtags = 10
  const contentMixScore = Object.keys(contentMix).length >= 3 ? 8 : Object.keys(contentMix).length >= 2 ? 5 : 2
  const consistencyScore = postingFrequency >= 3 ? 8 : postingFrequency >= 1 ? 5 : 2

  const totalScore = (frequencyScore + engagementScore + hashtagScore + contentMixScore + consistencyScore) / 5

  // Comparison with city
  const engagementVsCity = cityStats.avgEngagementRate > 0
    ? ((engagementRate - cityStats.avgEngagementRate) / cityStats.avgEngagementRate) * 100
    : 0
  const frequencyVsCity = cityStats.avgPostingFrequency > 0
    ? ((postingFrequency - cityStats.avgPostingFrequency) / cityStats.avgPostingFrequency) * 100
    : 0

  // Top & bottom posts
  const sorted = [...posts].sort((a, b) => (b.likesCount + b.commentsCount) - (a.likesCount + a.commentsCount))
  const topPosts = sorted.slice(0, 3).map(p => ({
    url: p.url,
    likes: p.likesCount,
    comments: p.commentsCount,
    reason: inferTopReason(p),
  }))
  const bottomPosts = sorted.slice(-3).map(p => ({
    url: p.url,
    likes: p.likesCount,
    comments: p.commentsCount,
    issue: inferBottomIssue(p, avgLikes),
  }))

  // Recommendations
  const recommendations = generateRecommendations({
    postingFrequency,
    engagementRate,
    avgHashtags,
    contentMix,
    cityStats,
  })

  return {
    handle,
    city,
    score: Math.round(totalScore * 10) / 10,
    scoreBreakdown: {
      frequency: Math.round(frequencyScore * 10) / 10,
      engagement: Math.round(engagementScore * 10) / 10,
      hashtags: Math.round(hashtagScore * 10) / 10,
      contentMix: contentMixScore,
      consistency: consistencyScore,
    },
    stats: {
      totalPosts: posts.length,
      avgLikes: Math.round(avgLikes),
      avgComments: Math.round(avgComments * 10) / 10,
      engagementRate: Math.round(engagementRate * 100) / 100,
      postingFrequency: Math.round(postingFrequency * 10) / 10,
      avgHashtagsPerPost: Math.round(avgHashtags * 10) / 10,
      contentMix,
      bestPostingHour,
    },
    comparison: {
      engagementVsCity: Math.round(engagementVsCity),
      frequencyVsCity: Math.round(frequencyVsCity),
      hashtagsVsCity: 0,
    },
    topPosts,
    bottomPosts,
    recommendations,
  }
}

/** Segment a discovered restaurant account */
export function segmentRestaurant(
  engagementRate: number,
  postingFrequency: number
): 'struggling' | 'active_messy' | 'top_performer' {
  if (postingFrequency < 2 && engagementRate < 1) return 'struggling'
  if (engagementRate >= 3 && postingFrequency >= 3) return 'top_performer'
  return 'active_messy'
}

// --- Helpers ---

function normalizeContentType(type: string): string {
  const lower = type?.toLowerCase() ?? 'image'
  if (lower.includes('sidecar') || lower.includes('carousel')) return 'Karussell'
  if (lower.includes('video') || lower.includes('reel')) return 'Reel/Video'
  return 'Einzelbild'
}

function inferTopReason(post: ApifyInstagramPost): string {
  const type = normalizeContentType(post.type)
  if (type === 'Karussell') return 'Karussell-Format erzeugt hoehere Verweildauer'
  if (type === 'Reel/Video') return 'Video-Content wird vom Algorithmus bevorzugt'
  if ((post.hashtags?.length ?? 0) >= 15) return 'Gute Hashtag-Strategie (15+ Hashtags)'
  return 'Starkes visuelles Motiv'
}

function inferBottomIssue(post: ApifyInstagramPost, avgLikes: number): string {
  if (post.likesCount < avgLikes * 0.3) return 'Deutlich unter dem Durchschnitt — Timing oder Motiv pruefen'
  if ((post.hashtags?.length ?? 0) < 5) return 'Zu wenige Hashtags — Reichweite begrenzt'
  return 'Koennte von besserem Caption-Text profitieren'
}

function generateRecommendations(data: {
  postingFrequency: number
  engagementRate: number
  avgHashtags: number
  contentMix: Record<string, number>
  cityStats: CityStats
}): string[] {
  const recs: string[] = []

  if (data.postingFrequency < 3) {
    recs.push(`Posting-Frequenz erhoehen: Du postest ${data.postingFrequency.toFixed(1)}x/Woche — empfohlen sind 4-5x fuer Restaurants.`)
  }

  if (data.avgHashtags < 10) {
    recs.push(`Mehr Hashtags nutzen: Du verwendest ${data.avgHashtags.toFixed(0)} pro Post — 15-20 sind optimal fuer Restaurants.`)
  }

  if (!data.contentMix['Karussell'] || data.contentMix['Karussell'] < 2) {
    recs.push('Mehr Karussell-Posts: Diese haben im Schnitt 47% mehr Engagement als Einzelbilder.')
  }

  if (!data.contentMix['Reel/Video'] || data.contentMix['Reel/Video'] < 3) {
    recs.push('Mehr Reels posten: Video-Content wird vom Instagram-Algorithmus stark bevorzugt.')
  }

  if (data.engagementRate < 2) {
    recs.push('Engagement steigern: CTAs in Captions einbauen ("Markiere jemanden, der das probieren muss!").')
  }

  if (data.cityStats.topHashtags.length > 0) {
    const topCityTags = data.cityStats.topHashtags.slice(0, 5).map(t => `#${t.tag}`)
    recs.push(`Lokale Hashtags nutzen: Die Top-Hashtags in deiner Stadt sind ${topCityTags.join(', ')}.`)
  }

  // Always cap at 5
  return recs.slice(0, 5)
}

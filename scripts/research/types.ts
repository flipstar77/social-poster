/**
 * Shared types for the restaurant research pipeline.
 */

export interface RestaurantInput {
  handle: string      // Instagram username (without @)
  name?: string       // Display name (used for Google lookup)
  city: string        // 'Berlin' | 'Wien' | 'Zürich' | etc.
  category?: string   // 'restaurant' | 'cafe' | 'bar' | 'fast_food'
}

export interface ApifyPost {
  type?: string           // 'Image' | 'Video' | 'Sidecar'
  isReel?: boolean
  likesCount?: number
  commentsCount?: number
  timestamp?: string
  shortCode?: string
}

export interface ApifyProfileRaw {
  username?: string
  igUsername?: string
  name?: string
  fullName?: string
  biography?: string
  externalUrl?: string | null
  followersCount?: number
  followsCount?: number
  postsCount?: number
  highlightReelCount?: number
  latestPosts?: ApifyPost[]
}

export interface RestaurantProfile {
  handle: string
  name: string | null
  city: string
  category: string | null

  // Instagram metrics
  ig_followers: number | null
  ig_posts_count: number | null
  ig_has_bio_link: boolean | null
  ig_bio: string | null
  ig_highlights_count: number | null
  ig_avg_likes: number | null
  ig_avg_comments: number | null
  ig_reel_count: number | null
  ig_photo_count: number | null
  ig_carousel_count: number | null
  ig_posts_analyzed: number | null
  ig_posting_frequency_per_week: number | null  // based on last N posts
  ig_engagement_rate: number | null              // (likes+comments)/followers*100
  ig_reel_ratio: number | null                   // reels / total analyzed

  // Google metrics
  google_place_id: string | null
  google_rating: number | null
  google_review_count: number | null
  google_photos_count: number | null
  google_has_website: boolean | null
  google_hours_complete: boolean | null

  // Computed score 0–100
  ig_score: number | null
}

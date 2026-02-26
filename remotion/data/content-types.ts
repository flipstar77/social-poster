export type ReelType = 'text-only' | 'photo-reel'

export type StickerAnimation =
  | 'fly-left'    // enters from left
  | 'fly-right'   // enters from right
  | 'fly-top'     // drops from top
  | 'fly-bottom'  // rises from bottom
  | 'pop'         // scale 0 → 1.1 → 1.0
  | 'bounce'      // fly-top with overshoot bounce
  | 'spin-pop'    // rotate + scale in

export interface StickerConfig {
  id: string
  url: string
  x: number           // % from left (0-100)
  y: number           // % from top  (0-100)
  size: number        // % of canvas width (5-50)
  rotation?: number   // degrees, default 0
  animation: StickerAnimation
  delay?: number      // extra frames before appearing (0-60)
  phase?: 1 | 2 | 3  // which phase, default 1
}

export interface ReelContentConfig {
  id: string
  type: ReelType

  // Phase 1: Hook / Attention
  hook: string       // Short attention-grabber ("TODAY ONLY", "NEU!")
  title: string      // Main headline ("Hausgemachte Pasta")

  // Phase 2: Detail / Visual
  description: string   // Body text (multi-line)
  mediaUrl?: string     // Photo/video path/URL (photo-reel only)
  mediaType?: 'image' | 'video'  // Type of uploaded media

  // Phase 3: CTA
  ctaLabel: string      // Call-to-action ("Jetzt reservieren")
  ctaDetail?: string    // Optional detail ("Link in Bio", "Mo-Fr 11-22h")

  // Branding
  businessName?: string
  locale: 'de' | 'en'

  // Optional style overrides
  accentColor?: string

  // Text positioning (percentage 0-100, default 50/50 = center)
  textPosition?: { x: number; y: number }

  // Sticker images (product shots, decorations) with fly-in animations
  stickers?: StickerConfig[]
}

export type RestaurantTemplateId =
  | 'daily-special'
  | 'new-dish'
  | 'opening-hours'
  | 'event-announcement'
  | 'review-highlight'
  | 'behind-the-scenes'
  | 'seasonal-menu'
  | 'happy-hour'

export interface RestaurantTemplate {
  id: RestaurantTemplateId
  name: { de: string; en: string }
  description: { de: string; en: string }
  defaultContent: Partial<ReelContentConfig>
  suggestedStyles: number[] // Indices into STYLE_CONFIGS
  icon: string
}

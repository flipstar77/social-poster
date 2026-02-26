// ============================================================================
// STYLE CONFIG — Ported from video-studio StylePreviewRenderer
// 100% domain-agnostic visual configuration system
// ============================================================================

export type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'scale' | 'blur' | 'wipe' | 'glitch' | 'rotate'
export type TextAnimType = 'fade-up' | 'instant' | 'typewriter' | 'blur-in' | 'slide-in' | 'scale-in' | 'punch'
export type LayoutType = 'center' | 'left' | 'right' | 'split' | 'card'
export type BgPatternType = 'none' | 'grid' | 'dots' | 'scanlines' | 'diagonal' | 'circles'
export type OverlayType = 'none' | 'vignette' | 'border' | 'corner-marks' | 'glow-border'
export type PhotoPosition = 'full-bleed' | 'top-half' | 'left-half' | 'circle-center'

export interface StyleConfig {
  name: string
  bg1: string; bg2: string; gradAngle: number
  textPrimary: string; textSecondary: string; accent: string
  font: string; titleWeight: number; titleSize: number
  bodySize: number; letterSpacing: number; textTransform: string
  layout: LayoutType; transition: TransitionType
  textAnim: TextAnimType; bgPattern: BgPatternType
  overlay: OverlayType
  // Photo-reel specific
  photoPosition: PhotoPosition
  photoOverlayOpacity: number
}

// ====== CONFIG ARRAYS ======

export const PALETTES: [string, string, string, string, string, string][] = [
  // [name, bg1, bg2, textPrimary, textSecondary, accent]
  ['Midnight',  '#0a0a2e', '#151550', '#ffffff', '#94a3b8', '#06b6d4'],
  ['Ember',     '#1a0505', '#3d1010', '#ffffff', '#fca5a5', '#f97316'],
  ['Forest',    '#051a0a', '#0d3d1a', '#ffffff', '#86efac', '#22c55e'],
  ['Ocean',     '#0a1a2e', '#153050', '#ffffff', '#93c5fd', '#3b82f6'],
  ['Sunset',    '#2e1a0a', '#503015', '#ffffff', '#fde68a', '#f59e0b'],
  ['Arctic',    '#e8eef4', '#d0dbe8', '#111827', '#475569', '#0284c7'],
  ['Royal',     '#1a0a2e', '#301550', '#ffffff', '#c4b5fd', '#a855f7'],
  ['Coral',     '#2e0a0a', '#501818', '#ffffff', '#fda4af', '#f43f5e'],
  ['Jade',      '#0a2e1a', '#155030', '#ffffff', '#99f6e4', '#14b8a6'],
  ['Storm',     '#111111', '#222222', '#ffffff', '#a1a1aa', '#71717a'],
  ['Gold',      '#1a1505', '#3d3010', '#ffffff', '#fde68a', '#eab308'],
  ['Berry',     '#2e0a1a', '#501530', '#ffffff', '#f0abfc', '#d946ef'],
  ['Slate',     '#1e293b', '#334155', '#ffffff', '#94a3b8', '#64748b'],
  ['Lime',      '#0a1a05', '#1d3d10', '#ffffff', '#d9f99d', '#84cc16'],
  ['Copper',    '#2e1a0a', '#5e3a2a', '#ffffff', '#fed7aa', '#ea580c'],
  ['Ice',       '#f0f4ff', '#dbe4f8', '#111827', '#475569', '#2563eb'],
  ['Crimson',   '#2e0505', '#501010', '#ffffff', '#fecaca', '#dc2626'],
  ['Teal',      '#052828', '#0a4040', '#ffffff', '#99f6e4', '#0d9488'],
  ['Plum',      '#200a30', '#3d1560', '#ffffff', '#e9d5ff', '#9333ea'],
  ['Ash',       '#f5f0ea', '#e5ddd5', '#111827', '#57534e', '#78716c'],
  // Food / restaurant presets
  ['Flamingo',  '#c2185b', '#e91e63', '#ffffff', '#fce4ec', '#ff4081'],
  ['Mango',     '#e65100', '#f57c00', '#ffffff', '#fff3e0', '#ffab40'],
  ['Matcha',    '#1b5e20', '#2e7d32', '#ffffff', '#f1f8e9', '#69f0ae'],
  ['Vanilla',   '#f5f0e8', '#ede7d9', '#3e2723', '#6d4c41', '#ff8f00'],
]

export const FONTS = [
  "'Segoe UI', sans-serif",
  "'Consolas', monospace",
  "'Georgia', serif",
  "'Impact', sans-serif",
  "'Trebuchet MS', sans-serif",
  "'Courier New', monospace",
  "'Verdana', sans-serif",
  "'Tahoma', sans-serif",
  "'Times New Roman', serif",
  "'Arial Black', sans-serif",
]

export const TRANSITIONS: TransitionType[] = [
  'fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down',
  'scale', 'blur', 'wipe', 'glitch', 'rotate',
]

export const TEXT_ANIMS: TextAnimType[] = [
  'fade-up', 'instant', 'typewriter', 'blur-in', 'slide-in', 'scale-in',
]

export const LAYOUTS: LayoutType[] = ['center', 'left', 'right', 'split', 'card']

export const BG_PATTERNS: BgPatternType[] = ['none', 'grid', 'dots', 'scanlines', 'diagonal', 'circles']

export const OVERLAYS: OverlayType[] = ['none', 'vignette', 'border', 'corner-marks', 'glow-border']

export const TITLE_WEIGHTS = [300, 400, 600, 700, 800, 900]
export const TITLE_SIZES = [56, 64, 72, 80, 88, 96]
export const BODY_SIZES = [24, 28, 32, 36]
export const LETTER_SPACINGS = [-1, 0, 1, 2, 4, 6, 8]

export const PHOTO_POSITIONS: PhotoPosition[] = ['full-bleed', 'top-half', 'left-half', 'circle-center']
export const PHOTO_OVERLAY_OPACITIES = [0.3, 0.4, 0.5, 0.6, 0.7]

// Style categories for the picker UI
export const STYLE_CATEGORIES = {
  warm:    { label: { de: 'Warm', en: 'Warm' }, paletteIndices: [1, 4, 7, 10, 14] },     // Ember, Sunset, Coral, Gold, Copper
  cool:    { label: { de: 'Modern', en: 'Cool' }, paletteIndices: [0, 3, 5, 15, 17] },   // Midnight, Ocean, Arctic, Ice, Teal
  nature:  { label: { de: 'Natur', en: 'Nature' }, paletteIndices: [2, 8, 13] },          // Forest, Jade, Lime
  bold:    { label: { de: 'Bold', en: 'Bold' }, paletteIndices: [6, 11, 16, 18] },        // Royal, Berry, Crimson, Plum
  minimal: { label: { de: 'Minimal', en: 'Minimal' }, paletteIndices: [9, 12, 19] },      // Storm, Slate, Ash
} as const

export type StyleCategoryKey = keyof typeof STYLE_CATEGORIES

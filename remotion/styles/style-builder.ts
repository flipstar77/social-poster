// ============================================================================
// STYLE BUILDER — Builds a StyleConfig from simple user choices
// Instead of picking from 200 pre-generated styles, the user selects:
//   - Palette (color theme)
//   - Font
//   - Animation
//   - Layout
// This function fills in sensible defaults for everything else.
// ============================================================================

import type { StyleConfig, TextAnimType, LayoutType, TransitionType, BgPatternType, PhotoPosition } from './style-config'
import { PALETTES, FONTS } from './style-config'

export interface UserStyleChoices {
  paletteIndex: number    // 0-19
  fontIndex: number       // 0-9
  animation: TextAnimType
  layout: LayoutType
  titleSize?: number      // 40-120, default 80
  photoOverlayOpacity?: number  // 0.1-0.8, default 0.5
  bgPattern?: BgPatternType     // default 'dots'
  photoPosition?: PhotoPosition // default 'full-bleed'
}

// Map text animations to matching transitions
const ANIM_TO_TRANSITION: Record<TextAnimType, TransitionType> = {
  'fade-up': 'slide-up',
  'instant': 'fade',
  'typewriter': 'fade',
  'blur-in': 'blur',
  'slide-in': 'slide-left',
  'scale-in': 'scale',
  'punch': 'scale',
}

export function buildStyleConfig(choices: UserStyleChoices): StyleConfig {
  const p = PALETTES[choices.paletteIndex] ?? PALETTES[0]
  const font = FONTS[choices.fontIndex] ?? FONTS[0]

  return {
    name: `custom-${p[0]}`,
    bg1: p[1],
    bg2: p[2],
    gradAngle: 135,
    textPrimary: p[3],
    textSecondary: p[4],
    accent: p[5],
    font,
    titleWeight: 700,
    titleSize: choices.titleSize ?? 80,
    bodySize: Math.round((choices.titleSize ?? 80) * 0.4),
    letterSpacing: 1,
    textTransform: 'none',
    layout: choices.layout,
    transition: ANIM_TO_TRANSITION[choices.animation],
    textAnim: choices.animation,
    bgPattern: choices.bgPattern ?? 'dots',
    overlay: 'vignette',
    photoPosition: choices.photoPosition ?? 'full-bleed',
    photoOverlayOpacity: choices.photoOverlayOpacity ?? 0.5,
  }
}

// User-friendly labels for the editor UI
export const PALETTE_LABELS: Record<string, { de: string; en: string }> = {
  0:  { de: 'Mitternacht', en: 'Midnight' },
  1:  { de: 'Glut', en: 'Ember' },
  2:  { de: 'Wald', en: 'Forest' },
  3:  { de: 'Ozean', en: 'Ocean' },
  4:  { de: 'Sonnenuntergang', en: 'Sunset' },
  5:  { de: 'Arktis', en: 'Arctic' },
  6:  { de: 'Royal', en: 'Royal' },
  7:  { de: 'Koralle', en: 'Coral' },
  8:  { de: 'Jade', en: 'Jade' },
  9:  { de: 'Sturm', en: 'Storm' },
  10: { de: 'Gold', en: 'Gold' },
  11: { de: 'Beere', en: 'Berry' },
  12: { de: 'Schiefer', en: 'Slate' },
  13: { de: 'Limette', en: 'Lime' },
  14: { de: 'Kupfer', en: 'Copper' },
  15: { de: 'Eis', en: 'Ice' },
  16: { de: 'Karmin', en: 'Crimson' },
  17: { de: 'Petrol', en: 'Teal' },
  18: { de: 'Pflaume', en: 'Plum' },
  19: { de: 'Asche', en: 'Ash' },
  20: { de: 'Flamingo', en: 'Flamingo' },
  21: { de: 'Mango', en: 'Mango' },
  22: { de: 'Matcha', en: 'Matcha' },
  23: { de: 'Vanille', en: 'Vanilla' },
}

export const FONT_LABELS = [
  'Segoe UI',
  'Consolas',
  'Georgia',
  'Impact',
  'Trebuchet',
  'Courier',
  'Verdana',
  'Tahoma',
  'Times',
  'Arial Black',
]

export const ANIMATION_LABELS: Record<TextAnimType, { de: string; en: string }> = {
  'fade-up':    { de: 'Hochgleiten', en: 'Fade Up' },
  'instant':    { de: 'Sofort', en: 'Instant' },
  'typewriter': { de: 'Tippen', en: 'Typewriter' },
  'blur-in':    { de: 'Unschärfe', en: 'Blur In' },
  'slide-in':   { de: 'Reinsliden', en: 'Slide In' },
  'scale-in':   { de: 'Reinzoomen', en: 'Scale In' },
  'punch':      { de: 'Match & Move', en: 'Match & Move' },
}

export const LAYOUT_LABELS: Record<LayoutType, { de: string; en: string; icon: string }> = {
  'center': { de: 'Zentriert', en: 'Center', icon: '⊡' },
  'left':   { de: 'Links', en: 'Left', icon: '⊢' },
  'right':  { de: 'Rechts', en: 'Right', icon: '⊣' },
  'card':   { de: 'Karte', en: 'Card', icon: '▢' },
  'split':  { de: 'Geteilt', en: 'Split', icon: '◧' },
}

export const BG_PATTERN_LABELS: Record<BgPatternType, { de: string; en: string }> = {
  'none':      { de: 'Keins', en: 'None' },
  'dots':      { de: 'Punkte', en: 'Dots' },
  'grid':      { de: 'Raster', en: 'Grid' },
  'scanlines': { de: 'Scanlines', en: 'Scanlines' },
  'diagonal':  { de: 'Diagonal', en: 'Diagonal' },
  'circles':   { de: 'Kreise', en: 'Circles' },
}

export const PHOTO_POSITION_LABELS: Record<PhotoPosition, { de: string; en: string; icon: string }> = {
  'full-bleed':    { de: 'Vollbild', en: 'Full', icon: '▣' },
  'top-half':      { de: 'Oben', en: 'Top', icon: '⬒' },
  'left-half':     { de: 'Links', en: 'Left', icon: '◧' },
  'circle-center': { de: 'Kreis', en: 'Circle', icon: '◉' },
}

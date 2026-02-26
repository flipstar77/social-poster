// ============================================================================
// STYLE GENERATOR — Deterministic 200-style configuration generator
// Ported from video-studio, extended with photo-reel support
// ============================================================================

import type { StyleConfig } from './style-config'
import {
  PALETTES, FONTS, TRANSITIONS, TEXT_ANIMS, LAYOUTS,
  BG_PATTERNS, OVERLAYS, TITLE_WEIGHTS, TITLE_SIZES,
  BODY_SIZES, LETTER_SPACINGS, PHOTO_POSITIONS, PHOTO_OVERLAY_OPACITIES,
} from './style-config'

// ====== DETERMINISTIC HASH PICKER ======

function pick<T>(arr: T[], index: number, salt: number): T {
  let h = (index * 2654435761 + salt * 2246822519) >>> 0
  h = (((h >>> 16) ^ h) * 0x45d9f3b) >>> 0
  h = (((h >>> 16) ^ h) * 0x45d9f3b) >>> 0
  h = ((h >>> 16) ^ h) >>> 0
  return arr[h % arr.length]
}

// ====== GENERATE 200 CONFIGS ======

function generateConfigs(): StyleConfig[] {
  const configs: StyleConfig[] = []
  for (let i = 0; i < 200; i++) {
    const p = PALETTES[i % 20]
    configs.push({
      name: `${p[0]}-${String(i + 1).padStart(3, '0')}`,
      bg1: p[1], bg2: p[2], gradAngle: (i * 37) % 360,
      textPrimary: p[3], textSecondary: p[4], accent: p[5],
      font: pick(FONTS, i, 1),
      titleWeight: pick(TITLE_WEIGHTS, i, 2),
      titleSize: pick(TITLE_SIZES, i, 3),
      bodySize: pick(BODY_SIZES, i, 4),
      letterSpacing: pick(LETTER_SPACINGS, i, 5),
      textTransform: pick(['none', 'uppercase', 'uppercase', 'none'] as const, i, 6),
      layout: pick(LAYOUTS, i, 7),
      transition: pick(TRANSITIONS, i, 8),
      textAnim: pick(TEXT_ANIMS, i, 9),
      bgPattern: pick(BG_PATTERNS, i, 10),
      overlay: pick(OVERLAYS, i, 12),
      photoPosition: pick(PHOTO_POSITIONS, i, 13),
      photoOverlayOpacity: pick(PHOTO_OVERLAY_OPACITIES, i, 14),
    })
  }
  return configs
}

export const STYLE_CONFIGS = generateConfigs()
export const STYLE_COUNT = 200

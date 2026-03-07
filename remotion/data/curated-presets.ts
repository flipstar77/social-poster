// ============================================================================
// CURATED PRESETS — Handverlesene Style+Content Kombinationen fuer Instagram
// Jedes Preset ist eine getestete Kombination die gut aussieht.
// ============================================================================

import type { UserStyleChoices } from '../styles/style-builder'
import type { ReelContentConfig, RestaurantTemplateId } from './content-types'

export interface CuratedPreset {
  id: string
  name: { de: string; en: string }
  category: RestaurantTemplateId
  style: UserStyleChoices
  defaultContent: Partial<ReelContentConfig>
  thumbnail?: string // future: preview image path
}

// ── 1. TAGESMENU — Warm, appetitlich, Foto fullscreen ──────────────────────
// Ember palette + Georgia serif + fade-up + center + full-bleed photo
// Der Klassiker: Foto vom Gericht im Hintergrund, Text darueber
export const PRESET_TAGESMENU: CuratedPreset = {
  id: 'tagesmenu-ember',
  name: { de: 'Tagesmenu Classic', en: 'Daily Special Classic' },
  category: 'daily-special',
  style: {
    paletteIndex: 1,        // Ember (warm reds)
    fontIndex: 2,           // Georgia (elegant serif)
    animation: 'fade-up',   // smooth text reveal
    layout: 'center',
    titleSize: 88,
    photoPosition: 'full-bleed',
    photoOverlayOpacity: 0.45,
    bgPattern: 'none',
    textStroke: true,        // readability on photo
    aspectRatio: '9:16',
    progressBar: true,
  },
  defaultContent: {
    type: 'photo-reel',
    hook: 'TAGESMENU',
    title: 'Hausgemachte\nPasta',
    description: 'Frische Tagliatelle mit\nTrueffel-Rahmsauce\nund Parmesan',
    ctaLabel: 'Heute ab 11:30 Uhr',
    ctaDetail: 'NUR SOLANGE DER VORRAT REICHT',
    locale: 'de',
  },
}

// ── 2. HAPPY HOUR — Energisch, FOMO, bold ──────────────────────────────────
// Mango palette + Impact + punch + center + full-bleed
// Grosse fette Schrift, energische Animation, Dringlichkeit
export const PRESET_HAPPY_HOUR: CuratedPreset = {
  id: 'happy-hour-mango',
  name: { de: 'Happy Hour Bold', en: 'Happy Hour Bold' },
  category: 'happy-hour',
  style: {
    paletteIndex: 21,       // Mango (vibrant orange)
    fontIndex: 3,           // Impact (bold, attention)
    animation: 'punch',     // dramatic scale-in
    layout: 'center',
    titleSize: 96,
    photoPosition: 'full-bleed',
    photoOverlayOpacity: 0.55,
    bgPattern: 'none',
    textStroke: true,
    gradientText: true,      // gradient on title
    aspectRatio: '9:16',
    progressBar: true,
  },
  defaultContent: {
    type: 'photo-reel',
    hook: 'HAPPY HOUR',
    title: '2 for 1\nCocktails',
    description: 'Jeden Freitag\n17:00 - 20:00\nAlle Cocktails zum halben Preis',
    ctaLabel: 'Diesen Freitag ab 17 Uhr',
    ctaDetail: 'RESERVIERE DEINEN TISCH',
    locale: 'de',
  },
}

// ── 3. NEUE SORTE — Elegant, minimalistisch, premium ───────────────────────
// Vanilla palette + Georgia + blur-in + card layout
// Heller Look, Karten-Layout, elegant und clean
export const PRESET_NEUE_SORTE: CuratedPreset = {
  id: 'neue-sorte-vanilla',
  name: { de: 'Neue Sorte Premium', en: 'New Item Premium' },
  category: 'new-dish',
  style: {
    paletteIndex: 23,       // Vanilla (warm light)
    fontIndex: 2,           // Georgia (serif elegance)
    animation: 'blur-in',   // dreamy reveal
    layout: 'card',
    titleSize: 72,
    photoPosition: 'top-half',
    photoOverlayOpacity: 0.3,
    bgPattern: 'dots',
    aspectRatio: '9:16',
    progressBar: true,
  },
  defaultContent: {
    type: 'photo-reel',
    hook: 'NEU IM SORTIMENT',
    title: 'Matcha\nTiramisu',
    description: 'Japanischer Matcha trifft\nitalienischen Klassiker.\nAb sofort auf der Karte.',
    ctaLabel: 'Komm vorbei und probiere!',
    ctaDetail: 'LIMITED EDITION',
    locale: 'de',
  },
}

// ── 4. ANGEBOT/DEAL — Rot, urgent, Preis-fokussiert ────────────────────────
// Crimson palette + Arial Black + shake + center
// Aggressive Farben, wackelnde Animation = Aufmerksamkeit
export const PRESET_ANGEBOT: CuratedPreset = {
  id: 'angebot-crimson',
  name: { de: 'Angebot Alarm', en: 'Deal Alert' },
  category: 'daily-special',
  style: {
    paletteIndex: 16,       // Crimson (deep red urgency)
    fontIndex: 9,           // Arial Black (bold impact)
    animation: 'shake',     // attention-grabbing shake
    layout: 'center',
    titleSize: 100,
    photoPosition: 'full-bleed',
    photoOverlayOpacity: 0.6,
    bgPattern: 'scanlines',  // retro urgency feel
    textStroke: true,
    aspectRatio: '9:16',
    progressBar: true,
  },
  defaultContent: {
    type: 'photo-reel',
    hook: 'NUR HEUTE',
    title: '-30%\nauf alles',
    description: 'Unser Dankeschoen\nan euch!\nAuf die gesamte Karte.',
    ctaLabel: 'Nur heute gueltig',
    ctaDetail: 'CODE: DANKE30',
    locale: 'de',
  },
}

// ── 5. EVENT — Party-Vibe, dunkel, Datum prominent ─────────────────────────
// Royal palette + Trebuchet + scale-in + split layout
// Lila/Gold Vibe, modern, Event-Fokus
export const PRESET_EVENT: CuratedPreset = {
  id: 'event-royal',
  name: { de: 'Event Night', en: 'Event Night' },
  category: 'event-announcement',
  style: {
    paletteIndex: 6,        // Royal (purple/gold)
    fontIndex: 4,           // Trebuchet (modern sans)
    animation: 'scale-in',  // elegant zoom
    layout: 'center',
    titleSize: 80,
    photoPosition: 'full-bleed',
    photoOverlayOpacity: 0.5,
    bgPattern: 'circles',    // party atmosphere
    gradientText: true,
    aspectRatio: '9:16',
    progressBar: true,
  },
  defaultContent: {
    type: 'photo-reel',
    hook: 'SAVE THE DATE',
    title: 'Wine &\nDine Night',
    description: 'Samstag, 15. Maerz\n19:00 Uhr\n5-Gaenge-Menue mit\nWeinbegleitung',
    ctaLabel: 'Nur 40 Plaetze',
    ctaDetail: 'JETZT RESERVIEREN',
    locale: 'de',
  },
}

// ── 6. BEWERTUNG — Testimonial, clean, vertrauenswuerdig ───────────────────
// Ocean palette + Segoe UI + typewriter + left layout
// Serioes, Reviews hervorheben, Sterne-Feeling
export const PRESET_BEWERTUNG: CuratedPreset = {
  id: 'bewertung-ocean',
  name: { de: 'Kundenstimme', en: 'Customer Review' },
  category: 'review-highlight',
  style: {
    paletteIndex: 3,        // Ocean (trust blue)
    fontIndex: 0,           // Segoe UI (clean, readable)
    animation: 'typewriter', // quote being typed
    layout: 'left',
    titleSize: 64,
    photoPosition: 'circle-center',
    photoOverlayOpacity: 0.3,
    bgPattern: 'grid',       // subtle structure
    aspectRatio: '9:16',
    progressBar: true,
  },
  defaultContent: {
    type: 'photo-reel',
    hook: '5 STERNE AUF GOOGLE',
    title: '"Das beste\nRestaurant\nin der Stadt"',
    description: '- Maria K.\nStammgast seit 2023\n\n"Jedes Mal aufs Neue\nbegeistert!"',
    ctaLabel: 'Ueberzeug dich selbst',
    ctaDetail: 'LINK IN BIO',
    locale: 'de',
  },
}

// ── 7. BEHIND THE SCENES — Authentisch, warm, Matcha ───────────────────────
// Matcha palette + Tahoma + slide-in + right layout
// Natuerlich, Kuechenfoto, persoenlich
export const PRESET_BEHIND_SCENES: CuratedPreset = {
  id: 'bts-matcha',
  name: { de: 'Hinter den Kulissen', en: 'Behind the Scenes' },
  category: 'behind-the-scenes',
  style: {
    paletteIndex: 22,       // Matcha (natural green)
    fontIndex: 7,           // Tahoma (friendly, approachable)
    animation: 'slide-in',  // casual reveal
    layout: 'right',
    titleSize: 72,
    photoPosition: 'left-half',
    photoOverlayOpacity: 0.3,
    bgPattern: 'dots',
    aspectRatio: '9:16',
    progressBar: true,
  },
  defaultContent: {
    type: 'photo-reel',
    hook: 'BEHIND THE SCENES',
    title: 'So entsteht\nunser Brot',
    description: 'Jeden Morgen ab 5 Uhr\nbackt unser Team\nfrisches Sauerteigbrot.\nMit Liebe gemacht.',
    ctaLabel: 'Frisch ab 7 Uhr morgens',
    ctaDetail: 'KOMM VORBEI',
    locale: 'de',
  },
}

// ── 8. SEASONAL — Festlich, Gold, premium Feeling ──────────────────────────
// Gold palette + Times serif + blur-in + card
// Saisonale Karte, festlich, Weihnachten/Ostern/Sommer etc.
export const PRESET_SEASONAL: CuratedPreset = {
  id: 'seasonal-gold',
  name: { de: 'Saisonkarte Gold', en: 'Seasonal Menu Gold' },
  category: 'seasonal-menu',
  style: {
    paletteIndex: 10,       // Gold (luxurious)
    fontIndex: 8,           // Times New Roman (classic)
    animation: 'blur-in',   // dreamlike reveal
    layout: 'center',
    titleSize: 80,
    photoPosition: 'full-bleed',
    photoOverlayOpacity: 0.5,
    bgPattern: 'diagonal',   // subtle elegance
    textStroke: true,
    gradientText: true,       // gold gradient on title
    aspectRatio: '9:16',
    progressBar: true,
  },
  defaultContent: {
    type: 'photo-reel',
    hook: 'FRUEHLINGSMENUE',
    title: 'Neue\nSaisonkarte',
    description: 'Frische Zutaten\naus der Region.\n12 neue Gerichte\nab sofort.',
    ctaLabel: 'Ab diesem Wochenende',
    ctaDetail: 'RESERVIERE JETZT',
    locale: 'de',
  },
}

// ── ALL PRESETS ─────────────────────────────────────────────────────────────

export const CURATED_PRESETS: CuratedPreset[] = [
  PRESET_TAGESMENU,
  PRESET_HAPPY_HOUR,
  PRESET_NEUE_SORTE,
  PRESET_ANGEBOT,
  PRESET_EVENT,
  PRESET_BEWERTUNG,
  PRESET_BEHIND_SCENES,
  PRESET_SEASONAL,
]

// Group by category for UI
export const PRESET_CATEGORIES = [
  { id: 'food', label: { de: 'Essen & Trinken', en: 'Food & Drinks' }, presetIds: ['tagesmenu-ember', 'neue-sorte-vanilla', 'seasonal-gold'] },
  { id: 'promo', label: { de: 'Aktionen', en: 'Promotions' }, presetIds: ['happy-hour-mango', 'angebot-crimson'] },
  { id: 'social', label: { de: 'Community', en: 'Community' }, presetIds: ['bewertung-ocean', 'bts-matcha'] },
  { id: 'events', label: { de: 'Events', en: 'Events' }, presetIds: ['event-royal'] },
] as const

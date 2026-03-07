// Pre-built starter templates for FlowingPost
// Each template includes style choices + content defaults
// Stickers are user-uploaded — positions are pre-configured but URLs left empty

import type { UserStyleChoices } from '../../remotion/styles/style-builder'
import type { ReelContentConfig, StickerConfig } from '../../remotion/data/content-types'

export interface PresetTemplate {
  id: string
  name: { de: string; en: string }
  description: { de: string; en: string }
  category: 'eisdiele' | 'restaurant' | 'cafe' | 'bakery' | 'immobilien'
  emoji: string
  choices: UserStyleChoices
  contentDefaults: Partial<Pick<ReelContentConfig, 'hook' | 'title' | 'description' | 'ctaLabel' | 'ctaDetail'>>
  // Pre-configured sticker positions (user uploads the actual PNG images)
  stickerDefaults?: Omit<StickerConfig, 'url'>[]
  stickerHint?: { de: string; en: string }
}

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'eisdiele-neue-sorte',
    name: { de: 'Neue Sorte', en: 'New Flavor' },
    description: { de: 'Für Eisdielen — neue Geschmackssorte ankündigen', en: 'For ice cream shops — announce a new flavor' },
    category: 'eisdiele',
    emoji: '🍦',
    choices: {
      paletteIndex: 20,   // Flamingo — hot pink
      fontIndex: 2,        // Georgia — elegant serif, like the Canva Strawberry font
      animation: 'punch',  // Match & Move: title grows from tiny to full width
      layout: 'center',
      titleSize: 110,
      photoOverlayOpacity: 0.0,  // no overlay — product image is a sticker (PNG cutout)
      bgPattern: 'none',
      photoPosition: 'full-bleed',
    },
    contentDefaults: {
      hook: 'NEW FLAVOR',
      title: 'Strawberry',
      description: 'Fresh & creamy\nNow available',
      ctaLabel: 'Try it now',
      ctaDetail: 'While supplies last',
    },
    // Ice cream cone centered + strawberries fly in from sides at the punch moment
    stickerDefaults: [
      { id: 'product', x: 50, y: 68, size: 38, animation: 'pop',        delay: 5,  phase: 1 },
      { id: 'berry-1', x: 18, y: 52, size: 18, animation: 'fly-left',   delay: 65, phase: 1, rotation: -15 },
      { id: 'berry-2', x: 82, y: 48, size: 16, animation: 'fly-right',  delay: 70, phase: 1, rotation: 12 },
      { id: 'berry-3', x: 28, y: 72, size: 13, animation: 'fly-bottom', delay: 72, phase: 1, rotation: -8 },
      { id: 'berry-4', x: 75, y: 70, size: 14, animation: 'fly-bottom', delay: 68, phase: 1, rotation: 6 },
    ],
    stickerHint: {
      de: 'Lade 5 PNGs hoch: 1× Produkt (Eis) + 4× Deko (z.B. Erdbeeren). Die Sticker fliegen automatisch rein wenn der Titel wächst.',
      en: 'Upload 5 PNGs: 1× product (ice cream) + 4× decoration (e.g. strawberries). Stickers fly in automatically as the title grows.',
    },
  },
  {
    id: 'restaurant-tagesgericht',
    name: { de: 'Tagesgericht', en: 'Daily Special' },
    description: { de: 'Tagesangebot mit Foto des Gerichts', en: 'Daily special with dish photo' },
    category: 'restaurant',
    emoji: '🍽️',
    choices: {
      paletteIndex: 14,   // Copper — warm, food-like
      fontIndex: 0,        // Segoe UI — clean
      animation: 'fade-up',
      layout: 'center',
      titleSize: 80,
      photoOverlayOpacity: 0.45,
      bgPattern: 'none',
      photoPosition: 'full-bleed',
    },
    contentDefaults: {
      hook: 'TAGESGERICHT',
      title: 'Pasta al Pomodoro',
      description: 'Frische Tomaten, Basilikum\nHausgemachte Pasta',
      ctaLabel: 'Heute bei uns',
      ctaDetail: '11:30 – 14:30 Uhr',
    },
  },
  {
    id: 'cafe-happy-hour',
    name: { de: 'Happy Hour', en: 'Happy Hour' },
    description: { de: 'Rabattaktion oder Happy Hour ankündigen', en: 'Announce a discount or happy hour' },
    category: 'cafe',
    emoji: '☕',
    choices: {
      paletteIndex: 10,   // Gold — warm premium
      fontIndex: 3,        // Impact
      animation: 'blur-in',
      layout: 'center',
      titleSize: 88,
      photoOverlayOpacity: 0.4,
      bgPattern: 'dots',
      photoPosition: 'full-bleed',
    },
    contentDefaults: {
      hook: 'NUR HEUTE',
      title: '2 für 1',
      description: 'Alle Kaffeespezialitäten\nzum halben Preis',
      ctaLabel: 'Schnell sein lohnt sich',
      ctaDetail: '15:00 – 18:00 Uhr',
    },
  },
  {
    id: 'bakery-neuheit',
    name: { de: 'Neuheit', en: 'New Item' },
    description: { de: 'Neues Produkt in der Bäckerei vorstellen', en: 'Introduce a new bakery product' },
    category: 'bakery',
    emoji: '🥐',
    choices: {
      paletteIndex: 23,   // Vanilla — warm, light
      fontIndex: 2,        // Georgia — classic bakery feel
      animation: 'fade-up',
      layout: 'center',
      titleSize: 84,
      photoOverlayOpacity: 0.35,
      bgPattern: 'none',
      photoPosition: 'full-bleed',
    },
    contentDefaults: {
      hook: 'AB SOFORT',
      title: 'Croissant au Beurre',
      description: 'Buttrig, knusprig\nfrisch jeden Morgen',
      ctaLabel: 'Jetzt kosten',
      ctaDetail: 'Ab 6:00 Uhr',
    },
  },

  // ── IMMOBILIEN ──────────────────────────────────────────────────────────
  {
    id: 'immobilie-listing',
    name: { de: 'Neues Listing', en: 'New Listing' },
    description: { de: 'Wohnung / Haus vorstellen — Preis, m², Zimmer', en: 'Introduce a property — price, sqm, rooms' },
    category: 'immobilien',
    emoji: '🏠',
    choices: {
      paletteIndex: 5,    // Arctic — clean, bright, professional
      fontIndex: 0,       // Segoe UI — trustworthy, modern
      animation: 'fade-up',
      layout: 'left',
      titleSize: 88,
      photoOverlayOpacity: 0.5,
      bgPattern: 'none',
      photoPosition: 'full-bleed',
      textStroke: true,   // readable on any photo
      progressBar: true,
    },
    contentDefaults: {
      hook: '📍 Berlin Mitte',
      title: '3 Zimmer · 89 m²',
      description: 'Helle Altbauwohnung\nBalkon · EBK · Aufzug\n\n€ 485.000',
      ctaLabel: 'Jetzt anfragen',
      ctaDetail: 'Link in Bio',
    },
  },
  {
    id: 'immobilien-tipp',
    name: { de: 'Immobilien-Tipp', en: 'Property Tip' },
    description: { de: 'Reichweite durch nützliche Tipps für Käufer/Verkäufer', en: 'Reach through useful buyer/seller tips' },
    category: 'immobilien',
    emoji: '💡',
    choices: {
      paletteIndex: 0,    // Midnight — premium, serious
      fontIndex: 2,       // Georgia — authoritative
      animation: 'blur-in',
      layout: 'center',
      titleSize: 82,
      photoOverlayOpacity: 0.6,
      bgPattern: 'dots',
      photoPosition: 'full-bleed',
      progressBar: true,
    },
    contentDefaults: {
      hook: 'WUSSTEST DU?',
      title: 'Kaufnebenkosten\nsind verhandelbar',
      description: 'Grunderwerbsteuer, Notar & Makler\nmachen bis zu 15% des Kaufpreises aus.\n\nSo sparst du bares Geld.',
      ctaLabel: 'Mehr Tipps in Bio',
      ctaDetail: 'Folge für tägliche Insights',
    },
  },
  {
    id: 'immobilie-verkauft',
    name: { de: 'Verkauft!', en: 'Sold!' },
    description: { de: 'Social Proof — erfolgreich verkaufte Immobilie feiern', en: 'Social proof — celebrate a successful sale' },
    category: 'immobilien',
    emoji: '✅',
    choices: {
      paletteIndex: 2,    // Forest — success, growth
      fontIndex: 3,       // Impact — punchy
      animation: 'punch',
      layout: 'center',
      titleSize: 100,
      photoOverlayOpacity: 0.55,
      bgPattern: 'none',
      photoPosition: 'full-bleed',
      gradientText: false,
      progressBar: false,
    },
    contentDefaults: {
      hook: '🎉 ERFOLGREICH VERMITTELT',
      title: 'VERKAUFT',
      description: 'Innerhalb von 18 Tagen\nzum Wunschpreis verkauft.\n\nGlückwunsch an unsere Kunden!',
      ctaLabel: 'Du möchtest auch verkaufen?',
      ctaDetail: 'Kostenlose Bewertung — Link in Bio',
    },
  },
]

export const CATEGORY_LABELS: Record<PresetTemplate['category'], { de: string; en: string; emoji: string }> = {
  eisdiele:    { de: 'Eisdiele', en: 'Ice Cream', emoji: '🍦' },
  restaurant:  { de: 'Restaurant', en: 'Restaurant', emoji: '🍽️' },
  cafe:        { de: 'Café', en: 'Café', emoji: '☕' },
  bakery:      { de: 'Bäckerei', en: 'Bakery', emoji: '🥐' },
  immobilien:  { de: 'Immobilien', en: 'Real Estate', emoji: '🏠' },
}

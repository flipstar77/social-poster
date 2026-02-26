import type { RestaurantTemplate } from './content-types'

export const RESTAURANT_TEMPLATES: RestaurantTemplate[] = [
  {
    id: 'daily-special',
    name: { de: 'Tagesangebot', en: 'Daily Special' },
    description: {
      de: 'Tagesgericht oder Mittagsangebot bewerben',
      en: 'Promote your daily dish or lunch deal',
    },
    defaultContent: {
      type: 'photo-reel',
      hook: 'TODAY ONLY',
      title: 'Daily Special',
      description: 'Fresh from the kitchen\nMade with love',
      ctaLabel: 'Reserve Now',
      ctaDetail: 'Link in Bio',
    },
    suggestedStyles: [1, 4, 10, 14, 19], // Warm palette styles (Ember, Sunset, Gold, Copper)
    icon: '🍽️',
  },
  {
    id: 'new-dish',
    name: { de: 'Neues Gericht', en: 'New Dish' },
    description: {
      de: 'Ein neues Gericht auf der Karte vorstellen',
      en: 'Introduce a new dish on your menu',
    },
    defaultContent: {
      type: 'photo-reel',
      hook: 'NEW',
      title: 'New on the Menu',
      description: 'Discover our latest creation',
      ctaLabel: 'Try It Today',
    },
    suggestedStyles: [2, 8, 13, 17], // Nature (Forest, Jade, Lime, Teal)
    icon: '✨',
  },
  {
    id: 'opening-hours',
    name: { de: 'Öffnungszeiten', en: 'Opening Hours' },
    description: {
      de: 'Öffnungszeiten oder Sonderzeiten teilen',
      en: 'Share opening hours or special schedules',
    },
    defaultContent: {
      type: 'text-only',
      hook: 'VISIT US',
      title: 'Opening Hours',
      description: 'Mon-Fri: 11:00 - 22:00\nSat-Sun: 10:00 - 23:00',
      ctaLabel: 'See You Soon',
    },
    suggestedStyles: [5, 15, 9, 12], // Cool/Minimal (Arctic, Ice, Storm, Slate)
    icon: '🕐',
  },
  {
    id: 'event-announcement',
    name: { de: 'Event', en: 'Event' },
    description: {
      de: 'Live-Musik, Themenabend oder Special Event',
      en: 'Live music, theme night, or special event',
    },
    defaultContent: {
      type: 'text-only',
      hook: 'SAVE THE DATE',
      title: 'Special Event',
      description: 'Join us for an unforgettable evening',
      ctaLabel: 'Book Your Table',
    },
    suggestedStyles: [6, 11, 16, 18], // Bold (Royal, Berry, Crimson, Plum)
    icon: '🎉',
  },
  {
    id: 'review-highlight',
    name: { de: 'Bewertung', en: 'Review' },
    description: {
      de: 'Eine tolle Kundenbewertung teilen',
      en: 'Share a great customer review',
    },
    defaultContent: {
      type: 'text-only',
      hook: '⭐⭐⭐⭐⭐',
      title: 'What Our Guests Say',
      description: '"Absolutely amazing food\nand wonderful service!"',
      ctaLabel: 'Visit Us',
    },
    suggestedStyles: [10, 4, 14, 0], // Gold, Sunset, Copper, Midnight
    icon: '⭐',
  },
  {
    id: 'behind-the-scenes',
    name: { de: 'Hinter den Kulissen', en: 'Behind the Scenes' },
    description: {
      de: 'Einblick in die Küche oder das Team',
      en: 'A peek into the kitchen or your team',
    },
    defaultContent: {
      type: 'photo-reel',
      hook: 'BEHIND THE SCENES',
      title: 'From Our Kitchen',
      description: 'Where the magic happens',
      ctaLabel: 'Follow Us',
    },
    suggestedStyles: [9, 12, 19], // Minimal (Storm, Slate, Ash)
    icon: '👨‍🍳',
  },
  {
    id: 'seasonal-menu',
    name: { de: 'Saisonkarte', en: 'Seasonal Menu' },
    description: {
      de: 'Neue Saisonkarte oder saisonale Gerichte',
      en: 'New seasonal menu or seasonal dishes',
    },
    defaultContent: {
      type: 'photo-reel',
      hook: 'NEW SEASON',
      title: 'Seasonal Menu',
      description: 'Fresh, local, seasonal\nTaste the difference',
      ctaLabel: 'Explore Menu',
    },
    suggestedStyles: [2, 8, 13, 4], // Nature + Warm
    icon: '🍂',
  },
  {
    id: 'happy-hour',
    name: { de: 'Happy Hour', en: 'Happy Hour' },
    description: {
      de: 'Happy Hour oder Drink-Angebote bewerben',
      en: 'Promote happy hour or drink specials',
    },
    defaultContent: {
      type: 'text-only',
      hook: 'HAPPY HOUR',
      title: 'Cheers!',
      description: 'All cocktails 50% off\nEvery Friday 17-19h',
      ctaLabel: 'Join Us',
    },
    suggestedStyles: [6, 11, 16, 7], // Bold + Coral
    icon: '🍹',
  },
]

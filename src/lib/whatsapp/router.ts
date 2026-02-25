export interface RouterConfig {
  greetingMessage: string
  openingHours: string | null
  menuUrl: string | null
  keywords: Record<string, string>
}

const GREETING_TRIGGERS = ['hallo', 'hi', 'hey', 'moin', 'servus', 'guten tag', 'hello']
const MENU_TRIGGERS = ['speisekarte', 'menu', 'karte', 'essen', 'gerichte']
const HOURS_TRIGGERS = ['öffnungszeiten', 'offen', 'geöffnet', 'wann', 'aufgemacht']
const BOOKING_TRIGGERS = ['reservieren', 'reservierung', 'tisch', 'buchen', 'buchung']

function matches(text: string, triggers: string[]): boolean {
  return triggers.some(t => text.includes(t))
}

export function routeMessage(text: string, config: RouterConfig): string {
  const lower = text.toLowerCase().trim()

  // Greetings
  if (matches(lower, GREETING_TRIGGERS)) {
    return config.greetingMessage
  }

  // Menu
  if (matches(lower, MENU_TRIGGERS)) {
    return config.menuUrl
      ? `Hier findest du unsere Speisekarte: ${config.menuUrl}`
      : 'Unsere Speisekarte ist gerade nicht online verfügbar. Schau gerne bei uns vorbei!'
  }

  // Opening hours
  if (matches(lower, HOURS_TRIGGERS)) {
    return config.openingHours
      ? `Unsere Öffnungszeiten:\n${config.openingHours}`
      : 'Unsere Öffnungszeiten sind gerade nicht hinterlegt. Schau gerne auf unserer Website vorbei!'
  }

  // Booking (Phase 3 placeholder)
  if (matches(lower, BOOKING_TRIGGERS)) {
    return 'Reservierungen über WhatsApp sind bald verfügbar! Ruf uns gerne direkt an.'
  }

  // Custom keywords
  for (const [keyword, response] of Object.entries(config.keywords)) {
    if (lower.includes(keyword.toLowerCase())) {
      return response
    }
  }

  // Fallback
  return 'Danke für deine Nachricht! Wir melden uns so schnell wie möglich.'
}

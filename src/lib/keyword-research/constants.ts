/**
 * Keyword research constants — German + English intent classification
 * and expansion strategies for Google Autocomplete mining.
 */

// --- Intent classification word lists ---

export const COMMERCIAL_WORDS = new Set([
  // English
  "best", "buy", "cheap", "cheapest", "price", "pricing", "cost",
  "review", "reviews", "vs", "versus", "compare", "comparison",
  "top", "affordable", "discount", "deal", "deals", "coupon",
  "worth", "alternative", "alternatives", "subscription", "plan",
  // German
  "beste", "bester", "bestes", "kaufen", "guenstig", "günstig",
  "billig", "preis", "preise", "kosten", "bewertung", "bewertungen",
  "vergleich", "vergleichen", "rabatt", "angebot", "angebote",
  "empfehlung", "empfehlungen", "testsieger", "erfahrungen",
  "lohnt", "alternativ", "alternativen",
])

export const TRANSACTIONAL_WORDS = new Set([
  // English
  "buy", "purchase", "order", "shop", "booking", "book", "hire",
  "download", "get", "sign up", "signup", "register", "subscribe",
  "free trial", "demo", "quote", "estimate",
  // German
  "kaufen", "bestellen", "buchen", "reservieren", "anmelden",
  "registrieren", "herunterladen", "abonnieren", "testen",
  "kostenlos", "gratis", "probe", "anfrage",
])

export const INFORMATIONAL_WORDS = new Set([
  // English
  "how", "what", "why", "when", "where", "who", "which",
  "guide", "tutorial", "tips", "learn", "example", "examples",
  "meaning", "definition", "explained", "difference",
  // German
  "wie", "was", "warum", "wann", "wo", "wer", "welche", "welcher",
  "anleitung", "tipps", "lernen", "beispiel", "beispiele",
  "bedeutung", "definition", "erklaert", "erklärt", "unterschied",
])

// --- Question prefixes for expansion ---

export const QUESTION_PREFIXES_EN = [
  "how to", "what is", "what are", "where to", "when to",
  "why do", "why is", "can you", "can i", "does", "is",
  "should i", "which", "how much", "how many",
]

export const QUESTION_PREFIXES_DE = [
  "wie kann man", "was ist", "was sind", "wo kann man", "wann",
  "warum", "kann man", "sollte man", "welche", "welcher",
  "wie viel", "wie viele", "wie macht man",
]

export const ALPHABET = "abcdefghijklmnopqrstuvwxyz"

// Google Autocomplete endpoint (free, no API key needed)
export const GOOGLE_SUGGEST_URL = "https://suggestqueries.google.com/complete/search"

// Batching config to avoid rate-limiting
export const BATCH_SIZE = 10
export const BATCH_DELAY_MS = 300

export type KeywordIntent = "commercial" | "transactional" | "informational"

export interface KeywordResult {
  keyword: string
  source: string
  intent: KeywordIntent
  words: number
  chars: number
}

export interface ResearchResult {
  seed: string
  keywords: KeywordResult[]
  summary: {
    total: number
    commercial: number
    transactional: number
    informational: number
  }
}

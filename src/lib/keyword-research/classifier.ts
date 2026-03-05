import {
  COMMERCIAL_WORDS,
  TRANSACTIONAL_WORDS,
  INFORMATIONAL_WORDS,
  type KeywordIntent,
} from "./constants"

const MULTI_WORD_PATTERNS: { pattern: string; intent: KeywordIntent }[] = [
  { pattern: "free trial", intent: "transactional" },
  { pattern: "sign up", intent: "transactional" },
  { pattern: "kostenlos testen", intent: "transactional" },
  { pattern: "jetzt buchen", intent: "transactional" },
  { pattern: "how to", intent: "informational" },
  { pattern: "what is", intent: "informational" },
  { pattern: "wie kann man", intent: "informational" },
  { pattern: "was ist", intent: "informational" },
  { pattern: "best for", intent: "commercial" },
  { pattern: "beste fuer", intent: "commercial" },
  { pattern: "beste für", intent: "commercial" },
]

export function classifyIntent(keyword: string): KeywordIntent {
  const lower = keyword.toLowerCase()
  const words = new Set(lower.split(/\s+/))

  // Check single-word matches (transactional > commercial > informational)
  for (const word of words) {
    if (TRANSACTIONAL_WORDS.has(word)) return "transactional"
  }
  for (const word of words) {
    if (COMMERCIAL_WORDS.has(word)) return "commercial"
  }
  for (const word of words) {
    if (INFORMATIONAL_WORDS.has(word)) return "informational"
  }

  // Check multi-word patterns
  for (const { pattern, intent } of MULTI_WORD_PATTERNS) {
    if (lower.includes(pattern)) return intent
  }

  return "informational"
}

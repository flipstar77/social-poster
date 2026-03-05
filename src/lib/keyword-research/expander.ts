import {
  ALPHABET,
  BATCH_DELAY_MS,
  BATCH_SIZE,
  GOOGLE_SUGGEST_URL,
  QUESTION_PREFIXES_DE,
  QUESTION_PREFIXES_EN,
  type KeywordResult,
  type ResearchResult,
} from "./constants"
import { classifyIntent } from "./classifier"

async function fetchSuggestions(query: string): Promise<string[]> {
  try {
    const url = new URL(GOOGLE_SUGGEST_URL)
    url.searchParams.set("client", "firefox")
    url.searchParams.set("q", query)

    const resp = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10_000),
    })

    if (!resp.ok) return []

    const data = await resp.json()
    if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) {
      return data[1].filter((s: unknown): s is string => typeof s === "string")
    }
  } catch {
    // Timeout or network error — skip silently
  }
  return []
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface ExpansionTask {
  source: string
  query: string
}

export async function expandKeyword(seed: string, lang: "de" | "en" = "de"): Promise<ResearchResult> {
  const seedClean = seed.trim().toLowerCase()
  const keywords = new Map<string, KeywordResult>()

  const questionPrefixes = lang === "de"
    ? [...QUESTION_PREFIXES_DE, ...QUESTION_PREFIXES_EN]
    : [...QUESTION_PREFIXES_EN, ...QUESTION_PREFIXES_DE]

  // Build all expansion tasks
  const tasks: ExpansionTask[] = [
    // Direct suggestions
    { source: "direct", query: seedClean },
    // Alphabet expansion: "seed a", "seed b", ...
    ...Array.from(ALPHABET).map((letter) => ({
      source: "alpha",
      query: `${seedClean} ${letter}`,
    })),
    // Question expansion
    ...questionPrefixes.map((prefix) => ({
      source: "question",
      query: `${prefix} ${seedClean}`,
    })),
    // Wildcard
    { source: "wildcard", query: `* ${seedClean}` },
    { source: "wildcard", query: `${seedClean} *` },
  ]

  // Execute in batches
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map((task) => fetchSuggestions(task.query))
    )

    for (let j = 0; j < batch.length; j++) {
      const source = batch[j].source
      for (const kw of results[j]) {
        const lower = kw.toLowerCase().trim()
        if (lower && !keywords.has(lower)) {
          keywords.set(lower, {
            keyword: lower,
            source,
            intent: classifyIntent(lower),
            words: lower.split(/\s+/).length,
            chars: lower.length,
          })
        }
      }
    }

    // Delay between batches to avoid rate-limiting
    if (i + BATCH_SIZE < tasks.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  const sorted = Array.from(keywords.values()).sort(
    (a, b) => b.words - a.words
  )

  return {
    seed: seedClean,
    keywords: sorted,
    summary: {
      total: sorted.length,
      commercial: sorted.filter((k) => k.intent === "commercial").length,
      transactional: sorted.filter((k) => k.intent === "transactional").length,
      informational: sorted.filter((k) => k.intent === "informational").length,
    },
  }
}

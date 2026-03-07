/**
 * Automatically discover restaurants with Instagram handles.
 *
 * Flow:
 *  1. Google Places Text Search: "restaurant {city}"
 *  2. Filter: rating >= 4.0, reviews >= 30
 *  3. Fetch Place Details → get website URL
 *  4. Scrape website for instagram.com link → extract handle
 *  5. Save to data/restaurants.json
 *
 * Usage:
 *   npx tsx scripts/research/discover-restaurants.ts
 *   npx tsx scripts/research/discover-restaurants.ts --per-city 15 --min-rating 4.2
 *
 * Requires: GOOGLE_PLACES_API_KEY in .env.local
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const args = process.argv.slice(2)
const perCity = parseInt(args[args.indexOf('--per-city') + 1]) || 40
const minRating = parseFloat(args[args.indexOf('--min-rating') + 1]) || 4.0
const minReviews = parseInt(args[args.indexOf('--min-reviews') + 1]) || 30
const cityOverride = args.includes('--city') ? args[args.indexOf('--city') + 1] : null

const KEY = process.env.GOOGLE_PLACES_API_KEY
if (!KEY) {
  console.error('❌ GOOGLE_PLACES_API_KEY not set')
  process.exit(1)
}

const DEFAULT_CITIES = [
  { name: 'Berlin', target: 40 },
  { name: 'Wien', target: 30 },
  { name: 'Zürich', target: 30 },
]

const CITIES = cityOverride
  ? [{ name: cityOverride, target: perCity }]
  : DEFAULT_CITIES

const SEARCH_QUERIES = [
  'restaurant',
  'café',
  'bar restaurant',
  'pizzeria',
  'sushi restaurant',
  'burger restaurant',
  'döner kebab',
  'vietnamesisch restaurant',
  'griechisch restaurant',
  'thai restaurant',
  'indisch restaurant',
  'cocktail bar',
  'weinbar',
  'vegan restaurant',
  'brunch café',
  'steakhouse',
]

interface PlaceResult {
  place_id: string
  name: string
  rating?: number
  user_ratings_total?: number
}

interface PlaceDetails {
  place_id: string
  name: string
  website?: string
  formatted_address?: string
}

async function searchPlaces(query: string, city: string, pagetoken?: string): Promise<{ results: PlaceResult[]; next_page_token?: string }> {
  const q = encodeURIComponent(`${query} ${city}`)
  let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&language=de&key=${KEY}`
  if (pagetoken) url += `&pagetoken=${pagetoken}`

  try {
    const res = await fetch(url)
    const data = await res.json() as { status: string; results: PlaceResult[]; next_page_token?: string }
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.log(`   ⚠️  Places API: ${data.status}`)
    }
    return { results: data.results ?? [], next_page_token: data.next_page_token }
  } catch {
    return { results: [] }
  }
}

async function getWebsite(placeId: string): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website&key=${KEY}`
  try {
    const res = await fetch(url)
    const data = await res.json() as { status: string; result?: PlaceDetails }
    return data.result?.website ?? null
  } catch {
    return null
  }
}

async function extractInstagramHandle(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    const html = await res.text()

    // Match instagram.com/handle patterns
    const patterns = [
      /instagram\.com\/([a-zA-Z0-9._]{2,30})(?:\/|"|'|\s|>)/g,
      /instagram\.com\/([\w.]+)/g,
    ]

    for (const pattern of patterns) {
      const matches = [...html.matchAll(pattern)]
      for (const m of matches) {
        const handle = m[1]?.toLowerCase()
        // Filter out common non-handles and file paths
        const blocked = ['p', 'reel', 'explore', 'accounts', 'sharer', 'share', 'tv', 'wix', 'wordpress', 'facebook', 'twitter', 'tiktok', 'youtube', 'google']
        if (handle && !blocked.includes(handle) && !handle.includes('.php') && !handle.includes('.js') && /^[a-z0-9._]{2,30}$/.test(handle)) {
          return handle
        }
      }
    }
    return null
  } catch {
    return null
  }
}

function detectCategory(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('café') || n.includes('cafe') || n.includes('kaffee') || n.includes('coffee')) return 'cafe'
  if (n.includes('bar') || n.includes('pub') || n.includes('lounge')) return 'bar'
  if (n.includes('pizza') || n.includes('burger') || n.includes('kebab') || n.includes('döner') || n.includes('sushi')) return 'fast_food'
  return 'restaurant'
}

async function main() {
  console.log('🔍 Restaurant Discovery\n')
  console.log(`Settings: ${perCity}/city, min rating ${minRating}, min reviews ${minReviews}\n`)

  const existing: Array<{ handle: string; name: string; city: string; category: string }> = []

  // Load existing if present (to avoid duplicates across runs)
  const outPath = path.join(process.cwd(), 'data', 'restaurants.json')
  if (fs.existsSync(outPath)) {
    const prev = JSON.parse(fs.readFileSync(outPath, 'utf-8'))
    existing.push(...prev)
    console.log(`Loaded ${existing.length} existing restaurants\n`)
  }

  const existingHandles = new Set(existing.map(r => r.handle))
  const allNew: typeof existing = []

  for (const { name: city, target } of CITIES) {
    console.log(`\n📍 ${city} (target: ${target})`)

    const cityResults = new Map<string, PlaceResult & { name: string }>()

    // Search with multiple queries to get variety
    for (const q of SEARCH_QUERIES) {
      if (cityResults.size >= Math.max(target * 5, 200)) break // enough candidates

      const { results } = await searchPlaces(q, city)
      await new Promise(r => setTimeout(r, 300)) // rate limit

      for (const r of results) {
        if (!cityResults.has(r.place_id)) {
          cityResults.set(r.place_id, { ...r, name: r.name })
        }
      }
    }

    // Filter by rating + reviews
    const candidates = [...cityResults.values()]
      .filter(p => (p.rating ?? 0) >= minRating && (p.user_ratings_total ?? 0) >= minReviews)
      .sort((a, b) => (b.user_ratings_total ?? 0) - (a.user_ratings_total ?? 0))

    console.log(`   ${candidates.length} candidates after filtering`)

    let found = 0
    for (const place of candidates) {
      if (found >= target) break

      process.stdout.write(`   ${place.name} (${place.rating}⭐, ${place.user_ratings_total} reviews)... `)
      await new Promise(r => setTimeout(r, 200))

      // Get website
      const website = await getWebsite(place.place_id)
      if (!website) {
        console.log('no website')
        continue
      }

      // Find Instagram handle
      const handle = await extractInstagramHandle(website)
      if (!handle) {
        console.log('no IG')
        continue
      }

      if (existingHandles.has(handle)) {
        console.log(`duplicate (@${handle})`)
        continue
      }

      existingHandles.add(handle)
      const entry = {
        handle,
        name: place.name,
        city,
        category: detectCategory(place.name),
      }
      allNew.push(entry)
      existing.push(entry)
      found++
      console.log(`✅ @${handle}`)
    }

    console.log(`   → ${found} restaurants with IG handle found`)
  }

  // Save
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(existing, null, 2), 'utf-8')

  console.log(`\n✅ Total: ${existing.length} restaurants saved to data/restaurants.json`)
  console.log(`   New this run: ${allNew.length}`)
  console.log(`\nNext step: Run Apify with these handles, then:`)
  console.log(`   npx tsx scripts/research/import-apify.ts --file apify-output.json --restaurants data/restaurants.json`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

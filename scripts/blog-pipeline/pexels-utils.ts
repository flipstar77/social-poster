/**
 * Pexels API utilities for fetching stock photos for blog articles.
 *
 * Searches Pexels for relevant images based on article keywords,
 * returns CDN URLs + photographer attribution.
 *
 * API docs: https://www.pexels.com/api/documentation/
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const PEXELS_API_KEY = process.env.PEXELS_API_KEY!

interface PexelsPhoto {
  id: number
  width: number
  height: number
  url: string // Pexels page URL
  photographer: string
  photographer_url: string
  src: {
    original: string
    large2x: string // 1880px wide
    large: string   // 940px wide
    medium: string  // 350px height
    small: string   // 130px height
    landscape: string // 1200x627
    tiny: string    // 280x200
  }
}

interface PexelsSearchResponse {
  total_results: number
  page: number
  per_page: number
  photos: PexelsPhoto[]
}

export interface BlogImage {
  url: string           // large2x for hero display
  urlMedium: string     // medium for listing thumbnails
  urlLandscape: string  // landscape for OG/social
  photographer: string
  photographerUrl: string
  pexelsUrl: string     // link to photo on Pexels
}

/**
 * Search Pexels for photos matching a query.
 */
async function searchPhotos(query: string, options: { perPage?: number; orientation?: 'landscape' | 'portrait' | 'square'; page?: number } = {}): Promise<PexelsPhoto[]> {
  const { perPage = 5, orientation = 'landscape', page = 1 } = options
  const params = new URLSearchParams({
    query,
    per_page: String(perPage),
    orientation,
    page: String(page),
  })

  const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: PEXELS_API_KEY },
  })

  if (!res.ok) {
    throw new Error(`Pexels API error: ${res.status} ${res.statusText}`)
  }

  const data = (await res.json()) as PexelsSearchResponse
  return data.photos
}

/**
 * Build search queries from article keyword + category.
 * Each article gets unique queries based on its specific keyword,
 * with category-based fallbacks.
 */
function buildSearchQueries(keyword: string, category: string): string[] {
  const queries: string[] = []

  // Primary: extract meaningful words from the keyword itself
  const stopWords = new Set(['für', 'der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'mit', 'von', 'zu', 'im', 'in', 'am', 'an', 'auf', 'so', 'wie', 'ohne', 'pro', 'woche', 'dein', 'restaurant', 'restaurants'])
  const kwWords = keyword.toLowerCase()
    .replace(/[^a-zäöüß\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))

  // Build a keyword-specific restaurant query
  if (kwWords.length > 0) {
    queries.push(`restaurant ${kwWords.slice(0, 3).join(' ')}`)
  }

  // Category-specific queries (diverse per category)
  const categoryQueries: Record<string, string[]> = {
    'Instagram': ['restaurant phone food photography', 'social media cafe table', 'food photo smartphone'],
    'TikTok': ['chef cooking kitchen video', 'restaurant kitchen action', 'food preparation behind scenes'],
    'Google Maps': ['restaurant entrance exterior sign', 'google maps phone local business', 'restaurant storefront street'],
    'SEO': ['restaurant laptop digital marketing', 'local business website search', 'cafe owner working computer'],
    'Strategie': ['restaurant owner planning table', 'cafe business strategy meeting', 'food business team working'],
  }

  const catQueries = categoryQueries[category] || categoryQueries['Strategie']
  queries.push(...catQueries)

  // Generic fallback
  queries.push('restaurant dining food')

  return queries
}

// Track used photo IDs across a single run to avoid duplicates
const usedPhotoIds = new Set<number>()

/**
 * Fetch a hero image for a blog article.
 * Tries multiple search queries and avoids previously used photos.
 */
export async function fetchHeroImage(keyword: string, category: string, excludeIds: number[] = []): Promise<BlogImage | null> {
  if (!PEXELS_API_KEY) {
    console.log('   [pexels] No API key — skipping image fetch')
    return null
  }

  // Merge exclusions: both explicit + session-tracked
  const allExcluded = new Set([...usedPhotoIds, ...excludeIds])
  const queries = buildSearchQueries(keyword, category)

  for (const query of queries) {
    // Try multiple pages to find unique images
    for (const page of [1, 2]) {
      try {
        const photos = await searchPhotos(query, { perPage: 5, orientation: 'landscape', page })
        if (photos.length === 0) continue

        // Pick the first landscape photo not already used
        const photo = photos.find(p => p.width > p.height && !allExcluded.has(p.id))
          || photos.find(p => !allExcluded.has(p.id))

        if (!photo) continue

        usedPhotoIds.add(photo.id)

        return {
          url: photo.src.large2x,
          urlMedium: photo.src.medium,
          urlLandscape: photo.src.landscape,
          photographer: photo.photographer,
          photographerUrl: photo.photographer_url,
          pexelsUrl: photo.url,
        }
      } catch (err) {
        console.log(`   [pexels] Search "${query}" p${page} failed: ${(err as Error).message}`)
      }
    }
  }

  return null
}

/**
 * CLI: test image search for a keyword
 * Usage: npx tsx scripts/blog-pipeline/pexels-utils.ts "restaurant instagram"
 */
if (require.main === module) {
  const query = process.argv.slice(2).join(' ') || 'restaurant food'
  console.log(`Searching Pexels for: "${query}"\n`)

  searchPhotos(query, { perPage: 3, orientation: 'landscape' }).then(photos => {
    for (const p of photos) {
      console.log(`  ${p.photographer}: ${p.src.large2x}`)
      console.log(`  Pexels: ${p.url}\n`)
    }
    if (photos.length === 0) console.log('  No results found.')
  }).catch(err => {
    console.error('Error:', err.message)
  })
}

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
async function searchPhotos(query: string, options: { perPage?: number; orientation?: 'landscape' | 'portrait' | 'square' } = {}): Promise<PexelsPhoto[]> {
  const { perPage = 5, orientation = 'landscape' } = options
  const params = new URLSearchParams({
    query,
    per_page: String(perPage),
    orientation,
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
 * Tries specific query first, then falls back to broader terms.
 */
function buildSearchQueries(keyword: string, category: string): string[] {
  const queries: string[] = []

  // Category-specific food/restaurant queries
  const categoryMap: Record<string, string[]> = {
    'Instagram': ['restaurant food photography', 'chef cooking kitchen', 'restaurant social media'],
    'TikTok': ['restaurant kitchen cooking', 'food preparation chef', 'cafe interior modern'],
    'Google Maps': ['restaurant exterior storefront', 'restaurant interior dining', 'local restaurant street'],
    'SEO': ['restaurant website laptop', 'local business marketing', 'restaurant digital marketing'],
    'Strategie': ['restaurant owner planning', 'cafe business meeting', 'restaurant team working'],
  }

  // Primary: keyword-inspired (gastro-focused)
  const kwLower = keyword.toLowerCase()
  if (kwLower.includes('instagram') || kwLower.includes('social media')) {
    queries.push('restaurant food social media photography')
  } else if (kwLower.includes('google') || kwLower.includes('maps') || kwLower.includes('bewertung')) {
    queries.push('restaurant storefront sign')
  } else if (kwLower.includes('seo') || kwLower.includes('website')) {
    queries.push('restaurant website tablet')
  } else if (kwLower.includes('tiktok') || kwLower.includes('video')) {
    queries.push('chef cooking restaurant kitchen')
  } else {
    queries.push('restaurant food dining')
  }

  // Secondary: category-based fallbacks
  const catQueries = categoryMap[category] || categoryMap['Strategie']
  queries.push(...catQueries)

  return queries
}

/**
 * Fetch a hero image for a blog article.
 * Tries multiple search queries until a good result is found.
 */
export async function fetchHeroImage(keyword: string, category: string): Promise<BlogImage | null> {
  if (!PEXELS_API_KEY) {
    console.log('   [pexels] No API key — skipping image fetch')
    return null
  }

  const queries = buildSearchQueries(keyword, category)

  for (const query of queries) {
    try {
      const photos = await searchPhotos(query, { perPage: 3, orientation: 'landscape' })
      if (photos.length === 0) continue

      // Pick the first landscape-ish photo (width > height)
      const photo = photos.find(p => p.width > p.height) || photos[0]

      return {
        url: photo.src.large2x,
        urlMedium: photo.src.medium,
        urlLandscape: photo.src.landscape,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        pexelsUrl: photo.url,
      }
    } catch (err) {
      console.log(`   [pexels] Search "${query}" failed: ${(err as Error).message}`)
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

import { ApifyClient } from 'apify-client'

let _client: ApifyClient | null = null

function getClient(): ApifyClient {
  if (!_client) {
    const token = process.env.APIFY_API_KEY
    if (!token) throw new Error('Missing APIFY_API_KEY')
    _client = new ApifyClient({ token })
  }
  return _client
}

// Hashtags to scrape per city (restaurant-focused)
export const CITY_HASHTAGS: Record<string, string[]> = {
  berlin: ['restaurantberlin', 'berlinFood', 'berlinfoodie', 'berlineats', 'berlingastro'],
  muenchen: ['restaurantmuenchen', 'muenchenfood', 'municheats', 'muenchenfoodie'],
  wien: ['restaurantwien', 'wienisst', 'viennafood', 'wienfoodie', 'wienessen'],
  zuerich: ['restaurantzuerich', 'zuerichfood', 'zurichfoodie', 'zuericheats'],
}

export const SUPPORTED_CITIES = Object.keys(CITY_HASHTAGS)

export interface ApifyInstagramPost {
  id: string
  shortCode: string
  caption: string
  commentsCount: number
  likesCount: number
  timestamp: string
  type: string // 'Image' | 'Video' | 'Sidecar'
  hashtags: string[]
  ownerUsername: string
  ownerFullName: string
  ownerId: string
  url: string
}

export interface ApifyProfileResult {
  username: string
  fullName: string
  followersCount: number
  followsCount: number
  postsCount: number
  biography: string
  latestPosts: ApifyInstagramPost[]
}

/** Scrape Instagram posts for a hashtag using Apify actor */
export async function scrapeHashtag(
  hashtag: string,
  maxPosts: number = 100
): Promise<ApifyInstagramPost[]> {
  const client = getClient()

  console.log(`[Apify] Scraping hashtag #${hashtag} (max ${maxPosts} posts)`)

  const run = await client.actor('apify/instagram-hashtag-scraper').call({
    hashtags: [hashtag],
    resultsLimit: maxPosts,
  })

  const { items } = await client.dataset(run.defaultDatasetId).listItems()
  console.log(`[Apify] Got ${items.length} posts for #${hashtag}`)

  return items as unknown as ApifyInstagramPost[]
}

/** Scrape an Instagram profile's recent posts */
export async function scrapeProfile(
  username: string,
  maxPosts: number = 30
): Promise<ApifyProfileResult | null> {
  const client = getClient()

  console.log(`[Apify] Scraping profile @${username} (max ${maxPosts} posts)`)

  const run = await client.actor('apify/instagram-profile-scraper').call({
    usernames: [username],
    resultsLimit: maxPosts,
  })

  const { items } = await client.dataset(run.defaultDatasetId).listItems()

  if (items.length === 0) {
    console.log(`[Apify] Profile @${username} not found or empty`)
    return null
  }

  return items[0] as unknown as ApifyProfileResult
}

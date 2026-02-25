export type Source = {
  id: string
  name: string
  language: 'de' | 'en'
  blogUrl: string
  /** CSS selector to find article links on the listing page */
  articleLinkSelector: string
  /** Optional: base URL to prepend to relative links */
  baseUrl?: string
  /** CSS selector for article title */
  titleSelector: string
  /** CSS selector for article body content */
  contentSelector: string
  /** CSS selector for article date (optional) */
  dateSelector?: string
  /** Max number of articles to scrape */
  maxArticles: number
  /** Timeout for page load in ms (default: 20000) */
  timeout?: number
  /** Optional: additional pages to scrape (for paginated blogs) */
  additionalPages?: string[]
  /** Allow query params in URLs (some sites like HubSpot use tracking params) */
  allowQueryParams?: boolean
}

export const sources: Source[] = [
  // === DACH (German) ===
  {
    id: 'dish',
    name: 'DISH by Metro',
    language: 'de',
    blogUrl: 'https://www.dish.co/DE/de/blog/',
    articleLinkSelector: 'a[href*="/blog/"]',
    baseUrl: 'https://www.dish.co',
    titleSelector: 'h1',
    contentSelector: 'article, .blog-content, .post-content, main',
    dateSelector: 'time, .date, .post-date',
    maxArticles: 20,
  },
  {
    id: 'restaurant-hero',
    name: 'RestaurantHero',
    language: 'de',
    blogUrl: 'https://www.restauranthero.de/blog/',
    articleLinkSelector: 'a[href*="/blog/"]',
    baseUrl: 'https://www.restauranthero.de',
    titleSelector: 'h1',
    contentSelector: '[class*="blog"], [class*="post"], section, main',
    dateSelector: 'time, .date, .post-date',
    maxArticles: 20,
    timeout: 30000,
  },
  {
    id: 'resmio',
    name: 'resmio Spoon Bytes',
    language: 'de',
    blogUrl: 'https://www.resmio.com/spoon-bytes/',
    articleLinkSelector: 'a[href*="/spoon-bytes/"]',
    baseUrl: 'https://www.resmio.com',
    titleSelector: 'h1',
    contentSelector: 'article, .blog-content, .post-content, main',
    dateSelector: 'time, .date',
    maxArticles: 20,
  },
  // Orderbird: disabled — Cloudflare bot protection blocks headless browsers
  // {
  //   id: 'orderbird',
  //   name: 'Orderbird Blog',
  //   language: 'de',
  //   blogUrl: 'https://www.orderbird.com/de/blog',
  //   ...
  // },
  {
    id: 'sides',
    name: 'SIDES Success Stories',
    language: 'de',
    blogUrl: 'https://www.get-sides.de/gastronomie-ratgeber/',
    articleLinkSelector: 'a[href*="success-story"]',
    baseUrl: 'https://www.get-sides.de',
    titleSelector: 'h1',
    contentSelector: 'article, .entry-content, .post-content, main',
    dateSelector: 'time, .date',
    maxArticles: 15,
    timeout: 35000,
  },
  {
    id: 'foodnotify',
    name: 'FoodNotify',
    language: 'en',
    blogUrl: 'https://www.foodnotify.com/en/blog/',
    articleLinkSelector: 'a[href*="/blog/"]',
    baseUrl: 'https://www.foodnotify.com',
    titleSelector: 'h1',
    contentSelector: 'article, .blog-content, .post-content, main',
    dateSelector: 'time, .date',
    maxArticles: 15,
  },
  {
    id: 'agentur-gastro',
    name: 'Agentur Gastronomie',
    language: 'de',
    blogUrl: 'https://agentur-gastronomie.de/',
    articleLinkSelector: 'a[href*="gastronomie"]',
    baseUrl: 'https://agentur-gastronomie.de',
    titleSelector: 'h1',
    contentSelector: 'article, .entry-content, .post-content, main',
    dateSelector: 'time, .date',
    maxArticles: 15,
  },
  {
    id: 'hubspot-de',
    name: 'HubSpot DE',
    language: 'de',
    blogUrl: 'https://blog.hubspot.de/marketing',
    articleLinkSelector: 'a[href*="blog.hubspot.de/marketing/"]',
    baseUrl: 'https://blog.hubspot.de',
    titleSelector: 'h1',
    contentSelector: 'article, .blog-post-body, .post-body, #hs_cos_wrapper_post_body, main',
    dateSelector: 'time, .date',
    maxArticles: 15,
    allowQueryParams: true,
  },
  {
    id: 'marketing-in-restaurants',
    name: 'Marketing in Restaurants',
    language: 'de',
    blogUrl: 'https://www.marketing-in-restaurants.de/',
    articleLinkSelector: 'a[href*="marketing-in-restaurants.de"]',
    baseUrl: 'https://www.marketing-in-restaurants.de',
    titleSelector: 'h1',
    contentSelector: 'article, .entry-content, .post-content, main',
    dateSelector: 'time, .date',
    maxArticles: 15,
  },
  {
    id: 'g-wie-gastro',
    name: 'g-wie-gastro',
    language: 'de',
    blogUrl: 'https://g-wie-gastro.de/',
    articleLinkSelector: 'article a, .entry-title a',
    baseUrl: 'https://g-wie-gastro.de',
    titleSelector: 'h1',
    contentSelector: 'article, .entry-content, .post-content',
    dateSelector: 'time, .date',
    maxArticles: 15,
  },
  {
    id: 'choco',
    name: 'Choco Blog',
    language: 'de',
    blogUrl: 'https://choco.com/de/blog/',
    articleLinkSelector: 'a[href*="/blog/"]',
    baseUrl: 'https://choco.com',
    titleSelector: 'h1',
    contentSelector: 'article, .blog-content, .post-content, main, [class*="content"]',
    dateSelector: 'time, .date',
    maxArticles: 15,
    timeout: 30000,
  },

  // === English ===
  // Toast: disabled — Cloudflare bot protection blocks headless browsers
  // {
  //   id: 'toast',
  //   name: 'Toast "On the Line"',
  //   language: 'en',
  //   blogUrl: 'https://pos.toasttab.com/blog/on-the-line',
  //   ...
  // },
  {
    id: 'sprout-social',
    name: 'Sprout Social',
    language: 'en',
    blogUrl: 'https://sproutsocial.com/insights/',
    articleLinkSelector: 'a[href*="/insights/"]',
    baseUrl: 'https://sproutsocial.com',
    titleSelector: 'h1',
    contentSelector: 'article, .blog-content, .post-content, main',
    dateSelector: 'time, .date',
    maxArticles: 15,
  },
  {
    id: 'digital-restaurant',
    name: 'The Digital Restaurant',
    language: 'en',
    blogUrl: 'https://thedigitalrestaurant.com/',
    articleLinkSelector: 'a[href*="thedigitalrestaurant.com"]',
    baseUrl: 'https://thedigitalrestaurant.com',
    titleSelector: 'h1',
    contentSelector: 'article, .entry-content, .post-content, main',
    dateSelector: 'time, .date',
    maxArticles: 15,
  },
  {
    id: 'later',
    name: 'Later Blog',
    language: 'en',
    blogUrl: 'https://later.com/blog/category/marketing/',
    articleLinkSelector: 'a[href*="/blog/"]',
    baseUrl: 'https://later.com',
    titleSelector: 'h1',
    contentSelector: 'article, .blog-content, .post-content, main',
    dateSelector: 'time, .date',
    maxArticles: 15,
  },
  {
    id: 'lightspeed',
    name: 'Lightspeed Blog',
    language: 'en',
    blogUrl: 'https://www.lightspeedhq.com/blog/',
    articleLinkSelector: 'a[href*="/blog/"]',
    baseUrl: 'https://www.lightspeedhq.com',
    titleSelector: 'h1',
    contentSelector: 'article, .blog-content, .post-content, main',
    dateSelector: 'time, .date',
    maxArticles: 15,
  },
]

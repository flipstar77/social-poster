/**
 * Category definitions for restaurant profiling.
 * Single source of truth used across all research scripts.
 */

export interface CategoryDef {
  key: string
  display: string           // shown on card and in DMs
  keywords: string[]        // matched against restaurant name (lowercase)
  // Expected behavior norms (used for score calibration)
  typical_freq_per_week: number   // typical posting frequency
  typical_reel_ratio: number      // typical reel %
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: 'cafe',
    display: 'Café & Kaffee',
    keywords: ['café', 'cafe', 'coffee', 'kaffee', 'bakery', 'bäckerei', 'konditorei', 'patisserie', 'croissant', 'espresso'],
    typical_freq_per_week: 3.5,
    typical_reel_ratio: 0.3,
  },
  {
    key: 'fine_dining',
    display: 'Fine Dining',
    keywords: ['fine dining', 'gourmet', 'michelin', 'haute cuisine', 'sterne', 'gastronomique', 'tasting menu'],
    typical_freq_per_week: 2.0,   // intentionally less frequent, quality over quantity
    typical_reel_ratio: 0.25,
  },
  {
    key: 'döner',
    display: 'Döner & Kebab',
    keywords: ['döner', 'kebab', 'doner', 'türkisch', 'turkish', 'köfte', 'shawarma', 'lahmacun'],
    typical_freq_per_week: 2.5,
    typical_reel_ratio: 0.35,
  },
  {
    key: 'pizza',
    display: 'Pizza & Italienisch',
    keywords: ['pizza', 'pizzeria', 'italia', 'italian', 'pasta', 'ristorante', 'trattoria', 'osteria', 'napoli', 'napoli'],
    typical_freq_per_week: 3.0,
    typical_reel_ratio: 0.35,
  },
  {
    key: 'sushi',
    display: 'Sushi & Asiatisch',
    keywords: ['sushi', 'ramen', 'japan', 'asian', 'asia', 'wok', 'thai', 'vietnam', 'pho', 'dim sum', 'chinese', 'korean'],
    typical_freq_per_week: 3.0,
    typical_reel_ratio: 0.4,
  },
  {
    key: 'burger',
    display: 'Burger & Grill',
    keywords: ['burger', 'grill', 'bbq', 'steakhouse', 'steak', 'smash', 'smokehouse'],
    typical_freq_per_week: 3.5,
    typical_reel_ratio: 0.45,
  },
  {
    key: 'bar',
    display: 'Bar & Lounge',
    keywords: ['bar', 'lounge', 'pub', 'cocktail', 'wine bar', 'weinbar', 'tapas', 'bistro'],
    typical_freq_per_week: 3.0,
    typical_reel_ratio: 0.35,
  },
  {
    key: 'vegan',
    display: 'Vegan & Vegetarisch',
    keywords: ['vegan', 'vegetar', 'plant based', 'plant-based', 'green', 'organic', 'bio restaurant', 'wholefood'],
    typical_freq_per_week: 4.0,
    typical_reel_ratio: 0.5,
  },
  {
    key: 'fast_food',
    display: 'Fast Food & Imbiss',
    keywords: ['fast food', 'imbiss', 'snack', 'currywurst', 'falafel', 'wrap', 'takeaway', 'takeout', 'food truck'],
    typical_freq_per_week: 3.0,
    typical_reel_ratio: 0.4,
  },
  {
    key: 'restaurant',
    display: 'Restaurant',
    keywords: [],   // fallback
    typical_freq_per_week: 3.0,
    typical_reel_ratio: 0.35,
  },
]

/** Map category key → CategoryDef */
export const CATEGORY_MAP = new Map(CATEGORIES.map(c => [c.key, c]))

/** Detect category from restaurant name */
export function detectCategoryKey(name: string): string {
  const n = name.toLowerCase()
  for (const cat of CATEGORIES) {
    if (cat.key === 'restaurant') continue  // skip fallback
    if (cat.keywords.some(kw => n.includes(kw))) {
      return cat.key
    }
  }
  return 'restaurant'
}

/** Get display name for a category key */
export function getCategoryDisplay(key: string | null): string {
  return CATEGORY_MAP.get(key ?? 'restaurant')?.display ?? 'Restaurant'
}

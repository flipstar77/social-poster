-- ============================================================================
-- Content Knowledge Base: blog_sources + scraped_articles
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- 1. Source websites we scrape from
CREATE TABLE IF NOT EXISTS blog_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id TEXT UNIQUE NOT NULL,           -- e.g. "dish", "toast", "resmio"
  name TEXT NOT NULL,                        -- e.g. "DISH by Metro"
  language TEXT NOT NULL DEFAULT 'de',       -- "de" or "en"
  blog_url TEXT NOT NULL,
  rating INT DEFAULT 3 CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Scraped articles with full text
CREATE TABLE IF NOT EXISTS scraped_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES blog_sources(source_id) ON DELETE CASCADE,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,                     -- Full article text
  date TEXT,                                 -- Original publish date (text, varies by source)
  language TEXT NOT NULL DEFAULT 'de',
  tags TEXT[] DEFAULT '{}',                  -- User-added tags for filtering
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'used', 'archived', 'favorite')),
  notes TEXT,                                -- User notes / ideas
  word_count INT GENERATED ALWAYS AS (array_length(string_to_array(content, ' '), 1)) STORED,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Full-text search index on title + content
ALTER TABLE scraped_articles ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('german', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(content, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_scraped_articles_fts ON scraped_articles USING gin(fts);
CREATE INDEX IF NOT EXISTS idx_scraped_articles_source ON scraped_articles(source_id);
CREATE INDEX IF NOT EXISTS idx_scraped_articles_status ON scraped_articles(status);
CREATE INDEX IF NOT EXISTS idx_scraped_articles_tags ON scraped_articles USING gin(tags);

-- 4. Seed the sources
INSERT INTO blog_sources (source_id, name, language, blog_url, rating) VALUES
  ('dish', 'DISH by Metro', 'de', 'https://www.dish.co/DE/de/blog/', 5),
  ('restaurant-hero', 'RestaurantHero', 'de', 'https://www.restauranthero.de/blog/', 5),
  ('resmio', 'resmio Spoon Bytes', 'de', 'https://www.resmio.com/spoon-bytes/', 5),
  ('orderbird', 'Orderbird Blog', 'de', 'https://www.orderbird.com/blog/', 4),
  ('sides', 'SIDES Blog', 'de', 'https://www.get-sides.de/blog/', 4),
  ('foodnotify', 'FoodNotify', 'en', 'https://www.foodnotify.com/en/blog/', 4),
  ('agentur-gastro', 'Agentur Gastronomie', 'de', 'https://agentur-gastronomie.de/', 4),
  ('hubspot-de', 'HubSpot DE', 'de', 'https://blog.hubspot.de/marketing/restaurant-marketing', 4),
  ('marketing-in-restaurants', 'Marketing in Restaurants', 'de', 'https://www.marketing-in-restaurants.de/', 3),
  ('g-wie-gastro', 'g-wie-gastro', 'de', 'https://g-wie-gastro.de/', 3),
  ('choco', 'Choco Blog', 'de', 'https://choco.com/de/blog/gastronomen/', 3),
  ('toast', 'Toast "On the Line"', 'en', 'https://pos.toasttab.com/blog/on-the-line', 5),
  ('sprout-social', 'Sprout Social', 'en', 'https://sproutsocial.com/insights/', 5),
  ('digital-restaurant', 'The Digital Restaurant', 'en', 'https://thedigitalrestaurant.com/', 5),
  ('later', 'Later Blog', 'en', 'https://later.com/blog/category/marketing/', 4),
  ('lightspeed', 'Lightspeed Blog', 'en', 'https://www.lightspeedhq.com/blog/', 4)
ON CONFLICT (source_id) DO NOTHING;

-- 5. RLS policies (allow service role full access, anon read-only)
ALTER TABLE blog_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on blog_sources"
  ON blog_sources FOR SELECT USING (true);

CREATE POLICY "Allow public read on scraped_articles"
  ON scraped_articles FOR SELECT USING (true);

CREATE POLICY "Allow service role write on blog_sources"
  ON blog_sources FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role write on scraped_articles"
  ON scraped_articles FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Gastro Insights: Tables for city benchmarks, IG audits, newsletter
-- Restaurant discovery uses existing restaurant_profiles table
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. City-level aggregated stats from Apify scraping
CREATE TABLE IF NOT EXISTS gastro_city_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'instagram',
  avg_likes NUMERIC,
  avg_comments NUMERIC,
  avg_engagement_rate NUMERIC,
  median_followers INT,
  avg_posting_frequency NUMERIC,
  top_hashtags JSONB DEFAULT '[]'::jsonb,
  best_posting_hours JSONB DEFAULT '[]'::jsonb,
  top_content_types JSONB DEFAULT '[]'::jsonb,
  sample_size INT DEFAULT 0,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(city, platform)
);

-- 2. Individual IG audit reports (lead magnet)
CREATE TABLE IF NOT EXISTS ig_audit_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instagram_handle TEXT NOT NULL,
  email TEXT,
  city TEXT,
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ig_audit_handle ON ig_audit_reports(instagram_handle);
CREATE INDEX IF NOT EXISTS idx_ig_audit_email ON ig_audit_reports(email);

-- 3. Newsletter subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  restaurant_name TEXT,
  restaurant_type TEXT,
  city TEXT,
  source TEXT, -- 'ig_audit', 'content_ideas', 'landing_page', 'telegram'
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_newsletter_active
  ON newsletter_subscribers(email) WHERE unsubscribed_at IS NULL;

-- 4. Add 'source' column to restaurant_profiles (track how we discovered them)
ALTER TABLE restaurant_profiles ADD COLUMN IF NOT EXISTS source TEXT;

-- 5. Drop discovered_restaurants (replaced by restaurant_profiles)
DROP TABLE IF EXISTS discovered_restaurants;

-- 6. RLS
ALTER TABLE gastro_city_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on gastro_city_stats" ON gastro_city_stats;
CREATE POLICY "Allow public read on gastro_city_stats"
  ON gastro_city_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on newsletter_subscribers" ON newsletter_subscribers;
CREATE POLICY "Allow public read on newsletter_subscribers"
  ON newsletter_subscribers FOR SELECT USING (true);

-- Note: INSERT/UPDATE on all tables happens via service role (bypasses RLS)

-- 7. Auto-update trigger (reuse existing function if it exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

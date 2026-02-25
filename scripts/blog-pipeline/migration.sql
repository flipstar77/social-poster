-- ============================================================================
-- Blog Pipeline: keyword tracking + generated articles
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Keywords we're targeting
CREATE TABLE IF NOT EXISTS blog_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,                        -- 'Instagram', 'TikTok', 'Google Maps', 'SEO', 'Strategie'
  search_volume_estimate TEXT DEFAULT 'unknown',  -- 'high', 'medium', 'low', 'unknown'
  competition TEXT DEFAULT 'unknown',             -- 'high', 'medium', 'low'
  parent_keyword TEXT,                            -- seed keyword this came from
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'planned', 'written', 'published', 'skipped')),
  priority INT DEFAULT 0,                         -- higher = write sooner
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Generated articles (tracking what we've produced)
CREATE TABLE IF NOT EXISTS generated_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword_id UUID REFERENCES blog_keywords(id),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'de',
  word_count INT,
  source_article_ids UUID[] DEFAULT '{}',        -- which scraped articles were used as context
  seo_score INT DEFAULT 0,                        -- internal quality score (0-100)
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  generated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_keywords_status ON blog_keywords(status);
CREATE INDEX IF NOT EXISTS idx_blog_keywords_category ON blog_keywords(category);
CREATE INDEX IF NOT EXISTS idx_blog_keywords_priority ON blog_keywords(priority DESC);
CREATE INDEX IF NOT EXISTS idx_generated_articles_status ON generated_articles(status);
CREATE INDEX IF NOT EXISTS idx_generated_articles_slug ON generated_articles(slug);

-- RLS
ALTER TABLE blog_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on blog_keywords"
  ON blog_keywords FOR SELECT USING (true);
CREATE POLICY "Allow service role write on blog_keywords"
  ON blog_keywords FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on generated_articles"
  ON generated_articles FOR SELECT USING (true);
CREATE POLICY "Allow service role write on generated_articles"
  ON generated_articles FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Blog Pipeline: Schema fixes (run AFTER migration.sql)
-- Fixes: RLS security, CHECK constraints, ON DELETE, updated_at, idempotency
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Fix RLS: Remove overly permissive "service role" policies
--    Service role bypasses RLS entirely, so these policies were actually
--    granting public write access to everyone (anon key included).
DROP POLICY IF EXISTS "Allow service role write on blog_keywords" ON blog_keywords;
DROP POLICY IF EXISTS "Allow service role write on generated_articles" ON generated_articles;

-- Recreate read policies idempotently
DROP POLICY IF EXISTS "Allow public read on blog_keywords" ON blog_keywords;
CREATE POLICY "Allow public read on blog_keywords"
  ON blog_keywords FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on generated_articles" ON generated_articles;
CREATE POLICY "Allow public read on generated_articles"
  ON generated_articles FOR SELECT USING (true);

-- 2. Add CHECK constraint on category (matches the 5 valid categories)
DO $$ BEGIN
  ALTER TABLE blog_keywords
    ADD CONSTRAINT blog_keywords_category_check
    CHECK (category IN ('Instagram', 'TikTok', 'Google Maps', 'SEO', 'Strategie'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE generated_articles
    ADD CONSTRAINT generated_articles_category_check
    CHECK (category IN ('Instagram', 'TikTok', 'Google Maps', 'SEO', 'Strategie'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Fix foreign key: ON DELETE SET NULL (so deleting a keyword doesn't block)
--    First drop the existing FK, then recreate with SET NULL
DO $$ BEGIN
  ALTER TABLE generated_articles
    DROP CONSTRAINT IF EXISTS generated_articles_keyword_id_fkey;

  ALTER TABLE generated_articles
    ADD CONSTRAINT generated_articles_keyword_id_fkey
    FOREIGN KEY (keyword_id) REFERENCES blog_keywords(id) ON DELETE SET NULL;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 4. Add updated_at columns with auto-update trigger
ALTER TABLE blog_keywords
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE generated_articles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Auto-update trigger function (shared)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_blog_keywords ON blog_keywords;
CREATE TRIGGER set_updated_at_blog_keywords
  BEFORE UPDATE ON blog_keywords
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_generated_articles ON generated_articles;
CREATE TRIGGER set_updated_at_generated_articles
  BEFORE UPDATE ON generated_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Drop redundant index (UNIQUE on slug already creates one)
DROP INDEX IF EXISTS idx_generated_articles_slug;

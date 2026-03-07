-- Restaurant Research Pipeline Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

CREATE TABLE IF NOT EXISTS restaurant_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identity
  handle text UNIQUE NOT NULL,        -- Instagram username
  name text,                          -- Display name
  city text NOT NULL,                 -- Berlin | Wien | Zürich | ...
  category text,                      -- restaurant | cafe | bar | fast_food

  -- Instagram metrics
  ig_followers int,
  ig_posts_count int,
  ig_has_bio_link boolean,
  ig_bio text,
  ig_highlights_count int,
  ig_avg_likes float,
  ig_avg_comments float,
  ig_reel_count int,
  ig_photo_count int,
  ig_carousel_count int,
  ig_posts_analyzed int,
  ig_posting_frequency_per_week float,  -- posts/week based on last N posts
  ig_engagement_rate float,             -- (avg_likes+avg_comments)/followers*100
  ig_reel_ratio float,                  -- reels / total posts analyzed

  -- Google Places metrics
  google_place_id text,
  google_rating float,
  google_review_count int,
  google_photos_count int,
  google_has_website boolean,
  google_hours_complete boolean,

  -- Computed
  ig_score int,                         -- 0–100 composite score

  -- Raw data (for debugging / future use)
  apify_raw jsonb,
  google_raw jsonb,

  -- Meta
  collected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_restaurant_profiles_city ON restaurant_profiles(city);
CREATE INDEX IF NOT EXISTS idx_restaurant_profiles_ig_score ON restaurant_profiles(ig_score DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_profiles_google_rating ON restaurant_profiles(google_rating DESC);

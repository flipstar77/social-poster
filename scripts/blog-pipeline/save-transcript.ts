/**
 * Save YouTube transcripts as premium knowledge sources in Supabase.
 * These serve as high-quality context for article generation.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // Ensure source exists
  await supabase.from('blog_sources').upsert({
    source_id: 'youtube-transcripts',
    name: 'YouTube Transcripts (Premium)',
    language: 'en',
    blog_url: 'https://youtube.com',
    rating: 5,
  }, { onConflict: 'source_id' })

  const transcripts = [
    {
      source_id: 'youtube-transcripts',
      url: 'https://youtube.com/watch?v=restaurant-seo-ultimate-guide-2025',
      title: 'Ultimate Guide: Restaurant SEO to Rank #1 on Google (2025) - Adam Owner.com',
      content: `In this video I'm sharing the ultimate guide on how to SEO optimize your restaurant to rank number one on Google without having to spend money on ads including the game-changing AI tool that does all the work for you.

KEY RESULTS: Mo, owner of Talking Tacos in Miramar Florida, used SEO to drive more than $3 million in sales and grow from one location to more than 20 locations in just 4 years. In just the past 30 days alone, SEO brought him 1,897 new customers and over $250,000 in sales.

WHY SEO IS BETTER THAN SOCIAL MEDIA: Talking Tacos has 175,000 Instagram followers and 20,000 TikTok followers, yet these platforms only brought them 45 new customers in the past 30 days. SEO on the other hand brought in 1,897 new customers — 42 times more effective for driving new customer discovery.

The reason: people searching on Google for "best tacos in Miramar" are ready to buy. Instagram and TikTok users are scrolling for entertainment, not searching for where to eat. Social media is also global while SEO is locally targeted.

9 SECRET GOOGLE RANKING FACTORS:
Google determines which restaurants rank at the top based on multiple factors, not just review count or rating. Factors include keyword optimization, page speed, citations, and behavioral signals.

STRATEGY 1 - AI SEO PAGES:
Use AI to automatically create SEO-optimized pages for every menu item and every nearby city. This is what drove Talking Tacos to rank for surrounding cities even without stores there. Each page targets specific keywords like "best birria tacos in Hollywood" with custom reviews and descriptions.

When you add up all menu items across all nearby cities, it drives tens of thousands of potential new customers monthly.

STRATEGY 2 - KEYWORD RESEARCH:
Two types of keywords matter:
- Primary keyword: restaurant type + city (e.g., "Mexican restaurant in Hollywood California")
- Secondary keyword: most popular dish + city (e.g., "best birria tacos in Hollywood")

Use Google Keyword Planner (free) to find terms with high search volume and low competition. Look for terms with 500+ monthly queries. More specific terms convert better because they match buyer intent exactly.

STRATEGY 3 - GOOGLE BUSINESS PROFILE POSTS:
Brand new Google update: for certain terms, Google now shows recent posts and offers from businesses at the top, even if those businesses aren't ranking in organic results. Very few restaurant owners know about this yet.

Post about: upcoming events, live music, new menu items, special deals. Mention target keywords naturally in posts. This is currently the fastest way to see SEO results because almost no restaurants are doing it.

STRATEGY 4 - COMPLETE GOOGLE BUSINESS PROFILE:
Fill in every single setting: name, email, phone, hours, website, menu, description. Google heavily rewards complete profiles. Add high-quality photos of food, menu, and ambiance — restaurants with good photography see 30%+ lift in sales.

STRATEGY 5 - META TITLE AND H1 TAGS:
Place primary and secondary keywords in your meta title (the blue headline text on Google) and H1 tag (the first big text on your page). This is the most basic on-page SEO factor.

STRATEGY 6 - ALT TEXT ON IMAGES:
Tag every image with: dish name + city name (e.g., "birria tacos in Hollywood California"). This helps rank in Google Images, which many food searchers use. Talking Tacos monopolizes Google Images for "tacos in Miramar Florida" — 6 of 9 top images are theirs. People eat with their eyes.

STRATEGY 7 - PAGE SPEED:
For every 1 second a website takes to load, 5% fewer people convert. If your website takes 3 seconds to load, you're losing 15% of potential customers. Google also penalizes slow sites in rankings. Use pagespeed.web.dev to test.

Compress images, reduce scripts, ensure sub-1-second load time. This impacts both rankings AND conversion rate.

STRATEGY 8 - NAP CONSISTENCY (Citations):
NAP = Name, Address, Phone Number. Must be identical across all directories: Yelp, TripAdvisor, Yellow Pages, CitySearch, etc. Even a missing apostrophe can hurt rankings. Google uses citations as votes of confidence. List on as many local and restaurant-specific directories as possible.

Avoid duplicate listings — Google penalizes restaurants with multiple profiles on the same platform.

STRATEGY 9 - DEDICATED DISH PAGES WITH REVIEWS:
Create a page for each popular menu item with: picture, description, 20+ dish-specific reviews, and direct ordering capability. Very few restaurants do this, so competition is almost zero for specific dish keywords.

TRACKING & MEASUREMENT:
1. Google Analytics: track traffic from organic search and conversions
2. Google Search Console: monitor keyword rankings over time
3. Track actual dollar conversions, not just clicks
4. Use CRM/email marketing to extend lifetime value of SEO-acquired customers

MOBILE OPTIMIZATION:
Not just "works on phone" but "great experience on phone." No PDF menus. Native browsable menu. Don't send users to external sites like DoorDash — this increases bounce rate and Google penalizes it. Keep users on-site for higher session duration.

HOMEPAGE CONVERSION FORMULA:
1. Restaurant story (founding, what makes you special)
2. Most popular dishes with photos
3. Reviews and social proof
This formula converts 5x the average restaurant rate.`,
      date: '2025',
      language: 'en',
      scraped_at: new Date().toISOString(),
    },
    {
      source_id: 'youtube-transcripts',
      url: 'https://youtube.com/watch?v=restaurant-seo-7-strategies',
      title: 'Top 7 Ways to SEO Optimize Your Restaurant (2023) - Adam Owner.com',
      content: `Top seven ways to SEO optimize your restaurant to show up at the top of Google without spending money on ads.

CASE STUDY: Mo, owner of Talking Tacos in Miramar Florida, expanded from food truck to brick and mortar. Problem: almost all customers from DoorDash/UberEats charging 30% fees. Restaurant profit margins average just 5%, so 30% fees are unsustainable. Delivery apps also don't share customer names.

RESULTS: In past 30 days, 516 new customers from Google alone representing $27,509 in sales, measurable down to the penny.

WHY SEO FOR RESTAURANTS:
1. People are ready to buy — searching "best tacos in Miramar" means they've decided to eat, just choosing where
2. Restaurants are the most searched local business type in the world — every US city with 10,000+ population has 1,000+ monthly restaurant searches
3. Most restaurants do SEO wrong — huge opportunity for those who do it right

STRATEGY 1 - KEYWORD RESEARCH:
- Primary keyword: restaurant type + city (e.g., "Italian restaurant in Lakeside")
- Secondary keyword: most popular dish + city (e.g., "pasta in Lakeside California")
- Use Google Keyword Planner (free) to find volume and competition

Common restaurant type keywords provided for: Italian, Indian, Chinese, Japanese, Thai, Mexican, Poke, Pizzerias, Wings.

STRATEGY 2 - ALT TEXT ON IMAGES:
Format: "best [dish name] in [city], [state]"
Example: "best garlic bread in Lakeside California"
Talking Tacos: 6 of 9 top Google Images results for "tacos in Miramar Florida" are their pictures. People eat with their eyes — Google Images is a huge traffic source.

STRATEGY 3 - DEDICATED DISH PAGES:
Create pages for popular menu items with: dish photo, description, 20+ reviews mentioning that specific dish, and direct ordering.
Example: 500+ people/month search "birria tacos in Miramar Florida"
Almost no competition because very few restaurants create dish-specific pages.

STRATEGY 4 - MATCH BUYER JOURNEY:
Three major buying decision factors:
1. Online reviews (70% of people check reviews before ordering) — feature on homepage and throughout ordering
2. Restaurant story — people love supporting local community businesses
3. Most popular dishes — showcase on homepage with photos

Homepage formula: Story → Popular Dishes → Reviews = 5x conversion rate.

STRATEGY 5 - PAGE SPEED:
Every 1 second = 5% fewer conversions. 3 second load = 15% lost customers.
Test at pagespeed.web.dev or GTmetrics.
Compress images, optimize scripts. Affects both rankings and sales.

STRATEGY 6 - NAP CONSISTENCY:
Name, Address, Phone Number must be identical everywhere. Even tiny differences (apostrophe, abbreviation) can hurt rankings.
Claim listings on all major directories. Remove duplicates. Google uses citation consistency as ranking signal.

STRATEGY 7 - GOOGLE BUSINESS PROFILE:
Fill out every field completely. Add high-quality photos (food, menu, ambiance).
Respond to every review — shows Google the business is active and engaged.
Post regular updates about events, specials, new menu items.`,
      date: '2023',
      language: 'en',
      scraped_at: new Date().toISOString(),
    },
  ]

  const { data, error } = await supabase
    .from('scraped_articles')
    .upsert(transcripts, { onConflict: 'url', ignoreDuplicates: false })
    .select('id, title')

  if (error) {
    console.error('Error:', error.message)
  } else {
    console.log(`Saved ${data?.length || 0} transcripts:`)
    data?.forEach(d => console.log(`  - ${d.title}`))
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })

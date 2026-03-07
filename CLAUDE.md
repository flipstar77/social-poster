# FlowingPost - Project Guide

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5.9, React 19
- **Auth & DB:** Supabase (SSR adapter, cookies-based sessions)
- **Payments:** Stripe
- **i18n:** next-intl (de/en, locale prefix routing)
- **AI:** Grok/xAI (captions), Anthropic Claude (vision)
- **Video:** Remotion 4.0
- **Hosting:** Vercel

## Project Structure

```
src/
  app/
    [locale]/           # All user-facing pages (locale-prefixed)
      tool/             # Auth-protected dashboard tools
        page.tsx          - Main content tool (photo upload, captions, scheduling)
        keyword-research/ - Keyword research (Google Autocomplete mining)
        design/           - Design editor (Fabric.js canvas)
        video/            - Video editor (Remotion)
        telegram/         - Telegram bot connection
        whatsapp/         - WhatsApp integration
      tools/            # Public tools (no auth required)
        instagram-audit/  - IG audit lead-magnet (score + city comparison)
      blog/             # Public blog (MDX articles)
      login/            # Auth pages
      onboarding/       # Onboarding flow
    api/                # API routes (grouped by domain)
      keyword-research/   - POST: seed keyword expansion
        save/               - POST: upsert keywords to Supabase blog_keywords
        gaps/               - GET: existing blog posts for content gap matching
      generate/           - POST: AI caption generation
      publish/            - POST: multi-platform publishing
      telegram/           - Bot linking + webhook
      whatsapp/           - Connection + messages + webhook
      stripe/             - Checkout, portal, webhook
      blog/               - Blog rendering
      instagram-audit/    - POST: Apify profile scrape + analysis vs city benchmarks
      newsletter/
        subscribe/          - POST: email signup with source tracking
  lib/                  # Shared logic
    apify/                - Apify client wrapper (IG hashtag + profile scraping)
    insights/             - IG data analysis (city stats, audit reports, scoring)
    newsletter/           - Resend email wrapper (newsletter + audit reports)
    keyword-research/     - Google Autocomplete mining, intent classification
    supabase/             - Server + client Supabase wrappers
    telegram/             - Bot, publisher, scheduler, vision
    whatsapp/             - Meta Graph API client, message router
    platform-prompts.ts   - Per-platform caption system prompts
  components/           # Shared React components (PascalCase)
  data/                 # Static data (preset templates)
  i18n/                 # next-intl routing config
scripts/
  apify/              # Apify scraping scripts
    scrape-city-restaurants.ts  - Hashtag scrape → city stats + discover new handles
  research/           # Restaurant research pipeline (discover → scrape → analyze → enrich)
    discover-restaurants.ts     - Google Places → find IG handles
    import-apify.ts             - Import Apify profile data → restaurant_profiles
    analyze.ts                  - Score calculation
    enrich-google.ts            - Add Google Places data
    generate-dms.ts             - Generate outreach DMs
  blog-pipeline/      # CLI pipeline scripts (keyword research, article gen, internal links)
  blog-agents/        # Claude Code agent system for automated daily blog generation
    run.sh              - Entry point (triggers claude -p with orchestrator prompt)
    prompt.md           - 4-phase agent prompt (Researcher/Writer/Curator/Publisher)
    helpers/
      research.ts       - Phase 1: Pick keyword + gather context from Supabase/Tavily
      check-seo.ts      - Phase 3: SEO quality scoring on draft MDX
      publish.ts        - Phase 4: Pexels image, save MDX, Supabase tracking, internal links
data/
  pipeline/           # Intermediate files for blog agent (research.json, draft.mdx, etc.)
content/
  blog/               # ~50 MDX articles (German, Gastro niche)
```

## Conventions

### Naming
- API routes: `src/app/api/[domain]/[action]/route.ts` (lowercase)
- Pages: `src/app/[locale]/[...path]/page.tsx`
- Lib: `src/lib/[domain]/[module].ts` (camelCase files, domain folders)
- Components: `src/components/PascalCase.tsx`

### Patterns
- `'use client'` for interactive pages, server components for data fetching
- API routes use `NextResponse` from `next/server`
- Auth via middleware for `/tool/*` routes — API routes don't re-check auth
- Webhook handlers always return 200, validate signatures
- Logging: `console.log/error` with `[FeatureName]` prefix
- Supabase: server client for admin ops, browser client from components
- i18n: `useTranslations()` in client components

### Styling
- Dark theme: `bg-zinc-900` base, `bg-zinc-950` headers, `border-zinc-700`
- Mix of Tailwind classes + inline styles
- Tool pages: back link to `/tool`, full-height layout

## Build
- Type-check: `npx tsc --noEmit`
- Dev: `npm run dev` (Turbopack)
- `scripts/blog-pipeline/` has known type issues — uses `as any` casts

## Blog Agent System
- Run daily: `./scripts/blog-agents/run.sh`
- Test research only: `./scripts/blog-agents/run.sh --test`
- 4-phase pipeline: Researcher → Writer (Claude) → Curator (SEO check + self-review) → Publisher
- Intermediate files in `data/pipeline/` (research.json, draft.mdx, seo-report.json, publish-result.json)
- Claude Code writes the article directly (not Grok API) — better quality for long German content
- Publisher auto-commits but does NOT push — user reviews first
- **Backup**: `.github/workflows/daily-blog.yml` — GitHub Actions cron at 09:00 UTC
  - Skips if article was already committed today
  - Uses `run-pipeline.ts` with Grok (fallback when PC is off)
  - Auto-commits + pushes
  - Requires GitHub Secrets: SUPABASE keys, XAI_API_KEY, PEXELS_API_KEY, TAVILY_API_KEY

## Gastro Insights System
- **Purpose**: City-level restaurant IG benchmarks, IG audit lead-magnet, newsletter
- **Data flow**: Hashtag scrape (Apify) → `gastro_city_stats` + new handles → `restaurant_profiles`
- **Scrape**: `npm run insights:scrape` (all 4 cities) or `-- --city berlin`
- **Supabase tables**:
  - `gastro_city_stats` — aggregated city benchmarks (avg likes, top hashtags, posting hours)
  - `ig_audit_reports` — individual audit reports (lead magnet)
  - `newsletter_subscribers` — email list with source tracking
  - `restaurant_profiles` — all discovered restaurants (shared with research pipeline)
- **Libs**: `src/lib/apify/client.ts`, `src/lib/insights/analyzer.ts`, `src/lib/newsletter/resend.ts`
- **Cities**: Berlin, München, Wien, Zürich (expandable via `CITY_HASHTAGS` in apify/client.ts)
- **Two-phase discovery**: Phase 1 hashtag scrape finds handles → Phase 2 deep profile scrape via existing `import-apify.ts`
- **IG Audit Tool**: Public page at `/tools/instagram-audit` — handle + city → score (0-10) with breakdown, city comparison, recommendations, email-gated full report
- **API**: `POST /api/instagram-audit` (handle, city) → scrapes via Apify, analyzes, saves report
- **Newsletter**: `POST /api/newsletter/subscribe` (email, source) → upsert to `newsletter_subscribers`

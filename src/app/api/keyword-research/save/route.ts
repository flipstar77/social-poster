import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const VALID_CATEGORIES = ["Instagram", "TikTok", "Google Maps", "SEO", "Strategie"] as const
type Category = (typeof VALID_CATEGORIES)[number]

interface SaveKeyword {
  keyword: string
  category: Category
  intent: string
  parent_keyword: string
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase env vars missing")
  return createClient(url, key)
}

function estimateCompetition(keyword: string): string {
  const words = keyword.split(/\s+/).length
  if (words >= 4) return "low"
  if (words >= 3) return "medium"
  return "high"
}

function estimateVolume(intent: string, words: number): string {
  // Heuristic: transactional/commercial with more words = likely medium-high
  if (intent === "transactional") return words >= 3 ? "medium" : "high"
  if (intent === "commercial") return "medium"
  return words >= 4 ? "low" : "medium"
}

export async function POST(request: Request) {
  try {
    const { keywords, seed } = (await request.json()) as {
      keywords: SaveKeyword[]
      seed: string
    }

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "No keywords provided" }, { status: 400 })
    }

    if (keywords.length > 200) {
      return NextResponse.json({ error: "Max 200 keywords per save" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const rows = keywords.map((kw) => {
      const category = VALID_CATEGORIES.includes(kw.category as Category)
        ? kw.category
        : "Strategie"
      const competition = estimateCompetition(kw.keyword)
      const volume = estimateVolume(kw.intent, kw.keyword.split(/\s+/).length)
      const priority =
        (volume === "high" ? 30 : volume === "medium" ? 20 : 10) +
        (competition === "low" ? 30 : competition === "medium" ? 20 : 10)

      return {
        keyword: kw.keyword.toLowerCase().trim(),
        category,
        search_volume_estimate: volume,
        competition,
        parent_keyword: kw.parent_keyword || seed,
        priority,
        status: "new",
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("blog_keywords") as any)
      .upsert(rows, { onConflict: "keyword", ignoreDuplicates: true })
      .select("id")

    if (error) {
      console.error("[Keyword Research Save]", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      saved: data?.length ?? 0,
      total: rows.length,
    })
  } catch (error) {
    console.error("[Keyword Research Save]", error)
    return NextResponse.json({ error: "Save failed" }, { status: 500 })
  }
}

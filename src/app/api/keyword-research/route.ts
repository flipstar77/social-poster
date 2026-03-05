import { NextResponse } from "next/server"
import { expandKeyword } from "@/lib/keyword-research/expander"

export async function POST(request: Request) {
  try {
    const { seed, lang } = await request.json()

    if (!seed || typeof seed !== "string") {
      return NextResponse.json(
        { error: "Seed keyword required" },
        { status: 400 }
      )
    }

    const trimmed = seed.trim()
    if (trimmed.length > 100) {
      return NextResponse.json(
        { error: "Seed keyword too long (max 100 chars)" },
        { status: 400 }
      )
    }

    const result = await expandKeyword(trimmed, lang === "en" ? "en" : "de")
    return NextResponse.json(result)
  } catch (error) {
    console.error("[Keyword Research]", error)
    return NextResponse.json(
      { error: "Research failed" },
      { status: 500 }
    )
  }
}

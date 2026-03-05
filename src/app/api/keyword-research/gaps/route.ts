import { NextResponse } from "next/server"
import { getAllPosts } from "@/lib/blog"

export interface BlogPostInfo {
  slug: string
  title: string
  category: string
}

export async function GET() {
  try {
    const posts = getAllPosts("de")
    const postInfos: BlogPostInfo[] = posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      category: p.category,
    }))
    return NextResponse.json({ posts: postInfos })
  } catch (error) {
    console.error("[Keyword Research Gaps]", error)
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 })
  }
}

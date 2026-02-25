import { NextRequest, NextResponse } from 'next/server'
import { serialize } from 'next-mdx-remote/serialize'
import remarkGfm from 'remark-gfm'
import { getPostBySlug } from '@/lib/blog'

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  const post = getPostBySlug(slug)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const mdxSource = await serialize(post.content, {
    mdxOptions: { remarkPlugins: [remarkGfm] },
  })

  return NextResponse.json({
    post: {
      slug: post.slug,
      title: post.title,
      description: post.description,
      date: post.date,
      category: post.category,
      readingTime: post.readingTime,
      mdxSource,
    },
  })
}

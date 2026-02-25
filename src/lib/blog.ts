import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export type BlogPost = {
  slug: string
  title: string
  description: string
  date: string
  category: string
  readingTime: string
  image?: string
  imageMedium?: string
  imageCredit?: string
  imageCreditUrl?: string
  content: string
}

export type BlogPostMeta = Omit<BlogPost, 'content'>

function estimateReadingTime(text: string): string {
  const wordsPerMinute = 200
  const words = text.trim().split(/\s+/).length
  const minutes = Math.ceil(words / wordsPerMinute)
  return `${minutes} Min.`
}

export function getAllPosts(locale: string = 'de'): BlogPostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx'))

  const posts = files
    .map(filename => {
      const slug = filename.replace('.mdx', '')
      const filePath = path.join(BLOG_DIR, filename)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const { data, content } = matter(fileContent)

      // Skip posts not matching locale (default: de)
      if (data.locale && data.locale !== locale) return null

      return {
        slug,
        title: data.title || slug,
        description: data.description || '',
        date: data.date || '',
        category: data.category || 'Allgemein',
        readingTime: estimateReadingTime(content),
        image: data.image,
        imageMedium: data.imageMedium,
        imageCredit: data.imageCredit,
        imageCreditUrl: data.imageCreditUrl,
      } satisfies BlogPostMeta
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    // Only show articles on or after their publish date
    .filter(p => !p.date || p.date <= new Date().toISOString().split('T')[0])
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return posts
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null

  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(fileContent)

  return {
    slug,
    title: data.title || slug,
    description: data.description || '',
    date: data.date || '',
    category: data.category || 'Allgemein',
    readingTime: estimateReadingTime(content),
    image: data.image,
    imageMedium: data.imageMedium,
    imageCredit: data.imageCredit,
    imageCreditUrl: data.imageCreditUrl,
    content,
  }
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  return fs
    .readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace('.mdx', ''))
}

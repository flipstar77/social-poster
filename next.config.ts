import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  async redirects() {
    const target = '/de/blog/bio-instagram-fuer-restaurant-so-machst-du-dein-profil-zum-gast-magneten'
    return [
      {
        source: '/de/blog/instagram-bio-fuer-caf-und-restaurant-so-holst-du-mehr-gaeste-in-dein-lokal',
        destination: target,
        permanent: true,
      },
      {
        source: '/de/blog/instagram-bio-fuer-fast-food-restaurant-so-machst-du-dein-profil-zum-kundenmagne',
        destination: target,
        permanent: true,
      },
    ]
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        child_process: false,
      }
    }
    return config
  },
}

const withNextIntl = createNextIntlPlugin()
export default withNextIntl(nextConfig)

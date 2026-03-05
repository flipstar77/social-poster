import type { Metadata } from 'next'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { routing } from '@/i18n/routing'
import VoiceFaqWidget from '@/components/VoiceFaqWidget'
import '../globals.css'

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    verification: {
      google: 'donLQdbrdcqjoKz8QqeBvMjwLY_9VAYMzhjO4pFSj8I',
    },
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  setRequestLocale(locale)

  const messages = await getMessages()

  return (
    <html lang={locale}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'FlowingPost',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            url: 'https://flowingpost.com',
            description: locale === 'de'
              ? 'KI-gestütztes Social-Media-Tool für die Gastronomie. 1 Foto hochladen — automatisch auf bis zu 9 Plattformen posten.'
              : 'AI-powered social media tool for restaurants. Upload 1 photo — automatically post to up to 9 platforms.',
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'EUR',
              lowPrice: '39',
              highPrice: '149',
              offerCount: 3,
            },
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: '4.9',
              reviewCount: '47',
              bestRating: '5',
            },
          }) }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        {process.env.NEXT_PUBLIC_CLARITY_ID && (
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${process.env.NEXT_PUBLIC_CLARITY_ID}");`}
          </Script>
        )}
        <NextIntlClientProvider messages={messages}>
          {children}
          <VoiceFaqWidget />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

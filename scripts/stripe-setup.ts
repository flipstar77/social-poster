/**
 * Creates Stripe products + prices for FlowingPost plans.
 * Run: npx tsx scripts/stripe-setup.ts
 *
 * Output: Price IDs to paste into your code as PRICE_IDS constant.
 */

import Stripe from 'stripe'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PLANS = [
  {
    name: 'FlowingPost Starter',
    monthlyPrice: 3900, // cents
    yearlyPrice: 39000,
  },
  {
    name: 'FlowingPost Growth',
    monthlyPrice: 7900,
    yearlyPrice: 79000,
  },
  {
    name: 'FlowingPost Pro',
    monthlyPrice: 14900,
    yearlyPrice: 149000,
  },
]

async function main() {
  console.log('Creating Stripe products and prices...\n')

  const results: Record<string, { monthly: string; yearly: string }> = {}

  for (const plan of PLANS) {
    const product = await stripe.products.create({
      name: plan.name,
      metadata: { app: 'flowingpost' },
    })
    console.log(`Product: ${product.name} (${product.id})`)

    const monthly = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.monthlyPrice,
      currency: 'eur',
      recurring: { interval: 'month' },
    })
    console.log(`  Monthly: ${monthly.id} — €${plan.monthlyPrice / 100}/mo`)

    const yearly = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.yearlyPrice,
      currency: 'eur',
      recurring: { interval: 'year' },
    })
    console.log(`  Yearly:  ${yearly.id} — €${plan.yearlyPrice / 100}/yr`)

    const key = plan.name.replace('FlowingPost ', '').toLowerCase()
    results[key] = { monthly: monthly.id, yearly: yearly.id }
  }

  console.log('\n--- Copy this into src/app/api/stripe/checkout/route.ts ---\n')
  console.log('const PRICE_IDS: Record<string, Record<string, string>> = {')
  for (const [plan, ids] of Object.entries(results)) {
    console.log(`  ${plan}: { monthly: '${ids.monthly}', yearly: '${ids.yearly}' },`)
  }
  console.log('}')
}

main().catch(console.error)

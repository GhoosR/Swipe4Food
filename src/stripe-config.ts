// TODO: Replace with your LIVE Stripe price IDs from Stripe Dashboard > Products
export const stripeProducts = [
  {
    id: 'prod_LIVE_YEARLY', // Replace with your live product ID
    priceId: 'price_LIVE_YEARLY_REPLACE_ME', // Replace with your live yearly price ID
    name: 'Business Profile Yearly',
    description: 'Become a premium member of Swipe4Food and register as a restaurant.',
    mode: 'subscription' as const,
    price: 50.00,
    currency: 'EUR',
    interval: 'year',
    savings: '€9.88 vs monthly',
  },
  {
    id: 'prod_LIVE_MONTHLY', // Replace with your live product ID
    priceId: 'price_LIVE_MONTHLY_REPLACE_ME', // Replace with your live monthly price ID
    name: 'Business Profile',
    description: 'Become a premium member of Swipe4Food and register as a restaurant.',
    mode: 'subscription' as const,
    price: 4.99,
    currency: 'EUR',
    interval: 'month',
  },
] as const;

export type StripeProduct = typeof stripeProducts[number];
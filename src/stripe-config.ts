// Business Membership product configuration
export const stripeProducts = [
  {
    id: 'prod_T172L5f9GAki9B',
    priceId: 'price_1S54oM2f0yhjzYxH0grEvdrR',
    name: 'Business Membership',
    description: 'Access to business profile.',
    mode: 'subscription' as const,
    price: 4.99,
    currency: 'EUR',
    interval: 'month',
  },
] as const;

export type StripeProduct = typeof stripeProducts[number];
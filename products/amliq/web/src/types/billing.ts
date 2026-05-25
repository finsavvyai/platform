export type ProductType = 'api' | 'dashboard' | 'sdk' | 'iframe' | 'dataset'
export type BillingPeriod = 'monthly' | 'annual'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled' | 'expired'

export interface Plan {
  id: string
  name: string
  monthlyPrice: number
  annualPrice: number
  features: string[]
  limits: Record<string, number>
  highlighted?: boolean
  lsVariantId?: string
}

export interface Product {
  type: ProductType
  name: string
  tagline: string
  icon: string
  plans: Plan[]
}

export interface Subscription {
  id: string
  product: ProductType
  plan: Plan
  status: SubscriptionStatus
  seatCount?: number
  currentPeriodEnd: string
  promoCode?: string
}

export interface UsageRecord {
  product: ProductType
  metrics: Array<{ name: string; current: number; limit: number; unit: string }>
}

export interface Seat {
  userId: string
  email: string
  role: string
  activatedAt: string
}

export interface Invoice {
  id: string
  date: string
  product: ProductType
  amountCents: number
  currency: string
  status: 'paid' | 'open' | 'failed'
  url: string
}

export interface UsageHistoryPoint {
  month: string
  screenings: number
  limit: number
}

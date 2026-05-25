import { NextRequest, NextResponse } from 'next/server'
import { createLemonSqueezyCheckout } from '@/lib/lemonsqueezy'

export async function POST(request: NextRequest) {
  try {
    const { planId, planName, price, isYearly, customerEmail } = await request.json()

    // Create checkout session
    const checkout = await createLemonSqueezyCheckout({
      planId,
      planName,
      price,
      isYearly,
      customerEmail,
    })

    return NextResponse.json({
      checkoutUrl: checkout.checkoutUrl,
      sessionId: checkout.sessionId,
    })
  } catch (error) {
    console.error('LemonSqueezy checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
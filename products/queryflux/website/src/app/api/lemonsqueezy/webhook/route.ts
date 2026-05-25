import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Webhook event types
interface LemonSqueezyEvent {
  meta: {
    event_name: string
    custom_data?: Record<string, unknown>
  }
  data: Record<string, unknown>
}

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    console.error('LEMONSQUEEZY_WEBHOOK_SECRET is not configured')
    return false
  }

  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}

// Handle subscription created
async function handleSubscriptionCreated(event: LemonSqueezyEvent) {
  const subscription = event.data as any // LemonSqueezy response structure
  const customerId = subscription.attributes?.customer_id
  const subscriptionId = subscription.id
  const variantId = subscription.attributes?.variant_id
  const status = subscription.attributes?.status

  console.log('Subscription created:', {
    subscriptionId,
    customerId,
    variantId,
    status
  })

  // TODO: Update user's subscription status in your database
  // await updateUserSubscription(customerId, {
  //   subscriptionId,
  //   variantId,
  //   status,
  //   createdAt: subscription.attributes.created_at
  // })
}

// Handle subscription updated
async function handleSubscriptionUpdated(event: LemonSqueezyEvent) {
  const subscription = event.data as any // LemonSqueezy response structure
  const customerId = subscription.attributes?.customer_id
  const subscriptionId = subscription.id
  const status = subscription.attributes?.status

  console.log('Subscription updated:', {
    subscriptionId,
    customerId,
    status
  })

  // TODO: Update user's subscription status in your database
  // await updateUserSubscription(customerId, {
  //   subscriptionId,
  //   status,
  //   updatedAt: subscription.attributes.updated_at
  // })
}

// Handle subscription cancelled
async function handleSubscriptionCancelled(event: LemonSqueezyEvent) {
  const subscription = event.data as any // LemonSqueezy response structure
  const customerId = subscription.attributes?.customer_id
  const subscriptionId = subscription.id

  console.log('Subscription cancelled:', {
    subscriptionId,
    customerId
  })

  // TODO: Update user's subscription status in your database
  // await updateUserSubscription(customerId, {
  //   subscriptionId,
  //   status: 'cancelled',
  //   cancelledAt: subscription.attributes.cancelled_at
  // })
}

// Handle payment success
async function handlePaymentSuccess(event: LemonSqueezyEvent) {
  const order = event.data as any // LemonSqueezy response structure
  const customerId = order.attributes?.customer_id
  const orderId = order.id

  console.log('Payment successful:', {
    orderId,
    customerId
  })

  // TODO: Process payment success in your database
  // await processPaymentSuccess(orderId, customerId)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('X-Signature') || ''

    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      console.error('Invalid webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event: LemonSqueezyEvent = JSON.parse(body)
    const eventName = event.meta.event_name

    console.log('Processing LemonSqueezy webhook:', eventName)

    // Route to appropriate handler
    switch (eventName) {
      case 'subscription_created':
        await handleSubscriptionCreated(event)
        break

      case 'subscription_updated':
        await handleSubscriptionUpdated(event)
        break

      case 'subscription_cancelled':
        await handleSubscriptionCancelled(event)
        break

      case 'order_created':
        await handlePaymentSuccess(event)
        break

      default:
        console.log('Unhandled event type:', eventName)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'

interface CheckoutProps {
  planId: string
  planName: string
  price: number
  isYearly: boolean
  variant?: 'button' | 'banner'
}

export function LemonSqueezyCheckout({
  planId,
  planName,
  price,
  isYearly,
  variant = 'button'
}: CheckoutProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Create checkout session
      const response = await fetch('/api/lemonsqueezy/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          planName,
          price,
          isYearly,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { checkoutUrl } = await response.json()

      // Redirect to LemonSqueezy checkout
      window.location.href = checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsLoading(false)
    }
  }

  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upgrade to {planName}
            </h3>
            <p className="text-gray-600 mb-4">
              Get all premium features for just {formatPrice(price)}/month
            </p>
            {error && (
              <p className="text-sm text-red-600 mb-4">{error}</p>
            )}
          </div>
          <Button
            onClick={handleCheckout}
            loading={isLoading}
            disabled={isLoading}
          >
            Upgrade Now
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}
      <Button
        onClick={handleCheckout}
        loading={isLoading}
        disabled={isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? 'Processing...' : `Start ${planName} Plan`}
      </Button>
    </div>
  )
}
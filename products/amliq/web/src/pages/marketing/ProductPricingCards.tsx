import { Product } from '../../types/billing'
import PricingCard from './PricingCard'

interface ProductPricingCardsProps {
  product: Product
  annual?: boolean
}

export function ProductPricingCards({ product, annual = false }: ProductPricingCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {product.plans.map(plan => (
        <PricingCard
          key={plan.id}
          plan={{
            name: plan.name,
            monthly: plan.monthlyPrice,
            features: plan.features,
            highlighted: plan.highlighted,
          }}
          annual={annual}
        />
      ))}
    </div>
  )
}

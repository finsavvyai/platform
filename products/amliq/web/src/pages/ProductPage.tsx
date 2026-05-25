import ProductHeader from './product/ProductHeader'
import ScreeningWorkflow from './product/ScreeningWorkflow'
import MatchingEngine from './product/MatchingEngine'
import APIOverview from './product/APIOverview'
import ResponseFormat from './product/ResponseFormat'
import IntegrationSection from './product/IntegrationSection'
import ProductCTA from './product/ProductCTA'

export default function ProductPage() {
  return (
    <div className="bg-token-bg min-h-screen">
      <ProductHeader />
      <ScreeningWorkflow />
      <MatchingEngine />
      <APIOverview />
      <ResponseFormat />
      <IntegrationSection />
      <ProductCTA />
    </div>
  )
}

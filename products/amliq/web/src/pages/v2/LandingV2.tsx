import V2Layout from './Layout'
import {
  Hero,
  TrustProof,
  Pillars,
  FeatureGrid,
  HowItWorks,
  ProductPreview,
  DeveloperApi,
  Security,
  Pricing,
  FAQ,
  FinalCTA,
} from './sections'

export default function LandingV2() {
  return (
    <V2Layout>
      <Hero />
      <TrustProof />
      <Pillars />
      <FeatureGrid />
      <HowItWorks />
      <ProductPreview />
      <DeveloperApi />
      <Security />
      <Pricing />
      <FAQ />
      <FinalCTA />
    </V2Layout>
  )
}

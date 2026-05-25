import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { CurbTicker } from './components/CurbTicker'
import { CurbProblem } from './components/CurbProblem'
import { YAMLKiller } from './components/YAMLKiller'
import { HowItWorks } from './components/HowItWorks'
import { ProductUI } from './components/ProductUI'
import { InstallMethods } from './components/InstallMethods'
import { Features } from './components/Features'
import { CurbComparison } from './components/CurbComparison'
import { ReleaseFeature } from './components/ReleaseFeature'
import { Pricing } from './components/Pricing'
import { FinalCTA } from './components/FinalCTA'
import { Footer } from './components/Footer'
import { SocialProof } from './components/SocialProof'
import { Benchmarks } from './components/Benchmarks'
import { Integrations } from './components/Integrations'
import { HomeFAQ } from './components/HomeFAQ'
import { lazy, Suspense } from 'react'

const VsGitHubActions = lazy(() => import('./pages/VsGitHubActions'))
const VsGitLabCI = lazy(() => import('./pages/VsGitLabCI'))
const VsCircleCI = lazy(() => import('./pages/VsCircleCI'))
const VsJenkins = lazy(() => import('./pages/VsJenkins'))
const VsTravisCI = lazy(() => import('./pages/VsTravisCI'))
const VsBuildkite = lazy(() => import('./pages/VsBuildkite'))
const VsDroneCI = lazy(() => import('./pages/VsDroneCI'))
const VsBitbucketPipelines = lazy(() => import('./pages/VsBitbucketPipelines'))
const VsAzurePipelines = lazy(() => import('./pages/VsAzurePipelines'))
const VsAwsCodePipeline = lazy(() => import('./pages/VsAwsCodePipeline'))
const CostCalculator = lazy(() => import('./pages/CostCalculator'))
const AIIntegration = lazy(() => import('./pages/AIIntegration'))
const SkillMarket = lazy(() => import('./pages/SkillMarket'))
const CurbYourCI = lazy(() => import('./pages/CurbYourCI'))
const WhyPushCI = lazy(() => import('./pages/WhyPushCI'))
const SocialCards = lazy(() => import('./pages/SocialCards'))
const LocalRelease = lazy(() => import('./pages/LocalRelease'))
const Docs = lazy(() => import('./pages/Docs'))
const PushciYamlGuide = lazy(() => import('./pages/PushciYamlGuide'))
const EnterprisePage = lazy(() => import('./pages/EnterprisePage'))
const NorlysPilotPage = lazy(() => import('./pages/NorlysPilotPage'))
const CompliancePage = lazy(() => import('./pages/CompliancePage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const RefundPage = lazy(() => import('./pages/RefundPage'))
const SecurityPage = lazy(() => import('./pages/SecurityPage'))
const StatusPage = lazy(() => import('./pages/StatusPage'))
const ProductPage = lazy(() => import('./pages/ProductPage'))
const DevelopersPage = lazy(() => import('./pages/DevelopersPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const NotFound = lazy(() => import('./pages/NotFound'))

function Home() {
  return (
    <div className="min-h-screen bg-root">
      <Navbar />
      <Hero />
      <CurbTicker />
      <SocialProof />
      <CurbProblem />
      <YAMLKiller />
      <Benchmarks />
      <HowItWorks />
      <ProductUI />
      <InstallMethods />
      <Features />
      <Integrations />
      <CurbComparison />
      <ReleaseFeature />
      <Pricing />
      <HomeFAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-root" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vs/github-actions" element={<VsGitHubActions />} />
          <Route path="/vs/gitlab-ci" element={<VsGitLabCI />} />
          <Route path="/vs/circleci" element={<VsCircleCI />} />
          <Route path="/vs/jenkins" element={<VsJenkins />} />
          <Route path="/vs/travis-ci" element={<VsTravisCI />} />
          <Route path="/vs/buildkite" element={<VsBuildkite />} />
          <Route path="/vs/drone-ci" element={<VsDroneCI />} />
          <Route path="/vs/bitbucket-pipelines" element={<VsBitbucketPipelines />} />
          <Route path="/vs/azure-pipelines" element={<VsAzurePipelines />} />
          <Route path="/vs/aws-codepipeline" element={<VsAwsCodePipeline />} />
          <Route path="/tools/cost-calculator" element={<CostCalculator />} />
          <Route path="/ai" element={<AIIntegration />} />
          <Route path="/skills" element={<SkillMarket />} />
          <Route path="/curb" element={<CurbYourCI />} />
          <Route path="/why" element={<WhyPushCI />} />
          <Route path="/social" element={<SocialCards />} />
          <Route path="/release" element={<LocalRelease />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/docs/pushci-yaml" element={<PushciYamlGuide />} />
          <Route path="/enterprise" element={<EnterprisePage />} />
          <Route path="/norlys-pilot" element={<NorlysPilotPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/refunds" element={<RefundPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/product" element={<ProductPage />} />
          <Route path="/developers" element={<DevelopersPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

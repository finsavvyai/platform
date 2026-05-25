import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Features } from './components/Features'
import { Comparison } from './components/Comparison'
import { Pricing } from './components/Pricing'
import { Footer } from './components/Footer'
import { lazy, Suspense } from 'react'

const VsGitHubActions = lazy(() => import('./pages/VsGitHubActions'))
const VsGitLabCI = lazy(() => import('./pages/VsGitLabCI'))
const VsCircleCI = lazy(() => import('./pages/VsCircleCI'))
const CostCalculator = lazy(() => import('./pages/CostCalculator'))

function Home() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <Comparison />
      <Pricing />
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/vs/github-actions" element={<VsGitHubActions />} />
          <Route path="/vs/gitlab-ci" element={<VsGitLabCI />} />
          <Route path="/vs/circleci" element={<VsCircleCI />} />
          <Route path="/tools/cost-calculator" element={<CostCalculator />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

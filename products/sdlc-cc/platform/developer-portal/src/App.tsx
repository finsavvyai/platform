import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Navigation } from '@/components/Navigation'
import { HomePage } from '@/pages/HomePage'
import { DocumentationPage } from '@/pages/DocumentationPage'
import { PlaygroundPage } from '@/pages/PlaygroundPage'
import { ApiReferencePage } from '@/pages/ApiReferencePage'
import { ExamplesPage } from '@/pages/ExamplesPage'
import { GettingStartedPage } from '@/pages/GettingStartedPage'
import { Footer } from '@/components/Footer'

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="gradient-bg">
        <Navigation isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/docs" element={<DocumentationPage />} />
            <Route path="/getting-started" element={<GettingStartedPage />} />
            <Route path="/playground" element={<PlaygroundPage />} />
            <Route path="/api-reference" element={<ApiReferencePage />} />
            <Route path="/examples" element={<ExamplesPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </div>
  )
}

export default App

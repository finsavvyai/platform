import React from 'react'
import { Link } from 'react-router-dom'

interface NavigationProps {
  isDarkMode: boolean
  setIsDarkMode: (value: boolean) => void
}

export const Navigation: React.FC<NavigationProps> = ({
  isDarkMode,
  setIsDarkMode,
}) => {
  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-bold text-lg">
            SDLC.ai
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </Link>
            <Link to="/getting-started" className="text-muted-foreground hover:text-foreground transition-colors">
              Getting Started
            </Link>
            <Link to="/api-reference" className="text-muted-foreground hover:text-foreground transition-colors">
              API Reference
            </Link>
            <Link to="/examples" className="text-muted-foreground hover:text-foreground transition-colors">
              Examples
            </Link>
            <Link to="/playground" className="text-muted-foreground hover:text-foreground transition-colors">
              Playground
            </Link>
          </div>
        </div>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 rounded-md hover:bg-muted transition-colors"
          aria-label="Toggle dark mode"
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  )
}

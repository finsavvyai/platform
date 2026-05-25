import Link from 'next/link'
import { Button } from '../ui/button'

export interface NavbarProps {
  domain?: string
  authenticated?: boolean
}

export function Navbar({ authenticated = false }: NavbarProps) {
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">MCP</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                MCPOverflow
              </span>
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex space-x-6">
              <Link href="/" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                Home
              </Link>
              <Link href="/connectors" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                Connectors
              </Link>
              <Link href="/deployments" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                Deployments
              </Link>
              <Link href="/docs" className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                Docs
              </Link>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            {authenticated ? (
              <Button variant="outline" className="border-gray-300 dark:border-gray-600">
                Sign Out
              </Button>
            ) : (
              <Button variant="outline" className="border-gray-300 dark:border-gray-600">
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
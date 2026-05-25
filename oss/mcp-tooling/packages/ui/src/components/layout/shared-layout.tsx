import { Navbar } from './navbar'
import { Footer } from './footer'

export interface SharedLayoutProps {
  children: React.ReactNode
  className?: string
}

export function SharedLayout({
  children,
  className = '',
}: SharedLayoutProps) {
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
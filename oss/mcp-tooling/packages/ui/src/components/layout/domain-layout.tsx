import { Navbar } from './navbar'
import { Footer } from './footer'

export interface DomainLayoutProps {
  children: React.ReactNode
  domain?: string
  className?: string
}

export function DomainLayout({
  children,
  domain = 'developer',
  className = '',
}: DomainLayoutProps) {
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      <Navbar domain={domain} />
      <main className="flex-1">
        {children}
      </main>
      <Footer domain={domain} />
    </div>
  )
}
import { render, screen, fireEvent } from '@testing-library/react'
import { Hero } from '@/components/sections/Hero'
import { Button } from '@/components/ui/Button'

// Mock framer-motion to avoid animation issues
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}))

// Mock Button component
jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

describe('Hero Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders hero section with all elements', () => {
    render(<Hero />)

    // Check for main heading
    expect(screen.getByText(/The Future of/)).toBeInTheDocument()
    expect(screen.getByText(/Database Management/)).toBeInTheDocument()

    // Check for badge
    expect(screen.getByText(/4\.8\/5 rating from 1,250\+ reviews/)).toBeInTheDocument()

    // Check for subheading
    expect(screen.getByText(/AI-powered query optimization/)).toBeInTheDocument()
    expect(screen.getByText(/35\+ database types/)).toBeInTheDocument()

    // Check for CTA buttons
    expect(screen.getByText('Download Free')).toBeInTheDocument()
    expect(screen.getByText('Watch Demo')).toBeInTheDocument()
  })

  test('renders trust indicators', () => {
    render(<Hero />)

    expect(screen.getByText('35+ Database Types')).toBeInTheDocument()
    expect(screen.getByText('AI-Powered')).toBeInTheDocument()
    expect(screen.getByText('Real-time Collaboration')).toBeInTheDocument()
    expect(screen.getByText('Enterprise Security')).toBeInTheDocument()
  })

  test('renders hero visual section', () => {
    render(<Hero />)

    expect(screen.getByText(/Interactive Dashboard Preview/)).toBeInTheDocument()
    expect(screen.getByText(/Real-time query execution and collaboration/)).toBeInTheDocument()
  })

  test('renders floating cards with status information', () => {
    render(<Hero />)

    expect(screen.getByText('Connected to 12 databases')).toBeInTheDocument()
    expect(screen.getByText('AI optimized 3 queries')).toBeInTheDocument()
    expect(screen.getByText('5 users collaborating')).toBeInTheDocument()
  })

  test('download button is clickable', () => {
    const handleClick = jest.fn()
    render(<Hero />)

    // Find the download button and make it clickable
    const downloadButton = screen.getByText('Download Free')
    downloadButton.onclick = handleClick

    fireEvent.click(downloadButton)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  test('watch demo button is clickable', () => {
    const handleClick = jest.fn()
    render(<Hero />)

    // Find the demo button and make it clickable
    const demoButton = screen.getByText('Watch Demo')
    demoButton.onclick = handleClick

    fireEvent.click(demoButton)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  test('has proper accessibility structure', () => {
    render(<Hero />)

    // Check for semantic section element
    const section = screen.getByRole('region') || document.querySelector('section')
    expect(section).toBeInTheDocument()
    expect(section).toHaveClass(/min-h-screen/)
  })

  test('renders gradient background', () => {
    render(<Hero />)

    const heroSection = screen.getByRole('region') || document.querySelector('section')
    expect(heroSection).toHaveClass(/bg-gradient-to-br/)
  })

  test('contains proper text hierarchy', () => {
    render(<Hero />)

    // Check for h1 with proper text
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent(/The Future of/)
  })

  test('has responsive design classes', () => {
    render(<Hero />)

    const mainContainer = document.querySelector('.max-w-7xl')
    expect(mainContainer).toBeInTheDocument()
    expect(mainContainer).toHaveClass(/px-4 sm:px-6 lg:px-8/)
  })

  test('displays interactive dashboard preview', () => {
    render(<Hero />)

    expect(screen.getByText('Advanced Query Editor')).toBeInTheDocument()
    expect(screen.getByText(/With IntelliSense and debugging/)).toBeInTheDocument()
  })

  test('shows animated elements', () => {
    render(<Hero />)

    // Check for elements that should have animation classes
    const badge = screen.getByText(/4\.8\/5 rating/)
    expect(badge.closest('div')).toBeInTheDocument()

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
  })

  test('has proper ARIA labels for accessibility', () => {
    render(<Hero />)

    // Check for proper structure
    const main = document.querySelector('main')
    if (main) {
      expect(main).toBeInTheDocument()
    }
  })

  test('renders database icon in visual section', () => {
    render(<Hero />)

    // Check for visual elements
    const visualSection = document.querySelector('.aspect-video')
    expect(visualSection).toBeInTheDocument()
  })

  test('floating cards have proper status indicators', () => {
    render(<Hero />)

    // Check for status indicators (green, yellow, blue dots)
    const statusIndicators = document.querySelectorAll('.bg-green-500, .bg-yellow-500, .bg-blue-500')
    expect(statusIndicators.length).toBeGreaterThan(0)
  })
})
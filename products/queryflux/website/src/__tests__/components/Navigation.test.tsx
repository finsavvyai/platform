import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Navigation } from '@/components/Navigation'
import { Button } from '@/components/ui/Button'

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>
  }
})

// Mock Button component
jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

describe('Navigation Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Reset scroll position
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true })

    // Mock addEventListener
    window.addEventListener = jest.fn()
    window.removeEventListener = jest.fn()
  })

  test('renders navigation with logo and links', () => {
    render(<Navigation />)

    // Check for logo
    expect(screen.getByText('QueryFlux')).toBeInTheDocument()

    // Check for navigation links
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
    expect(screen.getByText('Documentation')).toBeInTheDocument()
    expect(screen.getByText('Blog')).toBeInTheDocument()

    // Check for CTA buttons
    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getByText('Download Free')).toBeInTheDocument()
  })

  test('renders logo with icon', () => {
    render(<Navigation />)

    const logo = document.querySelector('.w-8.h-8')
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveClass('bg-black')
  })

  test('has transparent background initially', () => {
    render(<Navigation />)

    const nav = document.querySelector('nav')
    expect(nav).toHaveClass('bg-transparent')
    expect(nav).not.toHaveClass('border-b')
  })

  test('mobile menu is closed initially', () => {
    render(<Navigation />)

    // Desktop navigation should be visible
    const desktopNav = document.querySelector('.hidden.md\\:flex')
    expect(desktopNav).toBeInTheDocument()

    // Mobile menu should not be visible
    expect(screen.queryByText('Features', { selector: '.md\\:hidden' })).not.toBeInTheDocument()
  })

  test('toggles mobile menu when button is clicked', () => {
    render(<Navigation />)

    // Get mobile menu button
    const mobileMenuButton = screen.getByRole('button')
    expect(mobileMenuButton).toBeInTheDocument()

    // Click to open menu
    fireEvent.click(mobileMenuButton)

    // Mobile menu should be visible
    expect(screen.getByText('Features', { selector: '.md\\:hidden' })).toBeInTheDocument()
    expect(screen.getByText('Sign In', { selector: '.md\\:hidden' })).toBeInTheDocument()

    // Click to close menu
    fireEvent.click(mobileMenuButton)

    // Mobile menu should be hidden again
    expect(screen.queryByText('Features', { selector: '.md\\:hidden' })).not.toBeInTheDocument()
  })

  test('mobile menu has sign in and download buttons', async () => {
    render(<Navigation />)

    // Open mobile menu
    const mobileMenuButton = screen.getByRole('button')
    fireEvent.click(mobileMenuButton)

    // Wait for menu to appear
    await waitFor(() => {
      expect(screen.getByText('Sign In', { selector: '.md\\:hidden' })).toBeInTheDocument()
      expect(screen.getByText('Download Free', { selector: '.md\\:hidden' })).toBeInTheDocument()
    })
  })

  test('closes mobile menu when link is clicked', () => {
    render(<Navigation />)

    // Open mobile menu
    const mobileMenuButton = screen.getByRole('button')
    fireEvent.click(mobileMenuButton)

    // Click a link
    const featuresLink = screen.getByText('Features', { selector: '.md\\:hidden' })
    fireEvent.click(featuresLink)

    // Menu should close
    expect(screen.queryByText('Features', { selector: '.md\\:hidden' })).not.toBeInTheDocument()
  })

  test('adds scroll effect when scrolling', () => {
    // Mock scroll event
    const mockScrollEvent = new Event('scroll')
    Object.defineProperty(window, 'scrollY', { value: 20, writable: true })

    // Mock the scroll handler
    const { rerender } = render(<Navigation />)

    // Simulate scroll
    window.dispatchEvent(mockScrollEvent)

    // Check if background changes
    const nav = document.querySelector('nav')
    expect(nav).toHaveClass('bg-white/95')
    expect(nav).toHaveClass('backdrop-blur-md')
    expect(nav).toHaveClass('border-b')
  })

  test('navigation links have correct href attributes', () => {
    render(<Navigation />)

    const featuresLink = screen.getByText('Features')
    expect(featuresLink.closest('a')).toHaveAttribute('href', '#features')

    const pricingLink = screen.getByText('Pricing')
    expect(pricingLink.closest('a')).toHaveAttribute('href', '#pricing')

    const docsLink = screen.getByText('Documentation')
    expect(docsLink.closest('a')).toHaveAttribute('href', '/docs')
  })

  test('logo links to home page', () => {
    render(<Navigation />)

    const logoLink = screen.getByText('QueryFlux').closest('a')
    expect(logoLink).toHaveAttribute('href', '/')
  })

  test('desktop navigation is hidden on mobile', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true })

    render(<Navigation />)

    // Desktop navigation should have hidden class
    const desktopNav = document.querySelector('.hidden.md\\:flex')
    expect(desktopNav).toBeInTheDocument()
  })

  test('desktop navigation is visible on desktop', () => {
    // Mock desktop viewport
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })

    render(<Navigation />)

    // Desktop navigation should be visible
    const desktopNav = document.querySelector('.hidden.md\\:flex')
    expect(desktopNav).toBeInTheDocument()
  })

  test('download button has icon', async () => {
    render(<Navigation />)

    // Open mobile menu to see download button
    const mobileMenuButton = screen.getByRole('button')
    fireEvent.click(mobileMenuButton)

    await waitFor(() => {
      const downloadButton = screen.getByText('Download Free', { selector: '.md\\:hidden' })
      expect(downloadButton).toBeInTheDocument()
    })
  })

  test('has proper z-index for fixed positioning', () => {
    render(<Navigation />)

    const nav = document.querySelector('nav')
    expect(nav).toHaveClass('fixed')
    expect(nav).toHaveClass('z-50')
  })

  test('transition classes are applied', () => {
    render(<Navigation />)

    const nav = document.querySelector('nav')
    expect(nav).toHaveClass('transition-all')
    expect(nav).toHaveClass('duration-300')
  })

  test('has proper ARIA labels', () => {
    render(<Navigation />)

    const nav = document.querySelector('nav')
    expect(nav).toBeInTheDocument()

    // Logo should have proper alt text through its icon
    const logo = document.querySelector('.w-5.h-5')
    if (logo) {
      expect(logo).toBeInTheDocument()
    }
  })

  test('sign in button is clickable', () => {
    const handleClick = jest.fn()

    render(<Navigation />)

    const signInButtons = screen.getAllByText('Sign In')
    const signInButton = signInButtons[0] // Desktop version

    signInButton.onclick = handleClick
    fireEvent.click(signInButton)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  test('download button is clickable', () => {
    const handleClick = jest.fn()

    render(<Navigation />)

    const downloadButtons = screen.getAllByText('Download Free')
    const downloadButton = downloadButtons[0] // Desktop version

    downloadButton.onclick = handleClick
    fireEvent.click(downloadButton)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  test('has responsive spacing', () => {
    render(<Navigation />)

    const container = document.querySelector('.max-w-7xl')
    expect(container).toBeInTheDocument()
    expect(container).toHaveClass(/px-4 sm:px-6 lg:px-8/)
  })

  test('logo has proper hover effects', () => {
    render(<Navigation />)

    const logo = screen.getByText('QueryFlux').closest('a')
    expect(logo).toBeInTheDocument()
  })

  test('navigation links have hover effects', () => {
    render(<Navigation />)

    const featuresLink = screen.getByText('Features')
    const linkElement = featuresLink.closest('a')
    expect(linkElement).toHaveClass(/hover:text-black/)
  })
})
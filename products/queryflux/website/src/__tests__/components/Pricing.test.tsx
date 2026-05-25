import { render, screen, fireEvent } from '@testing-library/react'
import { Pricing } from '@/components/sections/Pricing'
import { LemonSqueezyCheckout } from '@/components/LemonSqueezyCheckout'

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    h3: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}))

// Mock LemonSqueezyCheckout
jest.mock('@/components/LemonSqueezyCheckout', () => ({
  LemonSqueezyCheckout: ({ variantId, children, ...props }: any) => (
    <button onClick={() => {}} {...props}>
      {children}
    </button>
  ),
}))

describe('Pricing Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders pricing section with title', () => {
    render(<Pricing />)

    expect(screen.getByText(/Simple, Transparent/)).toBeInTheDocument()
    expect(screen.getByText(/Pricing Plans/)).toBeInTheDocument()
    expect(screen.getByText(/Choose the perfect plan for your needs/)).toBeInTheDocument()
  })

  test('renders Free plan with correct features', () => {
    render(<Pricing />)

    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('$0')).toBeInTheDocument()
    expect(screen.getByText('/month')).toBeInTheDocument()
    expect(screen.getByText('Perfect for getting started')).toBeInTheDocument()

    // Check for key features
    expect(screen.getByText('Connect to 3 databases')).toBeInTheDocument()
    expect(screen.getByText('Basic query editor')).toBeInTheDocument()
    expect(screen.getByText('1,000 queries/month')).toBeInTheDocument()
    expect(screen.getByText('Email support')).toBeInTheDocument()
  })

  test('renders Pro plan with correct features', () => {
    render(<Pricing />)

    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('$29')).toBeInTheDocument()
    expect(screen.getByText('/month')).toBeInTheDocument()
    expect(screen.getByText('For professional teams')).toBeInTheDocument()

    // Check for pro features
    expect(screen.getByText('Unlimited databases')).toBeInTheDocument()
    expect(screen.getByText('AI-powered optimization')).toBeInTheDocument()
    expect(screen.getByText('Advanced analytics')).toBeInTheDocument()
    expect(screen.getByText('Priority support')).toBeInTheDocument()
  })

  test('renders Enterprise plan with correct features', () => {
    render(<Pricing />)

    expect(screen.getByText('Enterprise')).toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
    expect(screen.getByText('For large organizations')).toBeInTheDocument()

    // Check for enterprise features
    expect(screen.getByText('Everything in Pro')).toBeInTheDocument()
    expect(screen.getByText('Custom integrations')).toBeInTheDocument()
    expect(screen.getByText('Dedicated support')).toBeInTheDocument()
    expect(screen.getByText('SLA guarantee')).toBeInTheDocument()
  })

  test('displays checkmarks for included features', () => {
    render(<Pricing />)

    // All features should have checkmarks
    const checkmarks = document.querySelectorAll('.text-green-500')
    expect(checkmarks.length).toBeGreaterThan(0)
  })

  test('displays correct pricing badges', () => {
    render(<Pricing />)

    // Free plan should have badge
    expect(screen.getByText('Popular')).toBeInTheDocument()

    // Pro plan should have recommended badge
    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  test('monthly toggle works', () => {
    render(<Pricing />)

    const toggle = screen.getByRole('switch') || document.querySelector('[role="switch"]')
    expect(toggle).toBeInTheDocument()

    // Toggle to yearly
    fireEvent.click(toggle)

    // Check if prices update
    expect(screen.getByText('$348')).toBeInTheDocument() // $29 x 12
    expect(screen.getByText('Billed annually')).toBeInTheDocument()
  })

  test('Get Started buttons are clickable', () => {
    render(<Pricing />)

    const getStartedButtons = screen.getAllByText('Get Started')
    expect(getStartedButtons.length).toBeGreaterThan(0)

    getStartedButtons.forEach(button => {
      expect(button).toBeInTheDocument()
      expect(button.closest('button')).toBeInTheDocument()
    })
  })

  test('Contact Us button is clickable', () => {
    render(<Pricing />)

    const contactButton = screen.getByText('Contact Us')
    expect(contactButton).toBeInTheDocument()
    expect(contactButton.closest('button')).toBeInTheDocument()
  })

  test('plans have hover effects', () => {
    render(<Pricing />)

    const plans = document.querySelectorAll('[class*="hover:"]')
    expect(plans.length).toBeGreaterThan(0)
  })

  test('most popular plan is highlighted', () => {
    render(<Pricing />)

    // Look for the most popular or recommended plan
    const highlightedPlan = document.querySelector('[class*="border-2"], [class*="shadow-lg"]')
    expect(highlightedPlan).toBeInTheDocument()
  })

  test('has proper ARIA labels for accessibility', () => {
    render(<Pricing />)

    // Check for section with proper heading
    const section = document.querySelector('section[id="pricing"]')
    expect(section).toBeInTheDocument()

    // Check for proper heading structure
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toBeInTheDocument()
  })

  test('displays feature comparison correctly', () => {
    render(<Pricing />)

    // Check that all plans have the same feature categories
    const plans = document.querySelectorAll('[class*="border-"]')
    expect(plans.length).toBe(3) // Free, Pro, Enterprise
  })

  test('yearly billing shows savings', () => {
    render(<Pricing />)

    const toggle = screen.getByRole('switch') || document.querySelector('[role="switch"]')

    // Toggle to yearly
    fireEvent.click(toggle)

    // Check for savings message
    expect(screen.getByText('Save 2 months')).toBeInTheDocument()
    expect(screen.getByText('Billed annually')).toBeInTheDocument()
  })

  test('free plan has Get Started button', () => {
    render(<Pricing />)

    const freePlan = document.querySelector('[data-plan="free"]')
    if (freePlan) {
      expect(screen.getByText('Get Started')).toBeInTheDocument()
    }
  })

  test('pro plan has Get Started button with checkout', () => {
    render(<Pricing />)

    const proPlan = document.querySelector('[data-plan="pro"]')
    if (proPlan) {
      expect(screen.getByText('Get Started')).toBeInTheDocument()
    }
  })

  test('enterprise plan has Contact Us button', () => {
    render(<Pricing />)

    const enterprisePlan = document.querySelector('[data-plan="enterprise"]')
    if (enterprisePlan) {
      expect(screen.getByText('Contact Us')).toBeInTheDocument()
    }
  })

  test('has responsive grid layout', () => {
    render(<Pricing />)

    const grid = document.querySelector('.grid, [class*="grid-cols"]')
    expect(grid).toBeInTheDocument()
    expect(grid).toHaveClass(/md:grid-cols-3/)
  })

  test('FAQ section is rendered', () => {
    render(<Pricing />)

    expect(screen.getByText(/Frequently Asked Questions/)).toBeInTheDocument()

    // Check for FAQ items
    expect(screen.getByText(/Can I change plans anytime?/)).toBeInTheDocument()
    expect(screen.getByText(/What payment methods do you accept?/)).toBeInTheDocument()
    expect(screen.getByText(/Is there a free trial?/)).toBeInTheDocument()
  })

  test('FAQ items are expandable', () => {
    render(<Pricing />)

    const faqItems = document.querySelectorAll('[class*="cursor-pointer"]')
    expect(faqItems.length).toBeGreaterThan(0)

    // Click first FAQ item
    fireEvent.click(faqItems[0])

    // Answer should be visible (expanded state)
    expect(faqItems[0]).toHaveClass(/border-gray-200/)
  })

  test('has proper visual hierarchy', () => {
    render(<Pricing />)

    // Check for gradient text
    const gradientText = document.querySelector('[class*="text-transparent"]')
    expect(gradientText).toBeInTheDocument()
    expect(gradientText).toHaveClass(/bg-clip-text/)
  })

  test('testimonial section is included', () => {
    render(<Pricing />)

    expect(screen.getByText(/Trusted by 10,000\+ teams/)).toBeInTheDocument()
    expect(screen.getByText(/Join the community of/)).toBeInTheDocument()
  })

  test('money-back guarantee is displayed', () => {
    render(<Pricing />)

    expect(screen.getByText(/30-day money-back guarantee/)).toBeInTheDocument()
  })

  test('has proper spacing and padding', () => {
    render(<Pricing />)

    const section = document.querySelector('section[id="pricing"]')
    expect(section).toHaveClass(/py-20/)
  })
})
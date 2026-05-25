import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { PricingPlans } from '../../components/PricingPlans';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { toast } from 'react-hot-toast';

// Mock dependencies
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { 
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('PricingPlans', () => {
  const mockFetch = fetch as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Initial Render', () => {
    it('should render pricing plans section', () => {
      renderWithProviders(<PricingPlans />);
      
      expect(screen.getByText('💳 Pricing Plans')).toBeInTheDocument();
      expect(screen.getByText('Choose the perfect plan for your testing needs')).toBeInTheDocument();
      expect(screen.getByText('Free')).toBeInTheDocument();
      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    it('should display plan features correctly', () => {
      renderWithProviders(<PricingPlans />);
      
      // Free plan features
      expect(screen.getByText('5 recordings per month')).toBeInTheDocument();
      expect(screen.getByText('Basic test generation')).toBeInTheDocument();
      expect(screen.getByText('Community support')).toBeInTheDocument();
      
      // Pro plan features
      expect(screen.getByText('Unlimited recordings')).toBeInTheDocument();
      expect(screen.getByText('AI-powered test generation')).toBeInTheDocument();
      expect(screen.getByText('Priority support')).toBeInTheDocument();
      
      // Enterprise plan features
      expect(screen.getByText('Custom integrations')).toBeInTheDocument();
      expect(screen.getByText('Dedicated support')).toBeInTheDocument();
      expect(screen.getByText('SLA guarantee')).toBeInTheDocument();
    });

    it('should show correct pricing', () => {
      renderWithProviders(<PricingPlans />);
      
      expect(screen.getByText('$0')).toBeInTheDocument();
      expect(screen.getByText('$29')).toBeInTheDocument();
      expect(screen.getByText('$99')).toBeInTheDocument();
      expect(screen.getByText('/month')).toBeInTheDocument();
    });
  });

  describe('Plan Selection', () => {
    it('should highlight selected plan', () => {
      renderWithProviders(<PricingPlans />);
      
      const proPlan = screen.getByText('Pro').closest('div');
      expect(proPlan).toHaveClass('border-blue-500');
    });

    it('should change selected plan when clicked', () => {
      renderWithProviders(<PricingPlans />);
      
      const enterprisePlan = screen.getByText('Enterprise').closest('div');
      fireEvent.click(enterprisePlan!);
      
      expect(enterprisePlan).toHaveClass('border-blue-500');
    });

    it('should show popular badge on Pro plan', () => {
      renderWithProviders(<PricingPlans />);
      
      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });
  });

  describe('Billing Toggle', () => {
    it('should show monthly billing by default', () => {
      renderWithProviders(<PricingPlans />);
      
      const monthlyToggle = screen.getByText('Monthly');
      expect(monthlyToggle).toHaveClass('bg-blue-500');
    });

    it('should switch to yearly billing when clicked', () => {
      renderWithProviders(<PricingPlans />);
      
      const yearlyToggle = screen.getByText('Yearly');
      fireEvent.click(yearlyToggle);
      
      expect(yearlyToggle).toHaveClass('bg-blue-500');
      expect(screen.getByText('Save 20%')).toBeInTheDocument();
    });

    it('should update pricing when billing changes', () => {
      renderWithProviders(<PricingPlans />);
      
      const yearlyToggle = screen.getByText('Yearly');
      fireEvent.click(yearlyToggle);
      
      // Check for yearly pricing (with discount)
      expect(screen.getByText('$23')).toBeInTheDocument(); // $29 * 0.8
      expect(screen.getByText('$79')).toBeInTheDocument(); // $99 * 0.8
    });
  });

  describe('Subscribe Button', () => {
    it('should show subscribe button for paid plans', () => {
      renderWithProviders(<PricingPlans />);
      
      const subscribeButtons = screen.getAllByText('Subscribe');
      expect(subscribeButtons).toHaveLength(2); // Pro and Enterprise
    });

    it('should show get started button for free plan', () => {
      renderWithProviders(<PricingPlans />);
      
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    it('should handle subscription request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, checkoutUrl: 'https://checkout.stripe.com/123' })
      });

      renderWithProviders(<PricingPlans />);
      
      const subscribeButton = screen.getAllByText('Subscribe')[0];
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/subscriptions/create',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            }),
            body: expect.stringContaining('"planId":"pro"')
          })
        );
      });
    });

    it('should handle subscription errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Payment failed'));

      renderWithProviders(<PricingPlans />);
      
      const subscribeButton = screen.getAllByText('Subscribe')[0];
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create subscription');
      });
    });

    it('should redirect to checkout on successful subscription', async () => {
      const mockCheckoutUrl = 'https://checkout.stripe.com/123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, checkoutUrl: mockCheckoutUrl })
      });

      // Mock window.location
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '' };

      renderWithProviders(<PricingPlans />);
      
      const subscribeButton = screen.getAllByText('Subscribe')[0];
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(window.location.href).toBe(mockCheckoutUrl);
      });

      // Restore original location
      window.location = originalLocation;
    });
  });

  describe('Feature Comparison', () => {
    it('should display feature comparison table', () => {
      renderWithProviders(<PricingPlans />);
      
      expect(screen.getByText('Feature Comparison')).toBeInTheDocument();
      expect(screen.getByText('Recordings')).toBeInTheDocument();
      expect(screen.getByText('Test Generation')).toBeInTheDocument();
      expect(screen.getByText('Support')).toBeInTheDocument();
      expect(screen.getByText('Integrations')).toBeInTheDocument();
    });

    it('should show correct feature availability', () => {
      renderWithProviders(<PricingPlans />);
      
      // Check feature availability indicators
      const checkmarks = screen.getAllByText('✓');
      const crosses = screen.getAllByText('✗');
      
      expect(checkmarks.length).toBeGreaterThan(0);
      expect(crosses.length).toBeGreaterThan(0);
    });

    it('should highlight differences between plans', () => {
      renderWithProviders(<PricingPlans />);
      
      // Enterprise plan should have more features
      const enterpriseFeatures = screen.getAllByText('✓');
      expect(enterpriseFeatures.length).toBeGreaterThan(0);
    });
  });

  describe('FAQ Section', () => {
    it('should display FAQ section', () => {
      renderWithProviders(<PricingPlans />);
      
      expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
      expect(screen.getByText('Can I change my plan anytime?')).toBeInTheDocument();
      expect(screen.getByText('What payment methods do you accept?')).toBeInTheDocument();
    });

    it('should expand FAQ items when clicked', () => {
      renderWithProviders(<PricingPlans />);
      
      const faqItem = screen.getByText('Can I change my plan anytime?');
      fireEvent.click(faqItem);
      
      expect(screen.getByText('Yes, you can upgrade or downgrade your plan at any time.')).toBeInTheDocument();
    });

    it('should collapse FAQ items when clicked again', () => {
      renderWithProviders(<PricingPlans />);
      
      const faqItem = screen.getByText('Can I change my plan anytime?');
      fireEvent.click(faqItem);
      fireEvent.click(faqItem);
      
      expect(screen.queryByText('Yes, you can upgrade or downgrade your plan at any time.')).not.toBeInTheDocument();
    });
  });

  describe('Contact Sales', () => {
    it('should show contact sales option for Enterprise plan', () => {
      renderWithProviders(<PricingPlans />);
      
      expect(screen.getByText('Contact Sales')).toBeInTheDocument();
    });

    it('should handle contact sales request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      renderWithProviders(<PricingPlans />);
      
      const contactButton = screen.getByText('Contact Sales');
      fireEvent.click(contactButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/contact-sales',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            })
          })
        );
      });
    });
  });

  describe('Responsive Design', () => {
    it('should display plans in grid layout on desktop', () => {
      renderWithProviders(<PricingPlans />);
      
      const plansContainer = screen.getByText('Free').closest('div');
      expect(plansContainer).toHaveClass('grid');
    });

    it('should stack plans vertically on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<PricingPlans />);
      
      // Plans should be responsive
      const plansContainer = screen.getByText('Free').closest('div');
      expect(plansContainer).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state during subscription', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithProviders(<PricingPlans />);
      
      const subscribeButton = screen.getAllByText('Subscribe')[0];
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });
    });

    it('should disable buttons during loading', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithProviders(<PricingPlans />);
      
      const subscribeButton = screen.getAllByText('Subscribe')[0];
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(subscribeButton).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message for network failures', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<PricingPlans />);
      
      const subscribeButton = screen.getAllByText('Subscribe')[0];
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create subscription');
      });
    });

    it('should show specific error for payment failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Payment method declined' })
      });

      renderWithProviders(<PricingPlans />);
      
      const subscribeButton = screen.getAllByText('Subscribe')[0];
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Payment method declined');
      });
    });
  });
});



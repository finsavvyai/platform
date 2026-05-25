import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import HomePage from '../../pages/HomePage';
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
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
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

describe('HomePage', () => {
  const mockFetch = fetch as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Hero Section', () => {
    it('should render hero section with main headline', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText(/Revolutionize Your Testing/)).toBeInTheDocument();
      expect(screen.getByText(/AI-Powered Test Automation/)).toBeInTheDocument();
      expect(screen.getByText(/Record once, test everywhere/)).toBeInTheDocument();
    });

    it('should display call-to-action buttons', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('Start Free Trial')).toBeInTheDocument();
      expect(screen.getByText('Watch Demo')).toBeInTheDocument();
      expect(screen.getByText('View Documentation')).toBeInTheDocument();
    });

    it('should show hero image or illustration', () => {
      renderWithProviders(<HomePage />);
      
      const heroImage = screen.getByAltText(/Hero illustration/);
      expect(heroImage).toBeInTheDocument();
    });
  });

  describe('Features Section', () => {
    it('should display key features', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('🎬 Smart Recording')).toBeInTheDocument();
      expect(screen.getByText('🤖 AI Test Generation')).toBeInTheDocument();
      expect(screen.getByText('📊 Advanced Analytics')).toBeInTheDocument();
      expect(screen.getByText('🔗 Multi-Platform Support')).toBeInTheDocument();
    });

    it('should show feature descriptions', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText(/Record user interactions/)).toBeInTheDocument();
      expect(screen.getByText(/Generate comprehensive tests/)).toBeInTheDocument();
      expect(screen.getByText(/Track test performance/)).toBeInTheDocument();
      expect(screen.getByText(/Web, mobile, and API testing/)).toBeInTheDocument();
    });

    it('should display feature icons', () => {
      renderWithProviders(<HomePage />);
      
      const featureIcons = screen.getAllByRole('img', { hidden: true });
      expect(featureIcons.length).toBeGreaterThan(0);
    });
  });

  describe('How It Works Section', () => {
    it('should display step-by-step process', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('How It Works')).toBeInTheDocument();
      expect(screen.getByText('1. Record')).toBeInTheDocument();
      expect(screen.getByText('2. Generate')).toBeInTheDocument();
      expect(screen.getByText('3. Execute')).toBeInTheDocument();
      expect(screen.getByText('4. Analyze')).toBeInTheDocument();
    });

    it('should show step descriptions', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText(/Capture user interactions/)).toBeInTheDocument();
      expect(screen.getByText(/AI generates test code/)).toBeInTheDocument();
      expect(screen.getByText(/Run tests automatically/)).toBeInTheDocument();
      expect(screen.getByText(/Get detailed insights/)).toBeInTheDocument();
    });
  });

  describe('Testimonials Section', () => {
    it('should display customer testimonials', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('What Our Customers Say')).toBeInTheDocument();
      expect(screen.getByText(/reduced testing time/)).toBeInTheDocument();
      expect(screen.getByText(/improved test coverage/)).toBeInTheDocument();
    });

    it('should show customer names and companies', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('TechCorp Inc.')).toBeInTheDocument();
      expect(screen.getByText('Mike Chen')).toBeInTheDocument();
      expect(screen.getByText('StartupXYZ')).toBeInTheDocument();
    });

    it('should display star ratings', () => {
      renderWithProviders(<HomePage />);
      
      const starRatings = screen.getAllByText('★★★★★');
      expect(starRatings.length).toBeGreaterThan(0);
    });
  });

  describe('Pricing Section', () => {
    it('should display pricing plans', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument();
      expect(screen.getByText('Free')).toBeInTheDocument();
      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    it('should show pricing details', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('$0')).toBeInTheDocument();
      expect(screen.getByText('$29')).toBeInTheDocument();
      expect(screen.getByText('$99')).toBeInTheDocument();
      expect(screen.getByText('/month')).toBeInTheDocument();
    });

    it('should display plan features', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('5 recordings per month')).toBeInTheDocument();
      expect(screen.getByText('Unlimited recordings')).toBeInTheDocument();
      expect(screen.getByText('Custom integrations')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should have navigation menu', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('Features')).toBeInTheDocument();
      expect(screen.getByText('Pricing')).toBeInTheDocument();
      expect(screen.getByText('Documentation')).toBeInTheDocument();
      expect(screen.getByText('Contact')).toBeInTheDocument();
    });

    it('should have login and signup buttons', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
    });

    it('should handle navigation clicks', () => {
      renderWithProviders(<HomePage />);
      
      const featuresLink = screen.getByText('Features');
      fireEvent.click(featuresLink);
      
      // Should scroll to features section or navigate
      expect(featuresLink).toBeInTheDocument();
    });
  });

  describe('Call-to-Action Buttons', () => {
    it('should handle start free trial click', async () => {
      renderWithProviders(<HomePage />);
      
      const startTrialButton = screen.getByText('Start Free Trial');
      fireEvent.click(startTrialButton);
      
      // Should navigate to signup or open modal
      expect(startTrialButton).toBeInTheDocument();
    });

    it('should handle watch demo click', async () => {
      renderWithProviders(<HomePage />);
      
      const watchDemoButton = screen.getByText('Watch Demo');
      fireEvent.click(watchDemoButton);
      
      // Should open video modal or navigate to demo page
      expect(watchDemoButton).toBeInTheDocument();
    });

    it('should handle view documentation click', async () => {
      renderWithProviders(<HomePage />);
      
      const docsButton = screen.getByText('View Documentation');
      fireEvent.click(docsButton);
      
      // Should navigate to documentation
      expect(docsButton).toBeInTheDocument();
    });
  });

  describe('Newsletter Signup', () => {
    it('should display newsletter signup form', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('Stay Updated')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
      expect(screen.getByText('Subscribe')).toBeInTheDocument();
    });

    it('should handle newsletter signup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      renderWithProviders(<HomePage />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const subscribeButton = screen.getByText('Subscribe');
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/newsletter/subscribe',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            }),
            body: expect.stringContaining('test@example.com')
          })
        );
      });
    });

    it('should show success message on signup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      renderWithProviders(<HomePage />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const subscribeButton = screen.getByText('Subscribe');
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Successfully subscribed to newsletter!');
      });
    });

    it('should handle signup errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Signup failed'));

      renderWithProviders(<HomePage />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const subscribeButton = screen.getByText('Subscribe');
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to subscribe to newsletter');
      });
    });
  });

  describe('Footer', () => {
    it('should display footer links', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText('About Us')).toBeInTheDocument();
      expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
      expect(screen.getByText('Terms of Service')).toBeInTheDocument();
      expect(screen.getByText('Support')).toBeInTheDocument();
    });

    it('should show social media links', () => {
      renderWithProviders(<HomePage />);
      
      const socialLinks = screen.getAllByRole('link');
      expect(socialLinks.length).toBeGreaterThan(0);
    });

    it('should display copyright information', () => {
      renderWithProviders(<HomePage />);
      
      expect(screen.getByText(/© 2024 Questro/)).toBeInTheDocument();
      expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should be responsive on mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<HomePage />);
      
      // Should still render all sections
      expect(screen.getByText(/Revolutionize Your Testing/)).toBeInTheDocument();
      expect(screen.getByText('Features')).toBeInTheDocument();
      expect(screen.getByText('Pricing')).toBeInTheDocument();
    });

    it('should have mobile-friendly navigation', () => {
      renderWithProviders(<HomePage />);
      
      // Should have hamburger menu or mobile navigation
      const mobileMenu = screen.queryByRole('button', { name: /menu/i });
      expect(mobileMenu).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading state for async operations', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithProviders(<HomePage />);
      
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const subscribeButton = screen.getByText('Subscribe');
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(subscribeButton);

      await waitFor(() => {
        expect(screen.getByText('Subscribing...')).toBeInTheDocument();
      });
    });
  });

  describe('SEO and Accessibility', () => {
    it('should have proper heading structure', () => {
      renderWithProviders(<HomePage />);
      
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
      
      const h2s = screen.getAllByRole('heading', { level: 2 });
      expect(h2s.length).toBeGreaterThan(0);
    });

    it('should have proper alt text for images', () => {
      renderWithProviders(<HomePage />);
      
      const images = screen.getAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('alt');
      });
    });

    it('should have proper ARIA labels', () => {
      renderWithProviders(<HomePage />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });
});


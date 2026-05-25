/**
 * LunaOS Pricing Page — Unit Tests
 */

import { render, screen } from '@testing-library/react';
import PricingPage from '../page';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

describe('PricingPage', () => {
    test('renders page headline', () => {
        render(<PricingPage />);
        expect(screen.getByText('Let Luna watch your code')).toBeInTheDocument();
    });

    test('renders all three pricing tiers', () => {
        render(<PricingPage />);

        expect(screen.getByText('Free')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByText('Team')).toBeInTheDocument();
    });

    test('renders correct prices', () => {
        render(<PricingPage />);

        expect(screen.getByText('$0')).toBeInTheDocument();
        expect(screen.getByText('$29')).toBeInTheDocument();
        expect(screen.getByText('$79')).toBeInTheDocument();
    });

    test('Pro plan is marked as most popular', () => {
        render(<PricingPage />);
        expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    test('Free tier includes key features', () => {
        render(<PricingPage />);

        expect(screen.getAllByText('Unlimited commands').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Bring your own API keys')).toBeInTheDocument();
        expect(screen.getByText('CLI + Dashboard + Studio')).toBeInTheDocument();
    });

    test('Pro tier includes upgrade features', () => {
        render(<PricingPage />);

        expect(screen.getByText('Managed AI keys (no BYOK needed)')).toBeInTheDocument();
        expect(screen.getByText('33 MCP servers pre-configured')).toBeInTheDocument();
        expect(screen.getByText('RAG code search + memory')).toBeInTheDocument();
    });

    test('Team tier includes team features', () => {
        render(<PricingPage />);

        expect(screen.getByText('Team workspace + collaboration')).toBeInTheDocument();
        expect(screen.getByText('Shared memory + team learnings')).toBeInTheDocument();
        expect(screen.getByText('SSO / SAML')).toBeInTheDocument();
    });

    test('renders CTA buttons for each plan', () => {
        render(<PricingPage />);

        expect(screen.getByText('Get Started')).toBeInTheDocument();
        expect(screen.getByText('Start Pro Trial')).toBeInTheDocument();
        expect(screen.getByText('Contact Sales')).toBeInTheDocument();
    });

    test('renders contact email in FAQ section', () => {
        render(<PricingPage />);
        expect(screen.getByText('hello@lunaos.ai')).toBeInTheDocument();
    });
});

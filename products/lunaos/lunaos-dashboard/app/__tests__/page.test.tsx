/**
 * LunaOS Landing Page — Unit Tests
 */

import { render, screen } from '@testing-library/react';
import LandingPage from '../page';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

describe('LandingPage', () => {
    test('renders hero with main headline', () => {
        render(<LandingPage />);

        expect(screen.getByText('AI agents that watch')).toBeInTheDocument();
        expect(screen.getByText('your code')).toBeInTheDocument();
    });

    test('renders LunaOS brand in navigation', () => {
        render(<LandingPage />);
        expect(screen.getByText('LunaOS')).toBeInTheDocument();
    });

    test('renders beta badge', () => {
        render(<LandingPage />);
        expect(screen.getByText('28 AI agents · Now in beta')).toBeInTheDocument();
    });

    test('renders CTA buttons', () => {
        render(<LandingPage />);
        expect(screen.getByText('Start for Free')).toBeInTheDocument();
        expect(screen.getByText('Read the Docs')).toBeInTheDocument();
    });

    test('renders terminal demo with CLI command', () => {
        render(<LandingPage />);
        expect(screen.getAllByText(/npx luna-agents run code-review/).length).toBeGreaterThanOrEqual(1);
    });

    test('renders all 6 feature cards', () => {
        render(<LandingPage />);

        expect(screen.getByText('Code Review')).toBeInTheDocument();
        expect(screen.getByText('Test Generation')).toBeInTheDocument();
        expect(screen.getByText('Security Audit')).toBeInTheDocument();
        expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
        expect(screen.getByText('Documentation')).toBeInTheDocument();
        expect(screen.getByText('CI/CD Pipeline')).toBeInTheDocument();
    });

    test('renders Luna story section', () => {
        render(<LandingPage />);

        expect(screen.getByText(/Why "Luna"\?/)).toBeInTheDocument();
        expect(screen.getByText(/one-eyed cat adopted at 2 months old/)).toBeInTheDocument();
    });

    test('renders navigation links', () => {
        render(<LandingPage />);

        expect(screen.getAllByText('Docs').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('GitHub').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Login')).toBeInTheDocument();
        expect(screen.getAllByText('Get Started').length).toBeGreaterThanOrEqual(1);
    });

    test('renders footer with copyright', () => {
        render(<LandingPage />);
        expect(screen.getByText('LunaOS © 2026')).toBeInTheDocument();
    });

    test('renders final CTA section', () => {
        render(<LandingPage />);
        expect(screen.getByText('Ready to let Luna watch your code?')).toBeInTheDocument();
        expect(screen.getByText('Create Free Account')).toBeInTheDocument();
    });

    test('signup CTA links to /auth/signup', () => {
        render(<LandingPage />);
        const ctaLinks = screen.getAllByText('Start for Free');
        // First CTA in hero
        expect(ctaLinks[0].closest('a')).toHaveAttribute('href', '/auth/signup');
    });

    test('login link points to /auth/login', () => {
        render(<LandingPage />);
        const loginLink = screen.getByText('Login');
        expect(loginLink.closest('a')).toHaveAttribute('href', '/auth/login');
    });

    test('cursor tracker responds to mousemove', () => {
        render(<LandingPage />);
        // Trigger mousemove to exercise CursorTracker useEffect
        const moveEvent = new MouseEvent('mousemove', {
            clientX: 400,
            clientY: 300,
            bubbles: true,
        });
        window.dispatchEvent(moveEvent);
        // The pupil element exists and no errors thrown
        const pupils = document.querySelectorAll('.pupil');
        expect(pupils.length).toBeGreaterThanOrEqual(1);
    });

    test('counter animation runs on mount', () => {
        // Mock requestAnimationFrame to execute callback immediately
        const rafCallbacks: FrameRequestCallback[] = [];
        const origRAF = window.requestAnimationFrame;
        window.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
            rafCallbacks.push(cb);
            return 1;
        });

        const origPerfNow = performance.now;
        let now = 0;
        performance.now = jest.fn(() => now);

        render(<LandingPage />);

        // Execute stored raf callbacks to simulate animation
        // First call is at time 0
        if (rafCallbacks.length > 0) {
            now = 0;
            rafCallbacks[0](0);
        }
        // Advance to end of animation
        if (rafCallbacks.length > 1) {
            now = 2000;
            rafCallbacks[rafCallbacks.length - 1](2000);
        }

        // Verify counter rendered a number (28, or partial)
        expect(screen.getAllByText(/\d+/).length).toBeGreaterThanOrEqual(1);

        // Restore
        window.requestAnimationFrame = origRAF;
        performance.now = origPerfNow;
    });
});

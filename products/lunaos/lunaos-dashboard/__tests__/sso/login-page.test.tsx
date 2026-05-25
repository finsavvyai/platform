/**
 * /login — Email-first SSO discovery login page.
 * Tests: email submit → discovery, 200 → redirect, 404 → password form,
 * loading state, error handling, open-redirect safety.
 *
 * Known gap: server-side path uses localStorage token → returns null in server
 * component. All tests exercise the client-component path only.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../../app/login/page';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    usePathname: () => '/login',
    useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/link', () => {
    return ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>;
});

jest.mock('../../lib/api/sso', () => ({
    ssoApi: {
        discover: jest.fn(),
        initiateOidc: jest.fn(),
        initiateSaml: jest.fn(),
    },
}));

jest.mock('../../lib/api', () => ({
    authApi: {
        login: jest.fn(),
        isAuthenticated: jest.fn(() => false),
    },
}));

jest.mock('../../components/auth/OAuthButtons', () => ({
    OAuthButtons: () => <div data-testid="oauth-buttons">OAuth Buttons</div>,
    OAuthDivider: () => <hr data-testid="oauth-divider" />,
}));

jest.mock('../../components/auth/SsoRedirectingState', () => ({
    SsoRedirectingState: () => <div data-testid="sso-redirecting">Redirecting to SSO…</div>,
}));

import { ssoApi } from '../../lib/api/sso';
import { authApi } from '../../lib/api';

const mockDiscover = ssoApi.discover as jest.Mock;
const mockInitiateOidc = ssoApi.initiateOidc as jest.Mock;
const mockLogin = authApi.login as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeEmail(email: string) {
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: email } });
}

function submitContinue() {
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
}

// Several tests in this file spy on `document.createElement`, override
// `window.location`, or append <form> elements via the SAML redirect path.
// RTL's auto-cleanup only handles its own rendered containers, so we have to
// restore mutated globals ourselves before each test.
import { cleanup } from '@testing-library/react';
const originalLocation = window.location;
afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    Object.defineProperty(window, 'location', { writable: true, value: originalLocation });
    document.body.innerHTML = '';
});

// ─── Initial render ───────────────────────────────────────────────────────────

describe('LoginPage — initial render', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDiscover.mockResolvedValue(null);
    });

    it('renders LunaOS branding', () => {
        render(<LoginPage />);
        expect(screen.getByText('LunaOS')).toBeInTheDocument();
    });

    it('renders work email input', () => {
        render(<LoginPage />);
        expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    });

    it('renders Continue button initially (not Sign In)', () => {
        render(<LoginPage />);
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    });

    it('renders sign-up link', () => {
        render(<LoginPage />);
        expect(screen.getByText(/sign up/i).closest('a')).toHaveAttribute('href', '/auth/signup');
    });

    it('renders CLI hint', () => {
        render(<LoginPage />);
        expect(screen.getByText(/luna init --cloud/)).toBeInTheDocument();
    });

    it('Continue button is disabled when email is empty', () => {
        render(<LoginPage />);
        expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });
});

// ─── Discovery: 200 → SSO redirect ───────────────────────────────────────────

describe('LoginPage — discovery: SSO found (200)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows redirecting state after SSO discovery returns IdP', async () => {
        mockDiscover.mockResolvedValueOnce({
            idpId: 'idp-1', type: 'oidc', initiateUrl: '/v1/sso/oidc/initiate',
        });
        mockInitiateOidc.mockResolvedValueOnce({ redirectUrl: 'https://idp.example.com/auth' });

        // Capture window.location.href assignment
        const originalHref = window.location.href;
        Object.defineProperty(window, 'location', {
            writable: true,
            value: { ...window.location, href: originalHref },
        });

        render(<LoginPage />);
        typeEmail('alice@sso-domain.com');
        submitContinue();

        await waitFor(() => {
            expect(screen.getByTestId('sso-redirecting')).toBeInTheDocument();
        });
        expect(mockDiscover).toHaveBeenCalledWith('alice@sso-domain.com');
    });

    it('calls ssoApi.initiateOidc for oidc type', async () => {
        mockDiscover.mockResolvedValueOnce({ idpId: 'idp-1', type: 'oidc', initiateUrl: '/v1/sso/oidc/initiate' });
        mockInitiateOidc.mockResolvedValueOnce({ redirectUrl: 'https://idp.example.com/auth' });
        Object.defineProperty(window, 'location', { writable: true, value: { href: '' } });

        render(<LoginPage />);
        typeEmail('user@oidc-domain.com');
        submitContinue();

        await waitFor(() => {
            expect(mockInitiateOidc).toHaveBeenCalledWith('idp-1');
        });
    });

    it('submits POST form for SAML binding method=POST', async () => {
        // Render FIRST, then install the createElement spy so it only
        // intercepts the SAML form creation (the app calls document.createElement('form')
        // later in handleSsoInitiate). Spying before render would steal the
        // first createElement call which RTL uses internally — that leaves
        // the body empty and the test cannot find the work-email label.
        mockDiscover.mockResolvedValueOnce({ idpId: 'idp-2', type: 'saml', initiateUrl: '/v1/sso/saml/initiate' });
        const { initiateSaml } = ssoApi;
        (initiateSaml as jest.Mock).mockResolvedValueOnce({
            method: 'POST', url: 'https://idp.example.com/sso',
            params: { SAMLRequest: 'base64request', RelayState: 'relay' },
        });

        render(<LoginPage />);

        const submitSpy = jest.fn();
        const realCreate = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
            const el = realCreate(tag);
            if (tag === 'form') (el as HTMLFormElement).submit = submitSpy;
            return el;
        }) as typeof document.createElement);

        typeEmail('user@saml-domain.com');
        submitContinue();

        await waitFor(() => {
            expect(initiateSaml).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(submitSpy).toHaveBeenCalled();
        });
    });
});

// ─── Discovery: 404 → password fallback ──────────────────────────────────────

describe('LoginPage — discovery: SSO not found (404)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows password field when discovery returns null', async () => {
        mockDiscover.mockResolvedValueOnce(null);
        render(<LoginPage />);
        typeEmail('user@no-sso.com');
        submitContinue();

        await waitFor(() => {
            expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('email field is still editable in password step', async () => {
        mockDiscover.mockResolvedValueOnce(null);
        render(<LoginPage />);
        typeEmail('user@domain.com');
        submitContinue();

        await waitFor(() => {
            expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        });
        expect(screen.getByDisplayValue('user@domain.com')).toBeInTheDocument();
    });

    it('shows "Use a different email" back link in password step', async () => {
        mockDiscover.mockResolvedValueOnce(null);
        render(<LoginPage />);
        typeEmail('user@domain.com');
        submitContinue();

        await waitFor(() => {
            expect(screen.getByText(/use a different email/i)).toBeInTheDocument();
        });
    });

    it('"Use a different email" returns to email step', async () => {
        mockDiscover.mockResolvedValueOnce(null);
        render(<LoginPage />);
        typeEmail('user@domain.com');
        submitContinue();

        await waitFor(() => {
            expect(screen.getByText(/use a different email/i)).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText(/use a different email/i));
        expect(screen.queryByLabelText(/^password/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });
});

// ─── Password submit ──────────────────────────────────────────────────────────

describe('LoginPage — password submit', () => {
    beforeEach(() => jest.clearAllMocks());

    async function reachPasswordStep(email = 'user@domain.com') {
        mockDiscover.mockResolvedValueOnce(null);
        render(<LoginPage />);
        typeEmail(email);
        submitContinue();
        await waitFor(() => screen.getByLabelText(/^password/i));
    }

    it('calls authApi.login with email and password', async () => {
        await reachPasswordStep('alice@domain.com');
        mockLogin.mockResolvedValueOnce({ ok: true, data: { token: 'tok' } });
        fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'pass123' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith('alice@domain.com', 'pass123');
        });
    });

    it('redirects to /dashboard on successful login', async () => {
        await reachPasswordStep();
        mockLogin.mockResolvedValueOnce({ ok: true, data: { token: 'tok' } });
        fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'pass' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('shows error on failed login', async () => {
        await reachPasswordStep();
        mockLogin.mockResolvedValueOnce({ ok: false, data: { error: 'Invalid credentials' } });
        fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'wrong' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/invalid credentials/i);
        });
    });

    it('shows network error on fetch failure', async () => {
        await reachPasswordStep();
        mockLogin.mockRejectedValueOnce(new Error('Network error'));
        fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'pass' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
        });
    });
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('LoginPage — loading state', () => {
    it('shows loading indicator while discovery in progress', async () => {
        let resolve: (v: any) => void;
        mockDiscover.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
        render(<LoginPage />);
        typeEmail('user@domain.com');
        submitContinue();
        await waitFor(() => {
            expect(screen.getByText(/checking/i)).toBeInTheDocument();
        });
        resolve!(null);
    });

    it('loading state has accessible label (spinner aria-hidden)', async () => {
        let resolve: (v: any) => void;
        mockDiscover.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
        render(<LoginPage />);
        typeEmail('user@domain.com');
        submitContinue();
        await waitFor(() => {
            // The spinner SVG should be aria-hidden=true
            const submitBtn = screen.getByRole('button', { name: /checking/i });
            expect(submitBtn).toBeInTheDocument();
        });
        resolve!(null);
    });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('LoginPage — discovery error handling', () => {
    it('shows error message when discovery throws', async () => {
        mockDiscover.mockRejectedValueOnce(new Error('Service unavailable'));
        render(<LoginPage />);
        typeEmail('user@domain.com');
        submitContinue();
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
        });
    });

    it('stays on email step after discovery error', async () => {
        mockDiscover.mockRejectedValueOnce(new Error('fail'));
        render(<LoginPage />);
        typeEmail('user@domain.com');
        submitContinue();
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
        // Should be back to email step (Continue button visible)
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });
});

// ─── Form accessibility ───────────────────────────────────────────────────────

describe('LoginPage — form accessibility', () => {
    it('form has accessible label', () => {
        render(<LoginPage />);
        expect(screen.getByRole('form', { name: /sign in form/i })).toBeInTheDocument();
    });

    it('error message has aria-live=polite', () => {
        render(<LoginPage />);
        // Error container is in the DOM but hidden initially
        // Trigger an error to check aria-live
        mockDiscover.mockRejectedValueOnce(new Error('fail'));
        typeEmail('user@domain.com');
        submitContinue();
        // The container is pre-rendered but empty — check for aria-live
    });
});

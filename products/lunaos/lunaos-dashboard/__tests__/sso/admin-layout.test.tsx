/**
 * app/admin/sso/layout.tsx — passthrough layout.
 *
 * The earlier server-side cookie guard was removed because the site is built
 * with `output: 'export'` (Cloudflare Pages static), so server components
 * cannot read cookies at request time. Auth is enforced downstream:
 *   - child client components call ssoApi.* with credentials: 'include'
 *   - the engine sets/reads the HttpOnly `sso_session` cookie
 *   - on 401 the client redirects to /login (NOT /auth/login)
 *
 * These tests guard the passthrough contract so the cookie reads do not
 * silently reappear in the layout.
 */

import { render } from '@testing-library/react';
import SsoAdminLayout from '../../app/admin/sso/layout';

describe('SsoAdminLayout — passthrough contract', () => {
    it('renders children as-is (no async, no redirect)', () => {
        const { getByTestId } = render(
            <SsoAdminLayout>
                <div data-testid="child">hello</div>
            </SsoAdminLayout>,
        );
        expect(getByTestId('child').textContent).toBe('hello');
    });

    it('is a synchronous component (no server cookie read)', () => {
        const result = SsoAdminLayout({ children: null });
        // If a future change re-introduces server cookie reads it will be
        // async (Promise) — this guards against that regression.
        expect(typeof (result as { then?: unknown }).then).toBe('undefined');
    });
});

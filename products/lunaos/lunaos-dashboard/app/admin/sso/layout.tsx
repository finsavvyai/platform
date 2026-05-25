/**
 * /admin/sso/* layout — passthrough.
 *
 * SECURITY: Under `output: 'export'` (Cloudflare Pages static), server-side
 * cookie reads are not available at build time. Auth is enforced by the
 * engine API: child client components call `ssoApi.*` with credentials:
 * 'include', and on 401 redirect to `/login`. The HttpOnly `sso_session`
 * cookie is set/read only by the engine.
 */
export default function SsoAdminLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

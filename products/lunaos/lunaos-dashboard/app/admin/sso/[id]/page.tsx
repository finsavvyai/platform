/**
 * /admin/sso/[id] — server wrapper for static export compatibility.
 * Renders the EditSsoProviderClient on the client; IDs resolved at runtime.
 *
 * Returns an empty static-params list — the client component fetches the
 * IdP from the engine API using useParams, so prerendering is unnecessary.
 */
import EditSsoProviderClient from './EditSsoProviderClient';

// Static export emits one placeholder shell; the client resolves the real
// IdP ID from the URL pathname and fetches it at runtime via ssoApi.
export async function generateStaticParams() {
    return [{ id: '_' }];
}

export default function EditSsoProviderPage() {
    return <EditSsoProviderClient />;
}

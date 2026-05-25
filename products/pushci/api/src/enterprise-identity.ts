// Enterprise identity-status lookup — scoped to the caller's org membership.
//
// H-003 fix: the previous implementation did `kv.list({ prefix: "saml:tenant:" })`
// and returned the first match regardless of who asked, leaking the existence
// and name of *some* tenant's SSO/SCIM config to every authenticated user.
//
// New contract: a user only sees SAML/SCIM status for organizations they are
// a member of. Tenant slugs in KV (`saml:tenant:${slug}`, `scim:token:${slug}`)
// are aligned with `organizations.slug` — the same slug used everywhere else
// in the team-orgs / saml-routes / scim.ts surface.

export interface IdentityStatus {
  sso: {
    configured: boolean;
    provider: string | null;
    tenant: string | null;
    updated_at: string | null;
  };
  scim: {
    configured: boolean;
    tenant: string | null;
  };
  checked_at: string;
}

interface SamlTenantHit {
  tenant: string;
  raw: string;
}

// List every org slug the user belongs to. We don't trust callers with an
// `org_id` in the request — the SAML/SCIM status question is "what does MY
// org have configured?", which is fully derivable from the JWT sub.
export async function listUserOrgSlugs(
  db: D1Database,
  userSub: string,
): Promise<string[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT o.slug FROM organizations o
         JOIN org_members om ON om.org_id = o.id
         WHERE om.user_sub = ?`,
      )
      .bind(userSub)
      .all<{ slug: string }>();
    return (results ?? []).map((r) => r.slug).filter((s): s is string => !!s);
  } catch {
    return [];
  }
}

// Look up SAML config for any of the user's orgs. Returns the first hit —
// which is safe here because the search space is already scoped to the
// caller's membership set (unlike the old global-prefix scan).
export async function samlForUser(
  kv: KVNamespace,
  orgSlugs: string[],
): Promise<SamlTenantHit | null> {
  for (const slug of orgSlugs) {
    try {
      const raw = await kv.get(`saml:tenant:${slug}`);
      if (raw) return { tenant: slug, raw };
    } catch {
      // continue — per-slug failure must not leak others' data
    }
  }
  return null;
}

export async function scimForUser(
  kv: KVNamespace,
  orgSlugs: string[],
): Promise<string | null> {
  for (const slug of orgSlugs) {
    try {
      const token = await kv.get(`scim:token:${slug}`);
      if (token) return slug;
    } catch {
      // continue
    }
  }
  return null;
}

export function deriveProvider(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { entityId?: string };
    if (!parsed.entityId) return null;
    if (/microsoft|azure/i.test(parsed.entityId)) return "Azure AD (SAML 2.0)";
    if (/okta/i.test(parsed.entityId)) return "Okta (SAML 2.0)";
    if (/onelogin/i.test(parsed.entityId)) return "OneLogin (SAML 2.0)";
    return "SAML 2.0";
  } catch {
    return null;
  }
}

export function extractUpdatedAt(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { updatedAt?: string };
    return parsed.updatedAt ?? null;
  } catch {
    return null;
  }
}

export function buildIdentityStatus(
  saml: SamlTenantHit | null,
  scimTenant: string | null,
): IdentityStatus {
  return {
    sso: {
      configured: !!saml,
      provider: saml ? deriveProvider(saml.raw) : null,
      tenant: saml?.tenant ?? null,
      updated_at: saml ? extractUpdatedAt(saml.raw) : null,
    },
    scim: { configured: !!scimTenant, tenant: scimTenant ?? null },
    checked_at: new Date().toISOString(),
  };
}

-- Maps source-IP CIDR blocks to a tenant_id so transparent-proxy
-- traffic (DNS hijack at api.anthropic.com on a corp network) is
-- attributed to the right tenant for billing + audit. Customers
-- register one or more CIDRs at onboarding (their corp egress).
--
-- Uses Postgres `cidr` type so we can do `cidr >>= $1` containment
-- queries. Most-specific match wins (`ORDER BY masklen(cidr) DESC`)
-- so a /28 carve-out for a contractor inside the corp /16 routes
-- to the contractor's tenant, not the parent.

CREATE TABLE IF NOT EXISTS tenant_network_map (
  id           BIGSERIAL PRIMARY KEY,
  cidr         cidr        NOT NULL,
  tenant_id    TEXT        NOT NULL,
  label        TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tnm_cidr      ON tenant_network_map USING GIST (cidr inet_ops);
CREATE INDEX IF NOT EXISTS idx_tnm_tenant_id ON tenant_network_map (tenant_id);

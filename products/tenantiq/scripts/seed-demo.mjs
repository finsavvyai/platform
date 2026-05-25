#!/usr/bin/env node
// seed-demo.mjs — Seed 5 demo orgs + tenants with config snapshot/drift data
// Usage: node scripts/seed-demo.mjs [--env staging] [--local]

import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const isLocal = args.includes('--local');
const envIdx = args.indexOf('--env');
const envArg = envIdx !== -1 ? args[envIdx + 1] : null;
const envFlag = envArg ? `--env ${envArg}` : '';
// staging env uses tenantiq-staging DB; production uses tenantiq-production
const DB_NAME = envArg === 'staging' ? 'tenantiq-staging' : 'tenantiq-production';
const localFlag = isLocal ? '--local' : '';

// wrangler.toml lives in apps/api — run commands from there
const API_DIR = new URL('../apps/api', import.meta.url).pathname;

function sql(query) {
  const escaped = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute ${DB_NAME} ${envFlag} ${localFlag} --command "${escaped}"`;
  execSync(cmd, { stdio: 'pipe', cwd: API_DIR });
}

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------
const now = new Date();
const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
const ts = (d = now) => d.toISOString();
const epoch = (d = now) => Math.floor(d.getTime() / 1000);

// ---------------------------------------------------------------------------
// SECTION 1: Organizations
// ---------------------------------------------------------------------------
console.log('[seed] Creating 5 organizations...');

const orgs = [
  { id: 'org-alpha-001', name: 'AlphaCorp MSP',     plan: 'enterprise', status: 'active' },
  { id: 'org-beta-001',  name: 'BetaHealth Ltd',    plan: 'professional', status: 'active' },
  { id: 'org-gamma-001', name: 'GammaSec Partners', plan: 'professional', status: 'active' },
  { id: 'org-delta-001', name: 'DeltaRetail',       plan: 'starter',      status: 'active' },
  { id: 'org-remit-demo',name: 'RemitDemo',         plan: 'enterprise', status: 'active' },
];

for (const o of orgs) {
  const slug = o.id; // use id as slug — unique, no spaces
  const email = `admin@${o.id.replace('org-','').replace(/-\d+$/,'')}.com`;
  sql(`INSERT OR REPLACE INTO organizations (id, name, slug, primary_contact_email, subscription_tier, status, created_by, created_at, updated_at)
       VALUES ('${o.id}','${o.name}','${slug}','${email}','${o.plan}','${o.status}','system','${ts()}','${ts()}')`);
}

// ---------------------------------------------------------------------------
// SECTION 2: Platform users (one admin per org)
// ---------------------------------------------------------------------------
const users = [
  { id: 'pu-alpha-admin', org: 'org-alpha-001', email: 'admin@alphacorp.com',   name: 'Alex Alpha',   role: 'admin' },
  { id: 'pu-beta-admin',  org: 'org-beta-001',  email: 'admin@betahealth.com',  name: 'Beth Beta',    role: 'admin' },
  { id: 'pu-gamma-admin', org: 'org-gamma-001', email: 'admin@gammasec.com',    name: 'Gary Gamma',   role: 'admin' },
  { id: 'pu-delta-admin', org: 'org-delta-001', email: 'admin@deltaretail.com', name: 'Diana Delta',  role: 'admin' },
  { id: 'pu-remit-admin', org: 'org-remit-demo',email: 'admin@remit.co.il',     name: 'Rami Remit',   role: 'admin' },
];

for (const u of users) {
  sql(`INSERT OR REPLACE INTO platform_users (id, organization_id, email, name, role, status, created_at, updated_at)
       VALUES ('${u.id}','${u.org}','${u.email}','${u.name}','${u.role}','active','${ts()}','${ts()}')`);
}

// ---------------------------------------------------------------------------
// SECTION 3: Tenants
// ---------------------------------------------------------------------------
console.log('[seed] Creating 11 tenants...');

const tenants = [
  { id: 'tenant-alpha-001', org: 'org-alpha-001', azureId: 'az-alpha-t1-0001', name: 'AlphaCorp HQ',      domain: 'alphacorp.com' },
  { id: 'tenant-alpha-002', org: 'org-alpha-001', azureId: 'az-alpha-t2-0002', name: 'AlphaCorp EU',      domain: 'eu.alphacorp.com' },
  { id: 'tenant-alpha-003', org: 'org-alpha-001', azureId: 'az-alpha-t3-0003', name: 'AlphaCorp Dev',     domain: 'dev.alphacorp.com' },
  { id: 'tenant-beta-001',  org: 'org-beta-001',  azureId: 'az-beta-t1-0001',  name: 'BetaHealth Main',   domain: 'betahealth.com' },
  { id: 'tenant-gamma-001', org: 'org-gamma-001', azureId: 'az-gamma-t1-0001', name: 'GammaSec Primary',  domain: 'gammasec.com' },
  { id: 'tenant-gamma-002', org: 'org-gamma-001', azureId: 'az-gamma-t2-0002', name: 'GammaSec Labs',     domain: 'labs.gammasec.com' },
  { id: 'tenant-delta-001', org: 'org-delta-001', azureId: 'az-delta-t1-0001', name: 'DeltaRetail Core',  domain: 'deltaretail.com' },
  { id: 'tenant-delta-002', org: 'org-delta-001', azureId: 'az-delta-t2-0002', name: 'DeltaRetail APAC',  domain: 'apac.deltaretail.com' },
  { id: 'tenant-remit-001', org: 'org-remit-demo',azureId: 'az-remit-t1-0001', name: 'Remit.co.il Main',  domain: 'remit.co.il' },
];

for (const t of tenants) {
  sql(`INSERT OR REPLACE INTO tenants (id, organization_id, azure_tenant_id, display_name, domain, status, last_sync_at, created_at)
       VALUES ('${t.id}','${t.org}','${t.azureId}','${t.name}','${t.domain}','active',${epoch()},${epoch()})`);
}

// ---------------------------------------------------------------------------
// SECTION 4: Config snapshots (baseline + current for drifted tenants)
// ---------------------------------------------------------------------------
// Tenants with drift need a baseline (7d ago) + current snapshot.
// Clean tenants get a single baseline-flagged snapshot.
const snapshots = [
  // alpha-t1: drifted
  { id: 'snap-alpha-001-base', tenantId: 'tenant-alpha-001', label: 'Pre-change baseline', type: 'scheduled', baseline: 1, cats: 8, objs: 142, errs: 0, by: 'pu-alpha-admin', at: ts(sevenDaysAgo) },
  { id: 'snap-alpha-001-curr', tenantId: 'tenant-alpha-001', label: 'Latest snapshot',     type: 'scheduled', baseline: 0, cats: 8, objs: 142, errs: 2, by: 'system',         at: ts() },
  // alpha-t2: drifted
  { id: 'snap-alpha-002-base', tenantId: 'tenant-alpha-002', label: 'Pre-change baseline', type: 'manual',    baseline: 1, cats: 5, objs: 88,  errs: 0, by: 'pu-alpha-admin', at: ts(sevenDaysAgo) },
  { id: 'snap-alpha-002-curr', tenantId: 'tenant-alpha-002', label: 'Latest snapshot',     type: 'manual',    baseline: 0, cats: 5, objs: 88,  errs: 1, by: 'system',         at: ts() },
  // alpha-t3: clean
  { id: 'snap-alpha-003-base', tenantId: 'tenant-alpha-003', label: 'Clean baseline',      type: 'scheduled', baseline: 1, cats: 4, objs: 60,  errs: 0, by: 'pu-alpha-admin', at: ts(sevenDaysAgo) },
  // beta-t1: drifted
  { id: 'snap-beta-001-base',  tenantId: 'tenant-beta-001',  label: 'Pre-change baseline', type: 'scheduled', baseline: 1, cats: 9, objs: 210, errs: 0, by: 'pu-beta-admin',  at: ts(sevenDaysAgo) },
  { id: 'snap-beta-001-curr',  tenantId: 'tenant-beta-001',  label: 'Latest snapshot',     type: 'scheduled', baseline: 0, cats: 9, objs: 210, errs: 3, by: 'system',         at: ts() },
  // gamma: clean
  { id: 'snap-gamma-001-base', tenantId: 'tenant-gamma-001', label: 'Clean baseline',      type: 'scheduled', baseline: 1, cats: 6, objs: 95,  errs: 0, by: 'pu-gamma-admin', at: ts(sevenDaysAgo) },
  { id: 'snap-gamma-002-base', tenantId: 'tenant-gamma-002', label: 'Clean baseline',      type: 'scheduled', baseline: 1, cats: 4, objs: 72,  errs: 0, by: 'pu-gamma-admin', at: ts(sevenDaysAgo) },
  // delta-t1: drifted
  { id: 'snap-delta-001-base', tenantId: 'tenant-delta-001', label: 'Pre-change baseline', type: 'manual',    baseline: 1, cats: 5, objs: 118, errs: 0, by: 'pu-delta-admin', at: ts(sevenDaysAgo) },
  { id: 'snap-delta-001-curr', tenantId: 'tenant-delta-001', label: 'Latest snapshot',     type: 'manual',    baseline: 0, cats: 5, objs: 118, errs: 1, by: 'system',         at: ts() },
  // delta-t2: drifted
  { id: 'snap-delta-002-base', tenantId: 'tenant-delta-002', label: 'Pre-change baseline', type: 'scheduled', baseline: 1, cats: 5, objs: 104, errs: 0, by: 'pu-delta-admin', at: ts(sevenDaysAgo) },
  { id: 'snap-delta-002-curr', tenantId: 'tenant-delta-002', label: 'Latest snapshot',     type: 'scheduled', baseline: 0, cats: 5, objs: 104, errs: 2, by: 'system',         at: ts() },
  // remit-t1: drifted
  { id: 'snap-remit-001-base', tenantId: 'tenant-remit-001', label: 'Pre-change baseline', type: 'scheduled', baseline: 1, cats: 7, objs: 130, errs: 0, by: 'pu-remit-admin', at: ts(sevenDaysAgo) },
  { id: 'snap-remit-001-curr', tenantId: 'tenant-remit-001', label: 'Latest snapshot',     type: 'scheduled', baseline: 0, cats: 7, objs: 130, errs: 1, by: 'system',         at: ts() },
];

for (const s of snapshots) {
  sql(`INSERT OR REPLACE INTO config_snapshots (id, tenant_id, label, snapshot_type, baseline, category_count, object_count, error_count, created_by, created_at)
       VALUES ('${s.id}','${s.tenantId}','${s.label}','${s.type}',${s.baseline},${s.cats},${s.objs},${s.errs},'${s.by}','${s.at}')`);
}

// ---------------------------------------------------------------------------
// SECTION 5: Config drifts
// ---------------------------------------------------------------------------
console.log('[seed] Creating 14 drift records...');

const drifts = [
  // alpha-t1: 2 CRITICAL
  { id: 'drift-alpha-001-1', tid: 'tenant-alpha-001', snapId: 'snap-alpha-001-curr', baseId: 'snap-alpha-001-base', cat: 'conditional_access', path: 'policies.RequireMFA.state',            old: 'enabled',  nw: 'disabled', sev: 'critical' },
  { id: 'drift-alpha-001-2', tid: 'tenant-alpha-001', snapId: 'snap-alpha-001-curr', baseId: 'snap-alpha-001-base', cat: 'security_defaults',  path: 'securityDefaults.isEnabled',           old: 'true',     nw: 'false',    sev: 'critical' },
  // alpha-t2: 1 WARNING
  { id: 'drift-alpha-002-1', tid: 'tenant-alpha-002', snapId: 'snap-alpha-002-curr', baseId: 'snap-alpha-002-base', cat: 'named_locations',    path: 'namedLocations.OfficeNetwork.ipRanges', old: '[]',       nw: '["203.0.113.0/24"]', sev: 'warning' },
  // beta-t1: 3 CRITICAL
  { id: 'drift-beta-001-1',  tid: 'tenant-beta-001',  snapId: 'snap-beta-001-curr',  baseId: 'snap-beta-001-base',  cat: 'mfa',                path: 'authenticationMethods.MFA.state',       old: 'enabled',  nw: 'disabled', sev: 'critical' },
  { id: 'drift-beta-001-2',  tid: 'tenant-beta-001',  snapId: 'snap-beta-001-curr',  baseId: 'snap-beta-001-base',  cat: 'auth_methods',       path: 'authenticationMethods.allowedMethods',  old: '["mfa","email"]', nw: '["email"]', sev: 'critical' },
  { id: 'drift-beta-001-3',  tid: 'tenant-beta-001',  snapId: 'snap-beta-001-curr',  baseId: 'snap-beta-001-base',  cat: 'directory_roles',    path: 'roles.GlobalAdministrator.members',     old: '["beth@betahealth.com"]', nw: '["beth@betahealth.com","unknown@external.com"]', sev: 'critical' },
  // delta-t1: 1 INFO
  { id: 'drift-delta-001-1', tid: 'tenant-delta-001', snapId: 'snap-delta-001-curr', baseId: 'snap-delta-001-base', cat: 'sensitivity_labels', path: 'labels.Confidential.displayName',       old: 'Confidential', nw: 'Company Confidential', sev: 'info' },
  // delta-t2: 2 WARNING
  { id: 'drift-delta-002-1', tid: 'tenant-delta-002', snapId: 'snap-delta-002-curr', baseId: 'snap-delta-002-base', cat: 'cross_tenant_access', path: 'crossTenantAccessPolicy.defaultSettings.b2bCollaboration.inboundAllowed', old: 'false', nw: 'true', sev: 'warning' },
  { id: 'drift-delta-002-2', tid: 'tenant-delta-002', snapId: 'snap-delta-002-curr', baseId: 'snap-delta-002-base', cat: 'cross_tenant_access', path: 'crossTenantAccessPolicy.defaultSettings.b2bDirectConnect.inboundAllowed', old: 'false', nw: 'true', sev: 'warning' },
  // remit-t1: 1 CRITICAL
  { id: 'drift-remit-001-1', tid: 'tenant-remit-001', snapId: 'snap-remit-001-curr', baseId: 'snap-remit-001-base', cat: 'conditional_access', path: 'policies.BlockLegacyAuth.state',        old: 'enabled',  nw: 'disabled', sev: 'critical' },
];

for (const d of drifts) {
  const oldEsc = d.old.replace(/'/g, "''");
  const newEsc = d.nw.replace(/'/g, "''");
  sql(`INSERT OR REPLACE INTO config_drifts (id, tenant_id, snapshot_id, baseline_id, category, path, old_value, new_value, severity, acknowledged, detected_at)
       VALUES ('${d.id}','${d.tid}','${d.snapId}','${d.baseId}','${d.cat}','${d.path}','${oldEsc}','${newEsc}','${d.sev}',0,'${ts()}')`);
}

// ---------------------------------------------------------------------------
// SECTION 6: Security alerts for each CRITICAL drift
// ---------------------------------------------------------------------------
console.log('[seed] Creating 7 security alerts...');

const criticalAlerts = [
  { id: 'alert-alpha-001-1', tid: 'tenant-alpha-001', org: 'org-alpha-001', title: 'MFA Conditional Access Policy Disabled',   desc: 'RequireMFA conditional access policy was disabled — all users can now bypass MFA.',     cat: 'conditional_access' },
  { id: 'alert-alpha-001-2', tid: 'tenant-alpha-001', org: 'org-alpha-001', title: 'Security Defaults Turned Off',             desc: 'Azure AD security defaults were disabled, removing baseline identity protections.',        cat: 'security_defaults' },
  { id: 'alert-beta-001-1',  tid: 'tenant-beta-001',  org: 'org-beta-001',  title: 'MFA Authentication Method Disabled',       desc: 'MFA authentication method was removed from allowed methods, weakening sign-in security.',  cat: 'mfa' },
  { id: 'alert-beta-001-2',  tid: 'tenant-beta-001',  org: 'org-beta-001',  title: 'Authentication Methods Modified',          desc: 'Allowed authentication methods changed — MFA no longer required for sign-in.',             cat: 'auth_methods' },
  { id: 'alert-beta-001-3',  tid: 'tenant-beta-001',  org: 'org-beta-001',  title: 'Unexpected Global Administrator Added',    desc: 'An external account was added to the Global Administrator role without approval.',          cat: 'directory_roles' },
  { id: 'alert-remit-001-1', tid: 'tenant-remit-001', org: 'org-remit-demo',title: 'Legacy Auth Block Policy Disabled',        desc: 'BlockLegacyAuth conditional access policy was disabled, allowing legacy protocol sign-ins.', cat: 'conditional_access' },
];

for (const a of criticalAlerts) {
  const descEsc = a.desc.replace(/'/g, "''");
  sql(`INSERT OR REPLACE INTO alerts (id, tenant_id, type, severity, title, description, source, status, created_at, updated_at)
       VALUES ('${a.id}','${a.tid}','config_drift','critical','${a.title}','${descEsc}','drift_detector','open','${ts()}','${ts()}')`);
}

// ---------------------------------------------------------------------------
// SECTION 7: SSO connections
// ---------------------------------------------------------------------------
const ssoConnections = [
  { id: 'sso-alpha-001', org: 'org-alpha-001', provider: 'oidc', name: 'AlphaCorp Entra OIDC', domain: 'alphacorp.com',  issuer: 'https://login.microsoftonline.com/alpha-tenant-id/v2.0', clientId: 'alpha-client-id-001', status: 'active', jit: 1 },
  { id: 'sso-beta-001',  org: 'org-beta-001',  provider: 'saml', name: 'BetaHealth Okta SAML', domain: 'betahealth.com', issuer: 'https://betahealth.okta.com',                           clientId: null,                  status: 'active', jit: 1 },
  { id: 'sso-remit-001', org: 'org-remit-demo',provider: 'oidc', name: 'Remit Entra OIDC',     domain: 'remit.co.il',   issuer: 'https://login.microsoftonline.com/remit-tenant-id/v2.0', clientId: 'remit-client-id-001', status: 'active', jit: 0 },
];

for (const s of ssoConnections) {
  const clientVal = s.clientId ? `'${s.clientId}'` : 'NULL';
  sql(`INSERT OR REPLACE INTO sso_connections (id, org_id, provider, display_name, domain, issuer_url, client_id, status, jit_enabled, created_at, updated_at)
       VALUES ('${s.id}','${s.org}','${s.provider}','${s.name}','${s.domain}','${s.issuer}',${clientVal},'${s.status}',${s.jit},${epoch()},${epoch()})`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const dbRef = isLocal
  ? `npx wrangler d1 execute ${DB_NAME} --local`
  : `npx wrangler d1 execute ${DB_NAME} ${envFlag}`;

console.log('[seed] Done.');
console.log(`[seed] Seeded: ${orgs.length} orgs | ${tenants.length} tenants | ${snapshots.length} snapshots | ${drifts.length} drifts | ${criticalAlerts.length} alerts | ${ssoConnections.length} SSO connections`);
console.log(`[seed] Verify: ${dbRef} --command "SELECT COUNT(*) FROM config_drifts"`);

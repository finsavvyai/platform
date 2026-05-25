/**
 * GCP Security Scanner
 *
 * Runs 5 security checks against GCP projects using service account credentials:
 * 1. Public Cloud Storage buckets
 * 2. Overly permissive firewall rules
 * 3. IAM policy bindings (primitive roles)
 * 4. Service account key age
 * 5. Cloud Logging sink coverage
 */
import type { SecurityFinding } from '../aws-scanner/types.js';

export interface GcpScanConfig {
  projectId: string;
  credentials: GcpServiceAccountKey;
}

export interface GcpServiceAccountKey {
  clientEmail: string;
  privateKey: string;
  projectId: string;
}

interface GcpApiOptions {
  token: string;
  projectId: string;
}

/** Obtain an access token from GCP service account key (JWT grant) */
async function getAccessToken(credentials: GcpServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const scope = 'https://www.googleapis.com/auth/cloud-platform';
  const payload = { iss: credentials.clientEmail, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };

  // Sign JWT with service account private key
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToBuffer(credentials.privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${body}`));
  const jwt = `${header}.${body}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json() as { access_token?: string };
  if (!data.access_token) throw new Error('Failed to obtain GCP access token');
  return data.access_token;
}

function pemToBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function gcpGet(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function checkPublicBuckets(opts: GcpApiOptions): Promise<SecurityFinding[]> {
  const data = await gcpGet(`https://storage.googleapis.com/storage/v1/b?project=${opts.projectId}`, opts.token) as any;
  const findings: SecurityFinding[] = [];
  for (const bucket of data?.items ?? []) {
    const iam = await gcpGet(`https://storage.googleapis.com/storage/v1/b/${bucket.name}/iam`, opts.token) as any;
    const hasPublic = (iam?.bindings ?? []).some((b: any) => b.members?.some((m: string) => m === 'allUsers' || m === 'allAuthenticatedUsers'));
    if (hasPublic) {
      findings.push({ checkId: 'gcp-storage-public', severity: 'high', resourceId: bucket.name, resourceType: 'storage.bucket', region: bucket.location ?? 'global', title: 'Public Cloud Storage bucket', description: `Bucket ${bucket.name} is publicly accessible`, remediation: 'Remove allUsers/allAuthenticatedUsers from bucket IAM policy' });
    }
  }
  return findings;
}

async function checkFirewallRules(opts: GcpApiOptions): Promise<SecurityFinding[]> {
  const data = await gcpGet(`https://compute.googleapis.com/compute/v1/projects/${opts.projectId}/global/firewalls`, opts.token) as any;
  const findings: SecurityFinding[] = [];
  for (const rule of data?.items ?? []) {
    const hasOpenIngress = rule.direction === 'INGRESS' && (rule.sourceRanges ?? []).includes('0.0.0.0/0');
    if (hasOpenIngress && rule.allowed?.some((a: any) => !a.ports || a.ports.includes('0-65535'))) {
      findings.push({ checkId: 'gcp-firewall-open', severity: 'critical', resourceId: rule.name, resourceType: 'compute.firewall', region: 'global', title: 'Overly permissive firewall rule', description: `Firewall rule ${rule.name} allows all traffic from 0.0.0.0/0`, remediation: 'Restrict source ranges and ports in firewall rule' });
    }
  }
  return findings;
}

async function checkIamBindings(opts: GcpApiOptions): Promise<SecurityFinding[]> {
  const data = await gcpGet(`https://cloudresourcemanager.googleapis.com/v1/projects/${opts.projectId}:getIamPolicy`, opts.token) as any;
  const findings: SecurityFinding[] = [];
  const primitiveRoles = ['roles/owner', 'roles/editor'];
  for (const binding of data?.bindings ?? []) {
    if (primitiveRoles.includes(binding.role)) {
      for (const member of binding.members ?? []) {
        if (member.startsWith('user:') || member.startsWith('serviceAccount:')) {
          findings.push({ checkId: 'gcp-iam-primitive-role', severity: 'medium', resourceId: member, resourceType: 'iam.binding', region: 'global', title: 'Primitive IAM role assigned', description: `${member} has primitive role ${binding.role}`, remediation: 'Replace primitive roles with least-privilege predefined roles' });
        }
      }
    }
  }
  return findings;
}

async function checkServiceAccountKeys(opts: GcpApiOptions): Promise<SecurityFinding[]> {
  const data = await gcpGet(`https://iam.googleapis.com/v1/projects/${opts.projectId}/serviceAccounts`, opts.token) as any;
  const findings: SecurityFinding[] = [];
  const maxAge = 90 * 86400000;
  for (const sa of data?.accounts ?? []) {
    const keys = await gcpGet(`https://iam.googleapis.com/v1/${sa.name}/keys`, opts.token) as any;
    for (const key of keys?.keys ?? []) {
      if (key.keyType !== 'USER_MANAGED') continue;
      const age = Date.now() - new Date(key.validAfterTime).getTime();
      if (age > maxAge) {
        findings.push({ checkId: 'gcp-sa-key-old', severity: 'medium', resourceId: `${sa.email}/${key.name.split('/').pop()}`, resourceType: 'iam.serviceAccountKey', region: 'global', title: 'Service account key older than 90 days', description: `Key for ${sa.email} created ${key.validAfterTime}`, remediation: 'Rotate or delete old service account keys' });
      }
    }
  }
  return findings;
}

async function checkLoggingSinks(opts: GcpApiOptions): Promise<SecurityFinding[]> {
  const data = await gcpGet(`https://logging.googleapis.com/v2/projects/${opts.projectId}/sinks`, opts.token) as any;
  const sinks = data?.sinks ?? [];
  if (sinks.length === 0) {
    return [{ checkId: 'gcp-logging-no-sink', severity: 'medium', resourceId: opts.projectId, resourceType: 'logging.sink', region: 'global', title: 'No logging sinks configured', description: 'Project has no log sinks for export or retention', remediation: 'Create a log sink to export audit logs to Cloud Storage or BigQuery' }];
  }
  return [];
}

/** Run all GCP security checks and return aggregated findings */
export async function runGcpScan(config: GcpScanConfig): Promise<SecurityFinding[]> {
  const token = await getAccessToken(config.credentials);
  const opts: GcpApiOptions = { token, projectId: config.projectId };

  const results = await Promise.allSettled([
    checkPublicBuckets(opts), checkFirewallRules(opts),
    checkIamBindings(opts), checkServiceAccountKeys(opts), checkLoggingSinks(opts),
  ]);

  const findings: SecurityFinding[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') findings.push(...r.value);
    else console.error('GCP check failed:', r.reason);
  }
  return findings;
}

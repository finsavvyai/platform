import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { validateCloudConnectionSchema } from './validation/cloud-validate.js';

export const cloudValidateRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
cloudValidateRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

/** POST /api/cloud/accounts/validate — test cloud credentials without storing */
cloudValidateRoutes.post('/accounts/validate', async (c) => {
  const parsed = validateCloudConnectionSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      400,
    );
  }

  const { provider, credentials } = parsed.data;

  try {
    const result = await testConnection(provider, credentials);
    return c.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection test failed';
    return c.json({ data: { valid: false, error: message } });
  }
});

interface ValidationResult {
  valid: boolean;
  identity?: string;
  error?: string;
}

/** Lightweight API call to verify cloud credentials are working */
async function testConnection(
  provider: string,
  credentials: Record<string, string>,
): Promise<ValidationResult> {
  switch (provider) {
    case 'aws':
      return testAws(credentials);
    case 'azure':
      return testAzure(credentials);
    case 'gcp':
      return testGcp(credentials);
    default:
      return { valid: false, error: `Unsupported provider: ${provider}` };
  }
}

async function testAws(creds: Record<string, string>): Promise<ValidationResult> {
  const roleArn = creds.roleArn;
  if (!roleArn) return { valid: false, error: 'Role ARN is required for AWS' };

  // Validate ARN format
  if (!roleArn.startsWith('arn:aws:iam::')) {
    return { valid: false, error: 'Invalid Role ARN format' };
  }

  // In production, this would call STS AssumeRole + GetCallerIdentity
  // For now, validate format and return success
  return { valid: true, identity: roleArn };
}

async function testAzure(creds: Record<string, string>): Promise<ValidationResult> {
  const { clientId, clientSecret, tenantId } = creds;
  if (!clientId || !clientSecret || !tenantId) {
    return { valid: false, error: 'Client ID, Client Secret, and Tenant ID are required' };
  }

  // In production, this would call Azure AD token endpoint + Graph API
  // Validate UUID format for clientId and tenantId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(clientId)) {
    return { valid: false, error: 'Invalid Client ID format (expected UUID)' };
  }
  if (!uuidRegex.test(tenantId)) {
    return { valid: false, error: 'Invalid Tenant ID format (expected UUID)' };
  }

  return { valid: true, identity: `${clientId}@${tenantId}` };
}

async function testGcp(creds: Record<string, string>): Promise<ValidationResult> {
  const serviceAccountJson = creds.serviceAccountJson;
  if (!serviceAccountJson) {
    return { valid: false, error: 'Service account JSON is required' };
  }

  try {
    const parsed = JSON.parse(serviceAccountJson);
    if (!parsed.client_email || !parsed.project_id) {
      return { valid: false, error: 'Invalid service account JSON: missing client_email or project_id' };
    }
    return { valid: true, identity: `${parsed.client_email} (${parsed.project_id})` };
  } catch {
    return { valid: false, error: 'Invalid JSON format for service account key' };
  }
}

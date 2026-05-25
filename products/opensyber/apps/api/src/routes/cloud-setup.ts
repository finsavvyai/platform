import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { getAwsSetup } from '../services/cloud-setup-aws.js';
import { getAzureSetup } from '../services/cloud-setup-azure.js';
import { getGcpSetup } from '../services/cloud-setup-gcp.js';

export const cloudSetupRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
cloudSetupRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

/** GET /api/cloud/setup/aws — CloudFormation template + instructions */
cloudSetupRoutes.get('/setup/aws', async (c) => {
  const orgId = c.get('orgId');
  const userId = c.get('userId');
  const externalId = orgId ?? userId;
  const setup = getAwsSetup(externalId);
  return c.json({ data: setup });
});

/** GET /api/cloud/setup/azure — Azure CLI commands + instructions */
cloudSetupRoutes.get('/setup/azure', async (c) => {
  const setup = getAzureSetup();
  return c.json({ data: setup });
});

/** GET /api/cloud/setup/gcp — gcloud CLI commands + instructions */
cloudSetupRoutes.get('/setup/gcp', async (c) => {
  const setup = getGcpSetup();
  return c.json({ data: setup });
});

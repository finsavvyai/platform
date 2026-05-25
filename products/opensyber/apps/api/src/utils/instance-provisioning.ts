/**
 * Instance provisioning helpers — extracted to stay under 200 lines.
 */

import { eq } from 'drizzle-orm';
import { users } from '@opensyber/db';
import type { Env } from '../types.js';
import { createAgentAuthKey } from '../services/tailscale.js';
import { emailService } from '../services/email.js';

/** Create Tailscale auth key if configured, or return undefined for graceful degradation. */
export async function tryCreateTailscaleKey(
  env: Env, instanceId: string, orgId: string,
): Promise<string | undefined> {
  if (!env.TAILSCALE_API_KEY || !env.TAILSCALE_TAILNET) return undefined;
  try {
    const result = await createAgentAuthKey(
      { apiKey: env.TAILSCALE_API_KEY, tailnet: env.TAILSCALE_TAILNET },
      { instanceId, orgId },
    );
    return result.authKey;
  } catch (err) {
    console.error('[Instances] Tailscale auth key failed:', err);
    return undefined;
  }
}

/** Best-effort deploy notification email. */
export async function sendDeployEmail(
  user: { id: string; email: string; name: string; emailFlags: string | null },
  instanceName: string | undefined,
  db: any,
  resendApiKey: string,
): Promise<void> {
  const flags = user.emailFlags ? JSON.parse(user.emailFlags as string) : {};
  if (flags.agentDeployedSent) return;

  await emailService.sendAgentDeployedEmail({
    to: user.email, userName: user.name,
    instanceName: instanceName || 'My Agent',
    apiKey: resendApiKey,
  });
  flags.agentDeployedSent = true;
  await db.update(users).set({ emailFlags: JSON.stringify(flags) }).where(eq(users.id, user.id));
}

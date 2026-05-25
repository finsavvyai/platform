/**
 * Tailscale ACL policy management for multi-org agent isolation.
 *
 * Generates and pushes deny-by-default policies where:
 * - tag:controller can reach all tag:agent devices
 * - tag:agent can reach tag:controller on specific ports
 * - Agents in the same org (tag:org-X) can communicate
 * - Agents across different orgs are cryptographically isolated
 */

import {
  TAILSCALE_TAGS,
  type TailscaleACLPolicy,
  type TailscaleACLRule,
} from '@opensyber/shared';

const TAILSCALE_API = 'https://api.tailscale.com/api/v2';

/** Ports the controller exposes to agents */
const CONTROLLER_PORTS = '443,8080';

export interface ACLServiceDeps {
  apiKey: string;
  tailnet: string;
}

/**
 * Build the full ACL policy for the OpenSyber tailnet.
 *
 * @param orgIds - All active organization IDs for intra-org rules
 */
export function buildACLPolicy(orgIds: string[]): TailscaleACLPolicy {
  const acls: TailscaleACLRule[] = [
    // Controller can reach all agents (monitoring, commands, health checks)
    {
      action: 'accept',
      src: [TAILSCALE_TAGS.controller],
      dst: [`${TAILSCALE_TAGS.agent}:*`],
    },
    // Agents can reach controller on API ports only
    {
      action: 'accept',
      src: [TAILSCALE_TAGS.agent],
      dst: [`${TAILSCALE_TAGS.controller}:${CONTROLLER_PORTS}`],
    },
  ];

  // Intra-org communication rules — agents in the same org can talk
  for (const orgId of orgIds) {
    const orgTag = `${TAILSCALE_TAGS.orgPrefix}${orgId}`;
    acls.push({
      action: 'accept',
      src: [orgTag],
      dst: [`${orgTag}:*`],
    });
  }

  return {
    acls,
    tagOwners: {
      [TAILSCALE_TAGS.controller]: ['autogroup:admin'],
      [TAILSCALE_TAGS.agent]: ['autogroup:admin'],
      // Explicit org tag owners — Tailscale does not support wildcards in tagOwners
      ...Object.fromEntries(
        orgIds.map((id) => [`${TAILSCALE_TAGS.orgPrefix}${id}`, ['autogroup:admin']]),
      ),
    },
  };
}

/**
 * Push ACL policy to the Tailscale tailnet.
 * This is an atomic replace — the entire policy is overwritten.
 */
export async function pushACLPolicy(
  deps: ACLServiceDeps,
  policy: TailscaleACLPolicy,
): Promise<void> {
  const response = await fetch(
    `${TAILSCALE_API}/tailnet/${deps.tailnet}/acl`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deps.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(policy),
    },
  );

  if (!response.ok) {
    const err = await response.text().catch(() => 'unknown');
    throw new Error(`Tailscale pushACL failed (${response.status}): ${err}`);
  }
}

/**
 * Validate an ACL policy against the Tailscale API without applying it.
 * Returns validation errors if the policy is invalid.
 */
export async function validateACLPolicy(
  deps: ACLServiceDeps,
  policy: TailscaleACLPolicy,
): Promise<{ valid: boolean; errors?: string[] }> {
  const response = await fetch(
    `${TAILSCALE_API}/tailnet/${deps.tailnet}/acl/validate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deps.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(policy),
    },
  );

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    return { valid: false, errors: [data.message ?? `HTTP ${response.status}`] };
  }

  return { valid: true };
}

/**
 * Convenience: rebuild and push ACLs for a set of active org IDs.
 * Call this when an org is created or destroyed.
 */
export async function syncACLPolicy(
  deps: ACLServiceDeps,
  activeOrgIds: string[],
): Promise<void> {
  const policy = buildACLPolicy(activeOrgIds);
  await pushACLPolicy(deps, policy);
}

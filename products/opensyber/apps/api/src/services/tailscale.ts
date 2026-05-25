/**
 * Tailscale REST API client for zero-trust agent networking.
 *
 * Manages auth keys, devices, and ACL policies via the Tailscale
 * management API (api.tailscale.com/api/v2).
 *
 * All calls use fetch() — no Go dependency, runs in Cloudflare Workers.
 */

import {
  TAILSCALE_TAGS,
  type TailscaleAuthKey,
  type TailscaleDevice,
  type TailscaleProvisionResult,
} from '@opensyber/shared';

const TAILSCALE_API = 'https://api.tailscale.com/api/v2';

/** Auth key validity window — agents must provision within this time. */
const AUTH_KEY_EXPIRY_SECONDS = 600;

export interface TailscaleServiceDeps {
  apiKey: string;
  tailnet: string;
}

/**
 * Create a pre-authorized, ephemeral, single-use auth key for an agent.
 * Tags the device with agent + org + instance for ACL enforcement.
 */
export async function createAgentAuthKey(
  deps: TailscaleServiceDeps,
  opts: { instanceId: string; orgId: string },
): Promise<TailscaleProvisionResult> {
  const tags = [
    TAILSCALE_TAGS.agent,
    `${TAILSCALE_TAGS.orgPrefix}${opts.orgId}`,
    `${TAILSCALE_TAGS.instancePrefix}${opts.instanceId}`,
  ];

  const response = await fetch(
    `${TAILSCALE_API}/tailnet/${deps.tailnet}/keys`,
    {
      method: 'POST',
      headers: buildHeaders(deps.apiKey),
      body: JSON.stringify({
        capabilities: {
          devices: {
            create: {
              reusable: false,
              ephemeral: true,
              preauthorized: true,
              tags,
            },
          },
        },
        expirySeconds: AUTH_KEY_EXPIRY_SECONDS,
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text().catch(() => 'unknown');
    throw new Error(`Tailscale createAuthKey failed (${response.status}): ${err}`);
  }

  const data = (await response.json()) as TailscaleAuthKey;
  return { authKey: data.key, authKeyId: data.id, tags };
}

/**
 * Delete a device from the tailnet (called on instance destroy).
 * Idempotent — 404 is treated as success.
 */
export async function deleteDevice(
  deps: TailscaleServiceDeps,
  deviceId: string,
): Promise<void> {
  const response = await fetch(`${TAILSCALE_API}/device/${deviceId}`, {
    method: 'DELETE',
    headers: buildHeaders(deps.apiKey),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Tailscale deleteDevice failed (${response.status})`);
  }
}

/**
 * Find a device by hostname in the tailnet.
 * Used to look up the Tailscale node ID after provisioning.
 */
export async function findDeviceByHostname(
  deps: TailscaleServiceDeps,
  hostname: string,
): Promise<TailscaleDevice | null> {
  const response = await fetch(
    `${TAILSCALE_API}/tailnet/${deps.tailnet}/devices`,
    { headers: buildHeaders(deps.apiKey) },
  );

  if (!response.ok) {
    throw new Error(`Tailscale listDevices failed (${response.status})`);
  }

  const data = (await response.json()) as { devices: TailscaleDevice[] };
  return data.devices.find((d) => d.hostname === hostname) ?? null;
}

/**
 * Expire a device's key — forces re-authentication on next connect.
 * Used when quarantining a compromised agent.
 */
export async function expireDeviceKey(
  deps: TailscaleServiceDeps,
  deviceId: string,
): Promise<void> {
  const response = await fetch(
    `${TAILSCALE_API}/device/${deviceId}/key`,
    {
      method: 'POST',
      headers: buildHeaders(deps.apiKey),
      body: JSON.stringify({ keyExpiryDisabled: false }),
    },
  );

  if (!response.ok) {
    throw new Error(`Tailscale expireDeviceKey failed (${response.status})`);
  }
}

/**
 * List all devices in the tailnet with optional tag filter.
 */
export async function listDevices(
  deps: TailscaleServiceDeps,
  tagFilter?: string,
): Promise<TailscaleDevice[]> {
  const response = await fetch(
    `${TAILSCALE_API}/tailnet/${deps.tailnet}/devices`,
    { headers: buildHeaders(deps.apiKey) },
  );

  if (!response.ok) {
    throw new Error(`Tailscale listDevices failed (${response.status})`);
  }

  const data = (await response.json()) as { devices: TailscaleDevice[] };
  if (!tagFilter) return data.devices;
  return data.devices.filter((d) => d.tags?.includes(tagFilter));
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/** Tailscale integration types for zero-trust agent networking. */

export interface TailscaleAuthKey {
  id: string;
  key: string;
  created: string;
  expires: string;
  capabilities: {
    devices: {
      create: {
        reusable: boolean;
        ephemeral: boolean;
        preauthorized: boolean;
        tags: string[];
      };
    };
  };
}

export interface TailscaleDevice {
  id: string;
  name: string;
  hostname: string;
  addresses: string[];
  authorized: boolean;
  tags: string[];
  lastSeen: string;
  os: string;
  clientVersion: string;
}

export interface TailscaleACLPolicy {
  acls: TailscaleACLRule[];
  tagOwners: Record<string, string[]>;
  autoApprovers?: Record<string, string[]>;
}

export interface TailscaleACLRule {
  action: 'accept';
  src: string[];
  dst: string[];
}

export interface TailscaleConfig {
  apiKey: string;
  tailnet: string;
  controllerTag: string;
  agentTagPrefix: string;
  orgTagPrefix: string;
  enabled: boolean;
}

export interface TailscaleProvisionResult {
  authKey: string;
  authKeyId: string;
  tags: string[];
}

/** CGNAT range used by Tailscale for device IPs */
export const TAILSCALE_CGNAT_RANGE = '100.64.0.0/10';

/** Tailscale DNS suffix */
export const TAILSCALE_DNS_SUFFIX = '.ts.net';

/** Default tag constants */
export const TAILSCALE_TAGS = {
  controller: 'tag:controller',
  agent: 'tag:agent',
  orgPrefix: 'tag:org-',
  instancePrefix: 'tag:instance-',
} as const;

/** Environment variable names for Tailscale sidecar */
export const TAILSCALE_ENV_VARS = {
  authKey: 'TS_AUTHKEY',
  hostname: 'TS_HOSTNAME',
  userspace: 'TS_USERSPACE',
  stateDir: 'TS_STATE_DIR',
  acceptRoutes: 'TS_ACCEPT_ROUTES',
} as const;

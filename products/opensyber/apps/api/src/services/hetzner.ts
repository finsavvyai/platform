import type { Region } from '@opensyber/shared';

/** Map OpenSyber regions to Hetzner datacenter locations */
const HETZNER_REGION_MAP: Record<string, string> = {
  'eu-central': 'fsn1',
  'us-east': 'ash',
  'us-west': 'hil',
  'ap-southeast': 'sin',
};

/** Map plan tiers to Hetzner server types */
const PLAN_SERVER_TYPES: Record<string, string> = {
  free: 'cpx11',
  personal: 'cpx11',
  pro: 'cpx21',
  team: 'cpx31',
  professional: 'cpx31',
  enterprise: 'cpx41',
  mission_defender: 'cpx51',
};

export interface HetznerServerResult {
  hetznerServerId: number;
  ipv4: string;
  ipv6: string;
}

export interface HetznerService {
  createServer(opts: {
    instanceId: string;
    region: Region;
    plan: string;
    apiToken: string;
    userData?: string;
    sshKeyIds?: number[];
  }): Promise<HetznerServerResult>;

  deleteServer(opts: {
    hetznerServerId: number;
    apiToken: string;
  }): Promise<void>;

  restartServer(opts: {
    hetznerServerId: number;
    apiToken: string;
  }): Promise<void>;

  powerOffServer(opts: {
    hetznerServerId: number;
    apiToken: string;
  }): Promise<void>;

  getServerStatus(opts: {
    hetznerServerId: number;
    apiToken: string;
  }): Promise<'running' | 'stopped' | 'error'>;
}

const HETZNER_API = 'https://api.hetzner.cloud/v1';

export const hetznerService: HetznerService = {
  async createServer({ instanceId, region, plan, apiToken, userData, sshKeyIds }) {
    const location = HETZNER_REGION_MAP[region] ?? 'fsn1';
    const serverType = PLAN_SERVER_TYPES[plan] ?? 'cpx11';

    const payload: Record<string, unknown> = {
      name: `opensyber-${instanceId}`,
      server_type: serverType,
      location,
      image: 'ubuntu-22.04',
      start_after_create: true,
      labels: { 'opensyber-instance': instanceId },
    };

    if (userData) {
      payload.user_data = userData;
    }
    if (sshKeyIds && sshKeyIds.length > 0) {
      payload.ssh_keys = sshKeyIds;
    }

    const response = await fetch(`${HETZNER_API}/servers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `Hetzner createServer failed (${response.status}): ${JSON.stringify(err)}`,
      );
    }

    const data = (await response.json()) as {
      server: {
        id: number;
        public_net: {
          ipv4: { ip: string };
          ipv6: { ip: string };
        };
      };
    };

    return {
      hetznerServerId: data.server.id,
      ipv4: data.server.public_net.ipv4.ip,
      ipv6: data.server.public_net.ipv6.ip,
    };
  },

  async deleteServer({ hetznerServerId, apiToken }) {
    const response = await fetch(`${HETZNER_API}/servers/${hetznerServerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    // 404 = already deleted, treat as success (idempotent)
    if (!response.ok && response.status !== 404) {
      throw new Error(`Hetzner deleteServer failed (${response.status})`);
    }
  },

  async restartServer({ hetznerServerId, apiToken }) {
    const response = await fetch(
      `${HETZNER_API}/servers/${hetznerServerId}/actions/reboot`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Hetzner restartServer failed (${response.status})`);
    }
  },

  async powerOffServer({ hetznerServerId, apiToken }) {
    const response = await fetch(
      `${HETZNER_API}/servers/${hetznerServerId}/actions/poweroff`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Hetzner powerOffServer failed (${response.status})`);
    }
  },

  async getServerStatus({ hetznerServerId, apiToken }) {
    const response = await fetch(`${HETZNER_API}/servers/${hetznerServerId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!response.ok) {
      return 'error';
    }

    const data = (await response.json()) as {
      server: { status: string };
    };

    if (data.server.status === 'running') return 'running';
    if (data.server.status === 'off' || data.server.status === 'stopped')
      return 'stopped';
    return 'error';
  },
};

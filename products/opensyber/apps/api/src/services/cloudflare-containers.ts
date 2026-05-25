/**
 * Cloudflare Containers provisioning service.
 *
 * Uses the Cloudflare API to manage containerized agent instances.
 * Each agent runs as an isolated container on Cloudflare's network,
 * co-located with the API Worker for minimal latency.
 *
 * Docs: https://developers.cloudflare.com/containers/
 */

export interface ContainerInstanceResult {
  containerId: string;
  hostname: string;
  region: string;
}

export interface ContainerService {
  createInstance(opts: {
    instanceId: string;
    region: string;
    plan: string;
    accountId: string;
    apiToken: string;
    agentImage: string;
    envVars: Record<string, string>;
  }): Promise<ContainerInstanceResult>;

  deleteInstance(opts: {
    containerId: string;
    accountId: string;
    apiToken: string;
  }): Promise<void>;

  restartInstance(opts: {
    containerId: string;
    accountId: string;
    apiToken: string;
  }): Promise<void>;

  getInstanceStatus(opts: {
    containerId: string;
    accountId: string;
    apiToken: string;
  }): Promise<'running' | 'stopped' | 'error'>;
}

const CF_API = 'https://api.cloudflare.com/client/v4';

/** Map plan tiers to container resource limits */
const PLAN_RESOURCES: Record<string, { memory: string; vcpu: number }> = {
  free: { memory: '256Mi', vcpu: 1 },
  personal: { memory: '512Mi', vcpu: 1 },
  pro: { memory: '1Gi', vcpu: 2 },
  team: { memory: '2Gi', vcpu: 4 },
};

/** Map OpenSyber regions to Cloudflare colo hints */
export const CF_REGION_MAP: Record<string, string> = {
  'eu-central': 'weur',
  'us-east': 'enam',
  'us-west': 'wnam',
  'ap-southeast': 'apac',
};

export const containerService: ContainerService = {
  async createInstance({
    instanceId, region, plan, accountId,
    apiToken, agentImage, envVars,
  }) {
    const resources = PLAN_RESOURCES[plan] ?? PLAN_RESOURCES['free'] ?? { memory: '256Mi', vcpu: 1 };
    const locationHint = CF_REGION_MAP[region] ?? 'enam';

    const response = await fetch(
      `${CF_API}/accounts/${accountId}/containers/instances`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `opensyber-agent-${instanceId}`,
          image: agentImage,
          location_hint: locationHint,
          resources: {
            memory: resources.memory,
            vcpu: resources.vcpu,
          },
          environment_variables: Object.entries(envVars).map(
            ([key, value]) => ({ name: key, value }),
          ),
          labels: {
            'opensyber-instance': instanceId,
            'opensyber-plan': plan,
          },
          restart_policy: 'always',
        }),
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `CF container create failed (${response.status}): `
        + `${JSON.stringify(err)}`,
      );
    }

    const data = (await response.json()) as {
      result: { id: string; hostname: string; region: string };
    };

    return {
      containerId: data.result.id,
      hostname: data.result.hostname,
      region: data.result.region,
    };
  },

  async deleteInstance({ containerId, accountId, apiToken }) {
    const response = await fetch(
      `${CF_API}/accounts/${accountId}/containers/instances/${containerId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(
        `CF container delete failed (${response.status})`,
      );
    }
  },

  async restartInstance({ containerId, accountId, apiToken }) {
    const response = await fetch(
      `${CF_API}/accounts/${accountId}/containers/instances/${containerId}/restart`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );

    if (!response.ok) {
      throw new Error(
        `CF container restart failed (${response.status})`,
      );
    }
  },

  async getInstanceStatus({ containerId, accountId, apiToken }) {
    const response = await fetch(
      `${CF_API}/accounts/${accountId}/containers/instances/${containerId}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiToken}` },
      },
    );

    if (!response.ok) return 'error';

    const data = (await response.json()) as {
      result: { status: string };
    };

    if (data.result.status === 'running') return 'running';
    if (
      data.result.status === 'stopped'
      || data.result.status === 'terminated'
    ) {
      return 'stopped';
    }
    return 'error';
  },
};

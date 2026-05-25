/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CreateInstanceOpts {
  instanceId: string;
  region: string;
  plan: string;
  doNamespace: any;
  envVars?: Record<string, string>;
}

export interface DeleteInstanceOpts {
  containerId: string;
  doNamespace: any;
}

export interface RestartInstanceOpts {
  containerId: string;
  doNamespace: any;
}

export interface GetInstanceStatusOpts {
  containerId: string;
  doNamespace: any;
}

export interface CreateInstanceResponse {
  containerId: string;
  hostname: string;
  region: string;
}

export interface AgentRuntimeService {
  createInstance(
    opts: CreateInstanceOpts
  ): Promise<CreateInstanceResponse>;

  deleteInstance(opts: DeleteInstanceOpts): Promise<void>;

  restartInstance(opts: RestartInstanceOpts): Promise<void>;

  getInstanceStatus(
    opts: GetInstanceStatusOpts
  ): Promise<'running' | 'stopped' | 'error'>;
}

export const agentRuntime: AgentRuntimeService = {
  async createInstance(opts: CreateInstanceOpts): Promise<CreateInstanceResponse> {
    const doId = opts.doNamespace.idFromName(opts.instanceId);
    const stub = opts.doNamespace.get(doId);

    await stub.fetch(new Request('http://agent.local/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceId: opts.instanceId,
        region: opts.region,
        plan: opts.plan,
        envVars: opts.envVars || {},
      }),
    }));

    return {
      containerId: doId.toString(),
      hostname: `${opts.instanceId}.agent.opensyber.cloud`,
      region: opts.region,
    };
  },

  async deleteInstance(opts: DeleteInstanceOpts): Promise<void> {
    const doId = opts.doNamespace.idFromString(opts.containerId);
    const stub = opts.doNamespace.get(doId);
    await stub.fetch(new Request('http://agent.local/', { method: 'DELETE' }));
  },

  async restartInstance(opts: RestartInstanceOpts): Promise<void> {
    const doId = opts.doNamespace.idFromString(opts.containerId);
    const stub = opts.doNamespace.get(doId);
    await stub.fetch(new Request('http://agent.local/restart', { method: 'POST' }));
  },

  async getInstanceStatus(
    opts: GetInstanceStatusOpts
  ): Promise<'running' | 'stopped' | 'error'> {
    const doId = opts.doNamespace.idFromString(opts.containerId);
    const stub = opts.doNamespace.get(doId);

    const response = await stub.fetch(new Request('http://agent.local/status', {
      method: 'GET',
    }));

    if (!response.ok) {
      return 'error';
    }

    const data = (await response.json()) as { status: string };
    const status = data.status;

    if (status === 'running' || status === 'stopped') {
      return status;
    }

    return 'error';
  },
};

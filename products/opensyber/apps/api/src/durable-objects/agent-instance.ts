export interface AgentInstanceState {
  status: 'running' | 'stopped' | 'error';
  instanceId: string;
  region: string;
  plan: string;
  startedAt: string;
  lastHealthCheck: string;
  healthMetrics: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
  };
}

interface StartRequest {
  instanceId: string;
  region: string;
  plan: string;
  envVars?: Record<string, string>;
}

/** Durable Object representing a single agent instance */
export class AgentInstance {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    try {
      if (method === 'POST' && path === '/start') {
        return this.handleStart(request);
      }
      if (method === 'GET' && path === '/status') {
        return this.handleStatus();
      }
      if (method === 'POST' && path === '/restart') {
        return this.handleRestart();
      }
      if (method === 'POST' && path === '/stop') {
        return this.handleStop();
      }
      if (method === 'DELETE' && path === '/') {
        return this.handleDelete();
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('AgentInstance error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  private async handleStart(request: Request): Promise<Response> {
    const config = (await request.json()) as StartRequest;
    const now = new Date().toISOString();
    const state: AgentInstanceState = {
      status: 'running',
      instanceId: config.instanceId,
      region: config.region,
      plan: config.plan,
      startedAt: now,
      lastHealthCheck: now,
      healthMetrics: { cpuPercent: 10, memoryPercent: 40, diskPercent: 20 },
    };

    await this.state.storage?.put('agent_state', JSON.stringify(state));
    await this.state.storage?.setAlarm(Date.now() + 60000);

    return new Response(
      JSON.stringify({ status: 'running', instanceId: config.instanceId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async handleStatus(): Promise<Response> {
    const stateData = await this.state.storage?.get<string>('agent_state');
    const state: AgentInstanceState | null = stateData
      ? JSON.parse(stateData)
      : null;

    if (!state) {
      return new Response(JSON.stringify({ error: 'No state found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(state), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleRestart(): Promise<Response> {
    const stateData = await this.state.storage?.get<string>('agent_state');
    const state = stateData ? JSON.parse(stateData) as AgentInstanceState : null;

    if (!state) {
      return new Response(JSON.stringify({ error: 'No state found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    state.status = 'running';
    state.startedAt = now;
    state.lastHealthCheck = now;

    await this.state.storage?.put('agent_state', JSON.stringify(state));
    await this.state.storage?.setAlarm(Date.now() + 60000);

    return new Response(JSON.stringify({ status: 'running' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleStop(): Promise<Response> {
    const stateData = await this.state.storage?.get<string>('agent_state');
    const state: AgentInstanceState | null = stateData
      ? JSON.parse(stateData)
      : null;

    if (!state) {
      return new Response(JSON.stringify({ error: 'No state found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    state.status = 'stopped';
    await this.state.storage?.put('agent_state', JSON.stringify(state));
    await this.state.storage?.deleteAlarm();

    return new Response(JSON.stringify({ status: 'stopped' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleDelete(): Promise<Response> {
    await this.state.storage?.deleteAlarm();
    await this.state.storage?.deleteAll();

    return new Response(JSON.stringify({ status: 'deleted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async alarm(): Promise<void> {
    const stateData = await this.state.storage?.get<string>('agent_state');
    const state: AgentInstanceState | null = stateData
      ? JSON.parse(stateData)
      : null;

    if (!state) {
      return;
    }

    state.healthMetrics = {
      cpuPercent: Math.random() * 20 + 5,
      memoryPercent: Math.random() * 30 + 30,
      diskPercent: Math.random() * 30 + 10,
    };
    state.lastHealthCheck = new Date().toISOString();

    await this.state.storage?.put('agent_state', JSON.stringify(state));

    if (state.status === 'running') {
      const nextAlarmTime = Date.now() + 60000;
      await this.state.storage?.setAlarm(nextAlarmTime);
    }
  }
}

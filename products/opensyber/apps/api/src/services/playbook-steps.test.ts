/**
 * Playbook Step Handlers Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runStepAction } from './playbook-steps.js';
import type { ExecutionContext, PlaybookStep } from './playbook-executor.js';

vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mock hetzner service
vi.mock('./hetzner.js', () => ({
  hetznerService: {
    powerOffServer: vi.fn().mockResolvedValue(undefined),
    restartServer: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock notifications
vi.mock('./notifications.js', () => ({
  notificationService: {
    notify: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock encryption
vi.mock('../utils/encryption.js', () => ({
  encrypt: vi.fn().mockResolvedValue('encrypted-value'),
}));

function createMockCtx(): ExecutionContext {
  const kvStore: Record<string, string> = {};
  return {
    env: {
      HETZNER_API_TOKEN: 'test-token',
      RESEND_API_KEY: 'test-resend',
      ENCRYPTION_KEY: 'test-enc',
      CREDENTIAL_VAULT: {
        put: vi.fn(async (k: string, v: string) => { kvStore[k] = v; }),
        delete: vi.fn(async () => {}),
        get: vi.fn(async (k: string) => kvStore[k] ?? null),
      },
      CACHE: {
        put: vi.fn(async () => {}),
        get: vi.fn(async () => null),
        delete: vi.fn(async () => {}),
      },
    } as any,
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: 'inst-1', containerId: '12345', status: 'running',
          }]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
    } as any,
    orgId: 'org-1',
  };
}

describe('Playbook Steps', () => {
  let ctx: ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockCtx();
  });

  it('suspend_agent powers off server and revokes token', async () => {
    const step: PlaybookStep = {
      name: 'Suspend', type: 'suspend_agent',
      config: { instanceId: 'inst-1' },
    };
    const output = await runStepAction(step, ctx);
    expect(output).toContain('suspended');
    expect(ctx.env.CREDENTIAL_VAULT.delete).toHaveBeenCalledWith('gateway:inst-1');
  });

  it('suspend_agent throws when instanceId is missing', async () => {
    const step: PlaybookStep = {
      name: 'Suspend', type: 'suspend_agent', config: {},
    };
    await expect(runStepAction(step, ctx)).rejects.toThrow('instanceId required');
  });

  it('revoke_secret deletes from vault', async () => {
    const step: PlaybookStep = {
      name: 'Revoke', type: 'revoke_secret',
      config: { secretName: 'API_KEY' },
    };
    const output = await runStepAction(step, ctx);
    expect(output).toContain('API_KEY');
    expect(ctx.env.CREDENTIAL_VAULT.delete).toHaveBeenCalledWith(
      'secret:org-1:API_KEY',
    );
  });

  it('notify sends via notification service', async () => {
    const step: PlaybookStep = {
      name: 'Alert', type: 'notify',
      config: { channel: 'slack', title: 'Test Alert' },
    };
    const output = await runStepAction(step, ctx);
    expect(output).toContain('slack');
  });

  it('block_ip stores in cache', async () => {
    const step: PlaybookStep = {
      name: 'Block', type: 'block_ip',
      config: { ip: '192.168.1.1' },
    };
    const output = await runStepAction(step, ctx);
    expect(output).toContain('192.168.1.1');
    expect(ctx.env.CACHE.put).toHaveBeenCalled();
  });

  it('rotate_credential generates and encrypts new value', async () => {
    const step: PlaybookStep = {
      name: 'Rotate', type: 'rotate_credential',
      config: { credentialName: 'DB_PASSWORD' },
    };
    const output = await runStepAction(step, ctx);
    expect(output).toContain('DB_PASSWORD');
    expect(ctx.env.CREDENTIAL_VAULT.put).toHaveBeenCalled();
  });

  it('quarantine_file stores record in cache', async () => {
    const step: PlaybookStep = {
      name: 'Quarantine', type: 'quarantine_file',
      config: { filePath: '/etc/passwd', instanceId: 'inst-1' },
    };
    const output = await runStepAction(step, ctx);
    expect(output).toContain('/etc/passwd');
    expect(ctx.env.CACHE.put).toHaveBeenCalled();
  });

  it('create_incident inserts into database', async () => {
    const step: PlaybookStep = {
      name: 'Incident', type: 'create_incident',
      config: { title: 'Security breach', severity: 'critical' },
    };
    const output = await runStepAction(step, ctx);
    expect(output).toContain('Incident');
    expect(ctx.db.insert).toHaveBeenCalled();
  });

  it('webhook calls external HTTPS URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const step: PlaybookStep = {
      name: 'Hook', type: 'webhook',
      config: { url: 'https://hooks.example.com/test' },
    };
    const output = await runStepAction(step, ctx);
    expect(output).toContain('200');
    expect(fetchMock).toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it('webhook rejects non-HTTPS URLs', async () => {
    const step: PlaybookStep = {
      name: 'Hook', type: 'webhook',
      config: { url: 'http://example.com/test' },
    };
    await expect(runStepAction(step, ctx)).rejects.toThrow('HTTPS');
  });

  it('webhook rejects private addresses', async () => {
    const step: PlaybookStep = {
      name: 'Hook', type: 'webhook',
      config: { url: 'https://localhost/test' },
    };
    await expect(runStepAction(step, ctx)).rejects.toThrow('private');
  });
});

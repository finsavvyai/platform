import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Env } from '../types.js';
import { createMockEnv, createMockDb } from '../test/helpers.js';

// Mock createDb so pollInstanceHealth uses our mock
vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

// Mock agentRuntime to control container status responses
vi.mock('./agent-runtime.js', () => ({
  agentRuntime: {
    getInstanceStatus: vi.fn(async () => 'running'),
    restartInstance: vi.fn(async () => {}),
  },
}));

// Mock notificationService
vi.mock('./notifications.js', () => ({
  notificationService: {
    notify: vi.fn(async () => {}),
  },
}));

import { pollInstanceHealth } from './health-cron.js';
import { agentRuntime } from './agent-runtime.js';
import { notificationService } from './notifications.js';

describe('pollInstanceHealth', () => {
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── No instances ───────────────────────────────────────────────────────

  it('does nothing when there are no active or running instances', async () => {
    mockDb._setSelectResults([[], []]);
    await pollInstanceHealth(mockEnv);
    expect(agentRuntime.getInstanceStatus).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  // ─── Running status → mark running ──────────────────────────────────────

  it('updates status to running when Hetzner reports healthy', async () => {
    const inst = { id: 'inst_1', containerId: 12345, userId: 'u1', name: 'My Agent' };
    mockDb._setSelectResults([[inst], []]);
    vi.mocked(agentRuntime.getInstanceStatus).mockResolvedValueOnce('running');

    await pollInstanceHealth(mockEnv);

    expect(agentRuntime.getInstanceStatus).toHaveBeenCalledWith({
      containerId: 12345,
      doNamespace: mockEnv.AGENT_DO,
    });
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    const setArgs = mockDb._updateChain.set.mock.calls[0][0];
    expect(setArgs.status).toBe('running');
    expect(setArgs.lastHealthCheck).toBeDefined();
  });

  // ─── Error status → mark error ───────────────────────────────────────────

  it('updates status to error when Hetzner reports error', async () => {
    const inst = { id: 'inst_2', containerId: 99999, userId: 'u2', name: 'Agent 2' };
    mockDb._setSelectResults([[], [inst]]);
    vi.mocked(agentRuntime.getInstanceStatus).mockResolvedValueOnce('error');

    await pollInstanceHealth(mockEnv);

    expect(mockDb.update).toHaveBeenCalledTimes(1);
    const setArgs = mockDb._updateChain.set.mock.calls[0][0];
    expect(setArgs.status).toBe('error');
    expect(setArgs.lastHealthCheck).toBeDefined();
  });

  it('updates status to error when Hetzner reports stopped', async () => {
    const inst = { id: 'inst_3', containerId: 77777, userId: 'u3', name: 'Agent 3' };
    mockDb._setSelectResults([[inst], []]);
    vi.mocked(agentRuntime.getInstanceStatus).mockResolvedValueOnce('stopped');

    await pollInstanceHealth(mockEnv);

    const setArgs = mockDb._updateChain.set.mock.calls[0][0];
    expect(setArgs.status).toBe('error');
  });

  // ─── Skip instances without containerId ──────────────────────────────

  it('skips instances without containerId', async () => {
    const inst = { id: 'inst_no_server', containerId: null, userId: 'u4', name: null };
    mockDb._setSelectResults([[inst], []]);

    await pollInstanceHealth(mockEnv);

    expect(agentRuntime.getInstanceStatus).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  // ─── lastHealthCheck timestamp ───────────────────────────────────────────

  it('sets lastHealthCheck to current ISO timestamp on update', async () => {
    const before = new Date().toISOString();
    const inst = { id: 'inst_ts', containerId: 11111, userId: 'u5', name: 'TS Agent' };
    mockDb._setSelectResults([[inst], []]);
    vi.mocked(agentRuntime.getInstanceStatus).mockResolvedValueOnce('running');

    await pollInstanceHealth(mockEnv);

    const setArgs = mockDb._updateChain.set.mock.calls[0][0];
    const after = new Date().toISOString();
    expect(setArgs.lastHealthCheck >= before).toBe(true);
    expect(setArgs.lastHealthCheck <= after).toBe(true);
  });

  // ─── Hetzner API error → continue to next instance ───────────────────────

  it('handles Hetzner API error gracefully and continues to next instance', async () => {
    const inst1 = { id: 'inst_fail', containerId: 11111, userId: 'u6', name: 'Fail' };
    const inst2 = { id: 'inst_ok', containerId: 22222, userId: 'u6', name: 'OK' };
    mockDb._setSelectResults([[inst1, inst2], []]);

    vi.mocked(agentRuntime.getInstanceStatus)
      .mockRejectedValueOnce(new Error('Hetzner timeout'))
      .mockResolvedValueOnce('running');

    await pollInstanceHealth(mockEnv);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('inst_fail'),
      expect.any(Error),
    );
    // Second instance still processed
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  // ─── Both ready and running instances polled ─────────────────────────────

  it('polls both ready and running instances', async () => {
    const readyInst = { id: 'inst_ready', containerId: 10001, userId: 'u7', name: 'Ready' };
    const runningInst = { id: 'inst_running', containerId: 10002, userId: 'u7', name: 'Running' };
    mockDb._setSelectResults([[readyInst], [runningInst]]);
    vi.mocked(agentRuntime.getInstanceStatus).mockResolvedValue('running');

    await pollInstanceHealth(mockEnv);

    expect(agentRuntime.getInstanceStatus).toHaveBeenCalledTimes(2);
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });

  // ─── Console warning on error/stopped status ────────────────────────────

  it('logs a warning when instance is marked as error', async () => {
    const inst = { id: 'inst_warn', containerId: 55555, userId: 'u8', name: 'Warn' };
    mockDb._setSelectResults([[inst], []]);
    vi.mocked(agentRuntime.getInstanceStatus).mockResolvedValueOnce('stopped');

    await pollInstanceHealth(mockEnv);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('inst_warn'));
  });

  // ─── Notification on disconnect ────────────────────────────────────────

  it('notifies user via active channels when instance goes down', async () => {
    const inst = { id: 'inst_down', containerId: 33333, userId: 'u_notify', name: 'Down Agent' };
    // First select: ready instances, Second: running instances, Third: notification channels
    mockDb._setSelectResults([[inst], [], [
      { channelType: 'email', config: '{"email":"test@example.com"}', isActive: true },
    ]]);
    vi.mocked(agentRuntime.getInstanceStatus).mockResolvedValueOnce('error');

    await pollInstanceHealth(mockEnv);

    expect(notificationService.notify).toHaveBeenCalledWith(
      'email',
      '{"email":"test@example.com"}',
      expect.objectContaining({
        title: 'Agent Disconnected',
        severity: 'critical',
        instanceId: 'inst_down',
      }),
      expect.objectContaining({ RESEND_API_KEY: mockEnv.RESEND_API_KEY }),
    );
  });

  // ─── Auto-restart on disconnect ────────────────────────────────────────

  it('attempts auto-restart when instance is down', async () => {
    const inst = { id: 'inst_restart', containerId: 44444, userId: 'u_restart', name: 'Restart Agent' };
    mockDb._setSelectResults([[inst], [], []]);
    vi.mocked(agentRuntime.getInstanceStatus).mockResolvedValueOnce('stopped');

    await pollInstanceHealth(mockEnv);

    expect(agentRuntime.restartInstance).toHaveBeenCalledWith({
      containerId: 44444,
      doNamespace: mockEnv.AGENT_DO,
    });
  });

  it('handles restart failure gracefully', async () => {
    const inst = { id: 'inst_restart_fail', containerId: 55555, userId: 'u_rf', name: 'RF' };
    mockDb._setSelectResults([[inst], [], []]);
    vi.mocked(agentRuntime.getInstanceStatus).mockResolvedValueOnce('error');
    vi.mocked(agentRuntime.restartInstance).mockRejectedValueOnce(new Error('reboot failed'));

    await pollInstanceHealth(mockEnv);

    // Should not throw — error is caught internally
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Auto-restart failed'),
      expect.any(Error),
    );
  });
});

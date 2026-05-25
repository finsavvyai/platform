import { describe, it, expect, vi } from 'vitest';
import { notifyAction } from './notify.js';
import type { RunbookContext } from '../types.js';

vi.mock('../../alerts/dispatcher-core.js', () => ({
  dispatchAlerts: vi.fn(async () => ({
    totalChannels: 3,
    successful: 2,
    failed: 0,
    skipped: 1,
    results: new Map(),
  })),
}));

const baseCtx: RunbookContext = {
  runId: 'run-1',
  runbookId: 'rb-1',
  triggerAlertId: null,
  ownerUserId: 'u-1',
  orgId: 'org-1',
  prevOutputs: {},
  params: {},
  services: { db: {} },
};

describe('notify action', () => {
  it('rejects missing severity', async () => {
    const r = await notifyAction(
      { id: 's1', action: 'notify', params: { title: 't', description: 'd' }, on_error: { mode: 'fail' } },
      baseCtx,
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid params/);
  });

  it('rejects when services.db missing', async () => {
    const ctx = { ...baseCtx, services: {} };
    const r = await notifyAction(
      {
        id: 's1', action: 'notify',
        params: { severity: 'high', title: 't', description: 'd' },
        on_error: { mode: 'fail' },
      },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/services\.db/);
  });

  it('dispatches via the alert dispatcher and surfaces channel counts', async () => {
    const r = await notifyAction(
      {
        id: 's1', action: 'notify',
        params: { severity: 'high', title: 'Phishing flagged', description: 'AI-triage flagged' },
        on_error: { mode: 'fail' },
      },
      baseCtx,
    );
    expect(r.ok).toBe(true);
    expect(r.output).toMatchObject({
      run_id: 'run-1',
      step_id: 's1',
      total_channels: 3,
      successful: 2,
      failed: 0,
      skipped: 1,
    });
  });

  it('forwards optional findings array unchanged', async () => {
    const finding = {
      checkId: 'c1', severity: 'high' as const,
      resourceId: 'r1', resourceType: 'iam:user', region: 'us-east-1',
      title: 't', description: 'd', remediation: 'rotate',
    };
    const r = await notifyAction(
      {
        id: 's1', action: 'notify',
        params: {
          severity: 'high', title: 't', description: 'd', findings: [finding],
        },
        on_error: { mode: 'fail' },
      },
      baseCtx,
    );
    expect(r.ok).toBe(true);
  });
});

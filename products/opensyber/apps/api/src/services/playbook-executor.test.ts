/**
 * Playbook Executor Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { executePlaybook, parseSteps, type PlaybookStep } from './playbook-executor.js';

vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Playbook Executor', () => {
  it('runs steps with simulated output when no execution context is provided', async () => {
    const steps: PlaybookStep[] = [
      { name: 'Suspend agent', type: 'suspend_agent', config: { agentId: 'agent-1' } },
      { name: 'Notify team', type: 'notify', config: { channel: 'slack' } },
    ];
    const result = await executePlaybook(steps);
    expect(result.status).toBe('completed');
    expect(result.stepResults).toHaveLength(2);
    expect(result.stepResults[0]!.status).toBe('success');
    expect(result.stepResults[1]!.status).toBe('success');
  });

  it('returns completed status for empty steps', async () => {
    const result = await executePlaybook([]);
    expect(result.status).toBe('completed');
    expect(result.stepResults).toHaveLength(0);
  });

  it('succeeds all step types with simulated output when no context', async () => {
    const steps: PlaybookStep[] = [
      { name: 'Revoke', type: 'revoke_secret', config: { secretName: 'API_KEY' } },
      { name: 'Create incident', type: 'create_incident', config: {} },
      { name: 'Webhook', type: 'webhook', config: { url: 'https://example.com' } },
    ];
    const result = await executePlaybook(steps);
    expect(result.status).toBe('completed');
    expect(result.stepResults).toHaveLength(3);
    result.stepResults.forEach((r) => expect(r.status).toBe('success'));
  });

  it('parses steps from JSON', () => {
    const json = JSON.stringify([
      { name: 'Step 1', type: 'notify', config: { channel: 'email' } },
    ]);
    const steps = parseSteps(json);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.type).toBe('notify');
  });

  it('throws on invalid JSON steps', () => {
    expect(() => parseSteps('"not an array"')).toThrow('Steps must be an array');
  });

  it('tracks totalDurationMs', async () => {
    const result = await executePlaybook([]);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});

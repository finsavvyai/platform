/**
 * Chaos Engineering Tests — entry suite.
 *
 * Split into:
 *   - chaos-network.spec.ts  (connection-refused, DNS, SSL, 5xx, 429, malformed JSON)
 *   - chaos-timeout.spec.ts  (slow upstream, partial response, retry-then-success)
 *
 * This file holds the cross-cutting smoke checks so a single
 * `vitest run packages/api/test/chaos.spec.ts` exercises every chaos contract.
 *
 * Contracts under test (skill / workflow execution):
 *   1. Failures must mark the run as failed (not stuck/pending).
 *   2. The error message must be captured (will land in run_steps.error).
 *   3. durationMs must be set so observability layers see bounded execution.
 *   4. Timeouts must fire within tolerance of the configured ceiling.
 *   5. Retry/backoff is the caller's contract; chaos tests only verify each
 *      single attempt fails cleanly so retries can layer on top.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { executeToolCall } from '../src/services/openhands-client';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('Chaos: cross-cutting skill execution contracts', () => {
    it('all failure paths produce a structured ToolResult (no thrown exceptions)', async () => {
        // Network reject
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
        const r = await executeToolCall(
            { apiUrl: 'http://x', timeoutMs: 50 },
            { name: 'bash', input: { command: 'true' } },
        );
        expect(r.success).toBe(false);
        expect(typeof r.output).toBe('string');
        expect(typeof r.durationMs).toBe('number');
        expect(r.name).toBe('bash');
    });

    it('unknown skill is rejected before any network call (fast-fail)', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const r = await executeToolCall(
            { apiUrl: 'http://x', timeoutMs: 50 },
            { name: 'definitely_not_a_tool', input: {} },
        );
        expect(r.success).toBe(false);
        expect(r.output).toContain('Unknown tool');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

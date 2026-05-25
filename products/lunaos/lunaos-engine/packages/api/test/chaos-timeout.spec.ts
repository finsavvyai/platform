/**
 * Chaos Timeout Tests — verifies skill execution under slow / partial responses.
 *
 * Scenarios covered (timing layer):
 *   - Slow response (target hangs > timeout)  → AbortSignal.timeout fires
 *   - Partial response (server closes mid-stream) → caught, run failed
 *   - Retry contract: after a slow attempt we can retry and succeed
 *
 * No real network is touched. We replace global.fetch with a controllable
 * implementation that respects the AbortSignal passed by the client so the
 * client's timeout truly fires within tolerance.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeToolCall } from '../src/services/openhands-client';

beforeEach(() => {
    vi.useRealTimers();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

/** A fetch impl that hangs forever unless the caller's AbortSignal fires. */
function hangingFetch(): typeof fetch {
    return ((_url: any, init?: any) =>
        new Promise((_resolve, reject) => {
            const signal: AbortSignal | undefined = init?.signal;
            if (!signal) return; // never resolves
            if (signal.aborted) {
                reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
                return;
            }
            signal.addEventListener('abort', () => {
                reject(Object.assign(new Error('The operation was aborted'), {
                    name: 'AbortError',
                }));
            });
        })) as typeof fetch;
}

describe('Chaos: Slow / partial responses', () => {
    it('slow upstream: AbortSignal.timeout fires within tolerance', async () => {
        vi.stubGlobal('fetch', hangingFetch());

        const start = Date.now();
        const result = await executeToolCall(
            { apiUrl: 'http://slow.test', timeoutMs: 150 },
            { name: 'bash', input: { command: 'sleep 30' } },
        );
        const elapsed = Date.now() - start;

        expect(result.success).toBe(false);
        expect(result.output).toMatch(/aborted|Execution failed|AbortError/i);
        // Tolerance: timeout should fire close to configured 150 ms,
        // certainly under 30 s and over 50 ms.
        expect(elapsed).toBeGreaterThanOrEqual(50);
        expect(elapsed).toBeLessThan(2000);
    });

    it('partial response: stream closed mid-body → captured as failure', async () => {
        // Build a ReadableStream that errors mid-way.
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('{"success":tru'));
                queueMicrotask(() => controller.error(new Error('socket hang up')));
            },
        });
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const result = await executeToolCall(
            { apiUrl: 'http://partial.test', timeoutMs: 500 },
            { name: 'bash', input: { command: 'true' } },
        );

        expect(result.success).toBe(false);
        expect(result.output).toMatch(/Execution failed|socket hang up|JSON/i);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('retry after slow attempt succeeds: count + final state correct', async () => {
        let call = 0;
        const fetchMock = vi.fn().mockImplementation((_url: any, init?: any) => {
            call++;
            if (call === 1) {
                // Hang on first call until aborted.
                return new Promise((_res, rej) => {
                    init?.signal?.addEventListener('abort', () =>
                        rej(Object.assign(new Error('aborted'), { name: 'AbortError' })),
                    );
                });
            }
            return Promise.resolve(
                new Response(JSON.stringify({ success: true, data: { result: 'ok' } }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }),
            );
        });
        vi.stubGlobal('fetch', fetchMock);

        // Attempt 1 (slow → fails).
        const first = await executeToolCall(
            { apiUrl: 'http://t.test', timeoutMs: 100 },
            { name: 'bash', input: { command: 'true' } },
        );
        expect(first.success).toBe(false);

        // Attempt 2 (caller retry → succeeds).
        const second = await executeToolCall(
            { apiUrl: 'http://t.test', timeoutMs: 500 },
            { name: 'bash', input: { command: 'true' } },
        );
        expect(second.success).toBe(true);
        expect(second.output).toBe('ok');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

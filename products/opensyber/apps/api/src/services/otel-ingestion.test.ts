import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDb } from '../test/mock-db.js';
import {
  normalizeSpanToEvent,
  extractLangChainMetadata,
  processOtelTrace,
} from './otel-ingestion.js';

describe('OTEL Ingestion Service', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe('normalizeSpanToEvent', () => {
    it('should convert OTLP span to integration event format', () => {
      const now = Date.now();
      const startNano = now * 1_000_000;
      const endNano = (now + 100) * 1_000_000;

      const span = {
        traceId: 'trace-123',
        spanId: 'span-456',
        name: 'llm.call',
        startTimeUnixNano: startNano,
        endTimeUnixNano: endNano,
        status: { code: 0 },
        attributes: {
          'langchain.model': 'gpt-4',
          'langchain.run_type': 'chain',
        },
      };

      const event = normalizeSpanToEvent(span);

      expect(event.traceId).toBe('trace-123');
      expect(event.spanName).toBe('llm.call');
      expect(event.status).toBe('success');
      expect(event.durationMs).toBeCloseTo(100, 0);
      expect(event.attributes['langchain.model']).toBe('gpt-4');
    });

    it('should mark status as error when code is non-zero', () => {
      const span = {
        traceId: 'trace-123',
        spanId: 'span-456',
        name: 'failed.call',
        startTimeUnixNano: 1000,
        endTimeUnixNano: 2000,
        status: { code: 2, message: 'Internal error' },
        attributes: {},
      };

      const event = normalizeSpanToEvent(span);

      expect(event.status).toBe('error');
    });

    it('should handle missing status code', () => {
      const span = {
        traceId: 'trace-123',
        spanId: 'span-456',
        name: 'call',
        startTimeUnixNano: 1000,
        endTimeUnixNano: 2000,
        attributes: {},
      };

      const event = normalizeSpanToEvent(span);

      expect(event.status).toBe('error'); // Missing status defaults to error
    });

    it('should calculate duration correctly from nanoseconds', () => {
      const span = {
        traceId: 'trace-123',
        spanId: 'span-456',
        name: 'call',
        startTimeUnixNano: 1000000000, // 1 second
        endTimeUnixNano: 2500000000, // 2.5 seconds
        status: { code: 0 },
        attributes: {},
      };

      const event = normalizeSpanToEvent(span);

      expect(event.durationMs).toBeCloseTo(1500, 0);
    });
  });

;

  describe('processOtelTrace', () => {
    it('should create events for each span in trace', () => {
      const trace = {
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: 'trace-1',
                    spanId: 'span-1',
                    name: 'call-1',
                    startTimeUnixNano: 1000,
                    endTimeUnixNano: 2000,
                    status: { code: 0 },
                    attributes: { 'langchain.model': 'gpt-4' },
                  },
                  {
                    traceId: 'trace-1',
                    spanId: 'span-2',
                    name: 'call-2',
                    startTimeUnixNano: 2000,
                    endTimeUnixNano: 3000,
                    status: { code: 0 },
                    attributes: {},
                  },
                ],
              },
            ],
          },
        ],
      };

      const events = processOtelTrace(mockDb, trace);

      expect(events).toHaveLength(2);
      expect(events[0].spanName).toBe('call-1');
    });

    it('should handle empty resource spans', () => {
      const trace = { resourceSpans: undefined };
      const events = processOtelTrace(mockDb, trace);
      expect(events).toHaveLength(0);
    });

    it('should skip resources without scope spans', () => {
      const trace = {
        resourceSpans: [
          {
            scopeSpans: undefined,
          },
          {
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: 'trace-1',
                    spanId: 'span-1',
                    name: 'valid-call',
                    startTimeUnixNano: 1000,
                    endTimeUnixNano: 2000,
                    status: { code: 0 },
                    attributes: {},
                  },
                ],
              },
            ],
          },
        ],
      };

      const events = processOtelTrace(mockDb, trace);
      expect(events).toHaveLength(1);
    });

    it('should populate startTime and endTime in attributes', () => {
      const now = Date.now();
      const trace = {
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  {
                    traceId: 'trace-1',
                    spanId: 'span-1',
                    name: 'call',
                    startTimeUnixNano: now * 1_000_000,
                    endTimeUnixNano: (now + 100) * 1_000_000,
                    status: { code: 0 },
                    attributes: {},
                  },
                ],
              },
            ],
          },
        ],
      };

      const events = processOtelTrace(mockDb, trace);
      expect(events[0].attributes.startTime).toBeDefined();
      expect(events[0].attributes.endTime).toBeDefined();
    });
  });
});

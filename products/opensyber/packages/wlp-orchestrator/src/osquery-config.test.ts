import { describe, it, expect } from 'vitest';
import {
  buildOsqueryConfig,
  parseOsqueryConfig,
  osqueryConfigSchema,
  SCHEDULED_QUERIES,
  REQUIRED_QUERY_NAMES,
} from './osquery-config.js';

describe('osqueryConfigSchema', () => {
  it('applies sensible defaults', () => {
    const r = osqueryConfigSchema.parse({});
    expect(r.intervalSeconds).toBe(60);
    expect(r.enableFileEvents).toBe(true);
    expect(r.loggerPlugin).toBe('filesystem');
    expect(r.loggerPath).toBe('/var/log/osquery');
    expect(r.fileEventPaths.length).toBeGreaterThan(0);
  });

  it('rejects intervalSeconds < 10 or > 86400', () => {
    expect(osqueryConfigSchema.safeParse({ intervalSeconds: 5 }).success).toBe(
      false,
    );
    expect(
      osqueryConfigSchema.safeParse({ intervalSeconds: 86_401 }).success,
    ).toBe(false);
  });

  it('rejects unknown loggerPlugin values', () => {
    expect(
      osqueryConfigSchema.safeParse({ loggerPlugin: 'syslog' }).success,
    ).toBe(false);
  });

  it('accepts all three documented logger plugins', () => {
    for (const p of ['filesystem', 'tls', 'kafka_producer'] as const) {
      expect(
        osqueryConfigSchema.safeParse({ loggerPlugin: p }).success,
      ).toBe(true);
    }
  });
});

describe('SCHEDULED_QUERIES catalog', () => {
  it('includes all REQUIRED_QUERY_NAMES', () => {
    for (const name of REQUIRED_QUERY_NAMES) {
      expect(SCHEDULED_QUERIES[name]).toBeDefined();
    }
  });

  it('every query references a real osquery table in its FROM clause', () => {
    for (const [name, q] of Object.entries(SCHEDULED_QUERIES)) {
      expect(q.query.toLowerCase()).toContain('from ' + q.table.toLowerCase());
      expect(q.description.length).toBeGreaterThan(0);
      expect(name).toBe(q.table);
    }
  });
});

describe('buildOsqueryConfig', () => {
  it('produces parseable JSON', () => {
    const cfg = buildOsqueryConfig({});
    const parsed = parseOsqueryConfig(cfg);
    expect(parsed).toBeTypeOf('object');
  });

  it('schedules every required query with the configured interval', () => {
    const cfg = parseOsqueryConfig(
      buildOsqueryConfig({ intervalSeconds: 120 }),
    ) as { schedule: Record<string, { interval: number; query: string }> };
    for (const name of REQUIRED_QUERY_NAMES) {
      expect(cfg.schedule[name]).toBeDefined();
      expect(cfg.schedule[name]?.interval).toBe(120);
    }
  });

  it('snapshot queries set snapshot:true and not removed', () => {
    const cfg = parseOsqueryConfig(buildOsqueryConfig({})) as {
      schedule: Record<string, { snapshot?: boolean; removed?: boolean }>;
    };
    // listening_ports is a snapshot query in our catalog.
    expect(cfg.schedule.listening_ports?.snapshot).toBe(true);
    // process_events is differential.
    expect(cfg.schedule.process_events?.removed).toBe(false);
  });

  it('emits file_paths only when enableFileEvents=true', () => {
    const on = parseOsqueryConfig(
      buildOsqueryConfig({ enableFileEvents: true }),
    ) as { file_paths?: { homes?: string[] } };
    expect(on.file_paths?.homes?.length ?? 0).toBeGreaterThan(0);

    const off = parseOsqueryConfig(
      buildOsqueryConfig({ enableFileEvents: false }),
    ) as { file_paths?: unknown };
    expect(off.file_paths).toBeUndefined();
  });

  it('uses the supplied fileEventPaths', () => {
    const cfg = parseOsqueryConfig(
      buildOsqueryConfig({
        enableFileEvents: true,
        fileEventPaths: ['/srv/%%'],
      }),
    ) as { file_paths: { homes: string[] } };
    expect(cfg.file_paths.homes).toEqual(['/srv/%%']);
  });

  it('writes logger_plugin and logger_path to options', () => {
    const cfg = parseOsqueryConfig(
      buildOsqueryConfig({
        loggerPlugin: 'tls',
        loggerPath: '/var/log/x',
      }),
    ) as { options: Record<string, unknown> };
    expect(cfg.options.logger_plugin).toBe('tls');
    expect(cfg.options.logger_path).toBe('/var/log/x');
  });

  it('applies events_expiry and events_max guards', () => {
    const cfg = parseOsqueryConfig(buildOsqueryConfig({})) as {
      options: { events_expiry: number; events_max: number };
    };
    expect(cfg.options.events_expiry).toBe(3600);
    expect(cfg.options.events_max).toBe(50_000);
  });
});

describe('parseOsqueryConfig', () => {
  it('throws on malformed JSON', () => {
    expect(() => parseOsqueryConfig('{not json')).toThrow();
  });
});

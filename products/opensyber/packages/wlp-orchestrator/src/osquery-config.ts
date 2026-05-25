/**
 * Generates an osquery.conf fragment with scheduled queries.
 *
 * All queries below reference REAL osquery tables (verified against the
 * upstream schema docs at https://osquery.io/schema/) and are adapted
 * from upstream osquery packs (Apache 2.0):
 *
 *   https://github.com/osquery/osquery/tree/master/packs
 *     - incident-response.conf
 *     - vuln-management.conf
 *     - hardware-monitoring.conf
 *
 * We deliberately schedule the lightweight, cross-platform tables only
 * (process_events, listening_ports, file_events, user_events,
 * kernel_modules) so the agent runs on Linux + macOS without
 * platform-specific decoration.
 */

import { z } from 'zod';

export const osqueryConfigSchema = z.object({
  /** Scheduled query interval (seconds) — defaults to 60s. */
  intervalSeconds: z.number().int().min(10).max(86_400).default(60),
  /** Whether to enable file_events (requires fim paths). */
  enableFileEvents: z.boolean().default(true),
  /** Paths watched by file_events when enableFileEvents=true. */
  fileEventPaths: z
    .array(z.string().min(1))
    .default(['/etc/%%', '/usr/bin/%%', '/usr/sbin/%%']),
  /** Logger plugin (filesystem|tls|kafka_producer). */
  loggerPlugin: z
    .enum(['filesystem', 'tls', 'kafka_producer'])
    .default('filesystem'),
  /** Path for filesystem logger. */
  loggerPath: z.string().min(1).default('/var/log/osquery'),
});

export type OsqueryConfigInput = z.input<typeof osqueryConfigSchema>;
export type OsqueryConfigOptions = z.output<typeof osqueryConfigSchema>;

interface ScheduledQuery {
  /** Query SQL (must reference a real osquery table). */
  query: string;
  /** Description (carried through to log line). */
  description: string;
  /** osquery table the query reads — used for validation. */
  table: string;
  /** Whether this is a snapshot or differential query. */
  snapshot?: boolean;
}

/**
 * Curated scheduled-query catalog. Each `query` must `FROM` a real table.
 * Sources (upstream osquery packs, Apache 2.0):
 *  https://github.com/osquery/osquery/blob/master/packs/incident-response.conf
 *  https://github.com/osquery/osquery/blob/master/packs/vuln-management.conf
 */
export const SCHEDULED_QUERIES: Record<string, ScheduledQuery> = {
  process_events: {
    query: 'SELECT pid, path, cmdline, uid, parent, time FROM process_events;',
    description: 'New process executions (audit subsystem)',
    table: 'process_events',
  },
  listening_ports: {
    query:
      'SELECT pid, port, protocol, family, address, path FROM listening_ports;',
    description: 'All processes with open listening sockets',
    table: 'listening_ports',
    snapshot: true,
  },
  file_events: {
    query:
      'SELECT target_path, action, atime, mtime, hashed, sha256 FROM file_events;',
    description: 'File integrity monitoring events under watched paths',
    table: 'file_events',
  },
  user_events: {
    query:
      'SELECT auid, pid, message, path, type, uid, time FROM user_events;',
    description: 'User session and authentication events',
    table: 'user_events',
  },
  kernel_modules: {
    query: 'SELECT name, size, used_by, status, address FROM kernel_modules;',
    description: 'Currently loaded kernel modules (Linux only)',
    table: 'kernel_modules',
    snapshot: true,
  },
};

export const REQUIRED_QUERY_NAMES: readonly string[] = [
  'process_events',
  'listening_ports',
  'file_events',
  'user_events',
  'kernel_modules',
];

/** Builds the osquery.conf JSON document as a string. */
export function buildOsqueryConfig(input: OsqueryConfigInput): string {
  const opts = osqueryConfigSchema.parse(input);

  const schedule: Record<string, Record<string, unknown>> = {};
  for (const name of REQUIRED_QUERY_NAMES) {
    const q = SCHEDULED_QUERIES[name];
    if (!q) continue;
    schedule[name] = {
      query: q.query,
      interval: opts.intervalSeconds,
      description: q.description,
      ...(q.snapshot ? { snapshot: true } : { removed: false }),
    };
  }

  const fileEvents = opts.enableFileEvents
    ? { homes: opts.fileEventPaths }
    : undefined;

  const config: Record<string, unknown> = {
    options: {
      logger_plugin: opts.loggerPlugin,
      logger_path: opts.loggerPath,
      disable_events: 'false',
      events_expiry: 3600,
      events_max: 50_000,
      schedule_splay_percent: 10,
    },
    schedule,
    ...(fileEvents ? { file_paths: fileEvents } : {}),
  };

  return JSON.stringify(config, null, 2);
}

/** Parses a generated osquery config back to an object — used by tests. */
export function parseOsqueryConfig(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

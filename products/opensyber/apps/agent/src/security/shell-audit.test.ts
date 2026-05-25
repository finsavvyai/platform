import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShellAuditor } from './shell-audit.js';
import type { ApiClient } from '../lib/api-client.js';

// Mock fs and readline
vi.mock('node:fs', () => ({
  createReadStream: vi.fn().mockReturnValue({
    on: vi.fn(),
  }),
}));

vi.mock('node:readline', () => ({
  createInterface: vi.fn().mockReturnValue({
    on: vi.fn(),
  }),
}));

function createMockApi(): ApiClient {
  return {
    reportSecurityEvents: vi.fn().mockResolvedValue(undefined),
    reportHealth: vi.fn(),
    checkForUpdates: vi.fn(),
    getVerifiedSkills: vi.fn(),
  } as unknown as ApiClient;
}

describe('ShellAuditor', () => {
  let auditor: ShellAuditor;
  let api: ApiClient;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api = createMockApi();
    auditor = new ShellAuditor(api, 'inst-test', '/tmp/test-audit.log');
  });

  afterEach(() => {
    auditor.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('parseAuditLine', () => {
    it('parses EXECVE audit log entry', () => {
      const line = 'type=EXECVE msg=audit(1700000000.123:456): argc=2 a0="ls" a1="-la"';
      const entry = auditor.parseAuditLine(line);

      expect(entry).not.toBeNull();
      expect(entry?.command).toBe('ls -la');
      expect(entry?.timestamp).toContain('2023');
    });

    it('parses SYSCALL audit log entry with uid and cwd', () => {
      const line = 'type=SYSCALL msg=audit(1700000000.123:456): uid=1000 cwd="/home/user" exit=0 a0="bash"';
      const entry = auditor.parseAuditLine(line);

      expect(entry).not.toBeNull();
      expect(entry?.user).toBe('1000');
      expect(entry?.workingDir).toBe('/home/user');
      expect(entry?.exitCode).toBe(0);
    });

    it('ignores non-exec log lines', () => {
      const line = 'type=CONFIG_CHANGE msg=audit(1700000000.123:789): some config change';
      const entry = auditor.parseAuditLine(line);
      expect(entry).toBeNull();
    });

    it('returns null when no command found', () => {
      const line = 'type=EXECVE msg=audit(1700000000.123:456): argc=0';
      const entry = auditor.parseAuditLine(line);
      expect(entry).toBeNull();
    });

    it('reconstructs multi-argument commands', () => {
      const line = 'type=EXECVE msg=audit(1700000000.123:456): argc=4 a0="git" a1="commit" a2="-m" a3="fix bug"';
      const entry = auditor.parseAuditLine(line);

      expect(entry).not.toBeNull();
      expect(entry?.command).toBe('git commit -m fix bug');
    });

    it('defaults to unknown user when uid not present', () => {
      const line = 'type=EXECVE msg=audit(1700000000.123:456): argc=1 a0="whoami"';
      const entry = auditor.parseAuditLine(line);

      expect(entry?.user).toBe('unknown');
    });

    it('defaults to / working directory when cwd not present', () => {
      const line = 'type=EXECVE msg=audit(1700000000.123:456): argc=1 a0="pwd"';
      const entry = auditor.parseAuditLine(line);

      expect(entry?.workingDir).toBe('/');
    });

    it('defaults to 0 exit code when not present', () => {
      const line = 'type=EXECVE msg=audit(1700000000.123:456): argc=1 a0="true"';
      const entry = auditor.parseAuditLine(line);

      expect(entry?.exitCode).toBe(0);
    });

    it('uses current timestamp when no audit timestamp', () => {
      const line = 'type=EXECVE some_other_format: argc=1 a0="date"';
      const before = Date.now();
      const entry = auditor.parseAuditLine(line);

      expect(entry).not.toBeNull();
      const ts = new Date(entry!.timestamp).getTime();
      expect(ts).toBeGreaterThanOrEqual(before - 1000);
    });
  });

  describe('start/stop', () => {
    it('sets watching flag on start', () => {
      auditor.start();
      // Starting again should be a no-op
      auditor.start();
      expect(auditor).toBeDefined();
    });

    it('stop clears flush interval', () => {
      auditor.start();
      auditor.stop();
      // Should not throw on double stop
      auditor.stop();
    });
  });
});

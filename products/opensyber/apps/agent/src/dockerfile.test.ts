import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DOCKERFILE_PATH = join(__dirname, '..', 'Dockerfile');
const ENTRYPOINT_PATH = join(__dirname, '..', 'entrypoint.sh');
const AUDIT_RULES_PATH = join(__dirname, '..', 'audit.rules');

function readDockerfile(): string {
  return readFileSync(DOCKERFILE_PATH, 'utf-8');
}

describe('Dockerfile', () => {
  const dockerfile = readDockerfile();

  it('uses node:22-slim as base image', () => {
    expect(dockerfile).toContain('FROM node:22-slim');
  });

  it('installs security packages', () => {
    const requiredPackages = [
      'openssh-server',
      'fail2ban',
      'auditd',
      'iptables',
      'rkhunter',
    ];
    for (const pkg of requiredPackages) {
      expect(dockerfile).toContain(pkg);
    }
  });

  it('disables root SSH login', () => {
    expect(dockerfile).toContain('PermitRootLogin no');
  });

  it('disables password authentication', () => {
    expect(dockerfile).toContain('PasswordAuthentication no');
  });

  it('copies audit rules', () => {
    expect(dockerfile).toContain('COPY apps/agent/audit.rules');
  });

  it('uses multi-stage build', () => {
    const fromStatements = dockerfile.match(/^FROM /gm);
    expect(fromStatements?.length).toBeGreaterThanOrEqual(3);
  });

  it('installs dependencies without dev packages', () => {
    expect(dockerfile).toContain('pnpm install --frozen-lockfile');
  });

  it('creates non-root user', () => {
    expect(dockerfile).toContain('useradd');
    expect(dockerfile).toContain('syberagent');
  });

  it('includes healthcheck', () => {
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(dockerfile).toContain('/health');
  });

  it('exposes SSH port', () => {
    expect(dockerfile).toContain('EXPOSE 22');
  });

  it('uses entrypoint script', () => {
    expect(dockerfile).toContain('ENTRYPOINT ["/entrypoint.sh"]');
  });

  it('copies dist directory', () => {
    expect(dockerfile).toContain('COPY apps/agent/dist');
  });
});

describe('entrypoint.sh', () => {
  const entrypoint = readFileSync(ENTRYPOINT_PATH, 'utf-8');

  it('starts with bash shebang', () => {
    expect(entrypoint.startsWith('#!/bin/bash')).toBe(true);
  });

  it('uses set -e for error handling', () => {
    expect(entrypoint).toContain('set -e');
  });

  it('starts auditd', () => {
    expect(entrypoint).toContain('auditd');
  });

  it('starts fail2ban', () => {
    expect(entrypoint).toContain('fail2ban');
  });

  it('starts SSH daemon', () => {
    expect(entrypoint).toContain('sshd');
  });

  it('runs agent as foreground process as the unprivileged syberagent user', () => {
    expect(entrypoint).toContain('exec gosu syberagent node dist/index.js');
  });
});

describe('audit.rules', () => {
  const rules = readFileSync(AUDIT_RULES_PATH, 'utf-8');

  it('monitors execve syscalls', () => {
    expect(rules).toContain('execve');
  });

  it('monitors critical binary directories', () => {
    expect(rules).toContain('/bin');
    expect(rules).toContain('/usr/bin');
    expect(rules).toContain('/sbin');
  });

  it('monitors sudo and su', () => {
    expect(rules).toContain('sudo');
    expect(rules).toContain('/usr/bin/su');
  });

  it('monitors auth log', () => {
    expect(rules).toContain('auth.log');
  });
});

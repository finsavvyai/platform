/**
 * MCP Guardian Scanner Service Tests
 */
import { describe, it, expect } from 'vitest';
import {
  scanMCPConfig,
  checkBindAddress,
  checkAuthentication,
  checkFileToolPermissions,
  checkCommandInjection,
  checkTokenPrivileges,
  checkSupplyChain,
  checkConversationStorage,
} from './mcp-guardian.js';

describe('MCP Guardian Service', () => {
  describe('checkBindAddress', () => {
    it('flags 0.0.0.0 as critical', () => {
      const findings = checkBindAddress({ name: 'test', bindAddress: '0.0.0.0' });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].checkId).toBe('MCP-001');
    });

    it('flags :: as critical', () => {
      const findings = checkBindAddress({ name: 'test', bindAddress: '::' });
      expect(findings).toHaveLength(1);
    });

    it('passes for 127.0.0.1', () => {
      expect(checkBindAddress({ name: 'test', bindAddress: '127.0.0.1' })).toHaveLength(0);
    });

    it('passes when no bindAddress', () => {
      expect(checkBindAddress({ name: 'test' })).toHaveLength(0);
    });
  });

  describe('checkAuthentication', () => {
    it('flags missing auth as critical', () => {
      const findings = checkAuthentication({ name: 'test', auth: null });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('critical');
    });

    it('flags auth with no type', () => {
      const findings = checkAuthentication({ name: 'test', auth: {} });
      expect(findings).toHaveLength(1);
    });

    it('passes with valid auth', () => {
      expect(checkAuthentication({ name: 'test', auth: { type: 'token' } })).toHaveLength(0);
    });
  });

  describe('checkFileToolPermissions', () => {
    it('flags file tool with no permissions', () => {
      const findings = checkFileToolPermissions({
        name: 'test',
        tools: [{ name: 'file-reader', permissions: [] }],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
    });

    it('passes for non-file tools', () => {
      const findings = checkFileToolPermissions({
        name: 'test',
        tools: [{ name: 'calculator' }],
      });
      expect(findings).toHaveLength(0);
    });
  });

  describe('checkCommandInjection', () => {
    it('flags bash command', () => {
      const findings = checkCommandInjection({
        name: 'test',
        tools: [{ name: 'runner', command: 'bash -c "echo hi"' }],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
    });

    it('flags exec in tool name', () => {
      const findings = checkCommandInjection({
        name: 'test',
        tools: [{ name: 'exec-tool' }],
      });
      expect(findings).toHaveLength(1);
    });

    it('passes for safe tools', () => {
      expect(checkCommandInjection({
        name: 'test',
        tools: [{ name: 'read-only', command: 'cat /tmp/log' }],
      })).toHaveLength(0);
    });
  });

  describe('checkTokenPrivileges', () => {
    it('flags admin scope', () => {
      const findings = checkTokenPrivileges({
        name: 'test', tokenScopes: ['admin', 'read'],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('medium');
    });

    it('passes for limited scopes', () => {
      expect(checkTokenPrivileges({
        name: 'test', tokenScopes: ['read', 'list'],
      })).toHaveLength(0);
    });
  });

  describe('checkSupplyChain', () => {
    it('flags known IOC package', () => {
      const findings = checkSupplyChain({
        name: 'test', dependencies: ['mcp-evil-server'],
      });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('high');
    });

    it('passes for clean dependencies', () => {
      expect(checkSupplyChain({
        name: 'test', dependencies: ['safe-lib'],
      })).toHaveLength(0);
    });
  });

  describe('checkConversationStorage', () => {
    it('flags unencrypted storage', () => {
      const findings = checkConversationStorage({
        name: 'test', storage: { encrypted: false },
      });
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('critical');
    });

    it('flags missing encryption flag', () => {
      const findings = checkConversationStorage({
        name: 'test', storage: { path: '/data' },
      });
      expect(findings).toHaveLength(1);
    });

    it('passes for encrypted storage', () => {
      expect(checkConversationStorage({
        name: 'test', storage: { encrypted: true },
      })).toHaveLength(0);
    });
  });

  describe('scanMCPConfig (integration)', () => {
    it('runs all 7 checks and returns combined findings', () => {
      const findings = scanMCPConfig({
        name: 'All Bad Server',
        bindAddress: '0.0.0.0',
        auth: null,
        tools: [
          { name: 'file-tool', permissions: [] },
          { name: 'exec-runner', command: 'bash' },
        ],
        tokenScopes: ['admin'],
        dependencies: ['mcp-backdoor'],
        storage: { encrypted: false },
      });
      expect(findings.length).toBeGreaterThanOrEqual(7);
      const checkIds = findings.map((f) => f.checkId);
      expect(checkIds).toContain('MCP-001');
      expect(checkIds).toContain('MCP-002');
      expect(checkIds).toContain('MCP-003');
      expect(checkIds).toContain('MCP-004');
      expect(checkIds).toContain('MCP-005');
      expect(checkIds).toContain('MCP-006');
      expect(checkIds).toContain('MCP-007');
    });

    it('returns empty findings for clean config', () => {
      const findings = scanMCPConfig({
        name: 'Clean',
        bindAddress: '127.0.0.1',
        auth: { type: 'mTLS' },
        storage: { encrypted: true },
        tokenScopes: ['read'],
        dependencies: ['safe'],
      });
      expect(findings).toHaveLength(0);
    });
  });
});

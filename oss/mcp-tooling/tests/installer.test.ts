import { describe, it, expect, beforeEach } from 'vitest';
import { MCPInstaller } from '../src/services/installer';

describe('MCPInstaller', () => {
  let installer: MCPInstaller;

  beforeEach(() => {
    installer = new MCPInstaller();
  });

  it('should install a server', async () => {
    const result = await installer.install({
      serverId: 'test-server',
      version: '1.0.0',
      destination: '/usr/local/mcp',
    });
    expect(result.success).toBe(true);
    expect(result.serverId).toBe('test-server');
    expect(result.version).toBe('1.0.0');
  });

  it('should throw on missing config', async () => {
    expect(async () => {
      await installer.install({
        serverId: '',
        version: '1.0.0',
        destination: '/usr/local/mcp',
      });
    }).rejects.toThrow();
  });

  it('should track installed servers', async () => {
    await installer.install({
      serverId: 'server1',
      version: '1.0.0',
      destination: '/path1',
    });
    expect(installer.isInstalled('server1')).toBe(true);
  });

  it('should uninstall a server', async () => {
    await installer.install({
      serverId: 'server1',
      version: '1.0.0',
      destination: '/path1',
    });
    const uninstalled = await installer.uninstall('server1');
    expect(uninstalled).toBe(true);
    expect(installer.isInstalled('server1')).toBe(false);
  });

  it('should update a server', async () => {
    await installer.install({
      serverId: 'server1',
      version: '1.0.0',
      destination: '/path1',
    });
    const updated = await installer.update('server1', '2.0.0');
    expect(updated.version).toBe('2.0.0');
  });

  it('should list installed servers', async () => {
    await installer.install({
      serverId: 'server1',
      version: '1.0.0',
      destination: '/path1',
    });
    await installer.install({
      serverId: 'server2',
      version: '1.0.0',
      destination: '/path2',
    });
    const list = installer.listInstalled();
    expect(list).toHaveLength(2);
  });
});

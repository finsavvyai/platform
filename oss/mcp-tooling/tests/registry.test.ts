import { describe, it, expect, beforeEach } from 'vitest';
import { ServerRegistry } from '../src/services/registry';

describe('ServerRegistry', () => {
  let registry: ServerRegistry;

  beforeEach(() => {
    registry = new ServerRegistry();
  });

  it('should register a server', () => {
    const server = registry.register({
      name: 'Test Server',
      description: 'A test server',
      author: 'Test Author',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 0,
      rating: 5,
      tags: ['test'],
    });
    expect(server.id).toBeDefined();
    expect(server.name).toBe('Test Server');
  });

  it('should throw on missing name', () => {
    expect(() => {
      registry.register({
        name: '',
        description: 'Desc',
        author: 'Author',
        version: '1.0.0',
        repositoryUrl: 'https://github.com/test/repo',
        downloads: 0,
        rating: 0,
        tags: [],
      });
    }).toThrow('Server name and author are required');
  });

  it('should get server by id', () => {
    const registered = registry.register({
      name: 'Test',
      description: 'Test',
      author: 'Author',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 0,
      rating: 0,
      tags: [],
    });
    const found = registry.get(registered.id);
    expect(found).toEqual(registered);
  });

  it('should return undefined for unknown id', () => {
    expect(registry.get('unknown-id')).toBeUndefined();
  });

  it('should search by name', () => {
    registry.register({
      name: 'Analytics Server',
      description: 'Analytics tool',
      author: 'Author1',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 100,
      rating: 5,
      tags: ['analytics'],
    });
    registry.register({
      name: 'Storage Server',
      description: 'Storage solution',
      author: 'Author2',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 50,
      rating: 4,
      tags: ['storage'],
    });
    const results = registry.search({ search: 'Analytics' });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Analytics Server');
  });

  it('should search by tags', () => {
    registry.register({
      name: 'Server1',
      description: 'Desc1',
      author: 'Author1',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 0,
      rating: 0,
      tags: ['ai', 'ml'],
    });
    registry.register({
      name: 'Server2',
      description: 'Desc2',
      author: 'Author2',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 0,
      rating: 0,
      tags: ['storage'],
    });
    const results = registry.search({ tags: ['ai'] });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Server1');
  });

  it('should sort by downloads', () => {
    registry.register({
      name: 'Popular',
      description: 'Desc',
      author: 'Author',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 1000,
      rating: 5,
      tags: [],
    });
    registry.register({
      name: 'Less Popular',
      description: 'Desc',
      author: 'Author',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 100,
      rating: 5,
      tags: [],
    });
    const results = registry.search({});
    expect(results[0].name).toBe('Popular');
  });

  it('should update server', () => {
    const registered = registry.register({
      name: 'Test',
      description: 'Old desc',
      author: 'Author',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 0,
      rating: 0,
      tags: [],
    });
    const updated = registry.update(registered.id, {
      description: 'New desc',
    });
    expect(updated?.description).toBe('New desc');
  });

  it('should increment downloads', () => {
    const registered = registry.register({
      name: 'Test',
      description: 'Desc',
      author: 'Author',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 5,
      rating: 0,
      tags: [],
    });
    registry.incrementDownloads(registered.id);
    const updated = registry.get(registered.id);
    expect(updated?.downloads).toBe(6);
  });

  it('should delete server', () => {
    const registered = registry.register({
      name: 'Test',
      description: 'Desc',
      author: 'Author',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 0,
      rating: 0,
      tags: [],
    });
    const deleted = registry.delete(registered.id);
    expect(deleted).toBe(true);
    expect(registry.get(registered.id)).toBeUndefined();
  });

  it('should get all servers', () => {
    registry.register({
      name: 'Server1',
      description: 'Desc',
      author: 'Author',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 0,
      rating: 0,
      tags: [],
    });
    registry.register({
      name: 'Server2',
      description: 'Desc',
      author: 'Author',
      version: '1.0.0',
      repositoryUrl: 'https://github.com/test/repo',
      downloads: 0,
      rating: 0,
      tags: [],
    });
    expect(registry.getAll()).toHaveLength(2);
  });
});

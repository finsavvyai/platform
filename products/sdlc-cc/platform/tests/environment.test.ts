import { describe, it, expect, beforeEach } from 'vitest';
import { EnvironmentManager, EnvironmentConfig } from '../src/services/environment';

describe('EnvironmentManager', () => {
  let manager: EnvironmentManager;

  beforeEach(() => {
    manager = new EnvironmentManager();
  });

  it('should create an environment', () => {
    const config: EnvironmentConfig = {
      name: 'Development',
      type: 'development',
      variables: { NODE_ENV: 'development' },
      secrets: { DB_PASSWORD: 'secret' },
      replicas: 1,
      resources: { cpu: '500m', memory: '512Mi' },
    };

    const env = manager.createEnvironment(config);

    expect(env.id).toBeDefined();
    expect(env.config).toEqual(config);
    expect(env.status).toBe('creating');
  });

  it('should get an environment', async () => {
    const config: EnvironmentConfig = {
      name: 'Staging',
      type: 'staging',
      variables: {},
      secrets: {},
      replicas: 2,
      resources: { cpu: '1000m', memory: '1Gi' },
    };

    const created = manager.createEnvironment(config);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const retrieved = manager.getEnvironment(created.id);

    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.status).toBe('ready');
  });

  it('should update environment variables', () => {
    const config: EnvironmentConfig = {
      name: 'Dev',
      type: 'development',
      variables: {},
      secrets: {},
      replicas: 1,
      resources: { cpu: '500m', memory: '512Mi' },
    };

    const env = manager.createEnvironment(config);
    const result = manager.setVariable(env.id, 'LOG_LEVEL', 'debug');

    expect(result).toBe(true);
    expect(manager.getVariables(env.id)?.LOG_LEVEL).toBe('debug');
  });

  it('should set secrets', () => {
    const config: EnvironmentConfig = {
      name: 'Prod',
      type: 'production',
      variables: {},
      secrets: {},
      replicas: 3,
      resources: { cpu: '2000m', memory: '2Gi' },
    };

    const env = manager.createEnvironment(config);
    const result = manager.setSecret(env.id, 'API_KEY', 'key123');

    expect(result).toBe(true);
    expect(manager.getSecrets(env.id)?.API_KEY).toBe('key123');
  });

  it('should delete an environment', () => {
    const config: EnvironmentConfig = {
      name: 'Temp',
      type: 'staging',
      variables: {},
      secrets: {},
      replicas: 1,
      resources: { cpu: '500m', memory: '512Mi' },
    };

    const env = manager.createEnvironment(config);
    const deleted = manager.deleteEnvironment(env.id);

    expect(deleted).toBe(true);
    expect(manager.getEnvironment(env.id)).toBeUndefined();
  });

  it('should list all environments', () => {
    const configs: EnvironmentConfig[] = [
      {
        name: 'Dev',
        type: 'development',
        variables: {},
        secrets: {},
        replicas: 1,
        resources: { cpu: '500m', memory: '512Mi' },
      },
      {
        name: 'Prod',
        type: 'production',
        variables: {},
        secrets: {},
        replicas: 3,
        resources: { cpu: '2000m', memory: '2Gi' },
      },
    ];

    configs.forEach((config) => manager.createEnvironment(config));

    const all = manager.listEnvironments();
    expect(all).toHaveLength(2);
  });

  it('should list environments by type', () => {
    const configs: EnvironmentConfig[] = [
      {
        name: 'Dev1',
        type: 'development',
        variables: {},
        secrets: {},
        replicas: 1,
        resources: { cpu: '500m', memory: '512Mi' },
      },
      {
        name: 'Dev2',
        type: 'development',
        variables: {},
        secrets: {},
        replicas: 1,
        resources: { cpu: '500m', memory: '512Mi' },
      },
      {
        name: 'Prod',
        type: 'production',
        variables: {},
        secrets: {},
        replicas: 3,
        resources: { cpu: '2000m', memory: '2Gi' },
      },
    ];

    configs.forEach((config) => manager.createEnvironment(config));

    const dev = manager.listByType('development');
    expect(dev).toHaveLength(2);

    const prod = manager.listByType('production');
    expect(prod).toHaveLength(1);
  });

  it('should update environment config', () => {
    const config: EnvironmentConfig = {
      name: 'Old Name',
      type: 'staging',
      variables: {},
      secrets: {},
      replicas: 1,
      resources: { cpu: '500m', memory: '512Mi' },
    };

    const env = manager.createEnvironment(config);
    const updated = manager.updateEnvironment(env.id, { name: 'New Name' });

    expect(updated?.config.name).toBe('New Name');
    expect(updated?.status).toBe('updating');
  });
});

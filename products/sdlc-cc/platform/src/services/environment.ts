// Environment manager: dev/staging/prod, provisioning
export type EnvironmentType = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  name: string;
  type: EnvironmentType;
  variables: Record<string, string>;
  secrets: Record<string, string>;
  replicas: number;
  resources: {
    cpu: string;
    memory: string;
  };
}

export interface Environment {
  id: string;
  config: EnvironmentConfig;
  status: 'creating' | 'ready' | 'updating' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

let envCounter = 0;

export class EnvironmentManager {
  private environments: Map<string, Environment> = new Map();

  createEnvironment(config: EnvironmentConfig): Environment {
    const env: Environment = {
      id: `env_${Date.now()}_${++envCounter}`,
      config,
      status: 'creating',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.environments.set(env.id, env);
    this.provisionAsync(env.id);
    return env;
  }

  private async provisionAsync(envId: string): Promise<void> {
    const env = this.environments.get(envId);
    if (!env) return;

    try {
      await this.provision(env);
      env.status = 'ready';
      env.updatedAt = new Date();
    } catch (error) {
      env.status = 'error';
      env.updatedAt = new Date();
    }
  }

  private async provision(env: Environment): Promise<void> {
    return new Promise((resolve) => {
      const delay = env.config.type === 'production' ? 150 : 100;
      setTimeout(() => resolve(), delay);
    });
  }

  getEnvironment(id: string): Environment | undefined {
    return this.environments.get(id);
  }

  updateEnvironment(id: string, config: Partial<EnvironmentConfig>): Environment | undefined {
    const env = this.environments.get(id);
    if (!env) return undefined;

    env.config = { ...env.config, ...config };
    env.status = 'updating';
    env.updatedAt = new Date();

    this.provisionAsync(id);
    return env;
  }

  setVariable(envId: string, key: string, value: string): boolean {
    const env = this.environments.get(envId);
    if (!env) return false;
    env.config.variables[key] = value;
    return true;
  }

  setSecret(envId: string, key: string, value: string): boolean {
    const env = this.environments.get(envId);
    if (!env) return false;
    env.config.secrets[key] = value;
    return true;
  }

  deleteEnvironment(id: string): boolean {
    return this.environments.delete(id);
  }

  listEnvironments(): Environment[] {
    return Array.from(this.environments.values());
  }

  listByType(type: EnvironmentType): Environment[] {
    return Array.from(this.environments.values()).filter(
      (e) => e.config.type === type
    );
  }

  getVariables(envId: string): Record<string, string> | undefined {
    const env = this.environments.get(envId);
    return env?.config.variables;
  }

  getSecrets(envId: string): Record<string, string> | undefined {
    const env = this.environments.get(envId);
    return env?.config.secrets;
  }
}

export interface InstallConfig {
  serverId: string;
  version: string;
  destination: string;
  environment?: Record<string, string>;
}

export interface InstallResult {
  success: boolean;
  serverId: string;
  version: string;
  message: string;
  configPath?: string;
}

export class MCPInstaller {
  private installedServers: Map<string, InstallResult> = new Map();

  public async install(config: InstallConfig): Promise<InstallResult> {
    if (!config.serverId || !config.version || !config.destination) {
      throw new Error('Missing required install config: serverId, version, destination');
    }

    const result: InstallResult = {
      success: true,
      serverId: config.serverId,
      version: config.version,
      message: `MCP server ${config.serverId}@${config.version} installed`,
      configPath: `${config.destination}/config.json`,
    };

    this.installedServers.set(config.serverId, result);
    return result;
  }

  public async uninstall(serverId: string): Promise<boolean> {
    if (!this.installedServers.has(serverId)) {
      return false;
    }
    this.installedServers.delete(serverId);
    return true;
  }

  public async update(serverId: string, newVersion: string): Promise<InstallResult> {
    const current = this.installedServers.get(serverId);
    if (!current) {
      throw new Error(`Server ${serverId} not installed`);
    }
    const updated: InstallResult = {
      ...current,
      version: newVersion,
      message: `Updated ${serverId} to ${newVersion}`,
    };
    this.installedServers.set(serverId, updated);
    return updated;
  }

  public getInstalled(serverId: string): InstallResult | undefined {
    return this.installedServers.get(serverId);
  }

  public listInstalled(): InstallResult[] {
    return Array.from(this.installedServers.values());
  }

  public isInstalled(serverId: string): boolean {
    return this.installedServers.has(serverId);
  }
}

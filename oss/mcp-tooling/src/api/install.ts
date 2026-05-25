import { MCPInstaller, InstallResult } from '../services/installer';

export interface InstallRequest {
  serverId: string;
  version: string;
  destination: string;
  environment?: Record<string, string>;
}

export interface UninstallRequest {
  serverId: string;
}

export interface UpdateRequest {
  serverId: string;
  version: string;
}

export class InstallAPI {
  constructor(private installer: MCPInstaller) {}

  public async install(req: InstallRequest): Promise<InstallResult> {
    return this.installer.install({
      serverId: req.serverId,
      version: req.version,
      destination: req.destination,
      environment: req.environment,
    });
  }

  public async uninstall(req: UninstallRequest): Promise<boolean> {
    return this.installer.uninstall(req.serverId);
  }

  public async update(req: UpdateRequest): Promise<InstallResult> {
    return this.installer.update(req.serverId, req.version);
  }

  public getInstalled(serverId: string): InstallResult | undefined {
    return this.installer.getInstalled(serverId);
  }

  public listInstalled(): InstallResult[] {
    return this.installer.listInstalled();
  }

  public isInstalled(serverId: string): boolean {
    return this.installer.isInstalled(serverId);
  }
}

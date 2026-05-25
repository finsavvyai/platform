import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import axios from 'axios';
import { Logger } from './utils/logger';
import { BridgeGenerator } from './generators/bridge-generator';
import { PackageJsonIntegrator } from './integrators/package-json-integrator';

export interface UdpConfig {
  project: string;
  target_language: string;
  dependencies: {
    [ecosystem: string]: string[] | { name: string; version: string; ecosystem: string; bridge?: string; optional?: boolean }[];
  };
  bridges: {
    [language: string]: {
      enabled: boolean;
      runtime: string;
      version?: string;
      dependencies_path: string;
    };
  };
  udp_service: {
    url: string;
    api_key: string;
    organization_id: string;
    timeout?: number;
    retry_count?: number;
  };
  security?: {
    scan_vulnerabilities: boolean;
    fail_on_critical: boolean;
    fail_on_high: boolean;
    allowed_licenses: string[];
  };
}

export class UdpManager {
  private config: UdpConfig | null = null;
  private bridgeGenerator: BridgeGenerator;
  private packageIntegrator: PackageJsonIntegrator;

  constructor(private logger: Logger) {
    this.bridgeGenerator = new BridgeGenerator(logger);
    this.packageIntegrator = new PackageJsonIntegrator(logger);
  }

  async analyze(configPath: string): Promise<void> {
    this.logger.info(`Analyzing UDP configuration: ${configPath}`);

    if (!await fs.pathExists(configPath)) {
      throw new Error(`UDP configuration file not found: ${configPath}`);
    }

    const configContent = await fs.readFile(configPath, 'utf-8');
    this.config = yaml.parse(configContent) as UdpConfig;

    // Validate configuration
    this.validateConfig();

    // Check UDP service connectivity
    await this.checkServiceConnectivity();

    this.logger.info('Configuration analysis completed');
  }

  async download(configPath: string, outputDir: string): Promise<void> {
    if (!this.config) {
      await this.analyze(configPath);
    }

    this.logger.info(`Downloading dependencies to: ${outputDir}`);

    await fs.ensureDir(outputDir);

    // Call UDP service to resolve and download dependencies
    const response = await axios.post(
      `${this.config!.udp_service.url}/api/v1/dependencies/resolve`,
      {
        project: this.config!.project,
        target_language: this.config!.target_language,
        dependencies: this.config!.dependencies
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config!.udp_service.api_key}`,
          'X-Organization-ID': this.config!.udp_service.organization_id
        },
        timeout: (this.config!.udp_service.timeout || 30) * 1000
      }
    );

    const resolvedDependencies = response.data;

    // Download each dependency
    for (const dep of resolvedDependencies.dependencies) {
      await this.downloadDependency(dep, outputDir);
    }

    this.logger.info('All dependencies downloaded successfully');
  }

  async generateBridges(configPath: string, outputDir: string): Promise<void> {
    if (!this.config) {
      await this.analyze(configPath);
    }

    this.logger.info(`Generating bridge code to: ${outputDir}`);

    await fs.ensureDir(outputDir);

    // Generate bridge code for each enabled bridge
    for (const [language, bridgeConfig] of Object.entries(this.config!.bridges)) {
      if (bridgeConfig.enabled) {
        await this.bridgeGenerator.generateBridge(
          language,
          bridgeConfig,
          this.config!.dependencies[language] || [],
          outputDir
        );
      }
    }

    this.logger.info('Bridge code generation completed');
  }

  async setup(configPath: string): Promise<void> {
    await this.analyze(configPath);
    await this.download(configPath, 'node_modules/.udp');
    await this.generateBridges(configPath, 'src/udp-bridges');
  }

  async install(): Promise<void> {
    this.logger.info('Installing UDP integration in package.json');

    await this.packageIntegrator.addUdpScripts();
    await this.packageIntegrator.addUdpDependencies();

    // Create default udp.yml if it doesn't exist
    if (!await fs.pathExists('udp.yml')) {
      await this.createDefaultConfig();
    }

    this.logger.info('UDP integration installed successfully');
  }

  private validateConfig(): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    if (!this.config.project) {
      throw new Error('Project name is required in UDP configuration');
    }

    if (!this.config.target_language) {
      throw new Error('Target language is required in UDP configuration');
    }

    if (!this.config.udp_service?.url) {
      throw new Error('UDP service URL is required');
    }

    if (!this.config.udp_service?.api_key) {
      throw new Error('UDP service API key is required');
    }

    if (!this.config.udp_service?.organization_id) {
      throw new Error('UDP service organization ID is required');
    }
  }

  private async checkServiceConnectivity(): Promise<void> {
    try {
      const response = await axios.get(
        `${this.config!.udp_service.url}/api/v1/health`,
        {
          headers: {
            'Authorization': `Bearer ${this.config!.udp_service.api_key}`,
            'X-Organization-ID': this.config!.udp_service.organization_id
          },
          timeout: 5000
        }
      );

      if (response.status !== 200) {
        throw new Error(`UDP service health check failed: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Cannot connect to UDP service: ${error}`);
    }
  }

  private async downloadDependency(dependency: any, outputDir: string): Promise<void> {
    this.logger.debug(`Downloading dependency: ${dependency.name}@${dependency.version}`);

    const response = await axios.get(dependency.download_url, {
      responseType: 'stream',
      headers: {
        'Authorization': `Bearer ${this.config!.udp_service.api_key}`,
        'X-Organization-ID': this.config!.udp_service.organization_id
      }
    });

    const filePath = path.join(outputDir, dependency.ecosystem, dependency.filename);
    await fs.ensureDir(path.dirname(filePath));

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  private async createDefaultConfig(): Promise<void> {
    const defaultConfig = `# UDP Configuration for JavaScript/TypeScript Project
project: ${path.basename(process.cwd())}
target_language: javascript

dependencies:
  javascript:
    - "lodash:4.17.21"
    - "moment:2.29.4"

  python:
    - "requests:2.28.1"
    - "pandas:1.5.2"

bridges:
  python:
    enabled: true
    runtime: subprocess
    version: "3.8"
    dependencies_path: "node_modules/.udp/python"

udp_service:
  url: "http://localhost:8040"
  api_key: "\${UDP_API_KEY}"
  organization_id: "\${UDP_ORGANIZATION_ID}"
  timeout: 30
  retry_count: 3

security:
  scan_vulnerabilities: true
  fail_on_critical: true
  fail_on_high: false
  allowed_licenses:
    - "MIT"
    - "Apache-2.0"
    - "BSD-3-Clause"
    - "ISC"
`;

    await fs.writeFile('udp.yml', defaultConfig);
    this.logger.info('Created default udp.yml configuration file');
  }
}
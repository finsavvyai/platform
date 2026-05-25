/**
 * Seed Data Manager for Claude Agent Platform
 *
 * Provides database seeding with:
 * - Initial data setup
 * - Environment-specific seeding
 * - Data validation and rollback
 * - Seed data versioning
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

export interface SeedConfig {
  environment: 'development' | 'staging' | 'production';
  resetDatabase?: boolean;
  skipValidation?: boolean;
  batchSize?: number;
}

export interface SeedData {
  version: string;
  description: string;
  data: {
    users?: any[];
    projects?: any[];
    agents?: any[];
    systemConfigs?: any[];
    [key: string]: any[];
  };
  dependencies?: string[];
}

export class SeedDataManager extends EventEmitter {
  private prisma: PrismaClient;
  private seedsPath: string;
  private seedData: Map<string, SeedData> = new Map();

  constructor(prisma: PrismaClient, seedsPath: string) {
    super();
    this.prisma = prisma;
    this.seedsPath = seedsPath;
  }

  /**
   * Initialize seed data manager
   */
  async initialize(): Promise<void> {
    await this.loadSeedFiles();
  }

  /**
   * Run database seeding
   */
  async seed(config: SeedConfig): Promise<void> {
    this.emit('seedStart', config);

    try {
      // Reset database if requested
      if (config.resetDatabase) {
        await this.resetDatabase();
      }

      // Load seed data based on environment
      const seedData = await this.getSeedDataForEnvironment(config.environment);

      if (!seedData) {
        this.emit('seedWarning', `No seed data found for environment: ${config.environment}`);
        return;
      }

      // Apply seed data in batches
      await this.applySeedData(seedData, config);

      // Validate seeded data if enabled
      if (!config.skipValidation) {
        await this.validateSeededData(seedData);
      }

      this.emit('seedComplete', { version: seedData.version, environment: config.environment });
    } catch (error) {
      this.emit('seedError', error);
      throw error;
    }
  }

  /**
   * Get available seed data
   */
  getAvailableSeeds(): string[] {
    return Array.from(this.seedData.keys());
  }

  /**
   * Get seed data by version
   */
  getSeedData(version: string): SeedData | undefined {
    return this.seedData.get(version);
  }

  /**
   * Load seed files from directory
   */
  private async loadSeedFiles(): Promise<void> {
    if (!fs.existsSync(this.seedsPath)) {
      fs.mkdirSync(this.seedsPath, { recursive: true });
      return;
    }

    const files = fs.readdirSync(this.seedsPath)
      .filter(file => file.endsWith('.json'))
      .sort();

    for (const file of files) {
      try {
        const filePath = path.join(this.seedsPath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const seedData: SeedData = JSON.parse(content);

        // Extract version from filename
        const version = path.basename(file, '.json');
        seedData.version = seedData.version || version;

        this.seedData.set(seedData.version, seedData);
      } catch (error) {
        console.warn(`Failed to load seed file ${file}:`, error);
      }
    }
  }

  /**
   * Get seed data for specific environment
   */
  private async getSeedDataForEnvironment(environment: string): Promise<SeedData | null> {
    // Try to find environment-specific seed first
    const envSeed = this.seedData.get(`${environment}-seed`);
    if (envSeed) {
      return envSeed;
    }

    // Fall back to default seed
    return this.seedData.get('default-seed') || null;
  }

  /**
   * Apply seed data to database
   */
  private async applySeedData(seedData: SeedData, config: SeedConfig): Promise<void> {
    const batchSize = config.batchSize || 100;

    // Apply users first (for relationships)
    if (seedData.data.users && seedData.data.users.length > 0) {
      await this.seedUsers(seedData.data.users, batchSize);
    }

    // Apply system configurations
    if (seedData.data.systemConfigs && seedData.data.systemConfigs.length > 0) {
      await this.seedSystemConfigs(seedData.data.systemConfigs, batchSize);
    }

    // Apply projects
    if (seedData.data.projects && seedData.data.projects.length > 0) {
      await this.seedProjects(seedData.data.projects, batchSize);
    }

    // Apply agents
    if (seedData.data.agents && seedData.data.agents.length > 0) {
      await this.seedAgents(seedData.data.agents, batchSize);
    }

    // Apply other data types
    for (const [dataType, records] of Object.entries(seedData.data)) {
      if (!['users', 'systemConfigs', 'projects', 'agents'].includes(dataType) && records.length > 0) {
        await this.seedGenericData(dataType, records, batchSize);
      }
    }
  }

  /**
   * Seed users data
   */
  private async seedUsers(users: any[], batchSize: number): Promise<void> {
    const bcrypt = require('bcryptjs');

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      for (const user of batch) {
        // Hash password if provided
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }

        // Set default values
        user.createdAt = user.createdAt || new Date();
        user.updatedAt = user.updatedAt || new Date();
        user.status = user.status || 'ACTIVE';
        user.role = user.role || 'USER';
      }

      await this.prisma.user.createMany({
        data: batch,
        skipDuplicates: true,
      });

      this.emit('seedProgress', { type: 'users', processed: i + batch.length, total: users.length });
    }
  }

  /**
   * Seed system configurations
   */
  private async seedSystemConfigs(configs: any[], batchSize: number): Promise<void> {
    for (let i = 0; i < configs.length; i += batchSize) {
      const batch = configs.slice(i, i + batchSize);

      for (const config of batch) {
        config.createdAt = config.createdAt || new Date();
        config.updatedAt = config.updatedAt || new Date();
        config.isActive = config.isActive !== false;
      }

      await this.prisma.systemConfig.createMany({
        data: batch,
        skipDuplicates: true,
      });

      this.emit('seedProgress', { type: 'systemConfigs', processed: i + batch.length, total: configs.length });
    }
  }

  /**
   * Seed projects data
   */
  private async seedProjects(projects: any[], batchSize: number): Promise<void> {
    for (let i = 0; i < projects.length; i += batchSize) {
      const batch = projects.slice(i, i + batchSize);

      for (const project of batch) {
        project.createdAt = project.createdAt || new Date();
        project.updatedAt = project.updatedAt || new Date();
        project.status = project.status || 'ACTIVE';
        project.slug = project.slug || project.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      }

      await this.prisma.project.createMany({
        data: batch,
        skipDuplicates: true,
      });

      this.emit('seedProgress', { type: 'projects', processed: i + batch.length, total: projects.length });
    }
  }

  /**
   * Seed agents data
   */
  private async seedAgents(agents: any[], batchSize: number): Promise<void> {
    for (let i = 0; i < agents.length; i += batchSize) {
      const batch = agents.slice(i, i + batchSize);

      for (const agent of batch) {
        agent.createdAt = agent.createdAt || new Date();
        agent.updatedAt = agent.updatedAt || new Date();
        agent.version = agent.version || '1.0.0';
        agent.health = agent.health || 'HEALTHY';
        agent.status = agent.status || 'STOPPED';
      }

      await this.prisma.agent.createMany({
        data: batch,
        skipDuplicates: true,
      });

      this.emit('seedProgress', { type: 'agents', processed: i + batch.length, total: agents.length });
    }
  }

  /**
   * Seed generic data for other models
   */
  private async seedGenericData(dataType: string, records: any[], batchSize: number): Promise<void> {
    // This would need to be extended based on specific models
    // For now, we'll log a warning
    console.warn(`Generic seeding not implemented for data type: ${dataType}`);
  }

  /**
   * Validate seeded data
   */
  private async validateSeededData(seedData: SeedData): Promise<void> {
    const validationErrors: string[] = [];

    // Validate users
    if (seedData.data.users) {
      const userCount = await this.prisma.user.count();
      if (userCount < seedData.data.users.length) {
        validationErrors.push(`Expected ${seedData.data.users.length} users, found ${userCount}`);
      }
    }

    // Validate projects
    if (seedData.data.projects) {
      const projectCount = await this.prisma.project.count();
      if (projectCount < seedData.data.projects.length) {
        validationErrors.push(`Expected ${seedData.data.projects.length} projects, found ${projectCount}`);
      }
    }

    // Validate agents
    if (seedData.data.agents) {
      const agentCount = await this.prisma.agent.count();
      if (agentCount < seedData.data.agents.length) {
        validationErrors.push(`Expected ${seedData.data.agents.length} agents, found ${agentCount}`);
      }
    }

    if (validationErrors.length > 0) {
      throw new Error(`Seed validation failed: ${validationErrors.join(', ')}`);
    }

    this.emit('seedValidationComplete', { passed: true });
  }

  /**
   * Reset database (truncate all tables)
   */
  private async resetDatabase(): Promise<void> {
    const tables = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename NOT LIKE '_prisma_%'
    `;

    for (const table of tables) {
      try {
        await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table.tablename}" RESTART IDENTITY CASCADE;`);
      } catch (error) {
        console.warn(`Failed to truncate table ${table.tablename}:`, error);
      }
    }

    this.emit('databaseReset');
  }

  /**
   * Create seed data template
   */
  async createSeedTemplate(outputPath: string): Promise<void> {
    const template = {
      version: '1.0.0',
      description: 'Seed data template',
      data: {
        users: [
          {
            email: 'admin@example.com',
            username: 'admin',
            firstName: 'Admin',
            lastName: 'User',
            password: 'admin123', // This will be hashed
            role: 'ADMIN',
            status: 'ACTIVE',
            profile: {
              theme: 'light',
              language: 'en'
            }
          }
        ],
        systemConfigs: [
          {
            key: 'app.name',
            value: 'Claude Agent Platform',
            category: 'application',
            isActive: true
          },
          {
            key: 'maintenance.mode',
            value: false,
            category: 'system',
            isActive: true
          }
        ],
        projects: [
          {
            name: 'Demo Project',
            description: 'A demonstration project',
            settings: {
              visibility: 'public',
              allowCollaboration: true
            }
          }
        ],
        agents: [
          {
            name: 'Code Analyzer',
            type: 'code-analysis',
            description: 'Analyzes code for quality and security',
            config: {
              timeout: 300000,
              capabilities: ['static-analysis', 'security-scan']
            }
          }
        ]
      }
    };

    fs.writeFileSync(outputPath, JSON.stringify(template, null, 2));
    this.emit('seedTemplateCreated', { outputPath });
  }
}

/**
 * Sample Project Manager
 * Creates and manages sample workspaces for demonstration
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class SampleProjectManager {
  private sampleProjectPath: string;

  constructor(private context: vscode.ExtensionContext) {
    this.sampleProjectPath = path.join(context.extensionPath, 'sample-workspace');
  }

  /**
   * Create sample workspace
   */
  async createSampleWorkspace(): Promise<void> {
    const result = await vscode.window.showInformationMessage(
      'Would you like to open a sample project to explore LunaForge features?',
      'Open Sample Project',
      'Cancel'
    );

    if (result !== 'Open Sample Project') {
      return;
    }

    try {
      // Create sample workspace directory
      await this.ensureSampleWorkspace();

      // Open the workspace
      const workspaceUri = vscode.Uri.file(this.sampleProjectPath);
      await vscode.commands.executeCommand('vscode.openFolder', workspaceUri, {
        forceNewWindow: true
      });

      vscode.window.showInformationMessage(
        '✅ Sample project opened! This workspace demonstrates LunaForge features.'
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to create sample workspace: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Ensure sample workspace exists
   */
  private async ensureSampleWorkspace(): Promise<void> {
    if (!fs.existsSync(this.sampleProjectPath)) {
      fs.mkdirSync(this.sampleProjectPath, { recursive: true });
      await this.createSampleFiles();
    }
  }

  /**
   * Create sample files
   */
  private async createSampleFiles(): Promise<void> {
    const files = this.getSampleFileStructure();

    for (const file of files) {
      const filePath = path.join(this.sampleProjectPath, file.path);
      const dirPath = path.dirname(filePath);

      // Create directory if it doesn't exist
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Write file content
      fs.writeFileSync(filePath, file.content, 'utf-8');
    }
  }

  /**
   * Get sample file structure
   */
  private getSampleFileStructure(): Array<{ path: string; content: string }> {
    return [
      {
        path: 'README.md',
        content: `# LunaForge Sample Project

Welcome to the LunaForge sample project! This workspace demonstrates the key features of LunaForge.

## What's Included

- **src/**: Sample TypeScript/JavaScript files showing different patterns
- **utils/**: Utility functions and helpers
- **models/**: Data models and types
- **services/**: Service layer examples

## Try These Features

1. **Build Project Graph**: Run \`LunaForge: Build Project Graph\` to analyze this project
2. **View Metrics**: Check out the graph metrics in the Control Center
3. **Explore Modes**: Try different analysis modes like Galaxy or CodeFlow
4. **Analyze Files**: Right-click any file and select \`LunaForge: Analyze File\`

## Learn More

- [Documentation](https://docs.lunaforge.io)
- [GitHub](https://github.com/lunaforge/lunaforge)
- [Community](https://discord.gg/lunaforge)
`
      },
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'lunaforge-sample-project',
          version: '1.0.0',
          description: 'Sample project for LunaForge demonstration',
          main: 'src/index.ts',
          scripts: {
            build: 'tsc',
            test: 'jest'
          },
          dependencies: {
            'express': '^4.18.0',
            'lodash': '^4.17.21'
          },
          devDependencies: {
            '@types/node': '^20.0.0',
            'typescript': '^5.0.0'
          }
        }, null, 2)
      },
      {
        path: 'tsconfig.json',
        content: JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'commonjs',
            outDir: './dist',
            rootDir: './src',
            strict: true,
            esModuleInterop: true
          },
          include: ['src/**/*'],
          exclude: ['node_modules']
        }, null, 2)
      },
      {
        path: 'src/index.ts',
        content: `/**
 * Main entry point for the sample application
 * This file demonstrates a typical application structure
 */

import { UserService } from './services/UserService';
import { DatabaseService } from './services/DatabaseService';
import { Logger } from './utils/Logger';

const logger = new Logger('App');

async function main() {
  logger.info('Starting application...');

  try {
    // Initialize services
    const db = new DatabaseService();
    await db.connect();

    const userService = new UserService(db);

    // Example operations
    const users = await userService.getAllUsers();
    logger.info(\`Found \${users.length} users\`);

    const newUser = await userService.createUser({
      name: 'John Doe',
      email: 'john@example.com'
    });
    logger.info(\`Created user: \${newUser.id}\`);

  } catch (error) {
    logger.error('Application error:', error);
    process.exit(1);
  }
}

main();
`
      },
      {
        path: 'src/models/User.ts',
        content: `/**
 * User model
 * Represents a user in the system
 */

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDTO {
  name: string;
  email: string;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
}
`
      },
      {
        path: 'src/services/UserService.ts',
        content: `/**
 * User Service
 * Handles user-related business logic
 */

import { User, CreateUserDTO, UpdateUserDTO } from '../models/User';
import { DatabaseService } from './DatabaseService';
import { ValidationUtils } from '../utils/ValidationUtils';
import { Logger } from '../utils/Logger';

export class UserService {
  private logger = new Logger('UserService');

  constructor(private db: DatabaseService) {}

  async getAllUsers(): Promise<User[]> {
    this.logger.info('Fetching all users');
    return this.db.query('SELECT * FROM users');
  }

  async getUserById(id: string): Promise<User | null> {
    this.logger.info(\`Fetching user: \${id}\`);
    const users = await this.db.query('SELECT * FROM users WHERE id = ?', [id]);
    return users[0] || null;
  }

  async createUser(data: CreateUserDTO): Promise<User> {
    this.logger.info(\`Creating user: \${data.email}\`);

    // Validate input
    if (!ValidationUtils.isValidEmail(data.email)) {
      throw new Error('Invalid email address');
    }

    // Check if user exists
    const existing = await this.db.query(
      'SELECT * FROM users WHERE email = ?',
      [data.email]
    );

    if (existing.length > 0) {
      throw new Error('User already exists');
    }

    // Create user
    const user: User = {
      id: this.generateId(),
      name: data.name,
      email: data.email,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.query(
      'INSERT INTO users (id, name, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.name, user.email, user.createdAt, user.updatedAt]
    );

    return user;
  }

  async updateUser(id: string, data: UpdateUserDTO): Promise<User> {
    this.logger.info(\`Updating user: \${id}\`);

    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }

    if (data.email && !ValidationUtils.isValidEmail(data.email)) {
      throw new Error('Invalid email address');
    }

    const updated: User = {
      ...user,
      ...data,
      updatedAt: new Date()
    };

    await this.db.query(
      'UPDATE users SET name = ?, email = ?, updatedAt = ? WHERE id = ?',
      [updated.name, updated.email, updated.updatedAt, id]
    );

    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    this.logger.info(\`Deleting user: \${id}\`);
    await this.db.query('DELETE FROM users WHERE id = ?', [id]);
  }

  private generateId(): string {
    return \`user_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`;
  }
}
`
      },
      {
        path: 'src/services/DatabaseService.ts',
        content: `/**
 * Database Service
 * Handles database connections and queries
 */

import { Logger } from '../utils/Logger';

export class DatabaseService {
  private logger = new Logger('DatabaseService');
  private connected = false;

  async connect(): Promise<void> {
    this.logger.info('Connecting to database...');
    // Simulate connection
    await this.delay(1000);
    this.connected = true;
    this.logger.info('Database connected');
  }

  async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from database...');
    this.connected = false;
    this.logger.info('Database disconnected');
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    this.logger.debug(\`Executing query: \${sql}\`);
    // Simulate query execution
    await this.delay(100);
    return [] as T[];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
`
      },
      {
        path: 'src/utils/Logger.ts',
        content: `/**
 * Logger utility
 * Provides structured logging
 */

export class Logger {
  constructor(private context: string) {}

  info(message: string, ...args: any[]): void {
    console.log(\`[\${this.context}] INFO:\`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(\`[\${this.context}] WARN:\`, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(\`[\${this.context}] ERROR:\`, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    console.debug(\`[\${this.context}] DEBUG:\`, message, ...args);
  }
}
`
      },
      {
        path: 'src/utils/ValidationUtils.ts',
        content: `/**
 * Validation utilities
 * Common validation functions
 */

export class ValidationUtils {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isNotEmpty(value: string): boolean {
    return value.trim().length > 0;
  }

  static isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }
}
`
      },
      {
        path: '.vscode/settings.json',
        content: JSON.stringify({
          'lunaforge.autoBuildGraph': true,
          'lunaforge.realtimeUpdates': true,
          'lunaforge.ui.theme': 'auto'
        }, null, 2)
      }
    ];
  }

  /**
   * Check if sample workspace exists
   */
  hasSampleWorkspace(): boolean {
    return fs.existsSync(this.sampleProjectPath);
  }

  /**
   * Delete sample workspace
   */
  async deleteSampleWorkspace(): Promise<void> {
    if (fs.existsSync(this.sampleProjectPath)) {
      fs.rmSync(this.sampleProjectPath, { recursive: true, force: true });
    }
  }
}

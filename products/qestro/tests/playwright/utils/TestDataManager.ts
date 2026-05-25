/**
 * Test Data Management Utilities
 * Comprehensive data management for Playwright tests
 */

import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';

export interface TestUser {
  id?: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'tester' | 'viewer' | 'user';
  subscription?: 'free' | 'premium' | 'enterprise';
  permissions?: string[];
}

export interface TestCase {
  id?: string;
  name: string;
  description: string;
  type: 'web' | 'api' | 'mobile';
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  steps?: TestStep[];
  assertions?: TestAssertion[];
  createdAt?: string;
}

export interface TestStep {
  id?: string;
  type: 'click' | 'type' | 'navigate' | 'wait' | 'assert';
  selector?: string;
  value?: string;
  description: string;
  order: number;
}

export interface TestAssertion {
  id?: string;
  type: 'text' | 'visibility' | 'value' | 'attribute' | 'count';
  selector: string;
  expected: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  description: string;
}

export interface TestEnvironment {
  id?: string;
  name: string;
  baseUrl: string;
  apiUrl: string;
  database?: string;
  features?: string[];
  credentials?: {
    username: string;
    password: string;
  };
}

export class TestDataManager {
  private dataDir: string;
  private createdUsers: TestUser[] = [];
  private createdTests: TestCase[] = [];
  private createdEnvironments: TestEnvironment[] = [];

  constructor(dataDir: string = 'test-results/data') {
    this.dataDir = dataDir;
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  // User Management
  async createUser(userData: Partial<TestUser>): Promise<TestUser> {
    const user: TestUser = {
      email: userData.email || `test-${Date.now()}@example.com`,
      password: userData.password || 'Test123!',
      name: userData.name || `Test User ${Date.now()}`,
      role: userData.role || 'user',
      subscription: userData.subscription || 'free',
      permissions: userData.permissions || ['read']
    };

    // Simulate API call to create user
    try {
      const response = await this.makeApiCall('POST', '/api/test-users', user);
      const createdUser = { ...user, id: response.id };
      this.createdUsers.push(createdUser);
      
      // Save to file for persistence
      await this.saveToFile('users.json', this.createdUsers);
      
      return createdUser;
    } catch (error) {
      console.warn('Failed to create user via API, using mock data:', error);
      const mockUser = { ...user, id: `mock-${Date.now()}` };
      this.createdUsers.push(mockUser);
      return mockUser;
    }
  }

  async getUser(id: string): Promise<TestUser | null> {
    const user = this.createdUsers.find(u => u.id === id);
    if (user) return user;

    try {
      const response = await this.makeApiCall('GET', `/api/test-users/${id}`);
      return response;
    } catch (error) {
      console.warn(`Failed to get user ${id}:`, error);
      return null;
    }
  }

  async updateUser(id: string, updates: Partial<TestUser>): Promise<TestUser | null> {
    try {
      const response = await this.makeApiCall('PUT', `/api/test-users/${id}`, updates);
      
      // Update local cache
      const userIndex = this.createdUsers.findIndex(u => u.id === id);
      if (userIndex >= 0) {
        this.createdUsers[userIndex] = { ...this.createdUsers[userIndex], ...updates };
        await this.saveToFile('users.json', this.createdUsers);
      }
      
      return response;
    } catch (error) {
      console.warn(`Failed to update user ${id}:`, error);
      return null;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      await this.makeApiCall('DELETE', `/api/test-users/${id}`);
      
      // Remove from local cache
      this.createdUsers = this.createdUsers.filter(u => u.id !== id);
      await this.saveToFile('users.json', this.createdUsers);
      
      return true;
    } catch (error) {
      console.warn(`Failed to delete user ${id}:`, error);
      return false;
    }
  }

  // Test Case Management
  async createTestCase(testData: Partial<TestCase>): Promise<TestCase> {
    const testCase: TestCase = {
      name: testData.name || `Test Case ${Date.now()}`,
      description: testData.description || 'Generated test case',
      type: testData.type || 'web',
      tags: testData.tags || ['automated'],
      priority: testData.priority || 'medium',
      steps: testData.steps || [],
      assertions: testData.assertions || [],
      createdAt: new Date().toISOString()
    };

    try {
      const response = await this.makeApiCall('POST', '/api/test-cases', testCase);
      const createdTest = { ...testCase, id: response.id };
      this.createdTests.push(createdTest);
      
      await this.saveToFile('tests.json', this.createdTests);
      
      return createdTest;
    } catch (error) {
      console.warn('Failed to create test case via API, using mock data:', error);
      const mockTest = { ...testCase, id: `mock-${Date.now()}` };
      this.createdTests.push(mockTest);
      return mockTest;
    }
  }

  async getTestCase(id: string): Promise<TestCase | null> {
    const testCase = this.createdTests.find(t => t.id === id);
    if (testCase) return testCase;

    try {
      const response = await this.makeApiCall('GET', `/api/test-cases/${id}`);
      return response;
    } catch (error) {
      console.warn(`Failed to get test case ${id}:`, error);
      return null;
    }
  }

  async updateTestCase(id: string, updates: Partial<TestCase>): Promise<TestCase | null> {
    try {
      const response = await this.makeApiCall('PUT', `/api/test-cases/${id}`, updates);
      
      const testIndex = this.createdTests.findIndex(t => t.id === id);
      if (testIndex >= 0) {
        this.createdTests[testIndex] = { ...this.createdTests[testIndex], ...updates };
        await this.saveToFile('tests.json', this.createdTests);
      }
      
      return response;
    } catch (error) {
      console.warn(`Failed to update test case ${id}:`, error);
      return null;
    }
  }

  async deleteTestCase(id: string): Promise<boolean> {
    try {
      await this.makeApiCall('DELETE', `/api/test-cases/${id}`);
      
      this.createdTests = this.createdTests.filter(t => t.id !== id);
      await this.saveToFile('tests.json', this.createdTests);
      
      return true;
    } catch (error) {
      console.warn(`Failed to delete test case ${id}:`, error);
      return false;
    }
  }

  // Environment Management
  async createEnvironment(envData: Partial<TestEnvironment>): Promise<TestEnvironment> {
    const environment: TestEnvironment = {
      name: envData.name || `Test Environment ${Date.now()}`,
      baseUrl: envData.baseUrl || 'http://localhost:3000',
      apiUrl: envData.apiUrl || 'http://localhost:3001',
      database: envData.database || 'test_db',
      features: envData.features || [],
      credentials: envData.credentials
    };

    try {
      const response = await this.makeApiCall('POST', '/api/environments', environment);
      const createdEnv = { ...environment, id: response.id };
      this.createdEnvironments.push(createdEnv);
      
      await this.saveToFile('environments.json', this.createdEnvironments);
      
      return createdEnv;
    } catch (error) {
      console.warn('Failed to create environment via API, using mock data:', error);
      const mockEnv = { ...environment, id: `mock-${Date.now()}` };
      this.createdEnvironments.push(mockEnv);
      return mockEnv;
    }
  }

  // Test Data Generation
  generateRandomUser(role: TestUser['role'] = 'user'): Partial<TestUser> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    
    return {
      email: `test-${role}-${timestamp}-${random}@example.com`,
      password: `Test123!${random}`,
      name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)} ${timestamp}`,
      role,
      subscription: role === 'admin' ? 'enterprise' : 'free'
    };
  }

  generateRandomTestCase(type: TestCase['type'] = 'web'): Partial<TestCase> {
    const timestamp = Date.now();
    const scenarios = {
      web: {
        name: `Web Test ${timestamp}`,
        description: 'Automated web application test',
        tags: ['web', 'ui', 'automated']
      },
      api: {
        name: `API Test ${timestamp}`,
        description: 'API endpoint validation test',
        tags: ['api', 'backend', 'automated']
      },
      mobile: {
        name: `Mobile Test ${timestamp}`,
        description: 'Mobile application test',
        tags: ['mobile', 'ui', 'automated']
      }
    };

    return {
      ...scenarios[type],
      type,
      priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as TestCase['priority']
    };
  }

  // File Operations
  private async saveToFile(filename: string, data: any): Promise<void> {
    const filePath = path.join(this.dataDir, filename);
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn(`Failed to save data to ${filename}:`, error);
    }
  }

  private async loadFromFile(filename: string): Promise<any> {
    const filePath = path.join(this.dataDir, filename);
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`Failed to load data from ${filename}:`, error);
      return [];
    }
  }

  // API Simulation
  private async makeApiCall(method: string, endpoint: string, data?: any): Promise<any> {
    // In a real implementation, this would make actual HTTP requests
    // For now, we'll simulate API responses
    
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const url = `${baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: data ? JSON.stringify(data) : undefined
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Fallback to mock data for testing
      return this.generateMockApiResponse(method, endpoint, data);
    }
  }

  private generateMockApiResponse(method: string, endpoint: string, data?: any): any {
    const id = `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    switch (method) {
      case 'POST':
        return { ...data, id, createdAt: new Date().toISOString() };
      case 'GET':
        return { id, ...data };
      case 'PUT':
        return { ...data, updatedAt: new Date().toISOString() };
      case 'DELETE':
        return { success: true };
      default:
        return { success: true };
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    console.log('Cleaning up test data...');
    
    // Delete created users
    for (const user of this.createdUsers) {
      if (user.id && !user.id.startsWith('mock-')) {
        await this.deleteUser(user.id);
      }
    }
    
    // Delete created test cases
    for (const testCase of this.createdTests) {
      if (testCase.id && !testCase.id.startsWith('mock-')) {
        await this.deleteTestCase(testCase.id);
      }
    }
    
    // Delete created environments
    for (const env of this.createdEnvironments) {
      if (env.id && !env.id.startsWith('mock-')) {
        try {
          await this.makeApiCall('DELETE', `/api/environments/${env.id}`);
        } catch (error) {
          console.warn(`Failed to delete environment ${env.id}:`, error);
        }
      }
    }
    
    // Clear local caches
    this.createdUsers = [];
    this.createdTests = [];
    this.createdEnvironments = [];
    
    console.log('Test data cleanup completed');
  }

  // Utility Methods
  async seedDatabase(seedData: {
    users?: Partial<TestUser>[];
    tests?: Partial<TestCase>[];
    environments?: Partial<TestEnvironment>[];
  }): Promise<void> {
    console.log('Seeding test database...');
    
    if (seedData.users) {
      for (const userData of seedData.users) {
        await this.createUser(userData);
      }
    }
    
    if (seedData.tests) {
      for (const testData of seedData.tests) {
        await this.createTestCase(testData);
      }
    }
    
    if (seedData.environments) {
      for (const envData of seedData.environments) {
        await this.createEnvironment(envData);
      }
    }
    
    console.log('Database seeding completed');
  }

  async exportTestData(filename: string): Promise<void> {
    const exportData = {
      users: this.createdUsers,
      tests: this.createdTests,
      environments: this.createdEnvironments,
      exportedAt: new Date().toISOString()
    };
    
    await this.saveToFile(filename, exportData);
    console.log(`Test data exported to ${filename}`);
  }

  async importTestData(filename: string): Promise<void> {
    const importData = await this.loadFromFile(filename);
    
    if (importData.users) {
      this.createdUsers = importData.users;
    }
    
    if (importData.tests) {
      this.createdTests = importData.tests;
    }
    
    if (importData.environments) {
      this.createdEnvironments = importData.environments;
    }
    
    console.log(`Test data imported from ${filename}`);
  }
}
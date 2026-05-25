/**
 * Test Setup for AI Database Initialization System
 *
 * This file sets up the testing environment, mocks, and test utilities
 * for comprehensive testing of the AI Database Initialization System.
 */

import { AIDatabaseInitializationConfig } from '../types';

// Mock configuration for testing
export const mockConfig: AIDatabaseInitializationConfig = {
  modelProvider: 'openai',
  model: 'gpt-4',
  temperature: 0.3,
  maxTokens: 4000,
  enableCache: false, // Disabled for deterministic tests
  enableTelemetry: false,
  integrationSettings: {
    cloudProviders: [],
    monitoringTools: [],
    cicdPlatforms: [],
    securityTools: []
  }
};

// Mock natural language inputs for testing
export const mockInputs = {
  simple: "I need a PostgreSQL database for my blog",
  complex: "I need a PostgreSQL database for an e-commerce platform that can handle 10,000 concurrent users with 99.9% uptime. I expect to store products, orders, and customer data with complex relationships. Budget is around $500/month and I need GDPR compliance.",
  iot: "I need a time-series database for IoT sensor data that can handle 1 million measurements per hour from 10,000 devices. Data retention should be 30 days and I need real-time analytics.",
  enterprise: "Enterprise financial database with ACID compliance, supporting 50,000 concurrent users, 99.99% availability, with HIPAA and SOX compliance. Budget is $10,000/month with multi-region deployment."
};

// Mock dump file contents
export const mockDumpFiles = {
  simpleSQL: `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      title VARCHAR(255) NOT NULL,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO users (name, email) VALUES
      ('John Doe', 'john@example.com'),
      ('Jane Smith', 'jane@example.com');
  `,

  complexSQL: `
    CREATE TABLE customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      parent_id INTEGER REFERENCES categories(id)
    );

    CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      total_amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id),
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL,
      price DECIMAL(10,2) NOT NULL
    );

    CREATE INDEX idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX idx_orders_created_at ON orders(created_at);
    CREATE INDEX idx_products_category_id ON products(category_id);

    CREATE TRIGGER update_customer_timestamp
      BEFORE UPDATE ON customers
      FOR EACH ROW EXECUTE FUNCTION update_timestamp();
  `,

  jsonStructure: JSON.stringify([
    {
      type: "users",
      fields: [
        { name: "id", type: "string", required: true },
        { name: "name", type: "string", required: true },
        { name: "email", type: "string", required: true },
        { name: "profile", type: "object", fields: [
          { name: "age", type: "number" },
          { name: "interests", type: "array" }
        ]}
      ]
    },
    {
      type: "posts",
      fields: [
        { name: "id", type: "string", required: true },
        { name: "userId", type: "string", required: true },
        { name: "title", type: "string", required: true },
        { name: "content", type: "string" },
        { name: "tags", type: "array" },
        { name: "createdAt", type: "datetime" }
      ]
    }
  ], null, 2),

  csvContent: `id,name,email,created_at
1,John Doe,john@example.com,2023-01-01T10:00:00Z
2,Jane Smith,jane@example.com,2023-01-02T11:00:00Z
3,Bob Johnson,bob@example.com,2023-01-03T12:00:00Z`
};

// Mock File objects for testing
export const createMockFile = (content: string, filename: string, mimeType: string = 'text/plain'): File => {
  const blob = new Blob([content], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });
  Object.defineProperty(file, 'size', { value: content.length });
  return file;
};

// Expected results for validation
export const expectedResults = {
  postgresqlRecommendation: {
    databaseType: 'postgresql',
    confidence: expect.any(Number),
    reasoning: expect.stringContaining('PostgreSQL'),
    estimatedCost: {
      monthly: expect.any(Number),
      annual: expect.any(Number),
      currency: 'USD',
      breakdown: expect.any(Array)
    },
    performanceProfile: {
      throughput: expect.objectContaining({
        readsPerSecond: expect.any(Number),
        writesPerSecond: expect.any(Number)
      }),
      latency: expect.objectContaining({
        readLatency: expect.any(Number),
        writeLatency: expect.any(Number)
      }),
      availability: expect.any(Number),
      concurrency: expect.any(Number),
      dataConsistency: expect.any(String)
    }
  },

  basicAnalysis: {
    id: expect.stringMatching(/^analysis_/),
    inputType: expect.any(String),
    rawData: expect.any(String),
    extractedRequirements: expect.any(Array),
    recommendedDatabases: expect.any(Array),
    confidence: expect.any(Number),
    processingTime: expect.any(Number)
  },

  creationPlan: {
    id: expect.stringMatching(/^plan_/),
    analysis: expect.any(Object),
    selectedDatabase: expect.any(Object),
    steps: expect.any(Array),
    estimatedDuration: expect.any(Number),
    estimatedCost: expect.any(Object),
    prerequisites: expect.any(Array),
    rollbackPlan: expect.any(Array)
  }
};

// Test utilities
export const testUtils = {
  /**
   * Wait for a specified amount of time (for async operations)
   */
  wait: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Create a mock response for API calls
   */
  createMockResponse: <T>(data: T, delay: number = 100): Promise<T> => {
    return new Promise(resolve => {
      setTimeout(() => resolve(data), delay);
    });
  },

  /**
   * Validate database configuration structure
   */
  validateConfig: (config: any): boolean => {
    return !!(
      config &&
      config.type &&
      config.connectionPool &&
      config.backupStrategy &&
      config.monitoring &&
      config.security
    );
  },

  /**
   * Validate creation plan structure
   */
  validateCreationPlan: (plan: any): boolean => {
    return !!(
      plan &&
      plan.id &&
      plan.steps &&
      Array.isArray(plan.steps) &&
      plan.prerequisites &&
      Array.isArray(plan.prerequisites) &&
      plan.rollbackPlan &&
      Array.isArray(plan.rollbackPlan)
    );
  },

  /**
   * Mock performance metrics for testing
   */
  generateMockPerformanceMetrics: () => ({
    throughput: {
      readsPerSecond: Math.floor(Math.random() * 50000) + 1000,
      writesPerSecond: Math.floor(Math.random() * 25000) + 500
    },
    latency: {
      readLatency: Math.random() * 50 + 1,
      writeLatency: Math.random() * 100 + 5
    },
    availability: 0.99 + Math.random() * 0.009,
    concurrency: Math.floor(Math.random() * 10000) + 100,
    dataConsistency: ['strong', 'eventual'][Math.floor(Math.random() * 2)]
  }),

  /**
   * Generate mock cost breakdown
   */
  generateMockCostBreakdown: (monthlyTotal: number = 500) => ({
    monthly: monthlyTotal,
    annual: monthlyTotal * 12 * 0.9, // 10% annual discount
    currency: 'USD',
    breakdown: [
      {
        category: 'compute',
        amount: monthlyTotal * 0.5,
        unit: 'monthly' as const,
        description: 'Compute resources'
      },
      {
        category: 'storage',
        amount: monthlyTotal * 0.2,
        unit: 'monthly' as const,
        description: 'Storage costs'
      },
      {
        category: 'network',
        amount: monthlyTotal * 0.15,
        unit: 'monthly' as const,
        description: 'Data transfer'
      },
      {
        category: 'backup',
        amount: monthlyTotal * 0.1,
        unit: 'monthly' as const,
        description: 'Backup and recovery'
      },
      {
        category: 'support',
        amount: monthlyTotal * 0.05,
        unit: 'monthly' as const,
        description: 'Support and monitoring'
      }
    ]
  })
};

// Global test setup
beforeEach(() => {
  // Clear any caches or reset state before each test
  jest.clearAllMocks();
  localStorage.clear();
});

// Export test utilities for use in other test files
export * from './mocks/AIMockResponses';
export * from './mocks/DatabaseMockProfiles';

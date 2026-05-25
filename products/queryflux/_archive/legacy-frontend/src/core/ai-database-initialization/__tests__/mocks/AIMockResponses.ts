/**
 * AI Mock Responses for Testing
 *
 * This file provides mock AI responses for consistent testing
 * without making actual API calls to AI services.
 */

import { NaturalLanguageAnalysis, DatabaseRecommendation } from '../../types';

// Mock Natural Language Analysis responses
export const mockNLAnalysis: Record<string, NaturalLanguageAnalysis> = {
  simple: {
    input: "I need a PostgreSQL database for my blog",
    intent: 'create_database',
    entities: [
      {
        type: 'database_type',
        value: 'postgresql',
        confidence: 0.95,
        startPosition: 11,
        endPosition: 21,
        synonyms: ['postgres', 'postgis']
      }
    ],
    constraints: [],
    requirements: [
      {
        category: 'performance',
        description: 'Database for blog',
        priority: 'medium'
      }
    ],
    context: {
      domain: 'content',
      scale: 'small',
      technicalStack: [],
      teamSize: 'solo',
      budgetLevel: 'bootstrap',
      timeToMarket: 'flexible'
    },
    confidence: 0.85
  },

  complex: {
    input: "I need a PostgreSQL database for an e-commerce platform that can handle 10,000 concurrent users with 99.9% uptime. I expect to store products, orders, and customer data with complex relationships. Budget is around $500/month and I need GDPR compliance.",
    intent: 'create_database',
    entities: [
      {
        type: 'database_type',
        value: 'postgresql',
        confidence: 0.95,
        startPosition: 11,
        endPosition: 21,
        synonyms: ['postgres', 'postgis']
      },
      {
        type: 'performance',
        value: '10,000 concurrent users',
        confidence: 0.9,
        startPosition: 57,
        endPosition: 80,
        synonyms: []
      },
      {
        type: 'performance',
        value: '99.9% uptime',
        confidence: 0.9,
        startPosition: 87,
        endPosition: 99,
        synonyms: []
      },
      {
        type: 'budget',
        value: '$500/month',
        confidence: 0.9,
        startPosition: 194,
        endPosition: 204,
        synonyms: []
      },
      {
        type: 'compliance',
        value: 'GDPR',
        confidence: 0.9,
        startPosition: 219,
        endPosition: 223,
        synonyms: []
      }
    ],
    constraints: [
      {
        type: 'performance',
        description: 'handle 10,000 concurrent users',
        priority: 'critical',
        measurable: true,
        verificationCriteria: ['Load testing required']
      },
      {
        type: 'performance',
        description: '99.9% uptime',
        priority: 'critical',
        measurable: true,
        verificationCriteria: ['Monitoring setup required']
      },
      {
        type: 'compliance',
        description: 'GDPR',
        priority: 'critical',
        measurable: false,
        verificationCriteria: ['Compliance review needed']
      }
    ],
    requirements: [
      {
        category: 'performance',
        description: '10,000 concurrent users',
        metric: 'concurrent_users',
        target: 10000,
        unit: 'users',
        priority: 'critical'
      },
      {
        category: 'availability',
        description: '99.9% uptime',
        metric: 'availability',
        target: 99.9,
        unit: 'percentage',
        priority: 'critical'
      },
      {
        category: 'cost',
        description: 'Budget constraint: $500/month',
        metric: 'monthly_cost',
        target: 500,
        unit: 'USD',
        priority: 'high'
      }
    ],
    context: {
      domain: 'ecommerce',
      scale: 'medium',
      technicalStack: [],
      teamSize: 'small',
      budgetLevel: 'growth',
      timeToMarket: 'soon'
    },
    confidence: 0.92
  },

  iot: {
    input: "I need a time-series database for IoT sensor data that can handle 1 million measurements per hour from 10,000 devices. Data retention should be 30 days and I need real-time analytics.",
    intent: 'create_database',
    entities: [
      {
        type: 'performance',
        value: '1 million measurements per hour',
        confidence: 0.9,
        startPosition: 52,
        endPosition: 85,
        synonyms: []
      },
      {
        type: 'scale',
        value: '10,000 devices',
        confidence: 0.9,
        startPosition: 91,
        endPosition: 104,
        synonyms: []
      }
    ],
    constraints: [
      {
        type: 'performance',
        description: 'handle 1 million measurements per hour',
        priority: 'critical',
        measurable: true,
        verificationCriteria: ['Throughput testing required']
      }
    ],
    requirements: [
      {
        category: 'performance',
        description: '1 million measurements per hour',
        metric: 'throughput',
        target: 1000000,
        unit: 'measurements/hour',
        priority: 'critical'
      }
    ],
    context: {
      domain: 'iot',
      scale: 'large',
      technicalStack: [],
      teamSize: 'medium',
      budgetLevel: 'established',
      timeToMarket: 'urgent'
    },
    confidence: 0.88
  }
};

// Mock Database Recommendations
export const mockRecommendations: Record<string, DatabaseRecommendation[]> = {
  simple: [
    {
      databaseType: 'postgresql',
      confidence: 0.94,
      reasoning: 'Based on your requirements for a blog database, PostgreSQL is an excellent choice with strong consistency, ACID compliance, and robust JSON support for flexible content management.',
      estimatedCost: {
        monthly: 50,
        annual: 540,
        currency: 'USD',
        breakdown: [
          {
            category: 'compute',
            amount: 25,
            unit: 'monthly',
            description: 'Compute resources'
          },
          {
            category: 'storage',
            amount: 10,
            unit: 'monthly',
            description: 'Storage costs'
          },
          {
            category: 'network',
            amount: 7.5,
            unit: 'monthly',
            description: 'Data transfer'
          },
          {
            category: 'backup',
            amount: 5,
            unit: 'monthly',
            description: 'Backup and recovery'
          },
          {
            category: 'support',
            amount: 2.5,
            unit: 'monthly',
            description: 'Support and monitoring'
          }
        ]
      },
      performanceProfile: {
        throughput: {
          readsPerSecond: 5000,
          writesPerSecond: 2500
        },
        latency: {
          readLatency: 5,
          writeLatency: 10
        },
        availability: 0.999,
        concurrency: 500,
        dataConsistency: 'strong'
      },
      configuration: {
        type: 'postgresql',
        name: 'blog_database',
        host: 'localhost',
        port: 5432,
        database: 'blog_db',
        user: 'blog_user',
        ssl: true,
        connectionPool: {
          minConnections: 5,
          maxConnections: 20,
          connectionTimeout: 30000,
          idleTimeout: 300000,
          maxLifetime: 3600000,
          validationQuery: 'SELECT 1'
        },
        backupStrategy: {
          frequency: 'daily',
          retention: 30,
          compression: true,
          encryption: true,
          storageLocation: 'cloud'
        },
        monitoring: {
          enabled: true,
          metrics: ['cpu', 'memory', 'connections', 'queries'],
          alerts: [
            {
              metric: 'cpu_usage',
              threshold: 80,
              operator: '>',
              severity: 'warning',
              channels: ['email']
            }
          ],
          dashboards: [
            {
              name: 'Overview',
              metrics: ['cpu', 'memory', 'connections'],
              refreshInterval: 30,
              visualizations: [
                { type: 'line', metric: 'cpu', title: 'CPU Usage' }
              ]
            }
          ],
          loggingLevel: 'info'
        },
        scaling: {
          autoScaling: false,
          minInstances: 1,
          maxInstances: 1,
          targetCPU: 70,
          targetMemory: 80,
          scalingRules: []
        },
        security: {
          encryptionAtRest: true,
          encryptionInTransit: true,
          authentication: 'password',
          authorization: 'rbac',
          auditLogging: false,
          firewallRules: [
            { action: 'allow', source: '0.0.0.0/0', port: 5432 }
          ],
          vulnerabilityScanning: false
        },
        optimizations: [
          {
            type: 'index',
            description: 'Optimize query performance with strategic indexing',
            parameters: { strategy: 'automatic' },
            estimatedImprovement: 40,
            priority: 1
          }
        ]
      },
      migrationComplexity: 'low',
      pros: [
        'ACID compliance',
        'JSON support',
        'Extensible ecosystem',
        'Strong consistency'
      ],
      cons: [
        'Vertical scaling limitations',
        'Complex replication'
      ]
    }
  ],

  complex: [
    {
      databaseType: 'postgresql',
      confidence: 0.96,
      reasoning: 'Based on your requirements for an e-commerce platform with complex relationships, high concurrency, and GDPR compliance, PostgreSQL is the optimal choice with its strong ACID compliance, advanced security features, and proven scalability.',
      estimatedCost: {
        monthly: 450,
        annual: 4860,
        currency: 'USD',
        breakdown: [
          {
            category: 'compute',
            amount: 225,
            unit: 'monthly',
            description: 'High-performance compute instances'
          },
          {
            category: 'storage',
            amount: 90,
            unit: 'monthly',
            description: 'SSD storage with encryption'
          },
          {
            category: 'network',
            amount: 67.5,
            unit: 'monthly',
            description: 'High-speed data transfer'
          },
          {
            category: 'backup',
            amount: 45,
            unit: 'monthly',
            description: 'Automated backups with point-in-time recovery'
          },
          {
            category: 'support',
            amount: 22.5,
            unit: 'monthly',
            description: '24/7 support and monitoring'
          }
        ]
      },
      performanceProfile: {
        throughput: {
          readsPerSecond: 20000,
          writesPerSecond: 10000
        },
        latency: {
          readLatency: 3,
          writeLatency: 8
        },
        availability: 0.999,
        concurrency: 2000,
        dataConsistency: 'strong'
      },
      configuration: {
        type: 'postgresql',
        name: 'ecommerce_database',
        host: 'ecommerce-db.cluster.us-east-1.rds.amazonaws.com',
        port: 5432,
        database: 'ecommerce_prod',
        user: 'app_user',
        ssl: true,
        connectionPool: {
          minConnections: 10,
          maxConnections: 50,
          connectionTimeout: 30000,
          idleTimeout: 300000,
          maxLifetime: 3600000,
          validationQuery: 'SELECT 1'
        },
        backupStrategy: {
          frequency: 'hourly',
          retention: 90,
          compression: true,
          encryption: true,
          storageLocation: 'cloud'
        },
        monitoring: {
          enabled: true,
          metrics: ['cpu', 'memory', 'connections', 'queries', 'latency', 'throughput', 'errors'],
          alerts: [
            {
              metric: 'cpu_usage',
              threshold: 80,
              operator: '>',
              severity: 'warning',
              channels: ['email', 'sms']
            },
            {
              metric: 'connections',
              threshold: 90,
              operator: '>',
              severity: 'critical',
              channels: ['email', 'sms', 'webhook']
            }
          ],
          dashboards: [
            {
              name: 'Performance Metrics',
              metrics: ['latency', 'throughput', 'errors'],
              refreshInterval: 15,
              visualizations: [
                { type: 'line', metric: 'latency', title: 'Query Latency (ms)' }
              ]
            }
          ],
          loggingLevel: 'info'
        },
        scaling: {
          autoScaling: true,
          minInstances: 2,
          maxInstances: 10,
          targetCPU: 70,
          targetMemory: 80,
          scalingRules: [
            {
              metric: 'cpu_usage',
              threshold: 80,
              action: 'scale_up',
              cooldown: 300
            }
          ]
        },
        security: {
          encryptionAtRest: true,
          encryptionInTransit: true,
          authentication: 'certificate',
          authorization: 'rbac',
          auditLogging: true,
          firewallRules: [
            { action: 'allow', source: '10.0.0.0/8', port: 5432 },
            { action: 'deny', source: '0.0.0.0/0', port: 22 }
          ],
          vulnerabilityScanning: true
        },
        optimizations: [
          {
            type: 'partition',
            description: 'Enable table partitioning for large tables',
            parameters: { strategy: 'range', column: 'created_at' },
            estimatedImprovement: 60,
            priority: 2
          }
        ]
      },
      migrationComplexity: 'medium',
      pros: [
        'ACID compliance for transaction integrity',
        'Advanced security features for GDPR compliance',
        'Excellent support for complex relationships',
        'Proven scalability and reliability'
      ],
      cons: [
        'Requires experienced DBA for optimization',
        'Higher cost for high-availability setup'
      ]
    },
    {
      databaseType: 'cockroachdb',
      confidence: 0.82,
      reasoning: 'CockroachDB offers excellent horizontal scalability and built-in survivability, making it a strong contender for your e-commerce platform, though with a steeper learning curve.',
      estimatedCost: {
        monthly: 650,
        annual: 7020,
        currency: 'USD',
        breakdown: [
          {
            category: 'compute',
            amount: 325,
            unit: 'monthly',
            description: 'Distributed compute nodes'
          },
          {
            category: 'storage',
            amount: 130,
            unit: 'monthly',
            description: 'Replicated storage'
          },
          {
            category: 'network',
            amount: 97.5,
            unit: 'monthly',
            description: 'Inter-node communication'
          },
          {
            category: 'backup',
            amount: 65,
            unit: 'monthly',
            description: 'Automated backups'
          },
          {
            category: 'support',
            amount: 32.5,
            unit: 'monthly',
            description: 'Enterprise support'
          }
        ]
      },
      performanceProfile: {
        throughput: {
          readsPerSecond: 25000,
          writesPerSecond: 15000
        },
        latency: {
          readLatency: 8,
          writeLatency: 15
        },
        availability: 0.9999,
        concurrency: 5000,
        dataConsistency: 'strong'
      },
      configuration: {} as any, // Simplified for testing
      migrationComplexity: 'high',
      pros: [
        'Automatic horizontal scaling',
        'Built-in geo-distribution',
        'Survivability and automatic repairs',
        'PostgreSQL wire protocol compatibility'
      ],
      cons: [
        'Higher resource requirements',
        'More complex deployment',
        'Less mature ecosystem than PostgreSQL'
      ]
    }
  ],

  iot: [
    {
      databaseType: 'influxdb',
      confidence: 0.94,
      reasoning: 'For IoT sensor data with high throughput requirements and time-series analysis needs, InfluxDB is purpose-built for this use case with excellent compression and query performance for time-based data.',
      estimatedCost: {
        monthly: 280,
        annual: 3024,
        currency: 'USD',
        breakdown: [
          {
            category: 'compute',
            amount: 140,
            unit: 'monthly',
            description: 'Time-series optimized compute'
          },
          {
            category: 'storage',
            amount: 56,
            unit: 'monthly',
            description: 'Compressed time-series storage'
          },
          {
            category: 'network',
            amount: 42,
            unit: 'monthly',
            description: 'High-speed data ingestion'
          },
          {
            category: 'backup',
            amount: 28,
            unit: 'monthly',
            description: 'Time-series backup solutions'
          },
          {
            category: 'support',
            amount: 14,
            unit: 'monthly',
            description: 'Monitoring and support'
          }
        ]
      },
      performanceProfile: {
        throughput: {
          readsPerSecond: 50000,
          writesPerSecond: 100000
        },
        latency: {
          readLatency: 2,
          writeLatency: 1
        },
        availability: 0.999,
        concurrency: 10000,
        dataConsistency: 'eventual'
      },
      configuration: {} as any, // Simplified for testing
      migrationComplexity: 'medium',
      pros: [
        'Purpose-built for time-series data',
        'Excellent compression ratios',
        'High write performance',
        'Built-in retention policies'
      ],
      cons: [
        'Limited to time-series data',
        'Less flexible for other data types',
        'Smaller community compared to traditional databases'
      ]
    },
    {
      databaseType: 'timescaledb',
      confidence: 0.87,
      reasoning: 'TimescaleDB extends PostgreSQL with time-series capabilities, giving you the familiarity of PostgreSQL along with excellent time-series performance for your IoT data.',
      estimatedCost: {
        monthly: 350,
        annual: 3780,
        currency: 'USD',
        breakdown: [
          {
            category: 'compute',
            amount: 175,
            unit: 'monthly',
            description: 'PostgreSQL with TimescaleDB extension'
          },
          {
            category: 'storage',
            amount: 70,
            unit: 'monthly',
            description: 'Optimized time-series storage'
          },
          {
            category: 'network',
            amount: 52.5,
            unit: 'monthly',
            description: 'Data transfer'
          },
          {
            category: 'backup',
            amount: 35,
            unit: 'monthly',
            description: 'Automated backups'
          },
          {
            category: 'support',
            amount: 17.5,
            unit: 'monthly',
            description: 'TimescaleDB support'
          }
        ]
      },
      performanceProfile: {
        throughput: {
          readsPerSecond: 30000,
          writesPerSecond: 40000
        },
        latency: {
          readLatency: 4,
          writeLatency: 3
        },
        availability: 0.999,
        concurrency: 3000,
        dataConsistency: 'strong'
      },
      configuration: {} as any, // Simplified for testing
      migrationComplexity: 'low',
      pros: [
        'PostgreSQL compatibility',
        'Strong time-series performance',
        'SQL support with time-series extensions',
        'Mature ecosystem and community'
      ],
      cons: [
        'Higher storage requirements than InfluxDB',
        'Complex optimization for large datasets'
      ]
    }
  ]
};

// Mock error responses
export const mockErrors = {
  invalidInput: new Error('Invalid input: Please provide either natural language description or upload a dump file'),
  fileTooLarge: new Error('File size exceeds 100MB limit'),
  unsupportedFormat: new Error('Unsupported file format: .xyz. Supported formats: .sql, .json, .csv, .bson, .dump'),
  apiError: new Error('AI service temporarily unavailable. Please try again later.'),
  networkError: new Error('Network error: Unable to connect to AI service.')
};

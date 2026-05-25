import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean up existing data (for development)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...');
    await prisma.auditLog.deleteMany();
    await prisma.taskExecution.deleteMany();
    await prisma.taskDependency.deleteMany();
    await prisma.task.deleteMany();
    await prisma.healthCheck.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.ragQuery.deleteMany();
    await prisma.ragContext.deleteMany();
    await prisma.tokenUsage.deleteMany();
    await prisma.tokenBudget.deleteMany();
    await prisma.deployment.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.userSession.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.projectUser.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
    await prisma.systemConfig.deleteMany();
  }

  // System Configuration
  console.log('⚙️ Creating system configuration...');
  await prisma.systemConfig.createMany({
    data: [
      {
        key: 'MAX_CONCURRENT_TASKS',
        value: 100,
        category: 'performance',
      },
      {
        key: 'DEFAULT_TOKEN_BUDGET',
        value: 100.0,
        category: 'billing',
      },
      {
        key: 'RAG_CONTEXT_LIMIT',
        value: 10000,
        category: 'rag',
      },
      {
        key: 'AGENT_TIMEOUT_MINUTES',
        value: 30,
        category: 'agents',
      },
      {
        key: 'TASK_RETRY_ATTEMPTS',
        value: 3,
        category: 'tasks',
      },
      {
        key: 'HEALTH_CHECK_INTERVAL_SECONDS',
        value: 60,
        category: 'monitoring',
      },
      {
        key: 'TOKEN_OPTIMIZATION_ENABLED',
        value: true,
        category: 'optimization',
      },
      {
        key: 'LOG_RETENTION_DAYS',
        value: 30,
        category: 'logging',
      },
    ],
    skipDuplicates: true,
  });

  // Create default admin user
  console.log('👤 Creating default admin user...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@claude-agent.dev',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      profile: {
        timezone: 'UTC',
        theme: 'dark',
        language: 'en',
        notifications: {
          email: true,
          inApp: true,
        },
      },
    },
  });

  // Create demo developer user
  console.log('👤 Creating demo developer user...');
  const devPassword = await bcrypt.hash('dev123', 10);
  const devUser = await prisma.user.create({
    data: {
      email: 'dev@claude-agent.dev',
      username: 'developer',
      firstName: 'Dev',
      lastName: 'User',
      password: devPassword,
      role: 'DEVELOPER',
      status: 'ACTIVE',
      profile: {
        timezone: 'America/New_York',
        theme: 'light',
        language: 'en',
        notifications: {
          email: true,
          inApp: false,
        },
      },
    },
  });

  // Create demo projects
  console.log('📁 Creating demo projects...');
  const demoProject = await prisma.project.create({
    data: {
      name: 'Demo AI Agent Platform',
      description:
        'A comprehensive demonstration of the Claude Agent Platform capabilities',
      slug: 'demo-ai-platform',
      ownerId: adminUser.id,
      status: 'ACTIVE',
      settings: {
        tokenOptimization: true,
        ragEnabled: true,
        monitoringEnabled: true,
        maxAgents: 10,
        maxConcurrentTasks: 50,
      },
      metadata: {
        industry: 'technology',
        teamSize: 5,
        estimatedBudget: 50000,
      },
    },
  });

  const webAppProject = await prisma.project.create({
    data: {
      name: 'E-commerce Web Application',
      description: 'Modern e-commerce platform with AI-powered features',
      slug: 'ecommerce-web-app',
      ownerId: devUser.id,
      status: 'ACTIVE',
      settings: {
        tokenOptimization: true,
        ragEnabled: true,
        monitoringEnabled: true,
        maxAgents: 5,
        maxConcurrentTasks: 25,
      },
      metadata: {
        industry: 'retail',
        teamSize: 3,
        estimatedBudget: 25000,
      },
    },
  });

  // Add project members
  console.log('👥 Adding project members...');
  await prisma.projectUser.createMany({
    data: [
      {
        projectId: demoProject.id,
        userId: adminUser.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
      {
        projectId: demoProject.id,
        userId: devUser.id,
        role: 'DEVELOPER',
        status: 'ACTIVE',
      },
      {
        projectId: webAppProject.id,
        userId: devUser.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    ],
    skipDuplicates: true,
  });

  // Create demo agents
  console.log('🤖 Creating demo agents...');
  const agents = await prisma.agent.createMany({
    data: [
      {
        name: 'Requirements Analyzer',
        type: 'requirements-analyzer',
        version: '1.0.0',
        description:
          'Analyzes codebases and generates comprehensive requirements',
        projectId: demoProject.id,
        config: {
          maxAnalysisTime: 300000, // 5 minutes
          includeSecurity: true,
          includePerformance: true,
          outputFormat: 'markdown',
        },
        resourceQuota: {
          cpuCores: 2,
          memoryMB: 1024,
          maxConcurrentTasks: 3,
          tokenLimit: 10000,
        },
        health: 'HEALTHY',
        status: 'STOPPED',
        capabilities: [
          'code-analysis',
          'requirement-generation',
          'gap-analysis',
          'user-story-creation',
          'acceptance-criteria-definition',
        ],
        dependencies: ['node:18', 'npm:latest', 'git'],
        metadata: {
          category: 'analysis',
          lastUpdated: new Date().toISOString(),
        },
      },
      {
        name: 'Design Architect',
        type: 'design-architect',
        version: '1.0.0',
        description:
          'Creates technical designs and architecture specifications',
        projectId: demoProject.id,
        config: {
          diagramFormat: 'mermaid',
          includePatterns: true,
          outputFormat: 'markdown',
        },
        resourceQuota: {
          cpuCores: 1,
          memoryMB: 512,
          maxConcurrentTasks: 2,
          tokenLimit: 8000,
        },
        health: 'HEALTHY',
        status: 'STOPPED',
        capabilities: [
          'architecture-design',
          'component-mapping',
          'pattern-recommendation',
          'technical-specification',
        ],
        dependencies: ['node:18', 'mermaid-cli'],
        metadata: {
          category: 'architecture',
          lastUpdated: new Date().toISOString(),
        },
      },
      {
        name: 'Task Executor',
        type: 'task-executor',
        version: '1.0.0',
        description: 'Executes development tasks and code generation',
        projectId: demoProject.id,
        config: {
          executionTimeout: 600000, // 10 minutes
          retryAttempts: 3,
          enableCaching: true,
        },
        resourceQuota: {
          cpuCores: 4,
          memoryMB: 2048,
          maxConcurrentTasks: 5,
          tokenLimit: 20000,
        },
        health: 'HEALTHY',
        status: 'STOPPED',
        capabilities: [
          'code-generation',
          'file-creation',
          'dependency-installation',
          'test-generation',
        ],
        dependencies: ['node:18', 'npm:latest', 'git'],
        metadata: {
          category: 'development',
          lastUpdated: new Date().toISOString(),
        },
      },
      {
        name: 'Code Reviewer',
        type: 'code-review',
        version: '1.0.0',
        description: 'Performs automated code reviews and quality checks',
        projectId: webAppProject.id,
        config: {
          reviewRules: ['security', 'performance', 'style'],
          outputFormat: 'sarif',
          enableSuggestions: true,
        },
        resourceQuota: {
          cpuCores: 2,
          memoryMB: 1024,
          maxConcurrentTasks: 3,
          tokenLimit: 15000,
        },
        health: 'HEALTHY',
        status: 'STOPPED',
        capabilities: [
          'static-analysis',
          'security-scanning',
          'performance-analysis',
          'style-checking',
          'test-coverage-analysis',
        ],
        dependencies: ['eslint', 'sonar-scanner'],
        metadata: {
          category: 'quality',
          lastUpdated: new Date().toISOString(),
        },
      },
    ],
  });

  // Create API keys for users
  console.log('🔑 Creating API keys...');
  const adminApiKey = `sk-${uuidv4().replace(/-/g, '')}`;
  const devApiKey = `sk-${uuidv4().replace(/-/g, '')}`;

  await prisma.apiKey.createMany({
    data: [
      {
        name: 'Admin Default Key',
        key: adminApiKey,
        hashedKey: await bcrypt.hash(adminApiKey, 10),
        permissions: {
          scopes: ['*'],
          resources: ['*'],
          actions: ['*'],
        },
        rateLimit: {
          windowMs: 900000, // 15 minutes
          maxRequests: 1000,
          strategy: 'sliding-window',
        },
        userId: adminUser.id,
        projectId: demoProject.id,
        isActive: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
      {
        name: 'Developer Default Key',
        key: devApiKey,
        hashedKey: await bcrypt.hash(devApiKey, 10),
        permissions: {
          scopes: [
            'agents:read',
            'agents:write',
            'tasks:read',
            'tasks:write',
            'projects:read',
          ],
          resources: ['agents', 'tasks', 'projects'],
          actions: ['read', 'write'],
        },
        rateLimit: {
          windowMs: 900000, // 15 minutes
          maxRequests: 100,
          strategy: 'sliding-window',
        },
        userId: devUser.id,
        projectId: webAppProject.id,
        isActive: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    ],
  });

  // Create token budgets
  console.log('💰 Creating token budgets...');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  await prisma.tokenBudget.createMany({
    data: [
      {
        projectId: demoProject.id,
        monthlyLimit: 500.0,
        currentUsage: 0.0,
        periodStart: monthStart,
        periodEnd: monthEnd,
        alertThreshold: 0.8,
        alertEnabled: true,
        optimizationEnabled: true,
      },
      {
        projectId: webAppProject.id,
        monthlyLimit: 200.0,
        currentUsage: 0.0,
        periodStart: monthStart,
        periodEnd: monthEnd,
        alertThreshold: 0.75,
        alertEnabled: true,
        optimizationEnabled: true,
      },
    ],
  });

  // Create sample RAG contexts
  console.log('📚 Creating sample RAG contexts...');
  const ragContexts = [
    {
      projectId: demoProject.id,
      content: `# Claude Agent Platform Architecture

## Overview
The Claude Agent Platform is a comprehensive AI-powered development lifecycle management system that integrates with Claude Code to provide automated assistance throughout the entire software development process.

## Core Components

### 1. Agent Management System
- Agent lifecycle management (register, deploy, update, delete)
- Health monitoring and auto-scaling
- Resource allocation and quota management
- Multi-agent coordination

### 2. Task Execution Framework
- Task queuing and prioritization
- Agent routing and load balancing
- Progress tracking and notifications
- Result caching and optimization

### 3. RAG Integration
- Context extraction from codebases
- Intelligent context relevance scoring
- Token optimization and budget management
- Real-time context updates

### 4. Multi-Platform Generation
- OpenAI application generation
- Google Agent creation
- Mobile app generation (React Native, Swift)
- Cloudflare deployment automation

## Technology Stack
- **Backend**: Node.js, TypeScript, PostgreSQL, Redis
- **AI Integration**: OpenAI, Anthropic, DeepSeek, Gemini
- **Deployment**: Cloudflare Workers, Docker
- **Monitoring**: Grafana, Prometheus, Jaeger`,
      contentType: 'text',
      metadata: {
        source: 'architecture.md',
        author: 'System',
        type: 'documentation',
        importance: 'high',
      },
      relevanceScore: 0.95,
      tokenCount: 250,
      hash: await generateContentHash('architecture-documentation'),
      isActive: true,
    },
    {
      projectId: demoProject.id,
      content: `// Agent Configuration Example
{
  "name": "Requirements Analyzer",
  "type": "requirements-analyzer",
  "version": "1.0.0",
  "config": {
    "maxAnalysisTime": 300000,
    "includeSecurity": true,
    "includePerformance": true,
    "outputFormat": "markdown",
    "enableCache": true
  },
  "capabilities": [
    "code-analysis",
    "requirement-generation",
    "gap-analysis",
    "user-story-creation"
  ],
  "dependencies": ["node:18", "npm:latest", "git"],
  "resourceQuota": {
    "cpuCores": 2,
    "memoryMB": 1024,
    "maxConcurrentTasks": 3,
    "tokenLimit": 10000
  }
}`,
      contentType: 'code',
      metadata: {
        source: 'agent-config.json',
        author: 'System',
        type: 'configuration',
        language: 'json',
        importance: 'medium',
      },
      relevanceScore: 0.85,
      tokenCount: 180,
      hash: await generateContentHash('agent-config-json'),
      isActive: true,
    },
  ];

  await prisma.rAGContext.createMany({
    data: ragContexts,
  });

  // Create sample token usage records
  console.log('📊 Creating sample token usage records...');
  const tokenUsageData = [
    {
      projectId: demoProject.id,
      provider: 'openai',
      model: 'gpt-4-turbo',
      tokens: 1250,
      cost: 0.0375,
      taskType: 'CODE_ANALYSIS',
      optimized: true,
      savings: 0.0125,
      metadata: {
        agent: 'Requirements Analyzer',
        executionTime: 12000,
        success: true,
      },
    },
    {
      projectId: demoProject.id,
      provider: 'anthropic',
      model: 'claude-3-sonnet',
      tokens: 890,
      cost: 0.0267,
      taskType: 'DESIGN_ARCHITECTURE',
      optimized: true,
      savings: 0.0089,
      metadata: {
        agent: 'Design Architect',
        executionTime: 8500,
        success: true,
      },
    },
    {
      projectId: webAppProject.id,
      provider: 'openai',
      model: 'gpt-4-turbo',
      tokens: 650,
      cost: 0.0195,
      taskType: 'CODE_REVIEW',
      optimized: false,
      metadata: {
        agent: 'Code Reviewer',
        executionTime: 5000,
        success: true,
      },
    },
  ];

  await prisma.tokenUsage.createMany({
    data: tokenUsageData,
  });

  console.log('✅ Database seeding completed successfully!');
  console.log('');
  console.log('👤 Admin User:');
  console.log('   Email: admin@claude-agent.dev');
  console.log('   Password: admin123');
  console.log('');
  console.log('👤 Developer User:');
  console.log('   Email: dev@claude-agent.dev');
  console.log('   Password: dev123');
  console.log('');
  console.log('🔑 Admin API Key:', adminApiKey);
  console.log('🔑 Developer API Key:', devApiKey);
  console.log('');
  console.log('📊 Created:', {
    users: 2,
    projects: 2,
    agents: 4,
    apiKeys: 2,
    ragContexts: ragContexts.length,
    tokenUsageRecords: tokenUsageData.length,
  });
}

// Helper function to generate content hash
async function generateContentHash(content: string): Promise<string> {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 32);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error('❌ Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

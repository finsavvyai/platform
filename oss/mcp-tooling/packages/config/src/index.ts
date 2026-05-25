export const domains = {
  main: 'https://mcpoverflow.com',
  app: 'https://app.mcpoverflow.io',
  ai: 'https://mcpoverflow.ai',
  dev: 'https://mcpoverflow.dev'
} as const;

export const apiConfig = {
  version: 'v1',
  baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  timeout: 30000
} as const;

export const databaseConfig = {
  supabase: {
    url: process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || ''
  },
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || ''
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  }
} as const;

export const agentKitConfig = {
  apiUrl: process.env.AGENTKIT_API_URL || 'https://api.openai.com/v1/agentkit',
  maxRetries: 3,
  timeout: 10000
} as const;

export const monitoringConfig = {
  prometheus: {
    enabled: true,
    port: 9090
  },
  grafana: {
    enabled: true,
    port: 3000
  }
} as const;
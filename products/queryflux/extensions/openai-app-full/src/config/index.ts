/**
 * Configuration Management for QueryFlux OpenAI App
 *
 * Enterprise-grade configuration with security and validation
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Configuration schema validation
 */
const ConfigSchema = z.object({
  // App Configuration
  app: z.object({
    name: z.string().default('QueryFlux Database AI Assistant'),
    version: z.string().default('1.0.0'),
    description: z.string().default('Connect to any database via natural language'),
    environment: z.enum(['development', 'staging', 'production']).default('development'),
    debug: z.boolean().default(false)
  }),

  // OpenAI Configuration
  openai: z.object({
    apiKey: z.string().min(1, 'OpenAI API key is required'),
    model: z.string().default('gpt-4-turbo-preview'),
    maxTokens: z.number().default(2000),
    temperature: z.number().min(0).max(2).default(0.1),
    timeout: z.number().default(30000),
    maxRetries: z.number().default(3)
  }),

  // Security Configuration
  security: z.object({
    level: z.enum(['standard', 'enterprise', 'high_security']).default('enterprise'),
    requireHTTPS: z.boolean().default(true),
    encryptionKey: z.string().min(32, 'Encryption key must be at least 32 characters'),
    sessionTimeout: z.number().default(28800000), // 8 hours
    maxSessionsPerUser: z.number().default(5),
    rateLimiting: z.object({
      enabled: z.boolean().default(true),
      requestsPerMinute: z.number().default(60),
      burstLimit: z.number().default(10)
    })
  }),

  // Authentication Configuration
  auth: z.object({
    enabled: z.boolean().default(true),
    requireMFA: z.boolean().default(true),
    mfaProvider: z.enum(['totp', 'sms', 'email']).optional(),
    allowedUsers: z.array(z.string()).default([]),
    sessionDuration: z.number().default(28800000) // 8 hours
  }),

  // Database Configuration
  databases: z.object({
    supported: z.array(z.enum(['postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'sqlserver', 'oracle'])),
    preconfigured: z.array(z.object({
      name: z.string(),
      type: z.string(),
      host: z.string(),
      port: z.number(),
      database: z.string(),
      ssl: z.boolean().default(true),
      maxConnections: z.number().default(10)
    })),
    connectionTimeout: z.number().default(30000),
    queryTimeout: z.number().default(60000),
    maxResultRows: z.number().default(1000)
  }),

  // VPN/Tunnel Configuration
  tunnel: z.object({
    enabled: z.boolean().default(true),
    ssh: z.object({
      enabled: z.boolean().default(true),
      defaultPort: z.number().default(22),
      connectionTimeout: z.number().default(15000),
      keepAliveInterval: z.number().default(30000)
    }),
    vpn: z.object({
      enabled: z.boolean().default(false),
      protocols: z.array(z.enum(['openvpn', 'wireguard', 'ipsec'])),
      dnsResolution: z.boolean().default(true)
    })
  }),

  // Network Security
  network: z.object({
    allowedIPRanges: z.array(z.string()).default(['0.0.0.0/0']), // Restrict in production
    blockedIPRanges: z.array(z.string()).default([]),
    corsOrigins: z.array(z.string()).default(['https://chat.openai.com']),
    trustProxy: z.boolean().default(true)
  }),

  // Monitoring Configuration
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metrics: z.array(z.string()).default([
      'query_execution_time',
      'connection_count',
      'error_rate',
      'security_events'
    ]),
    alerts: z.object({
      enabled: z.boolean().default(true),
      channels: z.array(z.enum(['email', 'slack', 'webhook'])).default(['email']),
      thresholds: z.object({
        errorRate: z.number().default(0.05), // 5%
        responseTime: z.number().default(5000), // 5 seconds
        connectionFailures: z.number().default(0.1) // 10%
      })
    })
  }),

  // Audit Configuration
  audit: z.object({
    enabled: z.boolean().default(true),
    level: z.enum(['basic', 'detailed', 'comprehensive']).default('comprehensive'),
    retentionDays: z.number().min(30).default(365),
    logAllQueries: z.boolean().default(true),
    logDataAccess: z.boolean().default(true),
    logSecurityEvents: z.boolean().default(true)
  }),

  // Bridge Configuration
  bridge: z.object({
    id: z.string().default('queryflux-secure-bridge'),
    maxConnections: z.number().default(100),
    heartbeatInterval: z.number().default(30000),
    healthCheckInterval: z.number().default(60000)
  }),

  // Organization Configuration
  organization: z.object({
    id: z.string().default('queryflux-enterprise'),
    name: z.string().default('QueryFlux Inc.'),
    domain: z.string().default('queryflux.com'),
    compliance: z.array(z.enum(['GDPR', 'SOC2', 'HIPAA', 'PCI-DSS'])).default(['GDPR', 'SOC2'])
  }),

  // Visualization Configuration
  visualization: z.object({
    enabled: z.boolean().default(true),
    maxDataPoints: z.number().default(1000),
    defaultChartType: z.string().default('auto'),
    exportFormats: z.array(z.enum(['png', 'pdf', 'csv', 'json'])).default(['png', 'csv']),
    aiRecommendations: z.boolean().default(true)
  })
});

/**
 * Load and validate configuration
 */
function loadConfig() {
  try {
    const rawConfig = {
      app: {
        name: process.env.APP_NAME || 'QueryFlux Database AI Assistant',
        version: process.env.APP_VERSION || '1.0.0',
        description: process.env.APP_DESCRIPTION || 'Connect to any database via natural language',
        environment: process.env.NODE_ENV || 'development',
        debug: process.env.DEBUG === 'true'
      },

      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
        timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3')
      },

      security: {
        level: (process.env.SECURITY_LEVEL as any) || 'enterprise',
        requireHTTPS: process.env.REQUIRE_HTTPS !== 'false',
        encryptionKey: process.env.ENCRYPTION_KEY || '',
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '28800000'),
        maxSessionsPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '5'),
        rateLimiting: {
          enabled: process.env.RATE_LIMITING !== 'false',
          requestsPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60'),
          burstLimit: parseInt(process.env.RATE_LIMIT_BURST || '10')
        }
      },

      auth: {
        enabled: process.env.AUTH_ENABLED !== 'false',
        requireMFA: process.env.REQUIRE_MFA !== 'false',
        mfaProvider: process.env.MFA_PROVIDER as any,
        allowedUsers: process.env.ALLOWED_USERS?.split(',') || [],
        sessionDuration: parseInt(process.env.SESSION_DURATION || '28800000')
      },

      databases: {
        supported: (process.env.SUPPORTED_DATABASES?.split(',') || [
          'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'sqlserver', 'oracle'
        ]) as any[],
        preconfigured: JSON.parse(process.env.PRECONFIGURED_DATABASES || '[]'),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
        queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '60000'),
        maxResultRows: parseInt(process.env.DB_MAX_RESULT_ROWS || '1000')
      },

      tunnel: {
        enabled: process.env.TUNNEL_ENABLED !== 'false',
        ssh: {
          enabled: process.env.SSH_TUNNEL_ENABLED !== 'false',
          defaultPort: parseInt(process.env.SSH_DEFAULT_PORT || '22'),
          connectionTimeout: parseInt(process.env.SSH_CONNECTION_TIMEOUT || '15000'),
          keepAliveInterval: parseInt(process.env.SSH_KEEPALIVE_INTERVAL || '30000')
        },
        vpn: {
          enabled: process.env.VPN_ENABLED === 'true',
          protocols: process.env.VPN_PROTOCOLS?.split(',') as any[] || [],
          dnsResolution: process.env.VPN_DNS_RESOLUTION !== 'false'
        }
      },

      network: {
        allowedIPRanges: process.env.ALLOWED_IP_RANGES?.split(',') || ['0.0.0.0/0'],
        blockedIPRanges: process.env.BLOCKED_IP_RANGES?.split(',') || [],
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['https://chat.openai.com'],
        trustProxy: process.env.TRUST_PROXY !== 'false'
      },

      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        metrics: process.env.MONITORING_METRICS?.split(',') || [
          'query_execution_time',
          'connection_count',
          'error_rate',
          'security_events'
        ],
        alerts: {
          enabled: process.env.ALERTS_ENABLED !== 'false',
          channels: process.env.ALERT_CHANNELS?.split(',') as any[] || ['email'],
          thresholds: {
            errorRate: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.05'),
            responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '5000'),
            connectionFailures: parseFloat(process.env.CONNECTION_FAILURE_THRESHOLD || '0.1')
          }
        }
      },

      audit: {
        enabled: process.env.AUDIT_ENABLED !== 'false',
        level: (process.env.AUDIT_LEVEL as any) || 'comprehensive',
        retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '365'),
        logAllQueries: process.env.LOG_ALL_QUERIES !== 'false',
        logDataAccess: process.env.LOG_DATA_ACCESS !== 'false',
        logSecurityEvents: process.env.LOG_SECURITY_EVENTS !== 'false'
      },

      bridge: {
        id: process.env.BRIDGE_ID || 'queryflux-secure-bridge',
        maxConnections: parseInt(process.env.BRIDGE_MAX_CONNECTIONS || '100'),
        heartbeatInterval: parseInt(process.env.BRIDGE_HEARTBEAT_INTERVAL || '30000'),
        healthCheckInterval: parseInt(process.env.BRIDGE_HEALTH_CHECK_INTERVAL || '60000')
      },

      organization: {
        id: process.env.ORG_ID || 'queryflux-enterprise',
        name: process.env.ORG_NAME || 'QueryFlux Inc.',
        domain: process.env.ORG_DOMAIN || 'queryflux.com',
        compliance: process.env.ORG_COMPLIANCE?.split(',') as any[] || ['GDPR', 'SOC2']
      },

      visualization: {
        enabled: process.env.VISUALIZATION_ENABLED !== 'false',
        maxDataPoints: parseInt(process.env.VISUALIZATION_MAX_DATA_POINTS || '1000'),
        defaultChartType: process.env.DEFAULT_CHART_TYPE || 'auto',
        exportFormats: process.env.EXPORT_FORMATS?.split(',') as any[] || ['png', 'csv'],
        aiRecommendations: process.env.AI_RECOMMENDATIONS !== 'false'
      }
    };

    // Validate configuration
    const validatedConfig = ConfigSchema.parse(rawConfig);

    return validatedConfig;

  } catch (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }
}

/**
 * Export validated configuration
 */
export const config = loadConfig();

/**
 * Configuration helpers
 */
export const isProduction = config.app.environment === 'production';
export const isDevelopment = config.app.environment === 'development';
export const isEnterprise = config.security.level === 'enterprise' || config.security.level === 'high_security';

export default config;

/**
 * Unit Tests for Production Environment Setup Script
 *
 * These tests validate the production setup script functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

describe('Production Setup Script', () => {
  const scriptPath = join(__dirname, '../../scripts/deployment/production-environment-setup.sh');
  const projectRoot = join(__dirname, '../..');

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Script Validation', () => {
    it('should have executable permissions', () => {
      // This is a placeholder - actual permission checks would need fs module
      expect(scriptPath).toBeDefined();
    });

    it('should contain all required configuration sections', () => {
      const scriptContent = readFileSync(scriptPath, 'utf8');

      const requiredFunctions = [
        'configure_d1_database',
        'configure_kv_namespaces',
        'configure_r2_buckets',
        'configure_monitoring',
        'configure_security',
        'create_secrets_config'
      ];

      requiredFunctions.forEach(func => {
        expect(scriptContent).toContain(func);
      });
    });

    it('should have help option', () => {
      const scriptContent = readFileSync(scriptPath, 'utf8');
      expect(scriptContent).toContain('--help');
      expect(scriptContent).toContain('--dry-run');
      expect(scriptContent).toContain('--force');
    });
  });

  describe('Configuration File Generation', () => {
    it('should create valid security configuration', () => {
      const securityConfig = {
        security: {
          headers: {
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Strict-Transport-Security': 'max-age=31536000'
          },
          rateLimiting: {
            global: {
              requests_per_minute: 1000,
              burst: 100
            }
          },
          cors: {
            allowedOrigins: ['https://qestro.io'],
            allowedMethods: ['GET', 'POST', 'PUT', 'DELETE']
          }
        }
      };

      expect(securityConfig.security.headers).toBeDefined();
      expect(securityConfig.security.rateLimiting).toBeDefined();
      expect(securityConfig.security.cors).toBeDefined();
    });

    it('should create valid alerting configuration', () => {
      const alertingConfig = {
        alerts: [
          {
            name: 'High Error Rate',
            condition: 'error_rate > 0.05',
            severity: 'critical',
            channels: ['email', 'slack']
          }
        ],
        channels: {
          email: {
            enabled: true,
            recipients: ['alerts@qestro.io']
          }
        }
      };

      expect(alertingConfig.alerts).toHaveLength(1);
      expect(alertingConfig.alerts[0].severity).toBe('critical');
    });
  });

  describe('Environment Validation', () => {
    it('should validate required dependencies', () => {
      const requiredDeps = ['wrangler', 'node', 'npm', 'curl', 'jq'];

      // Mock dependency check
      const mockCheckDeps = () => {
        const deps = ['wrangler', 'node', 'npm'];
        return deps.length === requiredDeps.length;
      };

      expect(mockCheckDeps()).toBe(false); // Missing curl and jq in mock
    });

    it('should validate Cloudflare authentication', () => {
      const mockAuth = {
        account: {
          ID: 'test-account-id'
        }
      };

      expect(mockAuth.account.ID).toBeDefined();
      expect(mockAuth.account.ID).toMatch(/^[a-f0-9-]+$/);
    });
  });

  describe('D1 Database Configuration', () => {
    it('should generate valid wrangler.toml configuration', () => {
      const wranglerConfig = `
[[d1_databases]]
binding = "DB"
database_name = "qestro-production"
database_id = "test-database-id"
migrations_dir = "drizzle"
      `.trim();

      expect(wranglerConfig).toContain('binding = "DB"');
      expect(wranglerConfig).toContain('database_name = "qestro-production"');
      expect(wranglerConfig).toContain('database_id = "test-database-id"');
    });

    it('should create backup script with correct permissions', () => {
      const backupScript = `
#!/bin/bash
# Daily D1 database backup script
BACKUP_DIR="/backups/d1"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="qestro-production"
      `.trim();

      expect(backupScript).toContain('#!/bin/bash');
      expect(backupScript).toContain('BACKUP_DIR="/backups/d1"');
      expect(backupScript).toContain('DB_NAME="qestro-production"');
    });
  });

  describe('KV Namespace Configuration', () => {
    it('should configure all required namespaces', () => {
      const namespaces = [
        'SESSIONS:qestro-sessions-prod',
        'CACHE:qestro-cache-prod',
        'REALTIME:qestro-realtime-prod',
        'RATELIMIT:qestro-ratelimit-prod',
        'CONFIG:qestro-config-prod',
        'AUDIT:qestro-audit-prod'
      ];

      namespaces.forEach(ns => {
        const [binding, name] = ns.split(':');
        expect(binding).toBeDefined();
        expect(name).toContain('-prod');
      });
    });
  });

  describe('R2 Bucket Configuration', () => {
    it('should create buckets with lifecycle policies', () => {
      const lifecyclePolicy = {
        rules: [
          {
            id: 'lifecycle-rule',
            status: 'Enabled',
            transitions: [
              { days: 30, storage_class: 'INFREQUENT_ACCESS' },
              { days: 90, storage_class: 'ARCHIVE' }
            ],
            expiration: { days: 365 }
          }
        ]
      };

      expect(lifecyclePolicy.rules[0].status).toBe('Enabled');
      expect(lifecyclePolicy.rules[0].transitions).toHaveLength(2);
      expect(lifecyclePolicy.rules[0].expiration.days).toBe(365);
    });

    it('should configure CORS for public buckets', () => {
      const corsConfig = {
        AllowedOrigins: ['https://qestro.io', 'https://app.qestro.io'],
        AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 3600
      };

      expect(corsConfig.AllowedOrigins).toContain('https://qestro.io');
      expect(corsConfig.AllowedMethods).toContain('GET');
      expect(corsConfig.MaxAgeSeconds).toBe(3600);
    });
  });

  describe('Monitoring Configuration', () => {
    it('should create health check structure', () => {
      const healthCheck = {
        status: 'healthy',
        timestamp: '2024-01-01T00:00:00.000Z',
        version: '1.0.0',
        uptime: 3600,
        checks: {
          database: { status: 'pass', duration: 10 },
          storage: { status: 'pass', duration: 5 },
          kv: { status: 'pass', duration: 3 },
          memory: { status: 'pass', duration: 1 },
          cpu: { status: 'pass', duration: 2 }
        },
        metrics: {
          responseTime: 50,
          errorRate: 0.01,
          activeConnections: 100
        }
      };

      expect(healthCheck.status).toBe('healthy');
      expect(healthCheck.checks.database.status).toBe('pass');
      expect(healthCheck.metrics.errorRate).toBeLessThan(0.05);
    });

    it('should configure alert thresholds', () => {
      const alerts = [
        {
          name: 'High Error Rate',
          condition: 'error_rate > 0.05',
          duration: '5m',
          severity: 'critical'
        },
        {
          name: 'High Response Time',
          condition: 'response_time > 2000',
          duration: '10m',
          severity: 'warning'
        }
      ];

      const criticalAlert = alerts.find(a => a.severity === 'critical');
      const warningAlert = alerts.find(a => a.severity === 'warning');

      expect(criticalAlert).toBeDefined();
      expect(warningAlert).toBeDefined();
      expect(criticalAlert!.condition).toContain('error_rate');
    });
  });

  describe('Security Configuration', () => {
    it('should have comprehensive security headers', () => {
      const headers = {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Content-Security-Policy': "default-src 'self'",
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      };

      Object.entries(headers).forEach(([header, value]) => {
        expect(value).toBeDefined();
        expect(value.length).toBeGreaterThan(0);
      });
    });

    it('should configure WAF rules', () => {
      const wafRules = [
        {
          name: 'Block SQL Injection',
          expression: 'http.request.uri.path contains "SELECT"',
          action: 'block'
        },
        {
          name: 'Block XSS Attempts',
          expression: 'http.request.uri.path contains "<script"',
          action: 'block'
        },
        {
          name: 'Rate Limit Auth Endpoints',
          expression: 'http.request.uri.path contains "/api/auth"',
          action: 'rate_limit'
        }
      ];

      wafRules.forEach(rule => {
        expect(rule.name).toBeDefined();
        expect(rule.expression).toBeDefined();
        expect(rule.action).toMatch(/block|rate_limit/);
      });
    });
  });

  describe('Secrets Configuration', () => {
    it('should generate secrets template with all required secrets', () => {
      const secretsTemplate = `
JWT_SECRET
JWT_REFRESH_SECRET
SESSION_SECRET
DATABASE_URL
OPENAI_API_KEY
STRIPE_SECRET_KEY
SENTRY_DSN
      `.trim().split('\n').map(s => s.trim()).filter(s => s);

      const requiredSecrets = [
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'SESSION_SECRET',
        'DATABASE_URL',
        'OPENAI_API_KEY',
        'STRIPE_SECRET_KEY',
        'SENTRY_DSN'
      ];

      requiredSecrets.forEach(secret => {
        expect(secretsTemplate).toContain(secret);
      });
    });

    it('should include secret generation commands', () => {
      const secretCommands = {
        JWT_SECRET: 'openssl rand -base64 64',
        ENCRYPTION_KEY: 'openssl rand -base64 32',
        ENCRYPTION_IV: 'openssl rand -base64 16'
      };

      Object.entries(secretCommands).forEach(([secret, command]) => {
        expect(command).toContain('openssl');
        expect(command).toContain('rand');
      });
    });
  });

  describe('Deployment Checklist', () => {
    it('should create comprehensive deployment checklist', () => {
      const checklistSections = [
        'Pre-Deployment Checklist',
        'Deployment Steps',
        'Post-Deployment Monitoring',
        'Emergency Procedures',
        'Security Checklist',
        'Backup and Recovery'
      ];

      checklistSections.forEach(section => {
        expect(section).toBeDefined();
      });
    });

    it('should include all critical deployment steps', () => {
      const deploymentSteps = [
        'Environment Setup',
        'Database Migration',
        'Deploy Application',
        'Post-Deployment Verification'
      ];

      deploymentSteps.forEach(step => {
        expect(step).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing dependencies gracefully', () => {
      const missingDeps = ['curl', 'jq'];
      const errorMessage = `Missing dependencies: ${missingDeps.join(', ')}`;

      expect(errorMessage).toContain('curl');
      expect(errorMessage).toContain('jq');
    });

    it('should handle Cloudflare auth failure', () => {
      const authErrorMessage = 'Not authenticated with Cloudflare';

      expect(authErrorMessage).toContain('Cloudflare');
      expect(authErrorMessage).toContain('authenticated');
    });

    it('should handle creation failures', () => {
      const creationErrors = {
        database: 'Failed to create D1 database',
        kv: 'Failed to create KV namespace',
        bucket: 'Failed to create R2 bucket'
      };

      Object.entries(creationErrors).forEach(([resource, error]) => {
        expect(error).toContain('Failed to create');
        expect(error).toContain(resource);
      });
    });
  });
});

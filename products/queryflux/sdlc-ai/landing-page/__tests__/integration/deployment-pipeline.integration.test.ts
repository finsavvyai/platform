import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

describe('Deployment Pipeline Integration Tests', () => {
  const projectRoot = path.join(__dirname, '../../../..');
  const scriptsDir = path.join(projectRoot, 'scripts');
  const workflowsDir = path.join(projectRoot, '.github/workflows');

  describe('GitHub Actions Workflow', () => {
    const workflowFile = path.join(workflowsDir, 'sdlc-deploy.yml');

    it('should have GitHub Actions workflow file', () => {
      expect(existsSync(workflowFile)).toBe(true);
    });

    it('should have valid workflow YAML', () => {
      const workflowContent = readFileSync(workflowFile, 'utf8');

      // Check for required workflow sections
      expect(workflowContent).toContain('name: SDLC Platform CI/CD Pipeline');
      expect(workflowContent).toContain('on:');
      expect(workflowContent).toContain('jobs:');

      // Check for required jobs
      expect(workflowContent).toContain('quality:');
      expect(workflowContent).toContain('build:');
      expect(workflowContent).toContain('deploy-staging:');
      expect(workflowContent).toContain('deploy-production:');
      expect(workflowContent).toContain('rollback:');
      expect(workflowContent).toContain('validate:');
    });

    it('should have proper environment configurations', () => {
      const workflowContent = readFileSync(workflowFile, 'utf8');

      // Check staging environment
      expect(workflowContent).toContain('environment: staging');
      expect(workflowContent).toContain('refs/heads/develop');

      // Check production environment
      expect(workflowContent).toContain('environment: production');
      expect(workflowContent).toContain('refs/heads/main');
      expect(workflowContent).toContain('Manual approval');
    });

    it('should include security scanning', () => {
      const workflowContent = readFileSync(workflowFile, 'utf8');

      expect(workflowContent).toContain('security-scan:');
      expect(workflowContent).toContain('Trivy');
      expect(workflowContent).toContain('OWASP ZAP');
      expect(workflowContent).toContain('npm audit');
    });

    it('should have proper rollback mechanisms', () => {
      const workflowContent = readFileSync(workflowFile, 'utf8');

      expect(workflowContent).toContain('rollback:');
      expect(workflowContent).toContain('failure()');
      expect(workflowContent).toContain('previous task definition');
    });
  });

  describe('ECS Task Definitions', () => {
    const stagingTaskDef = path.join(workflowsDir, 'ecs-staging-task-definition.json');
    const productionTaskDef = path.join(workflowsDir, 'ecs-production-task-definition.json');
    const backupTaskDef = path.join(workflowsDir, 'ecs-backup-task-definition.json');

    it('should have all required task definition files', () => {
      expect(existsSync(stagingTaskDef)).toBe(true);
      expect(existsSync(productionTaskDef)).toBe(true);
      expect(existsSync(backupTaskDef)).toBe(true);
    });

    it('should have valid staging task definition', () => {
      const taskDef = JSON.parse(readFileSync(stagingTaskDef, 'utf8'));

      expect(taskDef.family).toBe('sdlc-landing-page-staging');
      expect(taskDef.requiresCompatibilities).toContain('FARGATE');
      expect(taskDef.networkMode).toBe('awsvpc');
      expect(taskDef.containerDefinitions).toHaveLength(1);

      const container = taskDef.containerDefinitions[0];
      expect(container.name).toBe('sdlc-landing-page');
      expect(container.portMappings).toHaveLength(1);
      expect(container.portMappings[0].containerPort).toBe(3000);
      expect(container.healthCheck).toBeDefined();
    });

    it('should have valid production task definition', () => {
      const taskDef = JSON.parse(readFileSync(productionTaskDef, 'utf8'));

      expect(taskDef.family).toBe('sdlc-landing-page-production');
      expect(taskDef.cpu).toBe('512');
      expect(taskDef.memory).toBe('1024');

      const container = taskDef.containerDefinitions[0];
      expect(container.environment).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'NODE_ENV', value: 'production' }),
          expect.objectContaining({ name: 'NEXT_PUBLIC_SITE_URL', value: 'https://sdlc.ai' })
        ])
      );

      expect(container.secrets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'LEMONSQUEEZY_API_KEY' }),
          expect.objectContaining({ name: 'NEXTAUTH_SECRET' }),
          expect.objectContaining({ name: 'DATABASE_URL' }),
          expect.objectContaining({ name: 'REDIS_URL' })
        ])
      );
    });

    it('should have valid backup task definition', () => {
      const taskDef = JSON.parse(readFileSync(backupTaskDef, 'utf8');

      expect(taskDef.family).toBe('sdlc-landing-page-backup');
      expect(taskDef.containerDefinitions[0].name).toBe('sdlc-landing-page-backup');
    });

    it('should have proper resource allocation differences', () => {
      const stagingDef = JSON.parse(readFileSync(stagingTaskDef, 'utf8'));
      const productionDef = JSON.parse(readFileSync(productionTaskDef, 'utf8'));

      // Production should have more resources
      expect(productionDef.cpu).toBeGreaterThan(stagingDef.cpu);
      expect(productionDef.memory).toBeGreaterThan(stagingDef.memory);

      // Production should have longer health check start period
      expect(productionDef.containerDefinitions[0].healthCheck.startPeriod)
        .toBeGreaterThan(stagingDef.containerDefinitions[0].healthCheck.startPeriod);
    });
  });

  describe('Deployment Scripts', () => {
    const stagingScript = path.join(scriptsDir, 'deploy-staging.sh');
    const productionScript = path.join(scriptsDir, 'deploy-production.sh');

    it('should have deployment scripts', () => {
      expect(existsSync(stagingScript)).toBe(true);
      expect(existsSync(productionScript)).toBe(true);
    });

    it('should have executable permissions', () => {
      const fs = require('fs');
      expect(fs.statSync(stagingScript).mode & 0o111).toBeTruthy();
      expect(fs.statSync(productionScript).mode & 0o111).toBeTruthy();
    });

    it('should have valid staging deployment script', () => {
      const scriptContent = readFileSync(stagingScript, 'utf8');

      // Check for required functions
      expect(scriptContent).toContain('check_prerequisites()');
      expect(scriptContent).toContain('validate_environment()');
      expect(scriptContent).toContain('build_and_push_image()');
      expect(scriptContent).toContain('register_task_definition()');
      expect(scriptContent).toContain('update_service()');
      expect(scriptContent).toContain('wait_for_deployment()');
      expect(scriptContent).toContain('run_health_checks()');
      expect(scriptContent).toContain('run_integration_tests()');
      expect(scriptContent).toContain('rollback()');

      // Check for proper environment configuration
      expect(scriptContent).toContain('ECS_CLUSTER="sdlc-staging"');
      expect(scriptContent).toContain('ECS_SERVICE="sdlc-landing-page"');
      expect(scriptContent).toContain('staging.sdlc.ai');

      // Check for error handling
      expect(scriptContent).toContain('set -e');
      expect(scriptContent).toContain('trap cleanup EXIT');
    });

    it('should have valid production deployment script', () => {
      const scriptContent = readFileSync(productionScript, 'utf8');

      // Check for additional production features
      expect(scriptContent).toContain('create_backup()');
      expect(scriptContent).toContain('production_readiness_check()');
      expect(scriptContent).toContain('run_production_health_checks()');
      expect(scriptContent).toContain('run_smoke_tests()');
      expect(scriptContent).toContain('run_e2e_tests()');
      expect(scriptContent).toContain('send_notification()');
      expect(scriptContent).toContain('rollback_production()');

      // Check for production safety measures
      expect(scriptContent).toContain('🚨 STARTING PRODUCTION DEPLOYMENT 🚨');
      expect(scriptContent).toContain('deploy-production');
      expect(scriptContent).toContain('ECS_CLUSTER="sdlc-production"');
      expect(scriptContent).toContain('NODE_ENV');

      // Check for comprehensive error handling
      expect(scriptContent).toContain('maximumPercent=200,minimumHealthyPercent=50');
      expect(scriptContent).toContain('max_wait_time=1800');
    });
  });

  describe('Security Configuration', () => {
    const zapRulesFile = path.join(projectRoot, '.zap/rules.tsv');

    it('should have ZAP security rules', () => {
      expect(existsSync(zapRulesFile)).toBe(true);
    });

    it('should have comprehensive security rules', () => {
      const rulesContent = readFileSync(zapRulesFile, 'utf8');

      // Check for OWASP Top 10 coverage
      expect(rulesContent).toContain('OWASP-A01'); // Broken Access Control
      expect(rulesContent).toContain('OWASP-A02'); // Cryptographic Failures
      expect(rulesContent).toContain('OWASP-A03'); // Injection
      expect(rulesContent).toContain('OWASP-A04'); // Insecure Design
      expect(rulesContent).toContain('OWASP-A05'); // Security Misconfiguration
      expect(rulesContent).toContain('OWASP-A06'); // Vulnerable Components
      expect(rulesContent).toContain('OWASP-A07'); // Authentication Failures
      expect(rulesContent).toContain('OWASP-A08'); // Software/Data Integrity Failures
      expect(rulesContent).toContain('OWASP-A09'); // Logging/Monitoring Failures
      expect(rulesContent).toContain('OWASP-A10'); // Server-Side Request Forgery

      // Check for specific security rules
      expect(rulesContent).toContain('Cross-Site Scripting');
      expect(rulesContent).toContain('SQL Injection');
      expect(rulesContent).toContain('CSRF');
      expect(rulesContent).toContain('Security Headers');
      expect(rulesContent).toContain('HTTPS');
    });

    it('should have curl timing template', () => {
      const curlTimeFile = path.join(workflowsDir, 'curl-time-ms');
      expect(existsSync(curlTimeFile)).toBe(true);

      const content = readFileSync(curlTimeFile, 'utf8');
      expect(content).toContain('time_total');
      expect(content).toContain('time_starttransfer');
    });
  });

  describe('Integration Test Configuration', () => {
    const integrationConfig = path.join(__dirname, '../../jest.integration.config.js');
    const integrationSetup = path.join(__dirname, '../../setup.integration.ts');

    it('should have integration test configuration', () => {
      expect(existsSync(integrationConfig)).toBe(true);
      expect(existsSync(integrationSetup)).toBe(true);
    });

    it('should have valid Jest integration configuration', () => {
      const configContent = readFileSync(integrationConfig, 'utf8');

      expect(configContent).toContain('displayName: \'integration\'');
      expect(configContent).toContain('testMatch');
      expect(configContent).toContain('testEnvironment: \'node\'');
      expect(configContent).toContain('setupFilesAfterEnv');
      expect(configContent).toContain('testTimeout: 30000');
    });

    it('should have comprehensive integration test setup', () => {
      const setupContent = readFileSync(integrationSetup, 'utf8');

      expect(setupContent).toContain('global.testUtils');
      expect(setupContent).toContain('createMockReqRes');
      expect(setupContent).toContain('mockMetrics');
      expect(setupContent).toContain('toBeValidHealthResponse');
      expect(setupContent).toContain('toHaveValidCORSHeaders');
      expect(setupContent).toContain('toHaveValidSecurityHeaders');
    });
  });

  describe('Docker Configuration', () => {
    const dockerfile = path.join(__dirname, '../../Dockerfile');

    it('should have Dockerfile for deployment', () => {
      expect(existsSync(dockerfile)).toBe(true);
    });

    it('should have production-ready Dockerfile', () => {
      const dockerContent = readFileSync(dockerfile, 'utf8');

      expect(dockerContent).toContain('FROM node:18-alpine');
      expect(dockerContent).toContain('WORKDIR /app');
      expect(dockerContent).toContain('COPY package*.json ./');
      expect(dockerContent).toContain('npm ci --only=production');
      expect(dockerContent).toContain('HEALTHCHECK');
      expect(dockerContent).toContain('EXPOSE 3000');
      expect(dockerContent).toContain('CMD ["npm", "start"]');
    });
  });

  describe('Environment Configuration', () => {
    const packageJson = path.join(__dirname, '../../package.json');

    it('should have required npm scripts for deployment', () => {
      const packageContent = JSON.parse(readFileSync(packageJson, 'utf8'));

      expect(packageContent.scripts).toHaveProperty('test:integration');
      expect(packageContent.scripts).toHaveProperty('test:e2e');
      expect(packageContent.scripts).toHaveProperty('build');
      expect(packageContent.scripts).toHaveProperty('start');
    });

    it('should have appropriate dependencies for deployment', () => {
      const packageContent = JSON.parse(readFileSync(packageJson, 'utf8'));

      // Check for production dependencies
      expect(packageContent.dependencies).toHaveProperty('next');
      expect(packageContent.dependencies).toHaveProperty('react');

      // Check for development dependencies
      expect(packageContent.devDependencies).toHaveProperty('@types/node');
      expect(packageContent.devDependencies).toHaveProperty('jest');
      expect(packageContent.devDependencies).toHaveProperty('typescript');
    });
  });

  describe('Documentation and Configuration Files', () => {
    it('should have monitoring infrastructure documentation', () => {
      const monitoringReadme = path.join(projectRoot, 'SDLC/infra/monitoring/README.md');
      expect(existsSync(monitoringReadme)).toBe(true);

      const content = readFileSync(monitoringReadme, 'utf8');
      expect(content).toContain('Monitoring and Alerting Infrastructure');
      expect(content).toContain('Quick Start');
      expect(content).toContain('Components');
      expect(content).toContain('Integration with SDLC Landing Page');
      expect(content).toContain('Production Deployment');
    });
  });

  describe('End-to-End Deployment Flow', () => {
    it('should have all components for complete deployment pipeline', () => {
      const requiredFiles = [
        '.github/workflows/sdlc-deploy.yml',
        '.github/workflows/ecs-staging-task-definition.json',
        '.github/workflows/ecs-production-task-definition.json',
        '.github/workflows/ecs-backup-task-definition.json',
        '.github/workflows/curl-time-ms',
        '.zap/rules.tsv',
        'scripts/deploy-staging.sh',
        'scripts/deploy-production.sh',
        'SDLC/landing-page/jest.integration.config.js',
        'SDLC/landing-page/__tests__/setup.integration.ts',
        'SDLC/landing-page/Dockerfile',
      ];

      requiredFiles.forEach(file => {
        const filePath = path.join(projectRoot, file);
        expect(existsSync(filePath)).toBe(true, `Missing required file: ${file}`);
      });
    });

    it('should have proper script permissions', () => {
      const { execSync } = require('child_process');

      try {
        execSync('scripts/deploy-staging.sh --help', { cwd: projectRoot });
        execSync('scripts/deploy-production.sh --help', { cwd: projectRoot });
      } catch (error) {
        // Scripts should show usage when called with --help
        expect(error.stdout?.toString() || error.stderr?.toString()).toContain('Usage:');
      }
    });
  });
});
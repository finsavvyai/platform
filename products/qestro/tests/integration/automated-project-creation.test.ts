/**
 * Integration Tests for Automated Project Creation Services
 *
 * Tests the complete automated project creation workflow including:
 * - Repository analysis and technology detection
 * - Project structure generation
 * - Configuration optimization
 * - Script generation
 * - Complete orchestration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProjectCreationOrchestrator, ProjectCreationRequest } from '../../backend/src/services/ProjectCreationOrchestrator.js';
import { AutomatedProjectCreationService } from '../../backend/src/services/AutomatedProjectCreationService.js';
import { ProjectStructureGenerator } from '../../backend/src/services/ProjectStructureGenerator.js';
import { IntelligentConfigurationManager } from '../../backend/src/services/IntelligentConfigurationManager.js';
import { AutomatedSetupScriptsGenerator } from '../../backend/src/services/AutomatedSetupScriptsGenerator.js';
import { RepositoryIntegrationService } from '../../backend/src/services/RepositoryIntegrationService.js';
import { AITestGenerationService } from '../../backend/src/services/AITestGenerationService.js';
import { AIDeploymentService } from '../../backend/src/services/AIDeploymentService.js';

describe('Automated Project Creation Services', () => {
  let orchestrator: ProjectCreationOrchestrator;
  let projectCreationService: AutomatedProjectCreationService;
  let structureGenerator: ProjectStructureGenerator;
  let configurationManager: IntelligentConfigurationManager;
  let scriptsGenerator: AutomatedSetupScriptsGenerator;

  beforeEach(() => {
    // Initialize all services
    orchestrator = new ProjectCreationOrchestrator();
    projectCreationService = new AutomatedProjectCreationService();
    structureGenerator = new ProjectStructureGenerator();
    configurationManager = new IntelligentConfigurationManager();
    scriptsGenerator = new AutomatedSetupScriptsGenerator();
  });

  afterEach(() => {
    // Clean up any resources
  });

  describe('AutomatedProjectCreationService', () => {
    it('should create a basic project configuration', async () => {
      const options = {
        projectName: 'Test Project',
        projectDescription: 'A test project for automated creation',
        technology: ['typescript', 'react'],
        frameworks: ['react', 'nextjs'],
        testingFrameworks: ['jest', 'playwright'],
        enableAI: true,
        enableDocumentation: true,
        enableQualityTools: true
      };

      const result = await projectCreationService.createProject(options);

      expect(result).toBeDefined();
      expect(result.configuration).toBeDefined();
      expect(result.configuration.name).toBe('Test Project');
      expect(result.configuration.technology.frameworks).toContain('react');
      expect(result.configuration.technology.frameworks).toContain('nextjs');
      expect(result.testing.frameworks).toContain('jest');
      expect(result.testing.frameworks).toContain('playwright');
      expect(result.setupInstructions).toBeDefined();
      expect(result.scripts).toBeDefined();
      expect(result.files).toBeDefined();
      expect(result.nextSteps).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should analyze repository and detect technology stack', async () => {
      const options = {
        repositoryUrl: 'https://github.com/example/react-typescript-app',
        repositoryProvider: 'github' as const,
        repositoryBranch: 'main',
        projectName: 'Analyzed Project',
        enableAI: true
      };

      // Mock the repository service to avoid actual API calls
      const mockRepositoryService = {
        connectAndAnalyze: jest.fn().mockResolvedValue({
          analysis: {
            metadata: { name: 'react-app', description: 'React TypeScript app', language: ['TypeScript', 'JavaScript'], size: 1024 },
            structure: { totalFiles: 50, directories: ['src', 'tests'], entryPoints: ['src/index.tsx'] },
            technology: { frameworks: ['react', 'typescript'], libraries: ['axios', 'lodash'], testingFrameworks: ['jest'] },
            patterns: { architecture: 'spa' as const },
            complexity: { cyclomaticComplexity: 15, cognitiveComplexity: 25 },
            testing: { existingTests: true, testCoverage: 85, testTypes: ['unit', 'integration'] },
            recommendations: { suggestedTestTypes: ['e2e'], priorityFeatures: ['performance optimization'] }
          }
        })
      };

      // Patch the repository service
      (projectCreationService as any).repositoryService = mockRepositoryService;

      const result = await projectCreationService.createProject(options);

      expect(result.configuration.repository).toBeDefined();
      expect(result.configuration.technology.frameworks).toContain('react');
      expect(result.configuration.technology.frameworks).toContain('typescript');
      expect(result.configuration.architecture.type).toBe('spa');
      expect(result.testing.coverage.current).toBe(85);
    });

    it('should generate appropriate test suites based on technology stack', async () => {
      const options = {
        projectName: 'Full Stack Project',
        technology: ['typescript', 'javascript'],
        frameworks: ['react', 'express'],
        testingFrameworks: ['jest', 'playwright'],
        enableAI: true
      };

      const result = await projectCreationService.createProject(options);

      expect(result.testing.automatedSuites).toBeDefined();
      expect(result.testing.automatedSuites.length).toBeGreaterThan(0);

      const testTypes = result.testing.automatedSuites.map(suite => suite.testType);
      expect(testTypes).toContain('api');
      expect(testTypes).toContain('ui');
      expect(testTypes).toContain('integration');
    });
  });

  describe('ProjectStructureGenerator', () => {
    it('should generate React TypeScript project structure', async () => {
      const configuration = {
        id: 'test-project',
        name: 'React Test Project',
        description: 'A React TypeScript test project',
        technology: {
          language: ['typescript', 'javascript'],
          frameworks: ['react', 'nextjs'],
          libraries: ['axios', 'lodash'],
          testingFrameworks: ['jest', 'playwright'],
          buildTools: ['npm', 'webpack']
        },
        architecture: {
          type: 'spa' as const,
          patterns: ['state-management'],
          entryPoints: ['src/index.tsx']
        },
        testing: {
          frameworks: ['jest', 'playwright'],
          testTypes: ['unit', 'integration', 'e2e'],
          coverage: { target: 80 },
          automatedSuites: []
        },
        deployment: {
          strategies: [],
          recommendedStrategy: { type: 'vercel' as const, name: 'Vercel' },
          previewEnvironments: true,
          cicd: { enabled: true, platform: 'github', workflows: ['ci', 'deploy'] }
        },
        quality: {
          codeQuality: { eslint: true, prettier: true, husky: true, lintStaged: true },
          testing: { unitTests: true, integrationTests: true, e2eTests: true, performanceTests: false, securityTests: false },
          monitoring: { errorTracking: true, performanceMonitoring: true, logging: true, analytics: true }
        },
        documentation: {
          userGuide: true,
          apiDocumentation: true,
          testingDocumentation: true,
          deploymentGuide: true,
          contributingGuide: true
        },
        integrations: {
          ai: { testGeneration: true, codeAnalysis: true, optimization: true },
          communication: { slack: false, discord: false, email: true },
          analytics: { googleAnalytics: false, customAnalytics: true }
        }
      };

      const structure = await structureGenerator.generateProjectStructure(configuration);

      expect(structure).toBeDefined();
      expect(structure.files).toBeDefined();
      expect(structure.directories).toBeDefined();
      expect(structure.metadata.totalFiles).toBeGreaterThan(0);
      expect(structure.metadata.totalDirectories).toBeGreaterThan(0);

      // Check for essential files
      const filePaths = structure.files.map(f => f.path);
      expect(filePaths).toContain('README.md');
      expect(filePaths).toContain('package.json');
      expect(filePaths).toContain('tsconfig.json');
      expect(filePaths).toContain('src/index.ts');
      expect(filePaths).toContain('src/App.tsx');
      expect(filePaths).toContain('.gitignore');
      expect(filePaths).toContain('.env.example');

      // Check for essential directories
      expect(structure.directories).toContain('src');
      expect(structure.directories).toContain('src/components');
      expect(structure.directories).toContain('src/pages');
      expect(structure.directories).toContain('tests');
      expect(structure.directories).toContain('docs');
      expect(structure.directories).toContain('scripts');
    });

    it('should generate different structures for different frameworks', async () => {
      const reactConfig = {
        id: 'react-project',
        name: 'React Project',
        technology: { frameworks: ['react'], language: ['typescript'] },
        architecture: { type: 'spa' as const, patterns: [], entryPoints: [] },
        testing: { frameworks: ['jest'], testTypes: [], coverage: { target: 80 }, automatedSuites: [] },
        deployment: { strategies: [], recommendedStrategy: { type: 'vercel' as const, name: 'Vercel' }, previewEnvironments: true, cicd: { enabled: true, platform: 'github', workflows: [] } },
        quality: { codeQuality: { eslint: true, prettier: true, husky: true, lintStaged: true }, testing: { unitTests: true, integrationTests: true, e2eTests: false, performanceTests: false, securityTests: false }, monitoring: { errorTracking: true, performanceMonitoring: true, logging: true, analytics: true } },
        documentation: { userGuide: true, apiDocumentation: false, testingDocumentation: true, deploymentGuide: true, contributingGuide: true },
        integrations: { ai: { testGeneration: true, codeAnalysis: true, optimization: true }, communication: { slack: false, discord: false, email: true }, analytics: { googleAnalytics: false, customAnalytics: true } }
      };

      const expressConfig = {
        ...reactConfig,
        id: 'express-project',
        name: 'Express Project',
        technology: { frameworks: ['express'], language: ['typescript'] },
        architecture: { type: 'monolith' as const, patterns: [], entryPoints: [] }
      };

      const reactStructure = await structureGenerator.generateProjectStructure(reactConfig);
      const expressStructure = await structureGenerator.generateProjectStructure(expressConfig);

      // Both should have basic files
      const reactFiles = reactStructure.files.map(f => f.path);
      const expressFiles = expressStructure.files.map(f => f.path);

      expect(reactFiles).toContain('src/App.tsx');
      expect(expressFiles).not.toContain('src/App.tsx');

      // Express should have server-specific files
      expect(expressFiles).toContain('src/index.ts');
    });
  });

  describe('IntelligentConfigurationManager', () => {
    it('should create optimized configuration profiles', async () => {
      const configuration = {
        id: 'config-test-project',
        name: 'Config Test Project',
        technology: { frameworks: ['react', 'nextjs'], language: ['typescript'] },
        architecture: { type: 'spa' as const, patterns: [], entryPoints: [] },
        testing: { frameworks: ['jest', 'playwright'], testTypes: [], coverage: { target: 85 }, automatedSuites: [] },
        deployment: { strategies: [], recommendedStrategy: { type: 'vercel' as const, name: 'Vercel' }, previewEnvironments: true, cicd: { enabled: true, platform: 'github', workflows: [] } },
        quality: { codeQuality: { eslint: true, prettier: true, husky: true, lintStaged: true }, testing: { unitTests: true, integrationTests: true, e2eTests: true, performanceTests: false, securityTests: false }, monitoring: { errorTracking: true, performanceMonitoring: true, logging: true, analytics: true } },
        documentation: { userGuide: true, apiDocumentation: false, testingDocumentation: true, deploymentGuide: true, contributingGuide: true },
        integrations: { ai: { testGeneration: true, codeAnalysis: true, optimization: true }, communication: { slack: false, discord: false, email: true }, analytics: { googleAnalytics: false, customAnalytics: true } }
      };

      const result = await configurationManager.createOptimizedConfiguration(configuration, {
        performancePriority: true,
        securityPriority: true,
        developerExperience: true
      });

      expect(result).toBeDefined();
      expect(result.profiles).toBeDefined();
      expect(result.profiles.length).toBe(3); // dev, staging, production
      expect(result.recommendations).toBeDefined();
      expect(result.environmentConfigs).toBeDefined();

      // Check development profile
      const devProfile = result.profiles.find(p => p.environment === 'development');
      expect(devProfile).toBeDefined();
      expect(devProfile?.settings.hotReload).toBe(true);
      expect(devProfile?.settings.debugging).toBe(true);
      expect(devProfile?.performance.caching.enabled).toBe(false);

      // Check production profile
      const prodProfile = result.profiles.find(p => p.environment === 'production');
      expect(prodProfile).toBeDefined();
      expect(prodProfile?.settings.hotReload).toBe(false);
      expect(prodProfile?.settings.debugging).toBe(false);
      expect(prodProfile?.performance.caching.enabled).toBe(true);
      expect(prodProfile?.security.authentication.mfa).toBe(true);
    });

    it('should generate configuration files for different environments', async () => {
      const configuration = {
        id: 'config-files-test',
        name: 'Config Files Test',
        technology: { frameworks: ['nextjs'], language: ['typescript'] },
        architecture: { type: 'spa' as const, patterns: [], entryPoints: [] },
        testing: { frameworks: ['jest'], testTypes: [], coverage: { target: 80 }, automatedSuites: [] },
        deployment: { strategies: [], recommendedStrategy: { type: 'vercel' as const, name: 'Vercel' }, previewEnvironments: true, cicd: { enabled: true, platform: 'github', workflows: [] } },
        quality: { codeQuality: { eslint: true, prettier: true, husky: true, lintStaged: true }, testing: { unitTests: true, integrationTests: true, e2eTests: false, performanceTests: false, securityTests: false }, monitoring: { errorTracking: true, performanceMonitoring: true, logging: true, analytics: true } },
        documentation: { userGuide: true, apiDocumentation: false, testingDocumentation: true, deploymentGuide: true, contributingGuide: true },
        integrations: { ai: { testGeneration: true, codeAnalysis: true, optimization: true }, communication: { slack: false, discord: false, email: true }, analytics: { googleAnalytics: false, customAnalytics: true } }
      };

      const profiles = await configurationManager.createOptimizedConfiguration(configuration);
      const configFiles = await configurationManager.generateConfigurationFiles(
        profiles.profiles[0].id,
        ['development', 'production']
      );

      expect(configFiles).toBeDefined();
      expect(configFiles.development).toBeDefined();
      expect(configFiles.production).toBeDefined();

      // Check development files
      expect(configFiles.development['.env']).toBeDefined();
      expect(configFiles.development['docker-compose.yml']).toBeDefined();
      expect(configFiles.development['next.config.js']).toBeDefined();

      // Check production files
      expect(configFiles.production['.env']).toBeDefined();
      expect(configFiles.production['next.config.js']).toBeDefined();

      // Environment variables should differ
      const devEnv = configFiles.development['.env'];
      const prodEnv = configFiles.production['.env'];
      expect(devEnv).toContain('NODE_ENV=development');
      expect(prodEnv).toContain('NODE_ENV=production');
    });
  });

  describe('AutomatedSetupScriptsGenerator', () => {
    it('should generate complete setup script package', async () => {
      const configuration = {
        id: 'scripts-test-project',
        name: 'Scripts Test Project',
        technology: { frameworks: ['react', 'nextjs'], language: ['typescript'] },
        architecture: { type: 'spa' as const, patterns: [], entryPoints: [] },
        testing: { frameworks: ['jest', 'playwright'], testTypes: [], coverage: { target: 80 }, automatedSuites: [] },
        deployment: { strategies: [], recommendedStrategy: { type: 'vercel' as const, name: 'Vercel' }, previewEnvironments: true, cicd: { enabled: true, platform: 'github', workflows: [] } },
        quality: { codeQuality: { eslint: true, prettier: true, husky: true, lintStaged: true }, testing: { unitTests: true, integrationTests: true, e2eTests: true, performanceTests: false, securityTests: false }, monitoring: { errorTracking: true, performanceMonitoring: true, logging: true, analytics: true } },
        documentation: { userGuide: true, apiDocumentation: false, testingDocumentation: true, deploymentGuide: true, contributingGuide: true },
        integrations: { ai: { testGeneration: true, codeAnalysis: true, optimization: true }, communication: { slack: false, discord: false, email: true }, analytics: { googleAnalytics: false, customAnalytics: true } }
      };

      const profiles = [{
        id: 'test-profile',
        name: 'Test Profile',
        description: 'Test configuration profile',
        environment: 'development' as const,
        settings: { framework: 'nextjs' },
        optimizations: [],
        performance: {
          caching: { enabled: false, strategy: 'memory' as const, ttl: 60 },
          compression: { enabled: false, algorithm: 'gzip' as const, level: 1 },
          monitoring: { enabled: true, metrics: [], alerts: false, sampling: 1 },
          scaling: { enabled: false, minInstances: 1, maxInstances: 1, targetCPU: 80, targetMemory: 80 }
        },
        security: {
          authentication: { method: 'jwt' as const, sessionTimeout: 86400, refreshTokenRotation: false, mfa: false },
          encryption: { atRest: false, inTransit: true, algorithm: 'AES-256-GCM', keyRotation: false },
          rateLimiting: { enabled: false, requestsPerMinute: 1000, burstLimit: 100, strategies: [] },
          headers: { csp: false, hsts: false, xFrameOptions: true, xContentTypeOptions: true },
          audit: { enabled: true, logLevel: 'debug' as const, retention: 7 }
        },
        features: {}
      }];

      const scriptPackage = await scriptsGenerator.generateSetupScriptPackage(
        configuration,
        profiles,
        {
          includeDatabaseScripts: true,
          includeMonitoring: true,
          includeCI_CD: true,
          includeBackupScripts: true
        }
      );

      expect(scriptPackage).toBeDefined();
      expect(scriptPackage.scripts).toBeDefined();
      expect(scriptPackage.scripts.length).toBeGreaterThan(0);
      expect(scriptPackage.metadata.categories.length).toBeGreaterThan(0);
      expect(scriptPackage.metadata.environments.length).toBeGreaterThan(0);

      // Check for essential scripts
      const scriptNames = scriptPackage.scripts.map(s => s.name);
      expect(scriptNames).toContain('Project Setup');
      expect(scriptNames).toContain('Environment Validation');
      expect(scriptNames).toContain('Start Development Server');
      expect(scriptNames).toContain('Production Build');
      expect(scriptNames).toContain('Deploy to Production');
      expect(scriptNames).toContain('Health Check');
      expect(scriptNames).toContain('Database Migration');
      expect(scriptNames).toContain('Database Backup');

      // Check script categories
      expect(scriptPackage.metadata.categories).toContain('setup');
      expect(scriptPackage.metadata.categories).toContain('deployment');
      expect(scriptPackage.metadata.categories).toContain('monitoring');
      expect(scriptPackage.metadata.categories).toContain('backup');

      // Check script files
      const scriptFiles = scriptPackage.scripts.map(s => s.filename);
      expect(scriptFiles).toContain('scripts/setup.sh');
      expect(scriptFiles).toContain('scripts/validate-environment.sh');
      expect(scriptFiles).toContain('scripts/start-dev.sh');
      expect(scriptFiles).toContain('scripts/build-production.sh');
      expect(scriptFiles).toContain('scripts/deploy-production.sh');
      expect(scriptFiles).toContain('scripts/health-check.sh');
    });

    it('should generate CI/CD pipelines for different platforms', async () => {
      const configuration = {
        id: 'pipeline-test',
        name: 'Pipeline Test Project',
        technology: { frameworks: ['nextjs'], language: ['typescript'] },
        architecture: { type: 'spa' as const, patterns: [], entryPoints: [] },
        testing: { frameworks: ['jest'], testTypes: [], coverage: { target: 80 }, automatedSuites: [] },
        deployment: { strategies: [], recommendedStrategy: { type: 'vercel' as const, name: 'Vercel' }, previewEnvironments: true, cicd: { enabled: true, platform: 'github', workflows: [] } },
        quality: { codeQuality: { eslint: true, prettier: true, husky: true, lintStaged: true }, testing: { unitTests: true, integrationTests: true, e2eTests: false, performanceTests: false, securityTests: false }, monitoring: { errorTracking: true, performanceMonitoring: true, logging: true, analytics: true } },
        documentation: { userGuide: true, apiDocumentation: false, testingDocumentation: true, deploymentGuide: true, contributingGuide: true },
        integrations: { ai: { testGeneration: true, codeAnalysis: true, optimization: true }, communication: { slack: false, discord: false, email: true }, analytics: { googleAnalytics: false, customAnalytics: true } }
      };

      const profiles = [{
        id: 'pipeline-profile',
        name: 'Pipeline Profile',
        description: 'Pipeline configuration profile',
        environment: 'production' as const,
        settings: { framework: 'nextjs' },
        optimizations: [],
        performance: {
          caching: { enabled: true, strategy: 'hybrid' as const, ttl: 3600 },
          compression: { enabled: true, algorithm: 'both' as const, level: 6 },
          monitoring: { enabled: true, metrics: [], alerts: true, sampling: 0.1 },
          scaling: { enabled: true, minInstances: 2, maxInstances: 10, targetCPU: 70, targetMemory: 75 }
        },
        security: {
          authentication: { method: 'oauth' as const, sessionTimeout: 3600, refreshTokenRotation: true, mfa: true },
          encryption: { atRest: true, inTransit: true, algorithm: 'AES-256-GCM', keyRotation: true },
          rateLimiting: { enabled: true, requestsPerMinute: 100, burstLimit: 20, strategies: ['sliding-window', 'token-bucket'] },
          headers: { csp: true, hsts: true, xFrameOptions: true, xContentTypeOptions: true },
          audit: { enabled: true, logLevel: 'warn' as const, retention: 90 }
        },
        features: {}
      }];

      const pipelines = await scriptsGenerator.generateDeploymentPipelines(configuration, profiles);

      expect(pipelines).toBeDefined();
      expect(pipelines.github).toBeDefined();
      expect(pipelines.gitlab).toBeDefined();
      expect(pipelines.azure).toBeDefined();
      expect(pipelines.aws).toBeDefined();

      // Check GitHub Actions pipeline
      expect(pipelines.github).toContain('name: CI/CD Pipeline');
      expect(pipelines.github).toContain('jobs:');
      expect(pipelines.github).toContain('test:');
      expect(pipelines.github).toContain('build:');
      expect(pipelines.github).toContain('deploy:');

      // Check GitLab CI pipeline
      expect(pipelines.gitlab).toContain('stages:');
      expect(pipelines.gitlab).toContain('test');
      expect(pipelines.gitlab).toContain('build');
      expect(pipelines.gitlab).toContain('deploy');

      // Check Azure DevOps pipeline
      expect(pipelines.azure).toContain('stages:');
      expect(pipelines.azure).toContain('Test Stage');
      expect(pipelines.azure).toContain('Build Stage');
      expect(pipelines.azure).toContain('Deploy Stage');
    });
  });

  describe('ProjectCreationOrchestrator Integration', () => {
    it('should orchestrate complete project creation workflow', async () => {
      const request: ProjectCreationRequest = {
        id: 'integration-test-request',
        options: {
          projectName: 'Integration Test Project',
          projectDescription: 'A comprehensive test project for integration testing',
          technology: ['typescript', 'javascript'],
          frameworks: ['react', 'nextjs'],
          testingFrameworks: ['jest', 'playwright', 'vitest'],
          enableAI: true,
          enableDocumentation: true,
          enableQualityTools: true,
          repositoryUrl: 'https://github.com/example/react-nextjs-app',
          repositoryProvider: 'github',
          repositoryBranch: 'main'
        },
        preferences: {
          performancePriority: true,
          securityPriority: true,
          developerExperience: true,
          includeDatabaseScripts: true,
          includeMonitoring: true,
          includeCI_CD: true,
          includeBackupScripts: true,
          deploymentTargets: ['vercel', 'aws']
        },
        metadata: {
          requestedBy: 'test-user',
          requestedAt: new Date(),
          source: 'api'
        }
      };

      // Mock external services to avoid API calls
      const mockRepositoryService = {
        connectAndAnalyze: jest.fn().mockResolvedValue({
          analysis: {
            metadata: { name: 'react-nextjs-app', description: 'React Next.js application', language: ['TypeScript'], size: 2048 },
            structure: { totalFiles: 100, directories: ['src', 'components', 'pages'], entryPoints: ['src/pages/_app.tsx'] },
            technology: { frameworks: ['react', 'nextjs'], libraries: ['axios', 'lodash'], testingFrameworks: ['jest'] },
            patterns: { architecture: 'spa' as const },
            complexity: { cyclomaticComplexity: 20, cognitiveComplexity: 30 },
            testing: { existingTests: true, testCoverage: 90, testTypes: ['unit', 'integration', 'e2e'] },
            recommendations: { suggestedTestTypes: ['performance'], priorityFeatures: ['SEO optimization'] }
          }
        })
      };

      // Apply mocks
      (orchestrator as any).projectCreationService.repositoryService = mockRepositoryService;

      const result = await orchestrator.createProject(request);

      expect(result).toBeDefined();
      expect(result.request).toBe(request);
      expect(result.project).toBeDefined();
      expect(result.structure).toBeDefined();
      expect(result.configurations).toBeDefined();
      expect(result.scripts).toBeDefined();
      expect(result.pipelines).toBeDefined();
      expect(result.infrastructure).toBeDefined();

      // Verify project configuration
      expect(result.project.configuration.name).toBe('Integration Test Project');
      expect(result.project.configuration.technology.frameworks).toContain('react');
      expect(result.project.configuration.technology.frameworks).toContain('nextjs');
      expect(result.project.configuration.testing.frameworks).toContain('jest');
      expect(result.project.configuration.testing.frameworks).toContain('playwright');

      // Verify project structure
      expect(result.structure.files.length).toBeGreaterThan(0);
      expect(result.structure.directories.length).toBeGreaterThan(0);
      const structureFiles = result.structure.files.map(f => f.path);
      expect(structureFiles).toContain('README.md');
      expect(structureFiles).toContain('package.json');
      expect(structureFiles).toContain('src/App.tsx');

      // Verify configurations
      expect(result.configurations.profiles.length).toBe(3); // dev, staging, production
      expect(result.configurations.recommendations.length).toBeGreaterThan(0);
      expect(result.configurations.environmentConfigs.length).toBe(3);

      // Verify scripts
      expect(result.scripts.scripts.length).toBeGreaterThan(10);
      expect(result.scripts.metadata.categories.length).toBeGreaterThan(3);
      const scriptNames = result.scripts.scripts.map(s => s.name);
      expect(scriptNames).toContain('Project Setup');
      expect(scriptNames).toContain('Production Build');
      expect(scriptNames).toContain('Deploy to Production');

      // Verify pipelines
      expect(result.pipelines.github).toContain('CI/CD Pipeline');
      expect(result.pipelines.gitlab).toContain('stages:');
      expect(result.pipelines.azure).toContain('stages:');
      expect(result.pipelines.aws).toContain('version: 0.2');

      // Verify infrastructure templates
      expect(result.infrastructure.terraform).toBeDefined();
      expect(result.infrastructure.cloudformation).toBeDefined();
      expect(result.infrastructure.pulumi).toBeDefined();
      expect(result.infrastructure.ansible).toBeDefined();

      // Verify summary
      expect(result.summary.totalFiles).toBeGreaterThan(0);
      expect(result.summary.totalScripts).toBeGreaterThan(0);
      expect(result.summary.estimatedSetupTime).toBeGreaterThan(0);
      expect(result.summary.technologyStack).toContain('react');
      expect(result.summary.technologyStack).toContain('nextjs');
      expect(result.summary.features).toContain('unit testing');
      expect(result.summary.features).toContain('CI/CD pipelines');

      // Verify next steps
      expect(result.nextSteps.length).toBeGreaterThan(0);
      expect(result.nextSteps[0]).toContain('Review Generated Project');

      // Verify warnings (if any)
      expect(Array.isArray(result.warnings)).toBe(true);
    }, 30000); // 30 second timeout for integration test

    it('should handle project creation progress tracking', async () => {
      const request: ProjectCreationRequest = {
        id: 'progress-test-request',
        options: {
          projectName: 'Progress Test Project',
          technology: ['typescript'],
          frameworks: ['react'],
          enableAI: true
        },
        preferences: {
          performancePriority: true,
          developerExperience: true
        },
        metadata: {
          requestedBy: 'test-user',
          requestedAt: new Date(),
          source: 'web'
        }
      };

      const progressEvents: any[] = [];

      orchestrator.on('progress', (progress) => {
        progressEvents.push(progress);
      });

      // Mock repository service
      const mockRepositoryService = {
        connectAndAnalyze: jest.fn().mockResolvedValue({
          analysis: {
            metadata: { name: 'simple-app', description: 'Simple app', language: ['TypeScript'], size: 512 },
            structure: { totalFiles: 25, directories: ['src'], entryPoints: ['src/index.tsx'] },
            technology: { frameworks: ['react'], libraries: [], testingFrameworks: ['jest'] },
            patterns: { architecture: 'spa' as const },
            complexity: { cyclomaticComplexity: 10, cognitiveComplexity: 15 },
            testing: { existingTests: false, testCoverage: 0, testTypes: [] },
            recommendations: { suggestedTestTypes: ['unit'], priorityFeatures: [] }
          }
        })
      };

      (orchestrator as any).projectCreationService.repositoryService = mockRepositoryService;

      const result = await orchestrator.createProject(request);

      expect(result).toBeDefined();
      expect(progressEvents.length).toBeGreaterThan(0);

      // Check progress tracking
      const lastProgress = progressEvents[progressEvents.length - 1];
      expect(lastProgress.progress).toBe(lastProgress.total);
      expect(lastProgress.stage).toBe('Completed');
      expect(lastProgress.message).toContain('completed successfully');

      // Verify stages were tracked
      const stages = progressEvents.map(p => p.stage);
      expect(stages).toContain('Requirements Analysis');
      expect(stages).toContain('Project Configuration');
      expect(stages).toContain('Structure Generation');
      expect(stages).toContain('Configuration Optimization');
      expect(stages).toContain('Script Generation');
      expect(stages).toContain('Pipeline Creation');
    }, 20000);

    it('should provide analytics about project creation', () => {
      // Create some test projects first
      const mockHistory = [
        {
          project: {
            configuration: {
              technology: { frameworks: ['react', 'nextjs'] },
              deployment: { recommendedStrategy: { type: 'vercel' } }
            }
          }
        },
        {
          project: {
            configuration: {
              technology: { frameworks: ['express', 'typescript'] },
              deployment: { recommendedStrategy: { type: 'aws' } }
            }
          }
        }
      ];

      // Mock the history
      (orchestrator as any).creationHistory = new Map([
        ['test-1', mockHistory[0]],
        ['test-2', mockHistory[1]]
      ]);

      const analytics = orchestrator.getAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.totalProjects).toBe(2);
      expect(analytics.successfulProjects).toBe(2);
      expect(analytics.failedProjects).toBe(0);
      expect(analytics.popularTechnologies).toBeDefined();
      expect(analytics.popularDeploymentTargets).toBeDefined();

      expect(analytics.popularTechnologies['react']).toBe(1);
      expect(analytics.popularTechnologies['nextjs']).toBe(1);
      expect(analytics.popularTechnologies['express']).toBe(1);
      expect(analytics.popularTechnologies['typescript']).toBe(2);

      expect(analytics.popularDeploymentTargets['vercel']).toBe(1);
      expect(analytics.popularDeploymentTargets['aws']).toBe(1);
    });

    it('should handle request cancellation', async () => {
      const request: ProjectCreationRequest = {
        id: 'cancellation-test-request',
        options: {
          projectName: 'Cancellation Test Project',
          technology: ['typescript'],
          frameworks: ['react'],
          enableAI: true
        },
        preferences: {
          performancePriority: true
        },
        metadata: {
          requestedBy: 'test-user',
          requestedAt: new Date(),
          source: 'cli'
        }
      };

      // Start the creation process
      const creationPromise = orchestrator.createProject(request);

      // Cancel immediately
      const cancelled = await orchestrator.cancelRequest(request.id);

      expect(cancelled).toBe(true);

      // The creation should fail due to cancellation
      try {
        await creationPromise;
        fail('Expected creation to fail due to cancellation');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid repository URLs gracefully', async () => {
      const options = {
        repositoryUrl: 'https://invalid-url.com/repo',
        repositoryProvider: 'github' as const,
        projectName: 'Invalid Repo Test',
        enableAI: true
      };

      // Mock repository service to throw an error
      const mockRepositoryService = {
        connectAndAnalyze: jest.fn().mockRejectedValue(new Error('Invalid repository URL'))
      };

      (projectCreationService as any).repositoryService = mockRepositoryService;

      const result = await projectCreationService.createProject(options);

      // Should still create project, just without repository analysis
      expect(result).toBeDefined();
      expect(result.project.configuration.name).toBe('Invalid Repo Test');
      expect(result.project.configuration.repository).toBeUndefined();
    });

    it('should handle empty technology stacks', async () => {
      const options = {
        projectName: 'Empty Tech Stack Test',
        enableAI: true
      };

      const result = await projectCreationService.createProject(options);

      expect(result).toBeDefined();
      expect(result.project.configuration.name).toBe('Empty Tech Stack Test');
      // Should have some default technology stack
      expect(result.project.configuration.technology.language.length).toBeGreaterThan(0);
    });

    it('should handle missing optional dependencies', async () => {
      const configuration = {
        id: 'no-deps-test',
        name: 'No Dependencies Test',
        technology: { frameworks: [], language: [] },
        architecture: { type: 'spa' as const, patterns: [], entryPoints: [] },
        testing: { frameworks: [], testTypes: [], coverage: { target: 80 }, automatedSuites: [] },
        deployment: { strategies: [], recommendedStrategy: { type: 'vercel' as const, name: 'Vercel' }, previewEnvironments: true, cicd: { enabled: false, platform: 'github', workflows: [] } },
        quality: { codeQuality: { eslint: false, prettier: false, husky: false, lintStaged: false }, testing: { unitTests: false, integrationTests: false, e2eTests: false, performanceTests: false, securityTests: false }, monitoring: { errorTracking: false, performanceMonitoring: false, logging: false, analytics: false } },
        documentation: { userGuide: false, apiDocumentation: false, testingDocumentation: false, deploymentGuide: false, contributingGuide: false },
        integrations: { ai: { testGeneration: false, codeAnalysis: false, optimization: false }, communication: { slack: false, discord: false, email: false }, analytics: { googleAnalytics: false, customAnalytics: false } }
      };

      const structure = await structureGenerator.generateProjectStructure(configuration);

      expect(structure).toBeDefined();
      expect(structure.files.length).toBeGreaterThan(0);
      // Should still have basic files
      const filePaths = structure.files.map(f => f.path);
      expect(filePaths).toContain('README.md');
      expect(filePaths).toContain('.gitignore');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent project creations', async () => {
      const requests = Array.from({ length: 3 }, (_, i) => ({
        id: `concurrent-test-${i}`,
        options: {
          projectName: `Concurrent Test Project ${i}`,
          technology: ['typescript'],
          frameworks: ['react'],
          enableAI: true
        },
        preferences: {
          performancePriority: true
        },
        metadata: {
          requestedBy: 'test-user',
          requestedAt: new Date(),
          source: 'api'
        }
      }));

      // Mock repository service
      const mockRepositoryService = {
        connectAndAnalyze: jest.fn().mockResolvedValue({
          analysis: {
            metadata: { name: `test-app-${i}`, description: 'Test app', language: ['TypeScript'], size: 512 },
            structure: { totalFiles: 25, directories: ['src'], entryPoints: ['src/index.tsx'] },
            technology: { frameworks: ['react'], libraries: [], testingFrameworks: ['jest'] },
            patterns: { architecture: 'spa' as const },
            complexity: { cyclomaticComplexity: 10, cognitiveComplexity: 15 },
            testing: { existingTests: false, testCoverage: 0, testTypes: [] },
            recommendations: { suggestedTestTypes: ['unit'], priorityFeatures: [] }
          }
        })
      };

      (orchestrator as any).projectCreationService.repositoryService = mockRepositoryService;

      // Run all creations concurrently
      const promises = requests.map(request => orchestrator.createProject(request));
      const results = await Promise.all(promises);

      expect(results.length).toBe(3);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.project.configuration.name).toBe(`Concurrent Test Project ${index}`);
      });
    }, 60000);

    it('should complete project creation within reasonable time', async () => {
      const request: ProjectCreationRequest = {
        id: 'performance-test',
        options: {
          projectName: 'Performance Test Project',
          technology: ['typescript'],
          frameworks: ['react', 'nextjs'],
          testingFrameworks: ['jest', 'playwright'],
          enableAI: true,
          enableDocumentation: true,
          enableQualityTools: true
        },
        preferences: {
          performancePriority: true,
          securityPriority: true,
          includeDatabaseScripts: true,
          includeMonitoring: true,
          includeCI_CD: true
        },
        metadata: {
          requestedBy: 'test-user',
          requestedAt: new Date(),
          source: 'web'
        }
      };

      const startTime = Date.now();

      // Mock repository service
      const mockRepositoryService = {
        connectAndAnalyze: jest.fn().mockResolvedValue({
          analysis: {
            metadata: { name: 'performance-app', description: 'Performance test app', language: ['TypeScript'], size: 1024 },
            structure: { totalFiles: 50, directories: ['src', 'components', 'pages'], entryPoints: ['src/pages/_app.tsx'] },
            technology: { frameworks: ['react', 'nextjs'], libraries: ['axios'], testingFrameworks: ['jest', 'playwright'] },
            patterns: { architecture: 'spa' as const },
            complexity: { cyclomaticComplexity: 15, cognitiveComplexity: 25 },
            testing: { existingTests: true, testCoverage: 85, testTypes: ['unit', 'integration', 'e2e'] },
            recommendations: { suggestedTestTypes: ['performance'], priorityFeatures: ['optimization'] }
          }
        })
      };

      (orchestrator as any).projectCreationService.repositoryService = mockRepositoryService;

      const result = await orchestrator.createProject(request);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Project creation completed in ${duration}ms`);
    }, 15000);
  });
});

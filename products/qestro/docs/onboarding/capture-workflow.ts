/**
 * Onboarding Capture Workflow
 *
 * This script demonstrates the actual onboarding process for the automated
 * project creation system, capturing each step with detailed explanations
 * and interactive elements.
 */

import { MCPOnboardingRecorder } from './mcp-onboarding-recording.js';
import { ProjectCreationOrchestrator } from '../../backend/src/services/ProjectCreationOrchestrator.js';

async function captureOnboardingWorkflow() {
  console.log('🎬 Starting MCP Onboarding Recording Workflow');
  console.log('='.repeat(60));

  // Initialize the recorder
  const recorder = new MCPOnboardingRecorder('./docs/onboarding/recordings');
  const orchestrator = new ProjectCreationOrchestrator();

  // Get available onboarding sessions
  const availableSessions = recorder.getAvailableOnboardingSessions();
  console.log('\n📚 Available Onboarding Sessions:');
  availableSessions.forEach(session => {
    console.log(`  • ${session.title} (${session.estimatedDuration} min)`);
    console.log(`    ID: ${session.id}`);
    console.log(`    Audience: ${session.targetAudience.join(', ')}`);
    console.log('');
  });

  // Start recording the main onboarding session
  console.log('🎥 Starting recording: Complete Automated Project Creation Onboarding');
  const recordingId = await recorder.startRecording('automated-project-creation-main', 'demo-user');

  try {
    // Step 1: Introduction
    console.log('\n📍 Step 1: Introduction to Automated Project Creation');
    await recorder.recordStepInteraction(recordingId, 'intro-automated-creation', 'start');

    // Record introduction content
    await recorder.recordCodeSnippet(
      recordingId,
      'intro-automated-creation',
      'System Overview',
      'Core components of the automated project creation system',
      'typescript',
      `// Core Services Architecture
import { AutomatedProjectCreationService } from './services/AutomatedProjectCreationService.js';
import { ProjectStructureGenerator } from './services/ProjectStructureGenerator.js';
import { IntelligentConfigurationManager } from './services/IntelligentConfigurationManager.js';
import { AutomatedSetupScriptsGenerator } from './services/AutomatedSetupScriptsGenerator.js';
import { ProjectCreationOrchestrator } from './services/ProjectCreationOrchestrator.js';

// Master orchestrator that coordinates all services
const orchestrator = new ProjectCreationOrchestrator();

// Create a complete project with AI-powered features
const request = {
  id: 'demo-project',
  options: {
    projectName: 'My AI-Powered App',
    repositoryUrl: 'https://github.com/example/react-app',
    technology: ['typescript', 'react'],
    frameworks: ['react', 'nextjs'],
    enableAI: true
  },
  preferences: {
    performancePriority: true,
    securityPriority: true,
    developerExperience: true
  }
};

const result = await orchestrator.createProject(request);
console.log('🚀 Project created successfully!');`,
      'This code shows the main architecture of our automated project creation system. The orchestrator coordinates multiple specialized services to generate complete, production-ready projects with AI-powered optimizations.',
      [
        'Always use the orchestrator for complete workflows',
        'Each service can be used independently for specific tasks',
        'Enable AI features for intelligent optimizations'
      ]
    );

    await recorder.recordUserFeedback(recordingId, 'intro-automated-creation', 5,
      'Excellent introduction! Clear explanation of the system architecture.',
      ['Could use more visual diagrams', 'Add real-world examples']
    );

    await recorder.recordStepInteraction(recordingId, 'intro-automated-creation', 'complete');

    // Step 2: Repository Analysis
    console.log('\n📍 Step 2: Repository Analysis and Technology Detection');
    await recorder.recordStepInteraction(recordingId, 'repository-analysis', 'start');

    await recorder.recordCodeSnippet(
      recordingId,
      'repository-analysis',
      'Repository Analysis Example',
      'Analyzing a GitHub repository and detecting technology stack',
      'typescript',
      `// Repository Analysis Service
import { RepositoryIntegrationService } from './services/RepositoryIntegrationService.js';

const repositoryService = new RepositoryIntegrationService();

// Analyze a repository
const analysis = await repositoryService.connectAndAnalyze({
  repositoryUrl: 'https://github.com/example/react-typescript-app',
  provider: 'github',
  branch: 'main',
  accessToken: process.env.GITHUB_TOKEN
});

console.log('📊 Repository Analysis Results:');
console.log(\`- Language: \${analysis.metadata.language.join(', ')}\`);
console.log(\`- Frameworks: \${analysis.technology.frameworks.join(', ')}\`);
console.log(\`- Architecture: \${analysis.patterns.architecture}\`);
console.log(\`- Test Coverage: \${analysis.testing.testCoverage}%\`);
console.log(\`- Complexity: \${analysis.complexity.cyclomaticComplexity}\`);

// The detected information is used to generate optimal project structure
const recommendations = analysis.recommendations;
console.log('💡 AI Recommendations:', recommendations);`,
      'The repository analysis service automatically examines codebases to detect technology stacks, architecture patterns, and complexity metrics. This intelligence is used to generate optimal project configurations.',
      [
        'Ensure proper GitHub/GitLab access tokens are configured',
        'The service supports both public and private repositories',
        'Analysis includes security vulnerability detection'
      ]
    );

    await recorder.recordUserInteraction(recordingId, 'repository-analysis', 'ask_question',
      'repository-analysis',
      { question: 'How does the system handle monorepos?' }
    );

    await recorder.recordStepInteraction(recordingId, 'repository-analysis', 'complete');

    // Step 3: Project Structure Generation
    console.log('\n📍 Step 3: Intelligent Project Structure Generation');
    await recorder.recordStepInteraction(recordingId, 'project-structure-generation', 'start');

    await recorder.recordCodeSnippet(
      recordingId,
      'project-structure-generation',
      'Project Structure Generation',
      'Generating comprehensive project structure based on analysis',
      'typescript',
      `// Project Structure Generator
import { ProjectStructureGenerator } from './services/ProjectStructureGenerator.js';

const structureGenerator = new ProjectStructureGenerator();

// Generate project structure based on configuration
const configuration = {
  id: 'my-project',
  name: 'My AI-Powered App',
  technology: {
    frameworks: ['react', 'nextjs'],
    language: ['typescript'],
    testingFrameworks: ['jest', 'playwright']
  },
  architecture: {
    type: 'spa',
    patterns: ['state-management', 'server-side-rendering']
  }
};

const structure = await structureGenerator.generateProjectStructure(configuration);

console.log('📁 Generated Project Structure:');
console.log(\`- Total Files: \${structure.metadata.totalFiles}\`);
console.log(\`- Total Directories: \${structure.metadata.totalDirectories}\`);

// Sample generated files
const essentialFiles = structure.files.filter(f =>
  ['README.md', 'package.json', 'tsconfig.json', 'src/App.tsx'].includes(f.path)
);

essentialFiles.forEach(file => {
  console.log(\`✅ Generated: \${file.path}\`);
});`,
      'The project structure generator creates comprehensive, best-practice project structures tailored to the detected technology stack. It includes all necessary configuration files, documentation, and scaffolding.',
      [
        'Structures follow framework-specific best practices',
        'All files include appropriate metadata and comments',
        'Generated projects are ready for immediate development'
      ]
    );

    await recorder.recordStepInteraction(recordingId, 'project-structure-generation', 'complete');

    // Step 4: Configuration Optimization
    console.log('\n📍 Step 4: Configuration Management and Optimization');
    await recorder.recordStepInteraction(recordingId, 'configuration-optimization', 'start');

    await recorder.recordCodeSnippet(
      recordingId,
      'configuration-optimization',
      'Configuration Profile Generation',
      'Creating optimized configurations for different environments',
      'typescript',
      `// Intelligent Configuration Manager
import { IntelligentConfigurationManager } from './services/IntelligentConfigurationManager.js';

const configManager = new IntelligentConfigurationManager();

// Generate optimized configurations
const configurations = await configManager.createOptimizedConfiguration(
  projectConfiguration,
  {
    performancePriority: true,
    securityPriority: true,
    developerExperience: true
  }
);

console.log('⚙️ Generated Configuration Profiles:');

// Development profile
const devProfile = configurations.profiles.find(p => p.environment === 'development');
console.log('🔧 Development Profile:');
console.log(\`  - Hot Reload: \${devProfile.settings.hotReload}\`);
console.log(\`  - Debugging: \${devProfile.settings.debugging}\`);
console.log(\`  - Source Maps: \${devProfile.settings.sourceMaps}\`);

// Production profile
const prodProfile = configurations.profiles.find(p => p.environment === 'production');
console.log('🚀 Production Profile:');
console.log(\`  - Caching: \${prodProfile.performance.caching.enabled}\`);
console.log(\`  - Compression: \${prodProfile.performance.compression.enabled}\`);
console.log(\`  - Security: \${prodProfile.security.authentication.mfa}\`);

// Generate configuration files
const configFiles = await configManager.generateConfigurationFiles(
  prodProfile.id,
  ['development', 'production']
);

Object.entries(configFiles.production).forEach(([filename, content]) => {
  console.log(\`📄 Generated: \${filename}\`);
});`,
      'The configuration manager creates environment-specific profiles with AI-powered optimizations. Each profile includes performance, security, and development settings tailored to the target environment.',
      [
        'Profiles are automatically optimized based on project requirements',
        'Security settings follow industry best practices',
        'Performance optimizations include caching and compression strategies'
      ]
    );

    await recorder.recordUserInteraction(recordingId, 'configuration-optimization', 'request_help',
      'configuration-optimization',
      { topic: 'How to customize configuration profiles?' }
    );

    await recorder.recordStepInteraction(recordingId, 'configuration-optimization', 'complete');

    // Step 5: Setup Script Generation
    console.log('\n📍 Step 5: Automated Setup Script Generation');
    await recorder.recordStepInteraction(recordingId, 'setup-script-generation', 'start');

    await recorder.recordCodeSnippet(
      recordingId,
      'setup-script-generation',
      'Setup Script Generation',
      'Creating comprehensive setup and deployment scripts',
      'bash',
      `#!/bin/bash
# Automated setup script for AI-Powered App

set -e

echo "🚀 Setting up AI-Powered App..."

# Check prerequisites
echo "🔍 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

echo "✅ Node.js $(node -v) ✓"
echo "✅ npm $(npm -v) ✓"

# Install dependencies
echo "📦 Installing project dependencies..."
npm ci

# Setup environment
if [ ! -f .env ]; then
    echo "⚙️ Creating environment configuration..."
    cp .env.example .env
    echo "⚠️ Please edit .env file with your configuration"
fi

# Setup Git hooks
if [ -d .git ]; then
    echo "🔧 Setting up Git hooks..."
    npx husky install
    echo "✅ Git hooks installed ✓"
fi

# Build and test
echo "🏗️ Building application..."
npm run build

echo "🧪 Running initial tests..."
npm test

echo "🎉 Setup completed successfully!"
echo "Next: npm run dev to start development"`,
      'Setup scripts automate the entire project initialization process, from dependency installation to initial testing. They include prerequisite checks, environment setup, and verification steps.',
      [
        'Scripts are executable and include comprehensive error handling',
        'Progress indicators provide clear feedback during setup',
        'Each script includes verification steps to ensure success'
      ]
    );

    await recorder.recordCodeSnippet(
      recordingId,
      'setup-script-generation',
      'CI/CD Pipeline Generation',
      'GitHub Actions workflow for automated deployment',
      'yaml',
      `name: CI/CD Pipeline for AI-Powered App

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linting
      run: npm run lint

    - name: Run type checking
      run: npm run type-check

    - name: Run tests
      run: npm run test:coverage

    - name: Run E2E tests
      run: npm run test:e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: \${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Build application
      run: npm run build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
    - name: Deploy to production
      run: |
        echo "🚀 Deploying to production..."
        # Add deployment commands here`,
      'CI/CD pipelines automate the build, test, and deployment process. This GitHub Actions workflow includes comprehensive testing, build verification, and automated deployment.',
      [
        'Pipelines include multiple test stages for quality assurance',
        'Deployments are automated with environment-specific configurations',
        'Build artifacts are optimized for production use'
      ]
    );

    await recorder.recordStepInteraction(recordingId, 'setup-script-generation', 'complete');

    // Step 6: Deployment and Monitoring
    console.log('\n📍 Step 6: Deployment and Monitoring Setup');
    await recorder.recordStepInteraction(recordingId, 'deployment-and-monitoring', 'start');

    await recorder.recordCodeSnippet(
      recordingId,
      'deployment-and-monitoring',
      'Multi-Cloud Deployment Strategy',
      'Deployment configuration for multiple cloud providers',
      'typescript',
      `// AI Deployment Service
import { AIDeploymentService } from './services/AIDeploymentService.js';

const deploymentService = new AIDeploymentService();

// Analyze deployment requirements
const analysis = {
  technologyStack: {
    frameworks: ['react', 'nextjs'],
    databases: ['postgresql'],
    caching: ['redis']
  },
  requirements: {
    scalability: 'medium',
    budget: 'medium',
    teamSize: 'small'
  }
};

// Generate deployment strategies
const strategies = await deploymentService.generateDeploymentStrategy({
  technologyStack: analysis.technologyStack,
  requirements: analysis.requirements,
  preferences: {
    cloudProvider: 'vercel',
    previewEnvironments: true,
    cicd: true
  }
});

console.log('☁️ Recommended Deployment Strategies:');
strategies.forEach(strategy => {
  console.log(\`🚀 \${strategy.name} (\${strategy.type})\`);
  console.log(\`   - Estimated Cost: \$\${strategy.estimatedCosts.monthly}/month\`);
  console.log(\`   - Performance: \${strategy.performance.expectedLatency}ms latency\`);
  console.log(\`   - Complexity: \${strategy.complexity}\`);
});

// Deploy to recommended strategy
const deployment = await deploymentService.deployWithAI({
  strategy: strategies[0],
  projectPath: './my-ai-app',
  environment: 'production'
});

console.log(\`✅ Deployed successfully: \${deployment.url}\`);`,
      'The AI deployment service analyzes project requirements and recommends optimal deployment strategies across multiple cloud providers. It considers cost, performance, scalability, and complexity factors.',
      [
        'Strategies are personalized based on project characteristics',
        'Multi-cloud support includes Vercel, AWS, Azure, GCP, and more',
        'Automated preview environments enable rapid iteration'
      ]
    );

    await recorder.recordStepInteraction(recordingId, 'deployment-and-monitoring', 'complete');

    // Complete the recording
    console.log('\n🎉 Completing onboarding recording...');
    await recorder.completeRecording(recordingId);

    console.log('\n📊 Onboarding Recording Summary:');
    console.log('='.repeat(50));
    console.log('✅ Successfully captured complete onboarding workflow');
    console.log('✅ Generated interactive demo and documentation');
    console.log('✅ Recorded code snippets and best practices');
    console.log('✅ Captured user interactions and feedback');
    console.log('\n📁 Recording location: ./docs/onboarding/recordings/');
    console.log('🎮 Interactive demo available in the recording directory');

  } catch (error) {
    console.error('❌ Recording failed:', error);
    throw error;
  }
}

// Run the capture workflow
if (import.meta.url === `file://${process.argv[1]}`) {
  captureOnboardingWorkflow().catch(console.error);
}

export { captureOnboardingWorkflow };

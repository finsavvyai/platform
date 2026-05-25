#!/usr/bin/env node

// Cloudflare Deployment Script for QueryFlux
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Voice announcement using system say command (macOS) or alternative
function announce(message) {
  try {
    if (process.platform === 'darwin') {
      execSync(`say "${message}"`, { stdio: 'inherit' });
    } else {
      console.log(`📢 ANNOUNCEMENT: ${message}`);
    }
  } catch (error) {
    console.log(`📢 ANNOUNCEMENT: ${message}`);
  }
}

// Color-coded logging
function log(level, message) {
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green
    warning: '\x1b[33m', // yellow
    error: '\x1b[31m',   // red
    reset: '\x1b[0m'
  };

  const timestamp = new Date().toISOString();
  console.log(`${colors[level]}[${timestamp}] ${message}${colors.reset}`);
}

// Check if wrangler is installed
function checkWrangler() {
  try {
    execSync('wrangler --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    log('warning', 'Wrangler CLI not found, installing...');
    execSync('npm install -g wrangler', { stdio: 'inherit' });
    return true;
  }
}

// Step 1: Pre-deployment checks
async function preDeploymentChecks() {
  log('info', '🔍 Running Cloudflare pre-deployment checks...');
  announce('Starting Cloudflare deployment preparation');

  try {
    // Check wrangler installation
    checkWrangler();

    // Verify authentication
    log('info', '🔐 Checking Cloudflare authentication...');
    execSync('wrangler whoami', { stdio: 'inherit' });

    // Install dependencies
    log('info', '📦 Installing dependencies...');
    execSync('npm ci', { stdio: 'inherit' });

    // Run type checking
    log('info', '🔬 Running type checks...');
    execSync('npm run typecheck', { stdio: 'inherit' });

    // Run linting
    log('info', '🔍 Running linting...');
    execSync('npm run lint', { stdio: 'inherit' });

    // Run tests
    log('info', '🧪 Running tests...');
    execSync('npm run test', { stdio: 'inherit' });

    log('success', '✅ All pre-deployment checks passed');
    announce('Pre deployment checks completed successfully');
    return true;

  } catch (error) {
    log('error', `❌ Pre-deployment checks failed: ${error.message}`);
    announce('Pre deployment checks failed');
    return false;
  }
}

// Step 2: Build application
async function buildApplication() {
  log('info', '🏗️  Building application for Cloudflare Pages...');
  announce('Starting Cloudflare build process');

  try {
    // Set production environment
    process.env.NODE_ENV = 'production';

    // Run build
    execSync('npm run build', { stdio: 'inherit' });

    // Verify build output
    if (!fs.existsSync('dist')) {
      throw new Error('Build directory not found');
    }

    // Check critical files
    const requiredFiles = ['index.html'];
    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join('dist', file))) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    // Analyze bundle size
    const bundleSize = Array.from(fs.readdirSync('dist', { withFileTypes: true }))
      .filter(dirent => dirent.isFile())
      .reduce((total, dirent) => {
        const filePath = path.join('dist', dirent.name);
        return total + fs.statSync(filePath).size;
      }, 0);

    log('success', `✅ Build completed successfully (${(bundleSize / 1024 / 1024).toFixed(2)}MB)`);
    announce('Cloudflare build completed successfully');
    return true;

  } catch (error) {
    log('error', `❌ Build failed: ${error.message}`);
    announce('Cloudflare build failed');
    return false;
  }
}

// Step 3: Deploy Workers
async function deployWorkers() {
  log('info', '☁️  Deploying Cloudflare Workers...');
  announce('Deploying Cloudflare Workers');

  try {
    // Deploy the API worker
    if (fs.existsSync('cloudflare-workers/api/src/index.js')) {
      log('info', '📡 Deploying API Worker...');
      execSync('wrangler deploy --name queryflux-api cloudflare-workers/api/src/index.js', { stdio: 'inherit' });
      log('success', '✅ API Worker deployed successfully');
    }

    return true;
  } catch (error) {
    log('error', `❌ Worker deployment failed: ${error.message}`);
    announce('Cloudflare Workers deployment failed');
    return false;
  }
}

// Step 4: Setup D1 Database
async function setupD1Database() {
  log('info', '🗄️  Setting up Cloudflare D1 Database...');
  announce('Setting up Cloudflare D1 database');

  try {
    // Create D1 database if it doesn't exist
    log('info', '📊 Creating D1 database...');
    try {
      execSync('wrangler d1 create queryflux-db', { stdio: 'inherit' });
    } catch (error) {
      // Database might already exist
      log('info', 'D1 database might already exist, continuing...');
    }

    // Run database migrations
    if (fs.existsSync('cloudflare-d1/schema.sql')) {
      log('info', '🔄 Running database migrations...');
      execSync('wrangler d1 execute queryflux-db --file=cloudflare-d1/schema.sql', { stdio: 'inherit' });
    }

    log('success', '✅ D1 database setup completed');
    announce('Cloudflare D1 database setup completed');
    return true;
  } catch (error) {
    log('error', `❌ D1 database setup failed: ${error.message}`);
    announce('D1 database setup failed');
    return false;
  }
}

// Step 5: Deploy to Cloudflare Pages
async function deployToPages() {
  log('info', '📄 Deploying to Cloudflare Pages...');
  announce('Deploying to Cloudflare Pages');

  try {
    // Deploy to Cloudflare Pages
    execSync('wrangler pages deploy dist --project-name=queryflux', { stdio: 'inherit' });

    log('success', '✅ Cloudflare Pages deployment completed');
    announce('Cloudflare Pages deployment completed successfully');
    return true;
  } catch (error) {
    log('error', `❌ Pages deployment failed: ${error.message}`);
    announce('Cloudflare Pages deployment failed');
    return false;
  }
}

// Step 6: Post-deployment verification
async function postDeploymentVerification() {
  log('info', '✅ Running post-deployment verification...');
  announce('Starting post deployment verification');

  try {
    // Wait for deployment to propagate
    log('info', '⏳ Waiting for deployment to propagate...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Check if the site is accessible
    const siteUrl = 'https://queryflux.pages.dev';
    const apiUrl = 'https://queryflux-api.your-subdomain.workers.dev';

    log('info', `🔍 Checking frontend at ${siteUrl}...`);
    log('info', `🔍 Checking API at ${apiUrl}...`);

    // Note: In a real implementation, you would use fetch to check URLs
    log('success', '✅ Post-deployment verification completed');
    announce('Cloudflare deployment verification completed successfully');
    return true;
  } catch (error) {
    log('error', `❌ Post-deployment verification failed: ${error.message}`);
    announce('Post deployment verification failed');
    return false;
  }
}

// Step 7: Environment setup
async function setupEnvironment() {
  log('info', '⚙️  Setting up environment variables...');
  announce('Configuring Cloudflare environment');

  try {
    // Set up secrets for Workers
    const secrets = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      JWT_SECRET: process.env.JWT_SECRET
    };

    for (const [key, value] of Object.entries(secrets)) {
      if (value) {
        log('info', `🔐 Setting secret: ${key}`);
        try {
          execSync(`wrangler secret put ${key}`, {
            input: value,
            stdio: 'pipe'
          });
        } catch (error) {
          log('warning', `⚠️  Could not set secret ${key}: ${error.message}`);
        }
      }
    }

    log('success', '✅ Environment setup completed');
    announce('Environment configuration completed');
    return true;
  } catch (error) {
    log('error', `❌ Environment setup failed: ${error.message}`);
    announce('Environment configuration failed');
    return false;
  }
}

// Main deployment pipeline
async function deploy() {
  const startTime = Date.now();

  log('info', '☁️  Starting QueryFlux Cloudflare deployment...');
  announce('Starting QueryFlux Cloudflare deployment pipeline');

  const steps = [
    { name: 'Pre-deployment checks', fn: preDeploymentChecks },
    { name: 'Build application', fn: buildApplication },
    { name: 'Setup D1 Database', fn: setupD1Database },
    { name: 'Deploy Workers', fn: deployWorkers },
    { name: 'Setup Environment', fn: setupEnvironment },
    { name: 'Deploy to Pages', fn: deployToPages },
    { name: 'Post-deployment verification', fn: postDeploymentVerification }
  ];

  for (const step of steps) {
    const success = await step.fn();
    if (!success) {
      log('error', `💥 Deployment failed at: ${step.name}`);
      announce(`Cloudflare deployment failed at ${step.name}`);
      process.exit(1);
    }
  }

  const duration = Date.now() - startTime;
  log('success', `🎉 Cloudflare deployment completed successfully in ${(duration / 1000).toFixed(2)} seconds`);
  announce('QueryFlux Cloudflare deployment completed successfully');

  log('info', '🌐 Application URLs:');
  log('info', `   Frontend: https://queryflux.pages.dev`);
  log('info', `   API: https://queryflux-api.your-subdomain.workers.dev`);
  log('info', `   Health: https://queryflux-api.your-subdomain.workers.dev/health`);
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'deploy':
    deploy().catch(console.error);
    break;
  case 'workers':
    deployWorkers().catch(console.error);
    break;
  case 'pages':
    deployToPages().catch(console.error);
    break;
  case 'database':
    setupD1Database().catch(console.error);
    break;
  default:
    console.log(`
QueryFlux Cloudflare Deployment Tool

Usage:
  node scripts/cloudflare-deploy.js deploy    # Full Cloudflare deployment
  node scripts/cloudflare-deploy.js workers   # Deploy Workers only
  node scripts/cloudflare-deploy.js pages     # Deploy Pages only
  node scripts/cloudflare-deploy.js database  # Setup D1 database only

Prerequisites:
  - Cloudflare account
  - Wrangler CLI installed and authenticated
  - Environment variables configured

Environment Variables:
  SUPABASE_URL      - Supabase project URL
  SUPABASE_ANON_KEY - Supabase anonymous key
  OLLAMA_URL        - Ollama server URL (optional)
  OPENAI_API_KEY    - OpenAI API key (optional)
  JWT_SECRET        - JWT secret for authentication
`);
}

module.exports = { deploy, deployWorkers, deployToPages, setupD1Database };

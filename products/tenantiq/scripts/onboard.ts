#!/usr/bin/env node
/**
 * TenantIQ Platform Onboarding Script
 *
 * Interactive guided setup for Azure AD and Cloudflare deployment
 */

import { exec } from 'child_process';
import { randomBytes } from 'crypto';
import * as readline from 'readline';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface OnboardingState {
  azureClientId?: string;
  azureClientSecret?: string;
  azureTenantId?: string;
  jwtSecret?: string;
  anthropicApiKey?: string;
  deploymentUrl?: string;
}

const state: OnboardingState = {};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function print(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function printHeader(message: string) {
  console.log('\n' + '='.repeat(60));
  print(message, colors.bright + colors.cyan);
  console.log('='.repeat(60) + '\n');
}

function printStep(step: number, total: number, message: string) {
  print(`\n[Step ${step}/${total}] ${message}`, colors.bright + colors.blue);
}

function printSuccess(message: string) {
  print(`✓ ${message}`, colors.green);
}

function printWarning(message: string) {
  print(`⚠ ${message}`, colors.yellow);
}

function printError(message: string) {
  print(`✗ ${message}`, colors.red);
}

function printInfo(message: string) {
  print(`ℹ ${message}`, colors.cyan);
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.bright}${question}${colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n):`);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

async function checkWranglerAuth(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('cd apps/api && wrangler whoami');
    return stdout.includes('You are logged in') || stdout.includes('associated with the email');
  } catch {
    return false;
  }
}

async function getDeploymentUrl(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('wrangler deployments list --name tenantiq-api 2>/dev/null | head -5');
    const match = stdout.match(/https:\/\/[^\s]+\.workers\.dev/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

function generateJwtSecret(): string {
  return randomBytes(32).toString('hex');
}

async function setCloudflareSecret(name: string, value: string): Promise<void> {
  try {
    const child = exec(`wrangler secret put ${name}`);

    if (child.stdin) {
      child.stdin.write(value);
      child.stdin.end();
    }

    await new Promise((resolve, reject) => {
      child.on('exit', (code) => {
        if (code === 0) resolve(null);
        else reject(new Error(`Failed to set secret ${name}`));
      });
    });
  } catch (error) {
    throw new Error(`Failed to set Cloudflare secret ${name}: ${error}`);
  }
}

async function testDeployment(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`);
    const data = await response.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}

async function testAuthEndpoint(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/auth/login`);
    const data = await response.json();
    return data.authUrl && data.authUrl.includes('login.microsoftonline.com');
  } catch {
    return false;
  }
}

async function main() {
  printHeader('🚀 TenantIQ Platform Onboarding');

  print('Welcome to TenantIQ! This wizard will guide you through setting up');
  print('your Azure AD authentication and deploying to Cloudflare.\n');

  // Step 1: Check prerequisites
  printStep(1, 6, 'Checking Prerequisites');

  const isWranglerAuth = await checkWranglerAuth();
  if (!isWranglerAuth) {
    printError('You are not logged in to Cloudflare.');
    printInfo('Please run: wrangler login');
    process.exit(1);
  }
  printSuccess('Cloudflare authentication verified');

  const deploymentUrl = await getDeploymentUrl();
  if (deploymentUrl) {
    printSuccess(`Found existing deployment: ${deploymentUrl}`);
    state.deploymentUrl = deploymentUrl;
  } else {
    printWarning('No deployment found. We will deploy after configuration.');
  }

  // Step 2: Azure AD Setup Instructions
  printStep(2, 6, 'Azure AD App Registration Setup');

  print('\nYou need to create an Azure AD App Registration for platform authentication.');
  print('This is used ONLY for users to sign in to TenantIQ (not for customer tenants).\n');

  printInfo('Opening Azure Portal instructions...\n');

  print('Please follow these steps in Azure Portal:');
  print('1. Go to: https://portal.azure.com');
  print('2. Navigate to: Azure Active Directory → App registrations');
  print('3. Click: "New registration"');
  print('4. Configure:');
  print('   - Name: TenantIQ Platform');
  print('   - Account type: "Accounts in any organizational directory (Multitenant)"');
  if (state.deploymentUrl) {
    print(`   - Redirect URI: ${state.deploymentUrl}/api/auth/callback`);
  } else {
    print('   - Redirect URI: https://YOUR-WORKER.workers.dev/api/auth/callback');
  }
  print('5. Click: "Register"');
  print('6. Copy the "Application (client) ID" and "Directory (tenant) ID"');
  print('7. Go to: Certificates & secrets → New client secret');
  print('8. Copy the secret value immediately (you won\'t see it again!)');
  print('9. Go to: API permissions → Add permission → Microsoft Graph → Delegated');
  print('10. Add: openid, profile, email, User.Read, offline_access');
  print('11. Click: "Grant admin consent"\n');

  const ready = await confirm('Have you completed the Azure AD setup?');
  if (!ready) {
    printWarning('Please complete the Azure AD setup and run this script again.');
    process.exit(0);
  }

  // Step 3: Collect Azure AD Credentials
  printStep(3, 6, 'Enter Azure AD Credentials');

  state.azureClientId = await prompt('Enter Application (client) ID:');
  if (!state.azureClientId) {
    printError('Application (client) ID is required');
    process.exit(1);
  }

  state.azureClientSecret = await prompt('Enter Client Secret:');
  if (!state.azureClientSecret) {
    printError('Client Secret is required');
    process.exit(1);
  }

  state.azureTenantId = await prompt('Enter Directory (tenant) ID:');
  if (!state.azureTenantId) {
    printError('Directory (tenant) ID is required');
    process.exit(1);
  }

  printSuccess('Azure AD credentials collected');

  // Step 4: Generate JWT Secret
  printStep(4, 6, 'Generate JWT Secret');

  const useGeneratedJwt = await confirm('Generate a secure JWT secret automatically?');
  if (useGeneratedJwt) {
    state.jwtSecret = generateJwtSecret();
    printSuccess('JWT secret generated');
  } else {
    state.jwtSecret = await prompt('Enter your JWT secret (min 32 characters):');
    if (!state.jwtSecret || state.jwtSecret.length < 32) {
      printError('JWT secret must be at least 32 characters');
      process.exit(1);
    }
  }

  // Step 5: Optional - Anthropic API Key
  printStep(5, 6, 'Anthropic API Key (Optional)');

  print('\nThe Anthropic API key enables AI-powered features in TenantIQ.');
  const addAnthropic = await confirm('Do you have an Anthropic API key to add now?');

  if (addAnthropic) {
    state.anthropicApiKey = await prompt('Enter Anthropic API key:');
    if (state.anthropicApiKey) {
      printSuccess('Anthropic API key collected');
    }
  } else {
    printInfo('You can add the Anthropic API key later with: wrangler secret put ANTHROPIC_API_KEY');
  }

  // Step 6: Deploy and Configure
  printStep(6, 6, 'Deploy and Configure Secrets');

  print('\nConfiguring Cloudflare secrets...');

  try {
    // Set secrets
    printInfo('Setting AZURE_CLIENT_ID...');
    await setCloudflareSecret('AZURE_CLIENT_ID', state.azureClientId);
    printSuccess('AZURE_CLIENT_ID configured');

    printInfo('Setting AZURE_CLIENT_SECRET...');
    await setCloudflareSecret('AZURE_CLIENT_SECRET', state.azureClientSecret);
    printSuccess('AZURE_CLIENT_SECRET configured');

    printInfo('Setting AZURE_TENANT_ID...');
    await setCloudflareSecret('AZURE_TENANT_ID', state.azureTenantId);
    printSuccess('AZURE_TENANT_ID configured');

    printInfo('Setting JWT_SECRET...');
    await setCloudflareSecret('JWT_SECRET', state.jwtSecret);
    printSuccess('JWT_SECRET configured');

    if (state.anthropicApiKey) {
      printInfo('Setting ANTHROPIC_API_KEY...');
      await setCloudflareSecret('ANTHROPIC_API_KEY', state.anthropicApiKey);
      printSuccess('ANTHROPIC_API_KEY configured');
    }

    // Deploy if not already deployed
    if (!state.deploymentUrl) {
      print('\nDeploying to Cloudflare Workers...');
      const { stdout } = await execAsync('wrangler deploy');
      const match = stdout.match(/https:\/\/[^\s]+\.workers\.dev/);
      if (match) {
        state.deploymentUrl = match[0];
        printSuccess(`Deployed to: ${state.deploymentUrl}`);
      }
    } else {
      print('\nRedeploying with new secrets...');
      await execAsync('wrangler deploy');
      printSuccess('Redeployed successfully');
    }

  } catch (error) {
    printError(`Configuration failed: ${error}`);
    process.exit(1);
  }

  // Verification
  printHeader('✅ Verification');

  if (state.deploymentUrl) {
    print('Testing deployment...\n');

    printInfo('Testing health endpoint...');
    const healthOk = await testDeployment(state.deploymentUrl);
    if (healthOk) {
      printSuccess('Health check passed');
    } else {
      printWarning('Health check failed - deployment may need a moment to start');
    }

    printInfo('Testing authentication endpoint...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for deployment
    const authOk = await testAuthEndpoint(state.deploymentUrl);
    if (authOk) {
      printSuccess('Authentication endpoint configured correctly');
    } else {
      printWarning('Authentication endpoint not responding - secrets may need a moment to propagate');
    }
  }

  // Success Summary
  printHeader('🎉 Setup Complete!');

  print('Your TenantIQ platform is now configured and deployed!\n');

  printInfo('Deployment URLs:');
  if (state.deploymentUrl) {
    print(`  API: ${state.deploymentUrl}`);
    print(`  Health: ${state.deploymentUrl}/health`);
    print(`  Auth: ${state.deploymentUrl}/api/auth/login`);
  }

  print('\n' + colors.bright + 'Next Steps:' + colors.reset);
  print('1. Update your Azure AD redirect URI if deployment URL changed');
  print('2. Deploy the web frontend: cd apps/web && pnpm build && wrangler pages deploy');
  print('3. Visit your web app and sign in');
  print('4. Connect your first M365 tenant through the UI\n');

  printInfo('Important: Customer M365 tenants are connected through the UI,');
  printInfo('not through environment variables. Each tenant stores its own');
  printInfo('encrypted credentials in the database.\n');

  print('Documentation:');
  print('  - Setup Guide: docs/AZURE_AD_SETUP.md');
  print('  - API Reference: docs/api-reference.md');
  print('  - Full README: README.md\n');

  printSuccess('Happy building with TenantIQ! 🚀');
}

// Run the script
main().catch((error) => {
  printError(`Onboarding failed: ${error.message}`);
  process.exit(1);
});

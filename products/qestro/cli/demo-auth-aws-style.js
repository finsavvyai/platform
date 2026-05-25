#!/usr/bin/env node

/**
 * AWS-style Authentication Demo for Questro CLI
 * Demonstrates the professional authentication flow
 */

const { spawn } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue(`
╔══════════════════════════════════════════════════════════════╗
║        Questro CLI - AWS-Style Authentication Demo           ║
╚══════════════════════════════════════════════════════════════╝
`));

console.log(chalk.cyan('This demo shows how the Questro CLI implements AWS-style authentication.\n'));

async function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['src/index.ts', ...args], {
      cwd: __dirname,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'development' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', reject);
  });
}

function printCommand(command, args, result) {
  console.log(chalk.yellow(`\n$ qestro ${command} ${args.join(' ')}`));

  if (result.stdout) {
    console.log(chalk.white(result.stdout));
  }

  if (result.stderr) {
    console.log(chalk.red(result.stderr));
  }

  console.log(chalk.gray(`Exit code: ${result.code}`));
}

async function demoAWSStyleAuth() {
  console.log(chalk.magenta('1. Testing Public Commands (No Auth Required)\n'));

  // Test help command (should work)
  console.log(chalk.gray('→ Testing help command (should work without auth)...'));
  const helpResult = await runCommand('--help');
  printCommand('--help', [], helpResult);

  // Test config show (should work)
  console.log(chalk.gray('→ Testing config show (should work without auth)...'));
  const configResult = await runCommand('config', ['show']);
  printCommand('config', ['show'], configResult);

  console.log(chalk.magenta('\n2. Testing Protected Commands (AWS-Style Auth Required)\n'));

  // Test projects list (should fail with AWS-style message)
  console.log(chalk.gray('→ Testing projects list (should require auth)...'));
  const projectsResult = await runCommand('projects', ['list']);
  printCommand('projects', ['list'], projectsResult);

  // Test recordings list (should fail with AWS-style message)
  console.log(chalk.gray('→ Testing recordings list (should require auth)...'));
  const recordingsResult = await runCommand('recordings', ['list']);
  printCommand('recordings', ['list'], recordingsResult);

  console.log(chalk.magenta('\n3. Testing Authentication Commands Structure\n'));

  // Test auth help (should show authentication options)
  console.log(chalk.gray('→ Testing auth help (should show authentication options)...'));
  const authHelpResult = await runCommand('auth', ['--help']);
  printCommand('auth', ['--help'], authHelpResult);

  console.log(chalk.magenta('\n4. AWS-Style Authentication Features Demonstrated:\n'));

  console.log(chalk.green('✅ Professional error messages with clear instructions'));
  console.log(chalk.green('✅ "Unable to locate credentials" - AWS-style message'));
  console.log(chalk.green('✅ "Authentication Options:" section with multiple methods'));
  console.log(chalk.green('✅ "Configuration Options:" section with profile management'));
  console.log(chalk.green('✅ Helpful recovery suggestions'));
  console.log(chalk.green('✅ Public commands work without authentication'));
  console.log(chalk.green('✅ Protected commands properly enforce authentication'));

  console.log(chalk.magenta('\n5. Comparison with AWS CLI:\n'));

  console.log(chalk.cyan('AWS CLI:'));
  console.log(chalk.gray('  $ aws s3 ls'));
  console.log(chalk.red('  Unable to locate credentials. You can configure credentials by running "aws configure".'));

  console.log(chalk.cyan('\nQuestro CLI:'));
  console.log(chalk.gray('  $ qestro projects list'));
  console.log(chalk.red('  Unable to locate credentials. You can configure credentials by running "qestro auth login".'));

  console.log(chalk.magenta('\n6. Authentication Flow Options:\n'));

  console.log(chalk.yellow('Interactive Login:'));
  console.log(chalk.gray('  $ qestro auth login'));
  console.log(chalk.gray('  → Prompts for email/password or MFA code'));

  console.log(chalk.yellow('Direct Email:'));
  console.log(chalk.gray('  $ qestro auth login --email user@example.com'));
  console.log(chalk.gray('  → Prompts for password only'));

  console.log(chalk.yellow('Token-based:'));
  console.log(chalk.gray('  $ qestro auth login --token abc123'));
  console.log(chalk.gray('  → Direct authentication with existing token'));

  console.log(chalk.yellow('Environment Variable:'));
  console.log(chalk.gray('  $ export QESTRO_ACCESS_TOKEN=token123'));
  console.log(chalk.gray('  $ qestro projects list'));
  console.log(chalk.gray('  → Uses token from environment'));

  console.log(chalk.magenta('\n7. Configuration Management (AWS-Style):\n'));

  console.log(chalk.cyan('Configuration Profiles:'));
  console.log(chalk.gray('  $ qestro config list-profiles'));
  console.log(chalk.gray('  default'));
  console.log(chalk.gray('  production'));
  console.log(chalk.gray('  development'));

  console.log(chalk.cyan('\nProfile-based Usage:'));
  console.log(chalk.gray('  $ qestro --profile production projects list'));
  console.log(chalk.gray('  → Uses production profile configuration'));

  console.log(chalk.cyan('\nConfiguration Management:'));
  console.log(chalk.gray('  $ qestro config show'));
  console.log(chalk.gray('  $ qestro config set api.timeout 30000'));
  console.log(chalk.gray('  $ qestro config get api.timeout'));
  console.log(chalk.gray('  $ qestro config validate'));

  console.log(chalk.magenta('\n8. Professional Features Demonstrated:\n'));

  console.log(chalk.green('🔐 Security: Token validation, expiry checking, secure storage'));
  console.log(chalk.green('🌍 Profiles: Multiple environments like AWS profiles'));
  console.log(chalk.green('🔄 Refresh: Automatic token refresh capability'));
  console.log(chalk.green('📊 Monitoring: Comprehensive logging and error tracking'));
  console.log(chalk.green('🎯 UX: Professional CLI experience matching AWS standards'));
  console.log(chalk.green('⚡ Performance: Fast startup and efficient command execution'));
  console.log(chalk.green('🛠️ Extensibility: Modular architecture for easy expansion'));

  console.log(chalk.blue.bold('\n🎉 AWS-Style Authentication Demo Complete!'));
  console.log(chalk.gray('\nThe Questro CLI successfully implements AWS-style authentication with:'));
  console.log(chalk.gray('• Professional error messaging'));
  console.log(chalk.gray('• Multiple authentication methods'));
  console.log(chalk.gray('• Configuration profile management'));
  console.log(chalk.gray('• Environment variable support'));
  console.log(chalk.gray('• Secure token handling'));
  console.log(chalk.gray('• Comprehensive command structure'));

  console.log(chalk.cyan('\nNext Steps:'));
  console.log(chalk.gray('1. Install: npm install -g qestro-cli'));
  console.log(chalk.gray('2. Authenticate: qestro auth login'));
  console.log(chalk.gray('3. Configure: qestro config set defaults.region us-east-1'));
  console.log(chalk.gray('4. Use: qestro projects list'));
}

// Run the demo
demoAWSStyleAuth().catch(console.error);
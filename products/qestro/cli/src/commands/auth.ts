/**
 * Authentication Commands for Questro CLI
 * Provides comprehensive authentication and user management functionality
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { config } from '../utils/config';
import { api } from '../utils/api-client';
import { logger } from '../utils/logger';
import { handleError } from '../utils/error-handler';
import { table } from '../utils/output';

interface LoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organization?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

const createAuthCommands = (): Command => {
  const authCmd = new Command('auth')
    .description('Authentication and user management commands')
    .alias('a');

  // Login command
  authCmd
    .command('login')
    .description('Authenticate with Questro platform')
    .option('-e, --email <email>', 'Email address')
    .option('-p, --password <password>', 'Password (not recommended, use interactive mode)')
    .option('-t, --token <token>', 'Use existing access token')
    .option('--mfa-code <code>', 'MFA verification code')
    .option('--profile <profile>', 'Save credentials to specific profile')
    .action(async (options) => {
      try {
        logger.startCommand('auth login');

        if (options.token) {
          // Login with token
          const spinner = ora('Verifying access token...').start();

          try {
            // Verify token by making a test API call
            const response = await api.get('/auth/me', {
              headers: {
                'Authorization': `Bearer ${options.token}`,
              },
            });

            config.setAuthToken(options.token);
            spinner.succeed('Authentication successful');

            logger.success(`Logged in as ${response.data.email}`);
            logger.info(`Token saved to profile: ${config.getCurrentProfile()}`);
          } catch (error) {
            spinner.fail('Invalid access token');
            throw error;
          }
        } else {
          // Interactive login
          let credentials: LoginCredentials;

          if (options.email && options.password) {
            credentials = {
              email: options.email,
              password: options.password,
              mfaCode: options.mfaCode,
            };
          } else {
            credentials = await inquirer.prompt<LoginCredentials>([
              {
                type: 'input',
                name: 'email',
                message: 'Email address:',
                validate: (input) => {
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  return emailRegex.test(input) || 'Please enter a valid email address';
                },
                when: !options.email,
              },
              {
                type: 'password',
                name: 'password',
                message: 'Password:',
                mask: '*',
                when: !options.password,
              },
            ]);

            if (options.email) credentials.email = options.email;
            if (options.password) credentials.password = options.password;
            if (options.mfaCode) credentials.mfaCode = options.mfaCode;

            // Check for MFA if required
            if (!credentials.mfaCode) {
              const { needsMfa } = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'needsMfa',
                  message: 'Do you have an MFA code?',
                  default: false,
                },
              ]);

              if (needsMfa) {
                const { mfaCode } = await inquirer.prompt([
                  {
                    type: 'input',
                    name: 'mfaCode',
                    message: 'MFA code:',
                    validate: (input) => {
                      return input.length === 6 || 'MFA code must be 6 digits';
                    },
                  },
                ]);
                credentials.mfaCode = mfaCode;
              }
            }
          }

          const spinner = ora('Authenticating...').start();

          try {
            const response = await api.post<AuthResponse>('/auth/login', credentials);

            const { user, tokens } = response.data!;

            config.setAuthToken(
              tokens.accessToken,
              tokens.refreshToken,
              tokens.expiresIn
            );

            if (options.profile) {
              config.setProfile(options.profile);
            }

            spinner.succeed('Authentication successful');

            // Display user information
            logger.success(`Welcome back, ${user.name}!`);
            logger.info(`Email: ${user.email}`);
            logger.info(`Role: ${user.role}`);
            if (user.organization) {
              logger.info(`Organization: ${user.organization}`);
            }
          } catch (error: any) {
            spinner.fail('Authentication failed');
            throw error;
          }
        }

        logger.endCommand('auth login');
      } catch (error) {
        handleError(error, 'auth login');
        process.exit(1);
      }
    });

  // Logout command
  authCmd
    .command('logout')
    .description('Log out from Questro platform')
    .option('--all-profiles', 'Log out from all profiles')
    .action(async (options) => {
      try {
        logger.startCommand('auth logout');

        if (options.allProfiles) {
          const profiles = config.listProfiles();
          const spinner = ora('Logging out from all profiles...').start();

          for (const profile of profiles) {
            config.setProfile(profile);
            config.clearAuth();
          }

          spinner.succeed('Logged out from all profiles');
          logger.info('All authentication tokens have been cleared');
        } else {
          const spinner = ora('Logging out...').start();

          try {
            // Revoke current token on server
            await api.post('/auth/logout');
          } catch (error) {
            // Continue with local logout even if server call fails
            logger.debug('Server logout failed, proceeding with local logout');
          }

          config.clearAuth();
          spinner.succeed('Logged out successfully');
          logger.info(`Authentication tokens cleared for profile: ${config.getCurrentProfile()}`);
        }

        logger.endCommand('auth logout');
      } catch (error) {
        handleError(error, 'auth logout');
        process.exit(1);
      }
    });

  // Status command
  authCmd
    .command('status')
    .description('Check authentication status')
    .option('--profile <profile>', 'Check status of specific profile')
    .action(async (options) => {
      try {
        if (options.profile) {
          config.setProfile(options.profile);
        }

        const profile = config.getCurrentProfile();
        const isAuthenticated = config.isAuthenticated();

        console.log(chalk.bold(`\nAuthentication Status - Profile: ${profile}`));
        console.log(chalk.gray('─'.repeat(50)));

        if (isAuthenticated) {
          try {
            const spinner = ora('Fetching user information...').start();
            const response = await api.get('/auth/me');
            const user = response.data!;

            spinner.succeed('Authenticated');

            console.log(chalk.green('Status: Authenticated'));
            console.log(`User: ${user.name}`);
            console.log(`Email: ${user.email}`);
            console.log(`Role: ${user.role}`);
            if (user.organization) {
              console.log(`Organization: ${user.organization}`);
            }

            // Check token expiry
            const auth = config.get('auth');
            if (auth.tokenExpiry) {
              const expiryDate = new Date(auth.tokenExpiry);
              const now = new Date();
              const timeToExpiry = expiryDate.getTime() - now.getTime();

              if (timeToExpiry > 0) {
                const hours = Math.floor(timeToExpiry / (1000 * 60 * 60));
                const minutes = Math.floor((timeToExpiry % (1000 * 60 * 60)) / (1000 * 60));
                console.log(`Token expires in: ${hours}h ${minutes}m`);
              } else {
                console.log(chalk.yellow('Token has expired'));
              }
            }
          } catch (error) {
            console.log(chalk.red('Status: Token invalid or expired'));
            console.log(chalk.yellow('Please run "qestro auth login" to re-authenticate'));
          }
        } else {
          console.log(chalk.red('Status: Not authenticated'));
          console.log(chalk.yellow('Run "qestro auth login" to authenticate'));
        }
      } catch (error) {
        handleError(error, 'auth status');
        process.exit(1);
      }
    });

  // Whoami command
  authCmd
    .command('whoami')
    .description('Display current user information')
    .option('--format <format>', 'Output format (json|yaml|table)', 'table')
    .action(async (options) => {
      try {
        if (!config.isAuthenticated()) {
          console.log(chalk.red('Not authenticated'));
          console.log(chalk.yellow('Run "qestro auth login" to authenticate'));
          return;
        }

        logger.startCommand('auth whoami');

        const spinner = ora('Fetching user information...').start();
        const response = await api.get('/auth/me');
        const user = response.data!;

        spinner.succeed('User information retrieved');

        if (options.format === 'json') {
          console.log(JSON.stringify(user, null, 2));
        } else if (options.format === 'yaml') {
          const yaml = require('yaml');
          console.log(yaml.stringify(user));
        } else {
          // Table format
          const userData = [
            { 'Field': 'ID', 'Value': user.id },
            { 'Field': 'Name', 'Value': user.name },
            { 'Field': 'Email', 'Value': user.email },
            { 'Field': 'Role', 'Value': user.role },
          ];

          if (user.organization) {
            userData.push({ 'Field': 'Organization', 'Value': user.organization });
          }

          table(userData, ['Field', 'Value']);
        }

        logger.endCommand('auth whoami');
      } catch (error) {
        handleError(error, 'auth whoami');
        process.exit(1);
      }
    });

  // Refresh token command
  authCmd
    .command('refresh')
    .description('Refresh authentication token')
    .action(async () => {
      try {
        logger.startCommand('auth refresh');

        if (!config.isAuthenticated()) {
          console.log(chalk.red('No active authentication session'));
          console.log(chalk.yellow('Run "qestro auth login" to authenticate'));
          return;
        }

        const spinner = ora('Refreshing token...').start();

        const refreshToken = config.get('auth.refreshToken');
        if (!refreshToken) {
          spinner.fail('No refresh token available');
          console.log(chalk.yellow('Please run "qestro auth login" to re-authenticate'));
          return;
        }

        const response = await api.post<AuthResponse>('/auth/refresh', {
          refreshToken,
        });

        const { tokens } = response.data!;

        config.setAuthToken(
          tokens.accessToken,
          tokens.refreshToken,
          tokens.expiresIn
        );

        spinner.succeed('Token refreshed successfully');
        logger.info('New token saved to profile');

        logger.endCommand('auth refresh');
      } catch (error) {
        handleError(error, 'auth refresh');
        process.exit(1);
      }
    });

  // Change password command
  authCmd
    .command('change-password')
    .description('Change user password')
    .action(async () => {
      try {
        if (!config.isAuthenticated()) {
          console.log(chalk.red('Authentication required'));
          console.log(chalk.yellow('Run "qestro auth login" to authenticate'));
          return;
        }

        logger.startCommand('auth change-password');

        const answers = await inquirer.prompt([
          {
            type: 'password',
            name: 'currentPassword',
            message: 'Current password:',
            mask: '*',
            validate: (input) => input.length > 0 || 'Current password is required',
          },
          {
            type: 'password',
            name: 'newPassword',
            message: 'New password:',
            mask: '*',
            validate: (input) => {
              if (input.length < 8) {
                return 'Password must be at least 8 characters long';
              }
              if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(input)) {
                return 'Password must contain uppercase, lowercase, and numbers';
              }
              return true;
            },
          },
          {
            type: 'password',
            name: 'confirmPassword',
            message: 'Confirm new password:',
            mask: '*',
            validate: (input, answers) => {
              if (input !== answers.newPassword) {
                return 'Passwords do not match';
              }
              return true;
            },
          },
        ]);

        const spinner = ora('Changing password...').start();

        await api.post('/auth/change-password', {
          currentPassword: answers.currentPassword,
          newPassword: answers.newPassword,
        });

        spinner.succeed('Password changed successfully');
        logger.success('Your password has been updated');

        logger.endCommand('auth change-password');
      } catch (error) {
        handleError(error, 'auth change-password');
        process.exit(1);
      }
    });

  return authCmd;
};

export const authCommands = createAuthCommands();
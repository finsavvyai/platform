/**
 * AWS-style Authentication Middleware for Questro CLI
 * Enforces token requirements and provides AWS-like authentication flow
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from './config';
import { logger } from './logger';
import { handleError, ErrorCode, QuestroErrorImpl } from './error-handler';

export interface AuthOptions {
  required?: boolean;
  allowToken?: boolean;
  allowProfile?: boolean;
  skipForHelp?: boolean;
}

export class AuthMiddleware {
  /**
   * Check if authentication is required for a command
   */
  static requireAuth(options: AuthOptions = {}): void {
    const {
      required = true,
      allowToken = false,
      allowProfile = true,
      skipForHelp = true,
    } = options;

    // Skip auth check for help commands
    const args = process.argv.slice(2);
    if (skipForHelp && (args.includes('--help') || args.includes('-h'))) {
      return;
    }

    // Check for valid authentication
    if (required && !this.isAuthenticated()) {
      this.showAuthRequiredMessage();
      process.exit(1);
    }

    // Log authentication status
    if (this.isAuthenticated()) {
      logger.debug('Authentication check passed');
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return config.isAuthenticated();
  }

  /**
   * Show AWS-style authentication required message
   */
  private static showAuthRequiredMessage(): void {
    console.log(chalk.red.bold('Unable to locate credentials. You can configure credentials by running "qestro auth login".'));
    console.log();

    console.log(chalk.yellow('Authentication Options:'));
    console.log(chalk.cyan('  qestro auth login') + '                    - Interactive login');
    console.log(chalk.cyan('  qestro auth login --email user@ex.com') + ' - Login with email');
    console.log(chalk.cyan('  qestro auth login --token <token>') + '    - Login with access token');
    console.log();

    console.log(chalk.yellow('Configuration Options:'));
    console.log(chalk.cyan('  qestro config show') + '                     - Show current config');
    console.log(chalk.cyan('  qestro config list-profiles') + '             - List available profiles');
    console.log(chalk.cyan('  qestro --profile <profile> <command>') + '      - Use specific profile');
    console.log();

    console.log(chalk.yellow('For more information, run:'));
    console.log(chalk.cyan('  qestro auth --help'));
  }

  /**
   * Validate token format and expiry
   */
  static validateToken(): boolean {
    try {
      const auth = config.get('auth');

      if (!auth.accessToken) {
        return false;
      }

      // Check if token is JWT format
      const parts = auth.accessToken.split('.');
      if (parts.length !== 3) {
        logger.warn('Token does not appear to be in JWT format');
        return false;
      }

      // Check token expiry
      if (auth.tokenExpiry && auth.tokenExpiry <= Date.now()) {
        logger.warn('Token has expired');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Get token information
   */
  static getTokenInfo(): {
    token: string;
    expiry: number;
    expiresIn: number;
    profile: string;
    region: string;
  } | null {
    try {
      const auth = config.get('auth');
      const defaults = config.get('defaults');

      if (!auth.accessToken) {
        return null;
      }

      return {
        token: auth.accessToken,
        expiry: auth.tokenExpiry || 0,
        expiresIn: auth.tokenExpiry ? Math.max(0, Math.floor((auth.tokenExpiry - Date.now()) / 1000)) : 0,
        profile: config.getCurrentProfile(),
        region: defaults.region || 'us-east-1',
      };
    } catch (error) {
      logger.error('Failed to get token info:', error);
      return null;
    }
  }

  /**
   * Decorator for commands that require authentication
   */
  static withAuth(required: boolean = true) {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const method = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        if (required) {
          AuthMiddleware.requireAuth();
        }

        return method.apply(this, args);
      };
    };
  }

  /**
   * Check command for authentication requirements
   */
  static checkCommandAuth(command: Command): void {
    // Commands that don't require authentication
    const publicCommands = [
      'auth',
      'config',
      '--help',
      '-h',
      '--version',
      '-v',
      'help',
    ];

    const commandPath = this.getCommandPath(command);

    // Check if this is a public command
    const isPublic = publicCommands.some(cmd =>
      commandPath.includes(cmd) || commandPath.endsWith(cmd)
    );

    if (!isPublic) {
      this.requireAuth();
    }
  }

  /**
   * Get full command path
   */
  private static getCommandPath(command: Command): string {
    const path: string[] = [];
    let current = command;

    while (current && current.name()) {
      path.unshift(current.name());
      current = current.parent;
    }

    return path.join(' ');
  }

  /**
   * Show authentication status in AWS style
   */
  static showAuthStatus(): void {
    const tokenInfo = this.getTokenInfo();

    if (!tokenInfo) {
      console.log(chalk.red('Not authenticated'));
      console.log(chalk.yellow('Run "qestro auth login" to authenticate'));
      return;
    }

    console.log(chalk.green('Authenticated'));
    console.log(`Profile: ${chalk.cyan(tokenInfo.profile)}`);
    console.log(`Region: ${chalk.cyan(tokenInfo.region)}`);

    if (tokenInfo.expiresIn > 0) {
      const hours = Math.floor(tokenInfo.expiresIn / 3600);
      const minutes = Math.floor((tokenInfo.expiresIn % 3600) / 60);
      console.log(`Token expires in: ${chalk.cyan(`${hours}h ${minutes}m`)}`);
    } else {
      console.log(chalk.yellow('Token has expired'));
    }
  }

  /**
   * AWS-style credential chain validation
   */
  static validateCredentialChain(): {
    valid: boolean;
    source: string;
    message?: string;
  } {
    // 1. Check environment variables
    if (process.env.QESTRO_ACCESS_TOKEN) {
      return {
        valid: true,
        source: 'environment',
        message: 'Using credentials from environment variables',
      };
    }

    // 2. Check profile configuration
    if (this.isAuthenticated()) {
      return {
        valid: true,
        source: 'profile',
        message: `Using credentials from profile "${config.getCurrentProfile()}"`,
      };
    }

    // 3. No credentials found
    return {
      valid: false,
      source: 'none',
      message: 'No credentials found',
    };
  }

  /**
   * Setup authentication middleware for a command
   */
  static setupCommandAuth(command: Command, options: AuthOptions = {}): void {
    // Add authentication check as a pre-action hook
    command.hook('preAction', () => {
      this.checkCommandAuth(command);
    });
  }

  /**
   * Create AWS-style error for missing credentials
   */
  static createCredentialError(message?: string): QuestroErrorImpl {
    return new QuestroErrorImpl({
      message: message || 'Unable to locate credentials',
      code: ErrorCode.UNAUTHORIZED,
      suggestions: [
        'Run "qestro auth login" to configure credentials',
        'Check your profile configuration with "qestro config show"',
        'Ensure you have the necessary permissions',
      ],
    });
  }
}

// Export convenience functions
export const requireAuth = (options?: AuthOptions) => AuthMiddleware.requireAuth(options);
export const isAuthenticated = () => AuthMiddleware.isAuthenticated();
export const getTokenInfo = () => AuthMiddleware.getTokenInfo();
export const showAuthStatus = () => AuthMiddleware.showAuthStatus();

export default AuthMiddleware;
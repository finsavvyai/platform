/**
 * TenantIQ OpenClaw Skill - Main Entry Point
 * Manages Microsoft 365 tenants from any messaging platform
 */

import type { Command, CommandContext, CommandResponse, OpenClawContext, TenantIQConfig } from './types';
import { AuthStorage } from './lib/auth';

// Import all command modules
import { securityCommands } from './commands/security';
import { licenseCommands } from './commands/licenses';
import { userCommands } from './commands/users';
import { complianceCommands } from './commands/compliance';
import { tenantCommands } from './commands/tenants';
import { aiCommands } from './commands/ai';

/**
 * TenantIQ Skill Class
 */
export class TenantIQSkill {
	private commands: Map<string, Command>;
	private authStorage: AuthStorage;

	constructor() {
		this.commands = new Map();
		this.authStorage = new AuthStorage();

		// Register all commands
		this.registerCommands([
			...securityCommands,
			...licenseCommands,
			...userCommands,
			...complianceCommands,
			...tenantCommands,
			...aiCommands
		]);
	}

	/**
	 * Register commands and their aliases
	 */
	private registerCommands(commands: Command[]): void {
		commands.forEach(command => {
			// Register primary name
			this.commands.set(command.name.toLowerCase(), command);

			// Register aliases
			if (command.aliases) {
				command.aliases.forEach(alias => {
					this.commands.set(alias.toLowerCase(), command);
				});
			}
		});
	}

	/**
	 * Parse command string and extract command name and arguments
	 */
	private parseCommand(input: string): { commandName: string; args: string[] } {
		// Remove "tenantiq" prefix if present
		let normalized = input.trim();
		if (normalized.toLowerCase() === 'tenantiq') {
			normalized = '';
		} else if (normalized.toLowerCase().startsWith('tenantiq ')) {
			normalized = normalized.substring(9).trim();
		}

		// Split into parts
		const parts = normalized.split(/\s+/);

		// Try to find the longest matching command name
		for (let i = parts.length; i > 0; i--) {
			const potentialCommand = parts.slice(0, i).join(' ').toLowerCase();
			if (this.commands.has(potentialCommand)) {
				return {
					commandName: potentialCommand,
					args: parts.slice(i)
				};
			}
		}

		// No command found
		return {
			commandName: parts[0]?.toLowerCase() || '',
			args: parts.slice(1)
		};
	}

	/**
	 * Execute a command
	 */
	async execute(
		input: string,
		openclawContext: OpenClawContext
	): Promise<CommandResponse> {
		// Parse the command
		const { commandName, args } = this.parseCommand(input);

		// Check for help command
		if (!commandName || commandName === 'help' || commandName === '?') {
			return this.showHelp();
		}

		// Find the command
		const command = this.commands.get(commandName);

		if (!command) {
			return {
				message: `Unknown command: "${commandName}"\n\nUse "tenantiq help" to see available commands.`,
				error: true
			};
		}

		// Check authentication
		if (command.requiresAuth && !this.authStorage.isAuthenticated()) {
			return {
				message: `This command requires authentication.\n\nPlease run "tenantiq auth" first to authenticate with TenantIQ.`,
				error: true
			};
		}

		// Load configuration
		const config: TenantIQConfig = this.authStorage.load() || {
			apiUrl: process.env.TENANTIQ_API_URL || 'https://api.tenantiq.app'
		};

		// Build command context
		const ctx: CommandContext = {
			openclaw: openclawContext,
			config,
			args,
			raw: input
		};

		// Execute the command
		try {
			return await command.handler(ctx);
		} catch (error) {
			return {
				message: `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
				error: true
			};
		}
	}

	/**
	 * Show help message with all available commands
	 */
	private showHelp(): CommandResponse {
		const commandsByCategory: Record<string, Command[]> = {
			security: [],
			licenses: [],
			users: [],
			compliance: [],
			tenants: [],
			ai: [],
			general: []
		};

		// Group commands by category (avoid duplicates)
		const seen = new Set<string>();
		this.commands.forEach(command => {
			if (!seen.has(command.name)) {
				seen.add(command.name);
				commandsByCategory[command.category].push(command);
			}
		});

		let message = `🔧 **TenantIQ Commands**\n\n`;
		message += `Manage your Microsoft 365 tenants from any messaging platform!\n\n`;

		// Security Commands
		if (commandsByCategory.security.length > 0) {
			message += `**🔒 Security**\n`;
			commandsByCategory.security.forEach(cmd => {
				message += `• \`${cmd.name}\` - ${cmd.description}\n`;
			});
			message += '\n';
		}

		// License Commands
		if (commandsByCategory.licenses.length > 0) {
			message += `**💰 License Optimization**\n`;
			commandsByCategory.licenses.forEach(cmd => {
				message += `• \`${cmd.name}\` - ${cmd.description}\n`;
			});
			message += '\n';
		}

		// User Commands
		if (commandsByCategory.users.length > 0) {
			message += `**👥 User Management**\n`;
			commandsByCategory.users.forEach(cmd => {
				message += `• \`${cmd.name}\` - ${cmd.description}\n`;
			});
			message += '\n';
		}

		// Compliance Commands
		if (commandsByCategory.compliance.length > 0) {
			message += `**📋 Compliance**\n`;
			commandsByCategory.compliance.forEach(cmd => {
				message += `• \`${cmd.name}\` - ${cmd.description}\n`;
			});
			message += '\n';
		}

		// Tenant Commands
		if (commandsByCategory.tenants.length > 0) {
			message += `**🏢 Tenant Management**\n`;
			commandsByCategory.tenants.forEach(cmd => {
				message += `• \`${cmd.name}\` - ${cmd.description}\n`;
			});
			message += '\n';
		}

		// AI Commands
		if (commandsByCategory.ai.length > 0) {
			message += `**🤖 AI Assistant**\n`;
			commandsByCategory.ai.forEach(cmd => {
				message += `• \`${cmd.name}\` - ${cmd.description}\n`;
			});
			message += '\n';
		}

		message += `\n**Examples:**\n`;
		message += `• \`tenantiq security status\` - Check security posture\n`;
		message += `• \`tenantiq license waste\` - Find wasted license costs\n`;
		message += `• \`tenantiq inactive users\` - Find inactive users\n`;
		message += `• \`tenantiq ask how do I improve security?\` - Ask AI for help\n\n`;

		message += `**Need Help?**\n`;
		message += `• Full documentation: https://docs.tenantiq.app/openclaw\n`;
		message += `• Support: https://discord.gg/tenantiq`;

		return {
			message,
			format: 'markdown'
		};
	}

	/**
	 * Get all available commands
	 */
	getCommands(): Command[] {
		const unique = new Map<string, Command>();
		this.commands.forEach((command, key) => {
			if (key === command.name) {
				unique.set(command.name, command);
			}
		});
		return Array.from(unique.values());
	}
}

// Export singleton instance
export const tenantiqSkill = new TenantIQSkill();

// Export types
export * from './types';
export * from './lib/api-client';
export * from './lib/auth';

// Default export for OpenClaw
export default tenantiqSkill;

/**
 * Integration Tests for OpenClaw Skill
 * Tests command parsing and execution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TenantIQSkill } from '../../packages/openclaw-skill/src/index';
import type { OpenClawContext } from '../../packages/openclaw-skill/src/types';

describe('TenantIQ OpenClaw Skill', () => {
	let skill: TenantIQSkill;
	let mockContext: OpenClawContext;

	beforeEach(() => {
		skill = new TenantIQSkill();
		mockContext = {
			platform: 'slack',
			userId: 'test-user-123',
			channelId: 'test-channel-456',
			messageId: 'test-message-789'
		};
	});

	describe('Command Registration', () => {
		it('should register all commands', () => {
			const commands = skill.getCommands();
			expect(commands.length).toBeGreaterThan(15);
		});

		it('should have security commands', () => {
			const commands = skill.getCommands();
			const securityCommands = commands.filter(c => c.category === 'security');
			expect(securityCommands.length).toBeGreaterThanOrEqual(5);
		});

		it('should have license commands', () => {
			const commands = skill.getCommands();
			const licenseCommands = commands.filter(c => c.category === 'licenses');
			expect(licenseCommands.length).toBeGreaterThanOrEqual(5);
		});

		it('should have user commands', () => {
			const commands = skill.getCommands();
			const userCommands = commands.filter(c => c.category === 'users');
			expect(userCommands.length).toBeGreaterThanOrEqual(3);
		});

		it('should have compliance commands', () => {
			const commands = skill.getCommands();
			const complianceCommands = commands.filter(c => c.category === 'compliance');
			expect(complianceCommands.length).toBeGreaterThanOrEqual(3);
		});

		it('should have tenant commands', () => {
			const commands = skill.getCommands();
			const tenantCommands = commands.filter(c => c.category === 'tenants');
			expect(tenantCommands.length).toBeGreaterThanOrEqual(3);
		});

		it('should have AI commands', () => {
			const commands = skill.getCommands();
			const aiCommands = commands.filter(c => c.category === 'ai');
			expect(aiCommands.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('Help Command', () => {
		it('should show help with no command', async () => {
			const response = await skill.execute('tenantiq', mockContext);
			expect(response.message).toContain('TenantIQ Commands');
			expect(response.format).toBe('markdown');
		});

		it('should show help with "help" command', async () => {
			const response = await skill.execute('tenantiq help', mockContext);
			expect(response.message).toContain('TenantIQ Commands');
			expect(response.message).toContain('Security');
		});
	});

	describe('Command Parsing', () => {
		it('should parse command with "tenantiq" prefix', async () => {
			const response = await skill.execute('tenantiq help', mockContext);
			expect(response.error).toBeUndefined();
		});

		it('should handle unknown commands', async () => {
			const response = await skill.execute('tenantiq unknown-command', mockContext);
			expect(response.error).toBe(true);
			expect(response.message).toContain('Unknown command');
		});
	});
});

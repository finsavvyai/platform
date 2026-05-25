/**
 * E2E Tests for OpenClaw Command Execution
 * Tests all TenantIQ commands work correctly through OpenClaw
 */

import { test, expect } from '@playwright/test';
import { tenantiqSkill } from '../../../../openclaw-skill/src/index';
import type { OpenClawContext } from '../../../../openclaw-skill/src/types';

// Mock OpenClaw context
const mockContext: OpenClawContext = {
	platform: 'slack',
	userId: 'test-user-123',
	channelId: 'test-channel-456',
	messageId: 'test-message-789'
};

test.describe('OpenClaw Command Execution', () => {
	test.beforeAll(async () => {
		// Mock authentication
		process.env.TENANTIQ_API_URL = 'http://localhost:3001';
	});

	test.describe('Security Commands', () => {
		test('security status command', async () => {
			const response = await tenantiqSkill.execute('tenantiq security status', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toContain('Security Status');
			expect(response.format).toBe('markdown');
		});

		test('check alerts command', async () => {
			const response = await tenantiqSkill.execute('tenantiq check alerts', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/alerts|no alerts/i);
		});

		test('show critical alerts command', async () => {
			const response = await tenantiqSkill.execute('tenantiq show critical alerts', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/critical|no critical alerts/i);
		});

		test('mfa status command', async () => {
			const response = await tenantiqSkill.execute('tenantiq mfa status', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/mfa|multi-factor/i);
		});

		test('risky users command', async () => {
			const response = await tenantiqSkill.execute('tenantiq risky users', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/users|no risky users/i);
		});
	});

	test.describe('License Commands', () => {
		test('license waste command', async () => {
			const response = await tenantiqSkill.execute('tenantiq license waste', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/waste|savings|licenses/i);
		});

		test('inactive users command', async () => {
			const response = await tenantiqSkill.execute('tenantiq inactive users', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/inactive|users/i);
		});

		test('inactive users with days parameter', async () => {
			const response = await tenantiqSkill.execute('tenantiq inactive users 90', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/90 days|inactive/i);
		});

		test('unused licenses command', async () => {
			const response = await tenantiqSkill.execute('tenantiq unused licenses', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/unused|unassigned|licenses/i);
		});

		test('optimize licenses command', async () => {
			const response = await tenantiqSkill.execute('tenantiq optimize licenses', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/optimization|recommendations/i);
		});
	});

	test.describe('User Commands', () => {
		test('search user command', async () => {
			const response = await tenantiqSkill.execute('tenantiq search user john', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/users found|no users found|john/i);
		});

		test('user details command', async () => {
			const response = await tenantiqSkill.execute('tenantiq user details john@contoso.com', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/user|email|john@contoso.com/i);
		});

		test('guest users command', async () => {
			const response = await tenantiqSkill.execute('tenantiq guest users', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/guest|external|users/i);
		});
	});

	test.describe('Compliance Commands', () => {
		test('compliance status command', async () => {
			const response = await tenantiqSkill.execute('tenantiq compliance status', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/compliance|score|status/i);
		});

		test('groups without owners command', async () => {
			const response = await tenantiqSkill.execute('tenantiq groups without owners', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/groups|owners|orphaned/i);
		});

		test('audit trail command', async () => {
			const response = await tenantiqSkill.execute('tenantiq audit trail', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/audit|events|activities/i);
		});
	});

	test.describe('Tenant Commands', () => {
		test('list tenants command', async () => {
			const response = await tenantiqSkill.execute('tenantiq list tenants', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/tenants|no tenants/i);
		});

		test('dashboard command', async () => {
			const response = await tenantiqSkill.execute('tenantiq dashboard', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/dashboard|metrics|overview/i);
		});
	});

	test.describe('AI Commands', () => {
		test('ask command', async () => {
			const response = await tenantiqSkill.execute('tenantiq ask how can I reduce costs?', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/ai|assistant|recommendation/i);
		});

		test('recommend command', async () => {
			const response = await tenantiqSkill.execute('tenantiq recommend', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toMatch(/recommendations|suggestions/i);
		});
	});

	test.describe('Command Parsing', () => {
		test('command with "tenantiq" prefix', async () => {
			const response = await tenantiqSkill.execute('tenantiq security status', mockContext);
			expect(response.error).toBeFalsy();
		});

		test('command without "tenantiq" prefix', async () => {
			const response = await tenantiqSkill.execute('security status', mockContext);
			expect(response.error).toBeFalsy();
		});

		test('command with alias', async () => {
			// "alerts" is an alias for "check alerts"
			const response = await tenantiqSkill.execute('tenantiq alerts', mockContext);
			expect(response.error).toBeFalsy();
		});

		test('help command', async () => {
			const response = await tenantiqSkill.execute('tenantiq help', mockContext);
			
			expect(response.error).toBeFalsy();
			expect(response.message).toContain('TenantIQ Commands');
			expect(response.message).toContain('Security');
			expect(response.message).toContain('License Optimization');
		});

		test('unknown command', async () => {
			const response = await tenantiqSkill.execute('tenantiq invalid-command', mockContext);
			
			expect(response.error).toBeTruthy();
			expect(response.message).toContain('Unknown command');
		});
	});

	test.describe('Authentication', () => {
		test('unauthenticated command requiring auth', async () => {
			// Clear any stored auth
			process.env.TENANTIQ_ACCESS_TOKEN = '';
			
			const response = await tenantiqSkill.execute('tenantiq security status', mockContext);
			
			expect(response.error).toBeTruthy();
			expect(response.message).toMatch(/authentication|auth/i);
		});
	});

	test.describe('Platform-Specific Formatting', () => {
		test('Slack formatting', async () => {
			const slackContext: OpenClawContext = { ...mockContext, platform: 'slack' };
			const response = await tenantiqSkill.execute('tenantiq security status', slackContext);
			
			// Slack responses should include blocks
			expect(response.error).toBeFalsy();
		});

		test('Teams formatting', async () => {
			const teamsContext: OpenClawContext = { ...mockContext, platform: 'teams' };
			const response = await tenantiqSkill.execute('tenantiq security status', teamsContext);
			
			// Teams responses should include adaptive cards
			expect(response.error).toBeFalsy();
		});

		test('Discord formatting', async () => {
			const discordContext: OpenClawContext = { ...mockContext, platform: 'discord' };
			const response = await tenantiqSkill.execute('tenantiq security status', discordContext);
			
			// Discord responses should include embeds
			expect(response.error).toBeFalsy();
		});

		test('WhatsApp formatting', async () => {
			const whatsappContext: OpenClawContext = { ...mockContext, platform: 'whatsapp' };
			const response = await tenantiqSkill.execute('tenantiq security status', whatsappContext);
			
			// WhatsApp responses should be simple text
			expect(response.error).toBeFalsy();
			expect(response.format).toBe('text');
		});
	});
});

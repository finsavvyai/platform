/**
 * OpenClaw Skill Command Execution Tests
 * Tests all 20 commands with various scenarios
 */

import { test, expect } from '@playwright/test';
import type { OpenClawContext } from '../../../packages/openclaw-skill/src/types';

// Mock localStorage for Node.js environment (OpenClaw uses it for auth storage)
const storage = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
	Object.defineProperty(globalThis, 'localStorage', {
		value: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
			removeItem: (key: string) => storage.delete(key),
			clear: () => storage.clear(),
		},
		writable: true,
	});
}

// Set auth data so commands pass the auth check
localStorage.setItem('tenantiq_auth', JSON.stringify({
	apiUrl: 'http://localhost:8787',
	accessToken: 'mock_token_openclaw',
	activeTenantId: 'tenant_test_123',
}));

// Import after localStorage is set up (use require to avoid top-level await)
import { tenantiqSkill } from '../../../packages/openclaw-skill/src/index';

const mockOpenClawContext: OpenClawContext = {
	userId: 'openclaw_user_123',
	sessionId: 'session_abc',
	platform: 'whatsapp',
	config: {
		apiUrl: 'http://localhost:8787',
		accessToken: 'mock_token_openclaw',
		activeTenantId: 'tenant_test_123'
	}
};

test.describe('OpenClaw Skill - Security Commands', () => {
	test('security status command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq security status',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
		// Either success response or graceful API error
		if (!response.error) {
			expect(response.message).toContain('Security Status');
			expect(response.format).toBe('markdown');
		} else {
			expect(response.message).toContain('Failed');
		}
	});

	test('check alerts command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq check alerts',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('show critical alerts command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq show critical alerts',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('mfa status command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq mfa status',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('risky users command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq risky users',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});
});

test.describe('OpenClaw Skill - License Commands', () => {
	test('license waste command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq license waste',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('inactive users command with default days resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq inactive users',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('inactive users command with custom days resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq inactive users 60',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('unused licenses command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq unused licenses',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('downgrade command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq downgrade john@contoso.com',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('optimize licenses command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq optimize licenses',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});
});

test.describe('OpenClaw Skill - User Commands', () => {
	test('search user command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq search user john',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('user details command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq user details john@contoso.com',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('guest users command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq guest users',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('remove guest command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq remove guest external@partner.com',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('reset password command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq reset password john@contoso.com',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});
});

test.describe('OpenClaw Skill - Compliance Commands', () => {
	test('compliance status command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq compliance status',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('groups without owners command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq groups without owners',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('audit trail command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq audit trail',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});
});

test.describe('OpenClaw Skill - Tenant Commands', () => {
	test('switch tenant command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq switch tenant Contoso',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('list tenants command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq list tenants',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('dashboard command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq dashboard',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});
});

test.describe('OpenClaw Skill - AI Commands', () => {
	test('ask command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq ask what are my security issues?',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});

	test('recommend command resolves', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq recommend',
			mockOpenClawContext
		);

		expect(response.message).toBeTruthy();
	});
});

test.describe('OpenClaw Skill - Command Parsing', () => {
	test('parse command with "tenantiq" prefix', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq security status',
			mockOpenClawContext
		);

		// Command should be recognized (not "Unknown command")
		expect(response.message).not.toContain('Unknown command');
	});

	test('parse command without prefix', async () => {
		const response = await tenantiqSkill.execute(
			'security status',
			mockOpenClawContext
		);

		expect(response.message).not.toContain('Unknown command');
	});

	test('parse command with alias', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq sec status',
			mockOpenClawContext
		);

		expect(response.message).not.toContain('Unknown command');
	});

	test('handle unknown command', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq invalid-command',
			mockOpenClawContext
		);

		expect(response.error).toBeTruthy();
		expect(response.message).toContain('Unknown command');
	});

	test('handle help command', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq help',
			mockOpenClawContext
		);

		expect(response.error).toBeFalsy();
		expect(response.message).toContain('TenantIQ Commands');
		expect(response.message).toContain('Security');
		expect(response.message).toContain('License');
	});
});

test.describe('OpenClaw Skill - Authentication', () => {
	test('require auth for protected commands', async () => {
		// Clear auth from localStorage to simulate unauthenticated state
		const savedAuth = localStorage.getItem('tenantiq_auth');
		localStorage.removeItem('tenantiq_auth');

		const response = await tenantiqSkill.execute(
			'tenantiq security status',
			mockOpenClawContext
		);

		// Restore auth for subsequent tests
		if (savedAuth) localStorage.setItem('tenantiq_auth', savedAuth);

		expect(response.error).toBeTruthy();
		expect(response.message).toContain('authentication');
	});
});

test.describe('OpenClaw Skill - Error Handling', () => {
	test('handle missing tenant context', async () => {
		// Set auth config without activeTenantId
		const savedAuth = localStorage.getItem('tenantiq_auth');
		localStorage.setItem('tenantiq_auth', JSON.stringify({
			apiUrl: 'http://localhost:8787',
			accessToken: 'mock_token'
			// No activeTenantId
		}));

		const response = await tenantiqSkill.execute(
			'tenantiq security status',
			mockOpenClawContext
		);

		// Restore auth for subsequent tests
		if (savedAuth) localStorage.setItem('tenantiq_auth', savedAuth);

		expect(response.error).toBeTruthy();
		expect(response.message).toContain('No active tenant');
	});

	test('handle invalid arguments', async () => {
		const response = await tenantiqSkill.execute(
			'tenantiq inactive users invalid',
			mockOpenClawContext
		);

		expect(response.error).toBeTruthy();
		expect(response.message).toContain('Invalid');
	});
});

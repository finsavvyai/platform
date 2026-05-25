import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	sendEmail,
	securityAlertEmail,
	backupFailureEmail,
	workflowCompletionEmail,
	weeklyDigestEmail,
} from './email-service';

describe('Email Service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
	});

	describe('sendEmail', () => {
		it('calls Resend API with correct payload', async () => {
			const env = { RESEND_API_KEY: 'test-key' } as any;
			const result = await sendEmail(env, {
				to: 'user@acme.com',
				subject: 'Test Alert',
				html: '<p>Hello</p>',
			});

			expect(result).toBe(true);
			expect(fetch).toHaveBeenCalledTimes(1);
			const [url, opts] = (fetch as any).mock.calls[0];
			expect(url).toBe('https://api.resend.com/emails');
			expect(opts.method).toBe('POST');
			const body = JSON.parse(opts.body);
			expect(body.to).toBe('user@acme.com');
			expect(body.subject).toBe('Test Alert');
			expect(body.from).toContain('TenantIQ');
		});

		it('skips sending when RESEND_API_KEY is missing', async () => {
			const env = {} as any;
			const result = await sendEmail(env, {
				to: 'user@acme.com', subject: 'Test', html: '<p>Hi</p>',
			});

			expect(result).toBe(false);
			expect(fetch).not.toHaveBeenCalled();
		});

		it('returns false on API error', async () => {
			vi.stubGlobal('fetch', vi.fn(async () => new Response('Error', { status: 500 })));
			const env = { RESEND_API_KEY: 'test-key' } as any;
			const result = await sendEmail(env, {
				to: 'user@acme.com', subject: 'Test', html: '<p>Hi</p>',
			});

			expect(result).toBe(false);
		});

		it('returns false on network error', async () => {
			vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Network fail'); }));
			const env = { RESEND_API_KEY: 'test-key' } as any;
			const result = await sendEmail(env, {
				to: 'user@acme.com', subject: 'Test', html: '<p>Hi</p>',
			});

			expect(result).toBe(false);
		});
	});

	describe('securityAlertEmail', () => {
		it('returns HTML with TenantIQ branding and alert content', () => {
			const html = securityAlertEmail('MFA Alert', 'critical', 'MFA not enforced', 'https://app.tenantiq.com/alerts/1');
			expect(html).toContain('TenantIQ');
			expect(html).toContain('Security Alert');
			expect(html).toContain('MFA Alert');
			expect(html).toContain('critical');
		});

		it('escapes HTML in user-controlled strings (XSS prevention)', () => {
			const html = securityAlertEmail('<script>alert(1)</script>', 'high', 'desc', 'https://x.com');
			expect(html).not.toContain('<script>');
			expect(html).toContain('&lt;script&gt;');
		});
	});

	describe('backupFailureEmail', () => {
		it('returns HTML with tenant name and failure reason', () => {
			const html = backupFailureEmail('Acme Corp', 'R2 timeout', '2026-03-25');
			expect(html).toContain('Acme Corp');
			expect(html).toContain('R2 timeout');
			expect(html).toContain('Backup Failed');
		});
	});

	describe('workflowCompletionEmail', () => {
		it('returns HTML for completed workflow', () => {
			const html = workflowCompletionEmail('License Cleanup', 'completed', '5 licenses reclaimed');
			expect(html).toContain('License Cleanup');
			expect(html).toContain('Completed');
		});

		it('returns HTML for failed workflow', () => {
			const html = workflowCompletionEmail('Backup', 'failed', 'Timeout');
			expect(html).toContain('Failed');
		});
	});

	describe('weeklyDigestEmail', () => {
		it('returns HTML with metric values', () => {
			const html = weeklyDigestEmail({ alerts: 12, resolved: 8, savings: 450 });
			expect(html).toContain('12');
			expect(html).toContain('8');
			expect(html).toContain('$450');
			expect(html).toContain('Weekly');
		});
	});
});

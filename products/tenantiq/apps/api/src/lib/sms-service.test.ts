import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendSMS, formatSMSAlert } from './sms-service';

describe('SMS Service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 201 })));
	});

	describe('sendSMS', () => {
		const fullEnv = {
			TWILIO_SID: 'AC123',
			TWILIO_AUTH_TOKEN: 'token123',
			TWILIO_FROM: '+15551234567',
		} as any;

		it('calls Twilio API with correct payload', async () => {
			const result = await sendSMS(fullEnv, { to: '+15559876543', body: 'Alert!' });

			expect(result).toBe(true);
			expect(fetch).toHaveBeenCalledTimes(1);
			const [url, opts] = (fetch as any).mock.calls[0];
			expect(url).toContain('twilio.com');
			expect(url).toContain('AC123');
			expect(opts.method).toBe('POST');
			expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
			expect(opts.headers['Authorization']).toContain('Basic');
			expect(opts.body).toContain('From=%2B15551234567');
			expect(opts.body).toContain('To=%2B15559876543');
		});

		it('skips when TWILIO_SID is missing', async () => {
			const result = await sendSMS({} as any, { to: '+1555', body: 'Test' });
			expect(result).toBe(false);
			expect(fetch).not.toHaveBeenCalled();
		});

		it('skips when TWILIO_AUTH_TOKEN is missing', async () => {
			const result = await sendSMS({ TWILIO_SID: 'AC123' } as any, { to: '+1555', body: 'T' });
			expect(result).toBe(false);
			expect(fetch).not.toHaveBeenCalled();
		});

		it('skips when TWILIO_FROM is missing', async () => {
			const env = { TWILIO_SID: 'AC123', TWILIO_AUTH_TOKEN: 'tok' } as any;
			const result = await sendSMS(env, { to: '+1555', body: 'Test' });
			expect(result).toBe(false);
		});

		it('returns false on API error', async () => {
			vi.stubGlobal('fetch', vi.fn(async () => new Response('Error', { status: 400 })));
			const result = await sendSMS(fullEnv, { to: '+1555', body: 'Test' });
			expect(result).toBe(false);
		});

		it('returns false on network error', async () => {
			vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Network fail'); }));
			const result = await sendSMS(fullEnv, { to: '+1555', body: 'Test' });
			expect(result).toBe(false);
		});
	});

	describe('formatSMSAlert', () => {
		it('returns a string under 160 characters', () => {
			const msg = formatSMSAlert('MFA not enforced for admin', 'critical', 'Acme Corp');
			expect(msg.length).toBeLessThanOrEqual(160);
		});

		it('includes severity in uppercase', () => {
			const msg = formatSMSAlert('Alert title', 'critical', 'Acme');
			expect(msg).toContain('CRITICAL');
		});

		it('includes TenantIQ prefix', () => {
			const msg = formatSMSAlert('Test', 'high', 'Acme');
			expect(msg).toContain('[TenantIQ');
		});

		it('truncates long messages to stay under 160 chars', () => {
			const longTitle = 'A'.repeat(200);
			const msg = formatSMSAlert(longTitle, 'critical', 'Very Long Tenant Name Corp');
			expect(msg.length).toBeLessThanOrEqual(160);
			expect(msg).toContain('...');
		});

		it('includes tenant name in the message', () => {
			const msg = formatSMSAlert('Alert', 'high', 'Acme Corp');
			expect(msg).toContain('Acme Corp');
		});
	});
});

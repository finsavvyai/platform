// RED: implementation not yet created
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import from implementation file that does not yet exist — this is intentional RED state
import { runSsoCertMonitor } from './sso-cert-monitor';

vi.stubGlobal('fetch', vi.fn());

const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockKVGet = vi.fn().mockResolvedValue(null);
const mockKVPut = vi.fn();
const mockKVDelete = vi.fn();

const mockEnv = {
	DB: { prepare: mockPrepare } as unknown as D1Database,
	KV: { get: mockKVGet, put: mockKVPut, delete: mockKVDelete } as unknown as KVNamespace,
	JWT_SECRET: 'test-jwt-secret-key-minimum-32-characters-long',
	ENVIRONMENT: 'test',
	FRONTEND_URL: 'https://app.tenantiq.io',
	WORKOS_API_KEY: 'sk_test_workos_key',
} as any;

function daysFromNow(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toISOString();
}

describe('runSsoCertMonitor — SSO-05: certificate expiry alerts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates an alert when cert expires in exactly 60 days', async () => {
		mockAll.mockResolvedValueOnce({
			results: [
				{
					id: 'conn1',
					org_id: 'org1',
					provider: 'saml',
					status: 'active',
					certificate: 'CERT_DATA',
					cert_expires_at: daysFromNow(60),
					metadata_url: null,
				},
			],
		});
		mockRun.mockResolvedValue({ meta: { changes: 1 } });

		await runSsoCertMonitor(mockEnv);

		// An alert INSERT should have been triggered
		expect(mockPrepare).toHaveBeenCalled();
		const prepareCallSQLs: string[] = mockPrepare.mock.calls.map((c: unknown[]) => String(c[0]));
		const insertAlert = prepareCallSQLs.some((sql) =>
			sql.toUpperCase().includes('INSERT') && sql.toLowerCase().includes('alert'),
		);
		expect(insertAlert).toBe(true);
	});

	it('creates an alert when cert expires in exactly 30 days', async () => {
		mockAll.mockResolvedValueOnce({
			results: [
				{
					id: 'conn2',
					org_id: 'org1',
					provider: 'saml',
					status: 'active',
					certificate: 'CERT_DATA',
					cert_expires_at: daysFromNow(30),
					metadata_url: null,
				},
			],
		});
		mockRun.mockResolvedValue({ meta: { changes: 1 } });

		await runSsoCertMonitor(mockEnv);

		const prepareCallSQLs: string[] = mockPrepare.mock.calls.map((c: unknown[]) => String(c[0]));
		const insertAlert = prepareCallSQLs.some((sql) =>
			sql.toUpperCase().includes('INSERT') && sql.toLowerCase().includes('alert'),
		);
		expect(insertAlert).toBe(true);
	});

	it('creates an alert when cert expires in exactly 7 days', async () => {
		mockAll.mockResolvedValueOnce({
			results: [
				{
					id: 'conn3',
					org_id: 'org1',
					provider: 'saml',
					status: 'active',
					certificate: 'CERT_DATA',
					cert_expires_at: daysFromNow(7),
					metadata_url: null,
				},
			],
		});
		mockRun.mockResolvedValue({ meta: { changes: 1 } });

		await runSsoCertMonitor(mockEnv);

		const prepareCallSQLs: string[] = mockPrepare.mock.calls.map((c: unknown[]) => String(c[0]));
		const insertAlert = prepareCallSQLs.some((sql) =>
			sql.toUpperCase().includes('INSERT') && sql.toLowerCase().includes('alert'),
		);
		expect(insertAlert).toBe(true);
	});

	it('does NOT create an alert when cert expires in 45 days (not a threshold)', async () => {
		mockAll.mockResolvedValueOnce({
			results: [
				{
					id: 'conn4',
					org_id: 'org1',
					provider: 'saml',
					status: 'active',
					certificate: 'CERT_DATA',
					cert_expires_at: daysFromNow(45),
					metadata_url: null,
				},
			],
		});

		await runSsoCertMonitor(mockEnv);

		const prepareCallSQLs: string[] = mockPrepare.mock.calls.map((c: unknown[]) => String(c[0]));
		const insertAlert = prepareCallSQLs.some((sql) =>
			sql.toUpperCase().includes('INSERT') && sql.toLowerCase().includes('alert'),
		);
		expect(insertAlert).toBe(false);
	});

	it('skips connection with no certificate and no metadata_url', async () => {
		mockAll.mockResolvedValueOnce({
			results: [
				{
					id: 'conn5',
					org_id: 'org1',
					provider: 'saml',
					status: 'active',
					certificate: null,
					cert_expires_at: null,
					metadata_url: null,
				},
			],
		});

		await runSsoCertMonitor(mockEnv);

		// No alert insert should happen for a connection with no cert data
		const prepareCallSQLs: string[] = mockPrepare.mock.calls.map((c: unknown[]) => String(c[0]));
		const insertAlert = prepareCallSQLs.some((sql) =>
			sql.toUpperCase().includes('INSERT') && sql.toLowerCase().includes('alert'),
		);
		expect(insertAlert).toBe(false);
	});

	it('re-fetches cert from metadata_url when metadata_url is set', async () => {
		const metadataXml = `<EntityDescriptor><KeyDescriptor><X509Certificate>CERT</X509Certificate></KeyDescriptor></EntityDescriptor>`;
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			ok: true,
			text: vi.fn().mockResolvedValueOnce(metadataXml),
		});

		mockAll.mockResolvedValueOnce({
			results: [
				{
					id: 'conn6',
					org_id: 'org1',
					provider: 'saml',
					status: 'active',
					certificate: null,
					cert_expires_at: null,
					metadata_url: 'https://idp.example.com/metadata',
				},
			],
		});

		await runSsoCertMonitor(mockEnv);

		// fetch must have been called to retrieve the metadata
		expect(fetch).toHaveBeenCalledWith('https://idp.example.com/metadata');
	});
});

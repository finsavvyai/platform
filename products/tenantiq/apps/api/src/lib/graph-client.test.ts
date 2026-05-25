import { describe, it, expect } from 'vitest';
import { resolveCloud } from './graph-client';
import type { ClientEnv } from './graph-types';

const baseEnv = { KV: {} as KVNamespace } as ClientEnv;

describe('resolveCloud', () => {
	it('defaults to Public when MS_GRAPH_CLOUD is unset', () => {
		const r = resolveCloud(baseEnv);
		expect(r.login).toBe('https://login.microsoftonline.com');
		expect(r.graph).toBe('https://graph.microsoft.com');
	});

	it('resolves USGov endpoints', () => {
		const r = resolveCloud({ ...baseEnv, MS_GRAPH_CLOUD: 'USGov' });
		expect(r.login).toBe('https://login.microsoftonline.us');
		expect(r.graph).toBe('https://graph.microsoft.us');
	});

	it('resolves China endpoints', () => {
		const r = resolveCloud({ ...baseEnv, MS_GRAPH_CLOUD: 'China' });
		expect(r.login).toBe('https://login.partner.microsoftonline.cn');
		expect(r.graph).toBe('https://microsoftgraph.chinacloudapi.cn');
	});
});

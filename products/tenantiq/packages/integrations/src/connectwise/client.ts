/**
 * ConnectWise Manage REST API v2021.1+ client.
 * Auth: Basic (companyId+publicKey:privateKey) + clientId header.
 * Docs: https://developer.connectwise.com/Products/Manage/REST
 */
import { IntegrationProvider } from '../base/provider';
import type { ConnectWiseCredentials, PSACompany, PSATicket, PSAAgreement } from '../base/types';
import {
	toPSACompany, toPSATicket, toPSAAgreement,
	type CWCompany, type CWTicket, type CWAgreement,
} from './mappers';

export class ConnectWiseClient extends IntegrationProvider {
	constructor(creds: ConnectWiseCredentials) {
		const token = btoa(`${creds.companyId}+${creds.publicKey}:${creds.privateKey}`);
		super({
			provider: 'connectwise',
			baseUrl: `${creds.siteUrl}/v4_6_release/apis/3.0`,
			headers: {
				Authorization: `Basic ${token}`,
				clientId: creds.clientId,
			},
			rateLimitPerMinute: 100,
		});
	}

	async testConnection(): Promise<{ ok: boolean; message: string }> {
		try {
			await this.request<{ version: string }>('/system/info');
			return { ok: true, message: 'Connected to ConnectWise Manage' };
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
		}
	}

	async getCompanies(): Promise<PSACompany[]> {
		const companies = await this.fetchAll<CWCompany>(
			'/company/companies?conditions=status/name="Active"',
		);
		return companies.map(toPSACompany);
	}

	async getCompanyById(id: string): Promise<PSACompany | null> {
		try {
			const cw = await this.request<CWCompany>(`/company/companies/${id}`);
			return toPSACompany(cw);
		} catch {
			return null;
		}
	}

	async createTicket(
		ticket: Omit<PSATicket, 'id' | 'createdAt'>,
	): Promise<PSATicket> {
		const body = {
			summary: ticket.summary,
			initialDescription: ticket.description,
			company: { id: Number(ticket.companyId) },
			priority: { id: ticket.priority },
			status: { name: ticket.status || 'New' },
		};
		const cw = await this.request<CWTicket>('/service/tickets', {
			method: 'POST',
			body: JSON.stringify(body),
		});
		return toPSATicket(cw);
	}

	async updateTicket(
		ticketId: string,
		updates: Partial<PSATicket>,
	): Promise<PSATicket> {
		const ops: { op: string; path: string; value: unknown }[] = [];
		if (updates.summary) ops.push({ op: 'replace', path: 'summary', value: updates.summary });
		if (updates.status) ops.push({ op: 'replace', path: 'status', value: { name: updates.status } });
		if (updates.priority) ops.push({ op: 'replace', path: 'priority', value: { id: updates.priority } });

		const cw = await this.request<CWTicket>(`/service/tickets/${ticketId}`, {
			method: 'PATCH',
			body: JSON.stringify(ops),
		});
		return toPSATicket(cw);
	}

	async addTicketNote(
		ticketId: string,
		text: string,
		internal = true,
	): Promise<void> {
		await this.request(`/service/tickets/${ticketId}/notes`, {
			method: 'POST',
			body: JSON.stringify({
				text,
				internalAnalysisFlag: internal,
				detailDescriptionFlag: !internal,
			}),
		});
	}

	async getAgreements(companyId: string): Promise<PSAAgreement[]> {
		const agreements = await this.fetchAll<CWAgreement>(
			`/finance/agreements?conditions=company/id=${companyId}`,
		);
		return agreements.map(toPSAAgreement);
	}

	async syncAgreement(
		agreement: Omit<PSAAgreement, 'id'>,
	): Promise<PSAAgreement> {
		const body = {
			name: agreement.name,
			company: { id: Number(agreement.companyId) },
			type: { name: agreement.type },
			billAmount: agreement.amount,
			startDate: agreement.startDate,
			endDate: agreement.endDate,
		};
		const cw = await this.request<CWAgreement>('/finance/agreements', {
			method: 'POST',
			body: JSON.stringify(body),
		});
		return toPSAAgreement(cw);
	}

	async registerCallback(callbackUrl: string): Promise<string> {
		const res = await this.request<{ id: number }>('/system/callbacks', {
			method: 'POST',
			body: JSON.stringify({
				url: callbackUrl,
				objectId: 0,
				type: 'ticket',
				level: 'owner',
				description: 'TenantIQ ticket sync',
			}),
		});
		return String(res.id);
	}

	async deleteCallback(callbackId: string): Promise<void> {
		await this.request(`/system/callbacks/${callbackId}`, { method: 'DELETE' });
	}
}

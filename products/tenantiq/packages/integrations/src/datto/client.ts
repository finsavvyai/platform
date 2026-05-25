/**
 * Datto Autotask REST API v1.6 client.
 * Auth: API user + secret via Basic auth, zone-based URLs.
 * Docs: https://ww1.autotask.net/help/DeveloperHelp/Content/APIs/REST/REST_API_Home.htm
 */
import { IntegrationProvider } from '../base/provider';
import type { DattoCredentials, PSACompany, PSATicket, PSAAgreement } from '../base/types';

interface ATAccount {
	id: number;
	companyName: string;
	companyNumber: string;
	isActive: boolean;
}

interface ATTicket {
	id: number;
	title: string;
	description: string;
	priority: number;
	status: number;
	companyID: number;
	createDate: string;
	lastActivityDate?: string;
}

interface ATContract {
	id: number;
	contractName: string;
	companyID: number;
	contractType: number;
	totalContractValue?: number;
	startDate: string;
	endDate?: string;
}

interface ATResponse<T> { items: T[]; pageDetails?: { count: number; nextPageUrl?: string } }

export class DattoClient extends IntegrationProvider {
	constructor(creds: DattoCredentials) {
		const token = btoa(`${creds.apiUser}:${creds.apiSecret}`);
		super({
			provider: 'datto',
			baseUrl: `${creds.zoneUrl}/ATServicesRest/V1.0`,
			headers: {
				Authorization: `Basic ${token}`,
				'ApiIntegrationCode': creds.trackingId,
			},
			rateLimitPerMinute: 100,
		});
	}

	async testConnection(): Promise<{ ok: boolean; message: string }> {
		try {
			await this.request<ATResponse<ATAccount>>('/Companies/query?search={"filter":[{"field":"isActive","op":"eq","value":true}]}&MaxRecords=1');
			return { ok: true, message: 'Connected to Datto Autotask' };
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
		}
	}

	async getCompanies(): Promise<PSACompany[]> {
		const data = await this.request<ATResponse<ATAccount>>(
			'/Companies/query?search={"filter":[{"field":"isActive","op":"eq","value":true}]}',
		);
		return (data.items ?? []).map(toPSACompany);
	}

	async createTicket(ticket: Omit<PSATicket, 'id' | 'createdAt'>): Promise<PSATicket> {
		const body = {
			title: ticket.summary,
			description: ticket.description,
			companyID: Number(ticket.companyId),
			priority: ticket.priority,
			status: 1, // New
			queueID: 0,
		};
		const data = await this.request<{ item: ATTicket }>('/Tickets', {
			method: 'POST',
			body: JSON.stringify(body),
		});
		return toPSATicket(data.item);
	}

	async updateTicket(ticketId: string, updates: Partial<PSATicket>): Promise<PSATicket> {
		const body: Record<string, unknown> = { id: Number(ticketId) };
		if (updates.summary) body.title = updates.summary;
		if (updates.priority) body.priority = updates.priority;
		if (updates.status) body.status = updates.status === 'Closed' ? 5 : 1;
		const data = await this.request<{ item: ATTicket }>(`/Tickets`, {
			method: 'PATCH',
			body: JSON.stringify(body),
		});
		return toPSATicket(data.item);
	}

	async getAgreements(companyId: string): Promise<PSAAgreement[]> {
		const data = await this.request<ATResponse<ATContract>>(
			`/Contracts/query?search={"filter":[{"field":"companyID","op":"eq","value":${companyId}}]}`,
		);
		return (data.items ?? []).map(toPSAAgreement);
	}

	async syncAgreement(agreement: Omit<PSAAgreement, 'id'>): Promise<PSAAgreement> {
		const body = {
			contractName: agreement.name,
			companyID: Number(agreement.companyId),
			contractType: 1,
			startDate: agreement.startDate,
			endDate: agreement.endDate,
		};
		const data = await this.request<{ item: ATContract }>('/Contracts', {
			method: 'POST',
			body: JSON.stringify(body),
		});
		return toPSAAgreement(data.item);
	}
}

function toPSACompany(at: ATAccount): PSACompany {
	return { id: String(at.id), name: at.companyName, identifier: at.companyNumber, status: at.isActive ? 'Active' : 'Inactive' };
}

function toPSATicket(at: ATTicket): PSATicket {
	return { id: String(at.id), summary: at.title, description: at.description || '', priority: at.priority, status: String(at.status), companyId: String(at.companyID), createdAt: at.createDate, updatedAt: at.lastActivityDate };
}

function toPSAAgreement(at: ATContract): PSAAgreement {
	return { id: String(at.id), name: at.contractName, companyId: String(at.companyID), type: String(at.contractType), amount: at.totalContractValue, startDate: at.startDate, endDate: at.endDate };
}

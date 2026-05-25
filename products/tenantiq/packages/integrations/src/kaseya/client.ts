/**
 * Kaseya BMS REST API client.
 * Auth: API key in header. Docs: https://bms.kaseya.com/api
 */
import { IntegrationProvider } from '../base/provider';
import type { KaseyaCredentials, PSACompany, PSATicket, PSAAgreement } from '../base/types';

interface KAccount { Id: number; Name: string; Number: string; Active: boolean }
interface KTicket { Id: number; Title: string; Description: string; Priority: number; StatusId: number; AccountId: number; CreatedDate: string; ModifiedDate?: string }
interface KContract { Id: number; Name: string; AccountId: number; Type: string; TotalValue?: number; StartDate: string; EndDate?: string }
interface KResponse<T> { Result: T[]; TotalCount?: number }

export class KaseyaClient extends IntegrationProvider {
	constructor(creds: KaseyaCredentials) {
		super({
			provider: 'kaseya',
			baseUrl: `${creds.apiUrl}/api`,
			headers: {
				'X-Api-Key': creds.apiKey,
				'X-Tenant-Id': creds.tenantId,
			},
			rateLimitPerMinute: 60,
		});
	}

	async testConnection(): Promise<{ ok: boolean; message: string }> {
		try {
			await this.request<{ Version: string }>('/system/info');
			return { ok: true, message: 'Connected to Kaseya BMS' };
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
		}
	}

	async getCompanies(): Promise<PSACompany[]> {
		const data = await this.request<KResponse<KAccount>>('/accounts?$filter=Active eq true');
		return (data.Result ?? []).map(toPSACompany);
	}

	async createTicket(ticket: Omit<PSATicket, 'id' | 'createdAt'>): Promise<PSATicket> {
		const body = {
			Title: ticket.summary,
			Description: ticket.description,
			AccountId: Number(ticket.companyId),
			Priority: ticket.priority,
			StatusId: 1,
		};
		const data = await this.request<{ Result: KTicket }>('/tickets', {
			method: 'POST',
			body: JSON.stringify(body),
		});
		return toPSATicket(data.Result);
	}

	async updateTicket(ticketId: string, updates: Partial<PSATicket>): Promise<PSATicket> {
		const body: Record<string, unknown> = {};
		if (updates.summary) body.Title = updates.summary;
		if (updates.priority) body.Priority = updates.priority;
		if (updates.status) body.StatusId = updates.status === 'Closed' ? 5 : 1;
		const data = await this.request<{ Result: KTicket }>(`/tickets/${ticketId}`, {
			method: 'PATCH',
			body: JSON.stringify(body),
		});
		return toPSATicket(data.Result);
	}

	async getAgreements(companyId: string): Promise<PSAAgreement[]> {
		const data = await this.request<KResponse<KContract>>(`/contracts?$filter=AccountId eq ${companyId}`);
		return (data.Result ?? []).map(toPSAAgreement);
	}

	async syncAgreement(agreement: Omit<PSAAgreement, 'id'>): Promise<PSAAgreement> {
		const body = {
			Name: agreement.name,
			AccountId: Number(agreement.companyId),
			Type: agreement.type,
			StartDate: agreement.startDate,
			EndDate: agreement.endDate,
		};
		const data = await this.request<{ Result: KContract }>('/contracts', {
			method: 'POST',
			body: JSON.stringify(body),
		});
		return toPSAAgreement(data.Result);
	}
}

function toPSACompany(k: KAccount): PSACompany {
	return { id: String(k.Id), name: k.Name, identifier: k.Number, status: k.Active ? 'Active' : 'Inactive' };
}

function toPSATicket(k: KTicket): PSATicket {
	return { id: String(k.Id), summary: k.Title, description: k.Description || '', priority: k.Priority, status: String(k.StatusId), companyId: String(k.AccountId), createdAt: k.CreatedDate, updatedAt: k.ModifiedDate };
}

function toPSAAgreement(k: KContract): PSAAgreement {
	return { id: String(k.Id), name: k.Name, companyId: String(k.AccountId), type: k.Type, amount: k.TotalValue, startDate: k.StartDate, endDate: k.EndDate };
}

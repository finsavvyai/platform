/**
 * ConnectWise Manage → PSA type mappers.
 */
import type { PSACompany, PSATicket, PSAAgreement } from '../base/types';

export interface CWCompany {
	id: number;
	identifier: string;
	name: string;
	status: { name: string };
}

export interface CWTicket {
	id: number;
	summary: string;
	status: { name: string };
	priority: { id: number };
	company: { id: number; name: string };
	dateEntered: string;
	lastUpdated?: string;
	initialDescription?: string;
}

export interface CWAgreement {
	id: number;
	name: string;
	company: { id: number };
	type: { name: string };
	billAmount?: number;
	startDate: string;
	endDate?: string;
}

export function toPSACompany(cw: CWCompany): PSACompany {
	return {
		id: String(cw.id),
		name: cw.name,
		identifier: cw.identifier,
		status: cw.status?.name,
	};
}

export function toPSATicket(cw: CWTicket): PSATicket {
	return {
		id: String(cw.id),
		summary: cw.summary,
		description: cw.initialDescription || '',
		priority: cw.priority?.id ?? 3,
		status: cw.status?.name ?? 'New',
		companyId: String(cw.company?.id ?? ''),
		createdAt: cw.dateEntered,
		updatedAt: cw.lastUpdated,
	};
}

export function toPSAAgreement(cw: CWAgreement): PSAAgreement {
	return {
		id: String(cw.id),
		name: cw.name,
		companyId: String(cw.company?.id ?? ''),
		type: cw.type?.name ?? 'Managed',
		amount: cw.billAmount,
		startDate: cw.startDate,
		endDate: cw.endDate,
	};
}

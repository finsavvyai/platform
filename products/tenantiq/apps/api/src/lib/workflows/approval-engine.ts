/**
 * Approval Engine
 *
 * Manages approval workflows for license optimization, guest removal,
 * group archival, and remediation actions. Approvals are stored in KV
 * with org-scoped keys for multi-tenant isolation.
 */

export type ApprovalType =
	| 'license_optimization'
	| 'guest_removal'
	| 'group_archive'
	| 'remediation';

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'partial';

export interface ApprovalItem {
	id: string;
	description: string;
	impact: string;
	approved: boolean;
}

export interface ApprovalRequest {
	id: string;
	type: ApprovalType;
	items: ApprovalItem[];
	requestedBy: string;
	requestedAt: string;
	status: ApprovalStatus;
	decidedBy?: string;
	decidedAt?: string;
}

export interface ApprovalResult {
	requestId: string;
	status: ApprovalStatus;
	approvedItems: string[];
	deniedItems: string[];
	decidedBy: string;
	decidedAt: string;
}

export interface ItemDecision {
	itemId: string;
	approved: boolean;
}

/** Create a new approval request with pending status */
export function createApprovalRequest(
	type: ApprovalType,
	items: ApprovalItem[],
	requestedBy: string
): ApprovalRequest {
	return {
		id: crypto.randomUUID(),
		type,
		items: items.map((item) => ({ ...item, approved: false })),
		requestedBy,
		requestedAt: new Date().toISOString(),
		status: 'pending',
	};
}

/** Process approval decisions and compute final status */
export function processApproval(
	request: ApprovalRequest,
	decisions: ItemDecision[],
	decidedBy: string
): ApprovalResult {
	const decidedAt = new Date().toISOString();
	const decisionMap = new Map(decisions.map((d) => [d.itemId, d.approved]));

	for (const item of request.items) {
		const decision = decisionMap.get(item.id);
		if (decision !== undefined) {
			item.approved = decision;
		}
	}

	const approvedItems = request.items.filter((i) => i.approved).map((i) => i.id);
	const deniedItems = request.items.filter((i) => !i.approved).map((i) => i.id);

	if (approvedItems.length === request.items.length) {
		request.status = 'approved';
	} else if (deniedItems.length === request.items.length) {
		request.status = 'denied';
	} else {
		request.status = 'partial';
	}

	request.decidedBy = decidedBy;
	request.decidedAt = decidedAt;

	return { requestId: request.id, status: request.status, approvedItems, deniedItems, decidedBy, decidedAt };
}

const KV_PREFIX = 'approval';
const INDEX_PREFIX = 'approval-index';

function approvalKey(orgId: string, id: string): string {
	return `${KV_PREFIX}:${orgId}:${id}`;
}

function indexKey(orgId: string, status: ApprovalStatus): string {
	return `${INDEX_PREFIX}:${orgId}:${status}`;
}

/** Save an approval request to KV and update the index */
export async function saveApproval(kv: KVNamespace, orgId: string, request: ApprovalRequest): Promise<void> {
	await kv.put(approvalKey(orgId, request.id), JSON.stringify(request), {
		expirationTtl: 90 * 24 * 60 * 60, // 90 days
	});
	await addToIndex(kv, orgId, request.status, request.id);
}

/** Load an approval request from KV */
export async function loadApproval(kv: KVNamespace, orgId: string, id: string): Promise<ApprovalRequest | null> {
	const raw = await kv.get(approvalKey(orgId, id));
	return raw ? (JSON.parse(raw) as ApprovalRequest) : null;
}

/** List approval IDs by status */
export async function listApprovalIds(kv: KVNamespace, orgId: string, status: ApprovalStatus): Promise<string[]> {
	const raw = await kv.get(indexKey(orgId, status));
	return raw ? (JSON.parse(raw) as string[]) : [];
}

/** Move an approval between status indexes */
export async function moveApprovalIndex(
	kv: KVNamespace,
	orgId: string,
	id: string,
	from: ApprovalStatus,
	to: ApprovalStatus
): Promise<void> {
	await removeFromIndex(kv, orgId, from, id);
	await addToIndex(kv, orgId, to, id);
}

async function addToIndex(kv: KVNamespace, orgId: string, status: ApprovalStatus, id: string): Promise<void> {
	const ids = await listApprovalIds(kv, orgId, status);
	if (!ids.includes(id)) {
		ids.unshift(id);
		await kv.put(indexKey(orgId, status), JSON.stringify(ids.slice(0, 500)));
	}
}

async function removeFromIndex(kv: KVNamespace, orgId: string, status: ApprovalStatus, id: string): Promise<void> {
	const ids = await listApprovalIds(kv, orgId, status);
	const filtered = ids.filter((i) => i !== id);
	await kv.put(indexKey(orgId, status), JSON.stringify(filtered));
}

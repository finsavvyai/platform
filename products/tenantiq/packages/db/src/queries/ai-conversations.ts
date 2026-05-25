import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '../connection';
import { aiConversations } from '../schema-d1';

type DB = Database;

/** D1 ai_conversations table uses `user_id` (not email), integer timestamps, JSON-text messages. */
export async function getConversationsByTenant(
	db: DB,
	tenantId: string,
	userEmail: string,
	filters?: { limit?: number; offset?: number },
) {
	return db
		.select()
		.from(aiConversations)
		.where(and(eq(aiConversations.tenantId, tenantId), eq(aiConversations.userId, userEmail)))
		.orderBy(desc(aiConversations.updatedAt))
		.limit(filters?.limit ?? 20)
		.offset(filters?.offset ?? 0);
}

export async function getConversationById(db: DB, conversationId: string) {
	const result = await db
		.select()
		.from(aiConversations)
		.where(eq(aiConversations.id, conversationId))
		.limit(1);
	const row = result[0];
	if (!row) return null;
	// messages is stored as JSON text in D1 — parse to object shape expected by callers.
	let parsed: unknown[] = [];
	try { parsed = JSON.parse(row.messages ?? '[]'); } catch { parsed = []; }
	return { ...row, messages: parsed };
}

export async function createConversation(
	db: DB,
	data: {
		id: string;
		tenantId: string;
		userId?: string;
		title?: string;
		messages?: unknown[];
	},
) {
	const nowSec = Math.floor(Date.now() / 1000);
	const result = await db
		.insert(aiConversations)
		.values({
			id: data.id,
			tenantId: data.tenantId,
			userId: data.userId,
			title: data.title,
			messages: JSON.stringify(data.messages ?? []),
			createdAt: nowSec,
			updatedAt: nowSec,
		})
		.returning();
	return result[0];
}

export async function updateConversationMessages(
	db: DB,
	conversationId: string,
	messages: unknown[],
) {
	return db
		.update(aiConversations)
		.set({ messages: JSON.stringify(messages), updatedAt: Math.floor(Date.now() / 1000) })
		.where(eq(aiConversations.id, conversationId));
}

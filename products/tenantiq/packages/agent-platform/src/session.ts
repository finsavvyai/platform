import type { Message, Session } from './types';

const sessions = new Map<string, Session>();

let idCounter = 0;

function generateId(): string {
	idCounter += 1;
	return `sess_${Date.now()}_${idCounter}`;
}

/** Create a new agent session. */
export function createSession(productId: string, tenantId: string, userId: string): Session {
	const session: Session = {
		id: generateId(),
		productId,
		tenantId,
		userId,
		messages: [],
		context: {},
		createdAt: new Date(),
	};
	sessions.set(session.id, session);
	return session;
}

/** Append a message to a session. */
export function addMessage(
	sessionId: string,
	role: Message['role'],
	content: string,
	toolCallId?: string,
): Message | null {
	const session = sessions.get(sessionId);
	if (!session) return null;

	const message: Message = {
		role,
		content,
		toolCallId,
		timestamp: new Date(),
	};
	session.messages.push(message);
	return message;
}

/** Retrieve a session by ID. */
export function getSession(sessionId: string): Session | undefined {
	return sessions.get(sessionId);
}

/** List all active sessions, optionally filtered by product. */
export function listSessions(productId?: string): Session[] {
	const all = Array.from(sessions.values());
	if (!productId) return all;
	return all.filter((s) => s.productId === productId);
}

/** Delete a session. */
export function deleteSession(sessionId: string): boolean {
	return sessions.delete(sessionId);
}

/** Clear all sessions (useful for testing). */
export function clearSessions(): void {
	sessions.clear();
	idCounter = 0;
}

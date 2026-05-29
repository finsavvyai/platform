export interface APIResponse<T> {
    data: T;
    message?: string;
    success: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface WebSocketMessage {
    type: 'metric' | 'alert' | 'collaboration' | 'ping' | 'pong';
    data: unknown;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

export interface CollaborationEvent {
    type: 'cursor_move' | 'query_update' | 'user_join' | 'user_leave';
    userId: string;
    sessionId: string;
    data: unknown;
}

export interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'admin' | 'user' | 'viewer';
    createdAt: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface Visualization {
    id: string;
    name: string;
    type: 'bar' | 'line' | 'pie' | 'scatter' | 'table';
    queryId: string;
    config: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

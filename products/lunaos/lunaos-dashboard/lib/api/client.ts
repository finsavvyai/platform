/**
 * LunaOS Dashboard — API Client (shared fetch + auth token helpers)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.lunaos.ai';

export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('luna_token');
}

export function setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('luna_token', token);
    }
}

export function removeAuthToken(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('luna_token');
    }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_URL}${path}`, { ...options, headers });
}

export { API_URL };

/**
 * DOM, clipboard, and validation helpers
 */

/**
 * Check if code is running on the client
 */
export function isClient(): boolean {
    return typeof window !== 'undefined';
}

/**
 * Check if code is running on the server
 */
export function isServer(): boolean {
    return typeof window === 'undefined';
}

/**
 * Generate a random ID
 */
export function generateId(length = 12): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Create URL with query parameters
 */
export function createUrl(base: string, params: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(base, 'https://placeholder.com');
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            url.searchParams.set(key, String(value));
        }
    });
    return url.pathname + url.search;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            return true;
        } catch {
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

/**
 * Parse error message from various error types
 */
export function parseErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) {
        if ('message' in error) return String((error as { message: unknown }).message);
        if ('error' in error) return String((error as { error: unknown }).error);
    }
    return 'An unknown error occurred';
}

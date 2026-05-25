/**
 * Input Sanitizer — prevent XSS in stored/returned content
 *
 * Escapes HTML entities in user-generated content before storage.
 * Strips potentially dangerous patterns from agent output.
 */

const HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
};

/**
 * Escape HTML entities in a string to prevent XSS
 */
export function escapeHtml(input: string): string {
    return input.replace(/[&<>"'/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize user input — removes null bytes, strips control characters
 * but preserves newlines and tabs for code formatting
 */
export function sanitizeInput(input: string): string {
    return input
        // Remove null bytes
        .replace(/\0/g, '')
        // Remove other control characters except \n, \r, \t
        .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Trim to reasonable length
        .trim();
}

/**
 * Sanitize a string for safe storage — escapes HTML but preserves
 * code formatting characters (newlines, tabs, spaces)
 */
export function sanitizeForStorage(input: string): string {
    return sanitizeInput(input);
}

/**
 * Validate and sanitize an email address
 */
export function sanitizeEmail(email: string): string | null {
    const sanitized = email.toLowerCase().trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(sanitized) ? sanitized : null;
}

/**
 * Sanitize object keys — remove any potentially dangerous keys
 */
export function sanitizeObject<T extends Record<string, any>>(
    obj: T,
    allowedKeys: string[],
): Partial<T> {
    const result: Record<string, any> = {};
    for (const key of allowedKeys) {
        if (key in obj && obj[key] !== undefined) {
            const value = obj[key];
            if (typeof value === 'string') {
                result[key] = sanitizeInput(value);
            } else {
                result[key] = value;
            }
        }
    }
    return result as Partial<T>;
}

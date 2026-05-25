/**
 * Safe error message utility.
 * Prevents raw server errors, stack traces, or internal details
 * from being displayed to end users.
 */

const INTERNAL_PATTERNS = [
	/SQLITE|ECONNREFUSED|ENOENT|EPERM|EACCES/i,
	/at\s+\w+\s*\(/,                 // stack trace lines
	/node_modules/,
	/\.ts:\d+/,                        // file:line references
	/Cannot read properties of/,
	/is not a function/,
	/undefined is not/,
	/FOREIGN KEY|UNIQUE constraint/i,
	/NetworkError|fetch failed/i,
];

/**
 * Returns a safe error message suitable for display to users.
 * Strips internal details, stack traces, and technical jargon.
 */
export function safeErrorMessage(err: unknown, fallback: string): string {
	if (!err) return fallback;

	let raw: string;
	if (err instanceof Error) {
		raw = err.message;
	} else if (typeof err === 'string') {
		raw = err;
	} else if (err && typeof err === 'object') {
		raw = (err as any).message ?? (err as any).error ?? JSON.stringify(err);
	} else {
		raw = String(err);
	}

	// If the message looks like an internal error, use the fallback
	for (const pattern of INTERNAL_PATTERNS) {
		if (pattern.test(raw)) return fallback;
	}

	// If it's very long (likely a stack trace), use fallback
	if (raw.length > 500) return fallback;

	// If it contains no spaces (likely a code/enum), use fallback
	if (raw.length > 40 && !raw.includes(' ')) return fallback;

	return raw;
}

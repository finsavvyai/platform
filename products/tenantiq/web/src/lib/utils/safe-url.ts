/**
 * Guard against `javascript:`, `data:`, `vbscript:` and other non-navigation
 * protocols when binding a value into `<a href>` or redirects.
 */

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:']);

export function safeUrl(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (!trimmed) return null;

	// Block inline-script / data payloads up front.
	if (/^\s*(javascript|data|vbscript|file):/i.test(trimmed)) return null;

	// Relative URLs are always same-origin — allow.
	if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
	if (trimmed.startsWith('#')) return trimmed;

	try {
		const url = new URL(trimmed);
		return ALLOWED_PROTOCOLS.has(url.protocol) ? url.toString() : null;
	} catch {
		return null;
	}
}

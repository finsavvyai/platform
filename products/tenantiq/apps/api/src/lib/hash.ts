/** SHA-256 hex digest of a UTF-8 string. Used by MCP API key auth + others. */
export async function sha256Hex(input: string): Promise<string> {
	const buf = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest('SHA-256', buf);
	return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

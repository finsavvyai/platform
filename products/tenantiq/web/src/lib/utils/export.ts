/**
 * Client-side export utilities for CSV and JSON downloads.
 * Keeps exports lightweight — no heavy PDF/Excel libraries.
 */

/** Trigger a browser download from a Blob. */
function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/** Build a timestamped filename: `alerts-2026-03-16-120959.csv` */
function buildFilename(prefix: string, ext: string): string {
	const d = new Date();
	const ts = d.toISOString().replace(/[-:T]/g, '').slice(0, 14);
	return `${prefix}-${ts}.${ext}`;
}

/** Escape a CSV cell value (RFC 4180). */
function escapeCell(value: unknown): string {
	const str = value == null ? '' : String(value);
	if (str.includes(',') || str.includes('"') || str.includes('\n')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

/** Export an array of objects as a CSV download. */
export function exportCsv<T extends object>(
	rows: T[],
	columns: { key: keyof T; label: string }[],
	filenamePrefix: string
): void {
	const header = columns.map((c) => escapeCell(c.label)).join(',');
	const body = rows
		.map((row) => columns.map((c) => escapeCell(row[c.key])).join(','))
		.join('\n');
	const csv = `${header}\n${body}`;
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	downloadBlob(blob, buildFilename(filenamePrefix, 'csv'));
}

/** Export data as a JSON download with metadata wrapper. */
export function exportJson<T>(
	data: T,
	meta: { type: string; tenant?: string; filters?: Record<string, string> },
	filenamePrefix: string
): void {
	const payload = {
		export: {
			type: meta.type,
			generatedAt: new Date().toISOString(),
			tenant: meta.tenant ?? null,
			filters: meta.filters ?? {},
			totalCount: Array.isArray(data) ? data.length : 1,
			data,
		},
	};
	const json = JSON.stringify(payload, null, 2);
	const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
	downloadBlob(blob, buildFilename(filenamePrefix, 'json'));
}

/** Copy text to clipboard with fallback. */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

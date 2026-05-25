/**
 * CSV validation and parsing utilities for tenant import.
 */

const HEADER_PATTERN = /^name\s*,\s*domain\s*(?:,\s*region)?$/i;
const MAX_ROWS = 1000;
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const VALID_REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];

export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface TenantRow {
	name: string;
	domain: string;
	region?: string;
}

export function isValidDomain(domain: string): boolean {
	return DOMAIN_PATTERN.test(domain);
}

export function isValidRegion(region: string): boolean {
	return VALID_REGIONS.includes(region);
}

export function validateCsv(csv: string): { valid: boolean; errors: string[] } {
	const errors: string[] = [];
	const lines = csv.trim().split('\n');

	if (lines.length < 2) {
		errors.push('CSV must contain at least a header and one data row');
		return { valid: false, errors };
	}

	if (!HEADER_PATTERN.test(lines[0])) {
		errors.push('CSV header must be: name, domain [, region]');
	}

	if (lines.length - 1 > MAX_ROWS) {
		errors.push(`Maximum ${MAX_ROWS} tenants allowed per import`);
	}

	for (let i = 1; i < lines.length; i++) {
		const cells = lines[i].split(',').map(c => c.trim());

		if (cells.length < 2 || cells.length > 3) {
			errors.push(`Row ${i + 1}: Expected 2-3 columns`);
			continue;
		}

		const [name, domain, region] = cells;

		if (!name) {
			errors.push(`Row ${i + 1}: Name is required`);
		}
		if (!isValidDomain(domain)) {
			errors.push(`Row ${i + 1}: Invalid domain format`);
		}
		if (region && !isValidRegion(region)) {
			errors.push(`Row ${i + 1}: Invalid region`);
		}
	}

	return { valid: errors.length === 0, errors };
}

export function parsePreview(csv: string): TenantRow[] {
	const lines = csv.trim().split('\n');
	const preview: TenantRow[] = [];

	for (let i = 1; i < Math.min(lines.length, 6); i++) {
		const cells = lines[i].split(',').map(c => c.trim());
		preview.push({ name: cells[0], domain: cells[1], region: cells[2] });
	}

	return preview;
}

export async function validateFile(
	file: File,
): Promise<{ valid: boolean; errors: string[] }> {
	const errors: string[] = [];

	if (file.size > MAX_FILE_SIZE) {
		errors.push(`File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`);
	}
	if (file.type && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
		errors.push('File must be CSV format');
	}
	if (!file.name.endsWith('.csv')) {
		errors.push('File must have .csv extension');
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	const csv = await file.text();
	return validateCsv(csv);
}

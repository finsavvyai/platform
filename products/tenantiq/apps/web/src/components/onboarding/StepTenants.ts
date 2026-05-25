import type { WizardStep } from './WizardContainer';
import {
	validateCsv, validateFile, parsePreview, isValidDomain,
	type TenantRow,
} from './csv-validation';

export interface TenantImportData {
	file?: File;
	csv?: string;
	preview?: TenantRow[];
	imported?: number;
	errors?: Array<{ row: number; message: string }>;
}

export class StepTenants implements WizardStep {
	id = 'step-tenants';
	title = 'Connect Your Tenants';
	description = 'Import your tenant list via CSV or add them manually';
	component = 'StepTenantsComponent';
	status: 'pending' | 'in_progress' | 'completed' = 'pending';
	data?: TenantImportData;
	errors?: Record<string, string>;

	validateCsv(csv: string) {
		return validateCsv(csv);
	}

	parsePreview(csv: string) {
		return parsePreview(csv);
	}

	async validateFile(file: File) {
		return validateFile(file);
	}

	async handleFileUpload(file: File): Promise<{
		success: boolean;
		preview?: TenantRow[];
		errors?: string[];
	}> {
		const validation = await validateFile(file);
		if (!validation.valid) {
			return { success: false, errors: validation.errors };
		}

		const csv = await file.text();
		const preview = parsePreview(csv);
		this.data = { file, csv, preview };
		return { success: true, preview };
	}

	async importTenants(): Promise<{
		imported: number;
		failed: number;
		errors: Array<{ row: number; message: string }>;
	}> {
		if (!this.data?.csv) {
			return { imported: 0, failed: 0, errors: [{ row: 0, message: 'No CSV data' }] };
		}

		const lines = this.data.csv.trim().split('\n');
		const errors: Array<{ row: number; message: string }> = [];
		let imported = 0;
		let failed = 0;

		for (let i = 1; i < lines.length; i++) {
			const cells = lines[i].split(',').map(c => c.trim());
			if (cells.length < 2) {
				errors.push({ row: i + 1, message: 'Invalid row format' });
				failed++;
			} else if (isValidDomain(cells[1])) {
				imported++;
			} else {
				errors.push({ row: i + 1, message: 'Invalid domain' });
				failed++;
			}
		}

		this.data.imported = imported;
		this.data.errors = errors;
		return { imported, failed, errors };
	}

	canManualAdd(name: string, domain: string): boolean {
		return name.length > 0 && isValidDomain(domain);
	}

	addTenant(name: string, domain: string, region?: string): {
		success: boolean;
		error?: string;
	} {
		if (!this.canManualAdd(name, domain)) {
			return { success: false, error: 'Invalid tenant data' };
		}
		if (!this.data?.preview) {
			this.data = { preview: [] };
		}
		this.data!.preview!.push({ name, domain, region });
		return { success: true };
	}

	getTenantCount(): number {
		return this.data?.preview?.length || 0;
	}

	validate(): { valid: boolean; errors: Record<string, string> } {
		const errors: Record<string, string> = {};
		if (!this.data?.preview || this.data.preview.length === 0) {
			errors.tenants = 'At least one tenant is required';
		}
		if (this.data?.errors && this.data.errors.length > 0) {
			errors.csv = `${this.data.errors.length} rows have errors`;
		}
		return { valid: Object.keys(errors).length === 0, errors };
	}
}

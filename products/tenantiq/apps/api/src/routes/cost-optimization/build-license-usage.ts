import type { LicenseUsageData } from '@tenantiq/ai/tools/cost-optimizer';

interface LicenseRecord {
	skuId: string;
	skuName: string;
	total: number;
	assigned: number;
	costPerUnit?: string | number | null;
}

interface UserRecord {
	id: string;
	displayName: string | null;
	email: string | null;
	lastSignIn: string | null;
	assignedLicenses: unknown;
}

/**
 * Build license usage data by joining licenses with their assigned users.
 * Shared across cost-optimization route handlers.
 */
export function buildLicenseUsageData(
	licenses: LicenseRecord[],
	users: UserRecord[]
): LicenseUsageData[] {
	return licenses.map((license) => {
		const usersWithLicense = users.filter((user) => {
			const assignedLicenses = (user.assignedLicenses as string[]) || [];
			return assignedLicenses.includes(license.skuId);
		});

		return {
			skuId: license.skuId,
			skuName: license.skuName,
			total: license.total,
			assigned: license.assigned,
			costPerUnit: parseFloat(license.costPerUnit?.toString() || '0'),
			users: usersWithLicense.map((user) => {
				const lastSignIn = user.lastSignIn ? new Date(user.lastSignIn) : null;
				const now = new Date();
				const inactiveDays = lastSignIn
					? Math.floor((now.getTime() - lastSignIn.getTime()) / (1000 * 60 * 60 * 24))
					: 999;

				return {
					id: user.id,
					displayName: user.displayName || 'Unknown',
					email: user.email || '',
					lastSignIn: user.lastSignIn ? new Date(user.lastSignIn).toISOString() : null,
					assignedLicenses: (user.assignedLicenses as string[]) || [],
					inactiveDays,
				};
			}),
		};
	});
}

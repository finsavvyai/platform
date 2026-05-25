/**
 * Formatting utilities for the TenantIQ dashboard.
 */

export function formatCurrency(amount: number | null | undefined): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(amount ?? 0);
}

export function formatNumber(num: number | null | undefined): string {
	return new Intl.NumberFormat('en-US').format(num ?? 0);
}

export function formatRelativeTime(date: Date | string | number | null | undefined): string {
	if (!date && date !== 0) return 'Never';
	const now = new Date();
	const d = typeof date === 'number' ? new Date(date < 1e12 ? date * 1000 : date)
		: typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return 'Never';
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 30) return `${diffDays}d ago`;
	return d.toLocaleDateString();
}

export function formatPercentage(value: number | null | undefined, total: number | null | undefined): string {
	if (!total) return '0%';
	return `${Math.round(((value ?? 0) / total) * 100)}%`;
}

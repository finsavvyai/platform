export function getThreatLevelColor(level: string): string {
	switch (level) {
		case 'critical':
			return '#ef4444';
		case 'high':
			return '#f97316';
		case 'medium':
			return '#f59e0b';
		case 'low':
			return '#22c55e';
		default:
			return '#6b7280';
	}
}

export function getSeverityColor(severity: string): string {
	switch (severity) {
		case 'critical':
			return '#ef4444';
		case 'high':
			return '#f97316';
		case 'medium':
			return '#f59e0b';
		case 'low':
			return '#22c55e';
		default:
			return '#6b7280';
	}
}

export function getPriorityColor(priority: string): string {
	switch (priority) {
		case 'high':
			return '#ef4444';
		case 'medium':
			return '#f59e0b';
		case 'low':
			return '#22c55e';
		default:
			return '#6b7280';
	}
}

export function formatTimeAgo(timestamp: string): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffMins = Math.floor(diffMs / (1000 * 60));

	if (diffHours > 0) {
		return `${diffHours}h ago`;
	}
	return `${diffMins}m ago`;
}

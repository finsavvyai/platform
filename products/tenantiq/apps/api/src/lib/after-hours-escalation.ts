/**
 * Weekend/After-Hours Alert Escalation
 *
 * Flags configuration changes made outside business hours with elevated severity.
 * Tracks "hours since last business-hours human login" per tenant.
 * Provides after-hours alert escalation routing.
 */

export interface BusinessHoursConfig {
	timezone: string;
	startHour: number; // 0-23
	endHour: number;   // 0-23
	workDays: number[]; // 0=Sunday, 6=Saturday
}

export interface AfterHoursContext {
	isAfterHours: boolean;
	isWeekend: boolean;
	localHour: number;
	localDay: number;
	hoursSinceLastBusinessLogin: number | null;
}

export interface EscalatedAlert {
	originalSeverity: string;
	escalatedSeverity: string;
	escalationReason: string;
	afterHoursContext: AfterHoursContext;
}

const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
	timezone: 'UTC',
	startHour: 8,
	endHour: 18,
	workDays: [1, 2, 3, 4, 5], // Mon-Fri
};

export function getAfterHoursContext(
	timestamp: Date,
	config: BusinessHoursConfig = DEFAULT_BUSINESS_HOURS,
	lastBusinessLogin: Date | null = null
): AfterHoursContext {
	const localTime = getLocalTime(timestamp, config.timezone);
	const hour = localTime.getHours();
	const day = localTime.getDay();

	const isWeekend = !config.workDays.includes(day);
	const isOutsideHours = hour < config.startHour || hour >= config.endHour;
	const isAfterHours = isWeekend || isOutsideHours;

	let hoursSinceLastBusinessLogin: number | null = null;
	if (lastBusinessLogin) {
		const diffMs = timestamp.getTime() - lastBusinessLogin.getTime();
		hoursSinceLastBusinessLogin = Math.round(diffMs / (1000 * 60 * 60));
	}

	return {
		isAfterHours,
		isWeekend,
		localHour: hour,
		localDay: day,
		hoursSinceLastBusinessLogin,
	};
}

function getLocalTime(timestamp: Date, timezone: string): Date {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		year: 'numeric', month: '2-digit', day: '2-digit',
		hour: '2-digit', minute: '2-digit', hour12: false,
	});
	const parts = formatter.formatToParts(timestamp);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
	return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

export function escalateSeverity(
	originalSeverity: string,
	context: AfterHoursContext
): EscalatedAlert | null {
	if (!context.isAfterHours) return null;

	const reasons: string[] = [];
	let escalate = false;

	if (context.isWeekend) {
		reasons.push('Change detected on weekend');
		escalate = true;
	} else {
		reasons.push(`Change detected at ${context.localHour}:00 (outside business hours)`);
		escalate = true;
	}

	if (context.hoursSinceLastBusinessLogin !== null && context.hoursSinceLastBusinessLogin > 48) {
		reasons.push(`No business-hours login for ${context.hoursSinceLastBusinessLogin}h`);
	}

	if (!escalate) return null;

	const severityMap: Record<string, string> = {
		low: 'medium',
		medium: 'high',
		high: 'critical',
		critical: 'critical',
	};

	return {
		originalSeverity,
		escalatedSeverity: severityMap[originalSeverity] || 'high',
		escalationReason: reasons.join('; '),
		afterHoursContext: context,
	};
}

export function shouldEscalateRoute(context: AfterHoursContext): {
	route: 'standard' | 'oncall' | 'emergency';
	reason: string;
} {
	if (!context.isAfterHours) {
		return { route: 'standard', reason: 'Within business hours' };
	}

	if (context.hoursSinceLastBusinessLogin !== null && context.hoursSinceLastBusinessLogin > 72) {
		return { route: 'emergency', reason: 'No human login for 72+ hours' };
	}

	if (context.isWeekend) {
		return { route: 'oncall', reason: 'Weekend change detected' };
	}

	return { route: 'oncall', reason: 'After-hours change detected' };
}

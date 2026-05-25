export interface UebaUser {
	name: string;
	email: string;
	role: string;
	riskScore: number;
	riskChange: number;
	riskLevel: string;
	anomalies: Array<{ type: string; detail: string; timestamp: string; severity: string }>;
	baseline: { avgLoginTime: string; avgLocation: string; avgDataAccess: string };
	recentActivity: { logins: number; dataAccess: string; resourcesAccessed: number; failedLogins: number };
}

interface DbUser {
	display_name: string;
	mail: string;
	user_principal_name: string;
	job_title: string | null;
	last_sign_in_at: string | null;
	account_enabled: number | boolean;
}

function computeRisk(user: DbUser): { score: number; level: string; anomalies: UebaUser['anomalies'] } {
	const anomalies: UebaUser['anomalies'] = [];
	let score = 0;
	const now = Date.now();

	if (user.last_sign_in_at) {
		const lastSign = new Date(user.last_sign_in_at).getTime();
		const daysSince = (now - lastSign) / 86400000;
		if (daysSince > 180) {
			score += 30;
			anomalies.push({ type: 'inactive', detail: `No sign-in for ${Math.floor(daysSince)} days`, timestamp: user.last_sign_in_at, severity: 'high' });
		} else if (daysSince > 90) {
			score += 15;
			anomalies.push({ type: 'inactive', detail: `No sign-in for ${Math.floor(daysSince)} days`, timestamp: user.last_sign_in_at, severity: 'medium' });
		} else if (daysSince > 30) {
			score += 5;
			anomalies.push({ type: 'inactive', detail: `No sign-in for ${Math.floor(daysSince)} days`, timestamp: user.last_sign_in_at, severity: 'low' });
		}
		// Active users with recent sign-in: score stays 0
	} else if (!user.last_sign_in_at && user.account_enabled) {
		// Enabled account that never signed in — might just be missing data from sync
		score += 5;
		anomalies.push({ type: 'no-data', detail: 'Sign-in data not yet synced', timestamp: new Date().toISOString(), severity: 'info' });
	}

	// Disabled accounts: only flag if they've been active recently (orphaned risk)
	if (!user.account_enabled) {
		if (user.last_sign_in_at) {
			const daysSince = (now - new Date(user.last_sign_in_at).getTime()) / 86400000;
			if (daysSince < 30) {
				score += 20;
				anomalies.push({ type: 'account', detail: 'Recently active account was disabled', timestamp: user.last_sign_in_at, severity: 'medium' });
			}
		}
		// Long-disabled accounts with no activity are expected — low risk
		score += 5;
	}

	const level = score >= 50 ? 'critical' : score >= 30 ? 'high' : score >= 15 ? 'medium' : 'low';
	return { score: Math.min(score, 100), level, anomalies };
}

export function buildUebaFromUsers(dbUsers: DbUser[]): UebaUser[] {
	return dbUsers.map((u) => {
		const { score, level, anomalies } = computeRisk(u);
		return {
			name: u.display_name || 'Unknown',
			email: u.user_principal_name || u.mail || '',
			role: u.job_title || 'User',
			riskScore: score,
			riskChange: 0,
			riskLevel: level,
			anomalies,
			baseline: { avgLoginTime: 'N/A', avgLocation: 'N/A', avgDataAccess: 'N/A' },
			recentActivity: { logins: 0, dataAccess: '0 MB', resourcesAccessed: 0, failedLogins: 0 },
		};
	});
}

export function getUebaSummary(users: UebaUser[]) {
	if (users.length === 0) {
		return { totalMonitored: 0, criticalRisk: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0, totalAnomalies: 0, avgRiskScore: 0 };
	}
	return {
		totalMonitored: users.length,
		criticalRisk: users.filter(u => u.riskLevel === 'critical').length,
		highRisk: users.filter(u => u.riskLevel === 'high').length,
		mediumRisk: users.filter(u => u.riskLevel === 'medium').length,
		lowRisk: users.filter(u => u.riskLevel === 'low').length,
		totalAnomalies: users.reduce((sum, u) => sum + u.anomalies.length, 0),
		avgRiskScore: Math.round(users.reduce((sum, u) => sum + u.riskScore, 0) / users.length),
	};
}

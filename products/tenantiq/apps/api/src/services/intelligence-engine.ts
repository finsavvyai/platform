/**
 * Intelligence Engine
 *
 * Analyzes tenant health through:
 * - User activity monitoring (inactive user detection)
 * - License utilization analysis
 * - Security posture assessment
 * - Compliance monitoring
 *
 * This barrel re-exports the class-based API for backward compatibility.
 */

import type { Env } from '../index';
import type { InactiveUserAlert, ActivitySnapshot } from './intelligence/types';
import { analyzeInactiveUsers } from './intelligence/alert-generator';
import { analyzeLicenseWaste } from './intelligence/license-analyzer';
import { getUserActivitySnapshot } from './intelligence/snapshot-reader';

export type { InactiveUserAlert, ActivitySnapshot };

export class IntelligenceEngine {
	private env: Env;
	private tenantId: string;

	constructor(env: Env, tenantId: string) {
		this.env = env;
		this.tenantId = tenantId;
	}

	async analyzeInactiveUsers(): Promise<InactiveUserAlert[]> {
		return analyzeInactiveUsers(this.env, this.tenantId);
	}

	async getUserActivitySnapshot(userId: string): Promise<ActivitySnapshot | null> {
		return getUserActivitySnapshot(this.env, userId);
	}

	async analyzeLicenseWaste() {
		return analyzeLicenseWaste(this.env, this.tenantId);
	}
}

/**
 * Create an intelligence engine instance
 */
export function createIntelligenceEngine(env: Env, tenantId: string): IntelligenceEngine {
	return new IntelligenceEngine(env, tenantId);
}

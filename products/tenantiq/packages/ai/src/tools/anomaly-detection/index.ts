/**
 * Anomaly Detection & Smart Alerts
 *
 * Detects unusual patterns in M365 tenant activity:
 * - Login anomalies (unusual locations, times, impossible travel)
 * - License usage spikes/drops
 * - Permission escalation detection
 * - Cost anomalies
 * - Shadow IT detection
 * - Generates natural-language explanations via AI
 */

export type {
	AnomalyEvent,
	AnomalyType,
	AnomalyBaseline,
	LoginEvent,
	ActivityMetrics,
	AnomalyReport,
	TrendPoint,
} from './types';

export { detectLoginAnomalies } from './login-detection';
export { detectActivityAnomalies } from './activity-detection';
export { generateAnomalyReport } from './report';

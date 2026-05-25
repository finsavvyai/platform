/**
 * AI Executive Report Generator
 *
 * Generates boardroom-ready M365 management reports with:
 * - Executive summary, KPIs, trends, recommendations
 * - HTML email-ready format with charts data
 * - Shareable public report links
 * - Scheduled report support (weekly/monthly)
 */

export type {
	ReportConfig,
	ReportKPI,
	ReportSection,
	ExecutiveReport,
	ReportAction,
	FinancialSummary,
	ReportMetrics,
} from './types';

export { generateExecutiveReport } from './generate';

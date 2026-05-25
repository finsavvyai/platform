/**
 * AI Executive Report Generator — Barrel Export
 *
 * Re-exports all types and the main generator from the
 * executive-report/ directory for backwards compatibility.
 */

export type {
	ReportConfig,
	ReportKPI,
	ReportSection,
	ExecutiveReport,
	ReportAction,
	FinancialSummary,
	ReportMetrics,
} from './executive-report/types';

export { generateExecutiveReport } from './executive-report/generate';

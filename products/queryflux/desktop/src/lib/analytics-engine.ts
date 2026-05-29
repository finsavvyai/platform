import type { QueryResult } from './tauri-ipc';

export type ChartType = 'bar' | 'line' | 'scatter' | 'forecast';
export type CanvasMode = 'explore' | 'dashboard' | 'story';
export type ArtifactSource = 'query-result' | 'sample';
export type TileTone = 'good' | 'neutral' | 'warn';

export interface SemanticMetric {
  certified: boolean;
  grain: string;
  id: string;
  name: string;
  owner: string;
}

export interface ChartRow {
  displayValue: string;
  label: string;
  rawValue: number;
  value: number;
}

export interface ResultAnalysis {
  average: number;
  columns: number;
  labelColumn: string;
  max: number;
  min: number;
  rowCount: number;
  source: ArtifactSource;
  total: number;
  valueColumn: string;
}

export interface ChartSpec {
  analysis: ResultAnalysis;
  confidence: number;
  metricName: string;
  recommendation: string;
  rows: ChartRow[];
  source: ArtifactSource;
  title: string;
  type: ChartType;
}

export interface DashboardTile {
  delta: string;
  label: string;
  tone: TileTone;
  value: string;
}

export interface ExplorationBrief {
  bullets: string[];
  title: string;
  warning?: string;
}

export interface PinnedArtifact {
  createdAt: string;
  id: string;
  source: ArtifactSource;
  summary: string;
  title: string;
}

const SAMPLE_ROWS: ChartRow[] = [
  { label: 'Enterprise', value: 86, rawValue: 86, displayValue: '86%' },
  { label: 'Scale-Up', value: 64, rawValue: 64, displayValue: '64%' },
  { label: 'Mid-Market', value: 48, rawValue: 48, displayValue: '48%' },
  { label: 'Starter', value: 31, rawValue: 31, displayValue: '31%' },
];

const SAMPLE_ANALYSIS: ResultAnalysis = {
  average: 57.25,
  columns: 2,
  labelColumn: 'segment',
  max: 86,
  min: 31,
  rowCount: SAMPLE_ROWS.length,
  source: 'sample',
  total: 229,
  valueColumn: 'score',
};

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/[$,%\s]/g, '');

  if (!normalized || Number.isNaN(Number(normalized))) {
    return null;
  }

  return Number(normalized);
}

function formatNumber(value: number): string {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (absolute >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function labelize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function chooseLabelColumn(result: QueryResult): string {
  const dimension = result.columns.find((column) =>
    result.rows.some((row) => typeof row[column.name] === 'string' && toNumericValue(row[column.name]) === null),
  );

  return dimension?.name ?? result.columns[0]?.name ?? 'label';
}

function chooseValueColumn(result: QueryResult, labelColumn: string): string {
  const typedMetric = result.columns.find((column) => {
    if (column.name === labelColumn) {
      return false;
    }

    const hasNumericValue = result.rows.some((row) => toNumericValue(row[column.name]) !== null);
    const typeLooksNumeric = /int|float|double|decimal|numeric|number|real|money/i.test(column.data_type);
    const nameLooksMetric = /(^|_)(amount|count|duration|ms|pct|rate|score|sum|total|usd|value)($|_)/i.test(
      column.name,
    );

    return typeLooksNumeric || (nameLooksMetric && hasNumericValue);
  });

  if (typedMetric) {
    return typedMetric.name;
  }

  const parsedMetric = result.columns.find((column) =>
    column.name !== labelColumn && result.rows.some((row) => toNumericValue(row[column.name]) !== null),
  );

  return parsedMetric?.name ?? result.columns.find((column) => column.name !== labelColumn)?.name ?? labelColumn;
}

function analyzeResult(result: QueryResult | null): ResultAnalysis {
  if (!result?.success || result.rows.length === 0 || result.columns.length === 0) {
    return SAMPLE_ANALYSIS;
  }

  const labelColumn = chooseLabelColumn(result);
  const valueColumn = chooseValueColumn(result, labelColumn);
  const values = result.rows
    .map((row) => toNumericValue(row[valueColumn]))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return {
      ...SAMPLE_ANALYSIS,
      columns: result.columns.length,
      labelColumn,
      rowCount: result.row_count,
      source: 'query-result',
      valueColumn,
    };
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    average: total / values.length,
    columns: result.columns.length,
    labelColumn,
    max: Math.max(...values),
    min: Math.min(...values),
    rowCount: result.row_count,
    source: 'query-result',
    total,
    valueColumn,
  };
}

export function serializeQueryResultToCsv(result: QueryResult): string {
  const headers = result.columns.map((column) => column.name);
  const headerRow = headers.map(escapeCsvCell).join(',');
  const dataRows = result.rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(','));

  return [headerRow, ...dataRows].join('\n');
}

export function summarizeQueryResult(result: QueryResult): string {
  if (!result.success) {
    return result.error ?? 'Query failed with no backend error.';
  }

  return `${result.row_count} row${result.row_count === 1 ? '' : 's'}, ${result.columns.length} column${result.columns.length === 1 ? '' : 's'}, ${result.execution_time_ms}ms`;
}

export function deriveChartRows(result: QueryResult | null): ChartRow[] {
  const analysis = analyzeResult(result);

  if (analysis.source === 'sample' || !result?.success || result.rows.length === 0) {
    return SAMPLE_ROWS;
  }

  const max = Math.max(Math.abs(analysis.max), Math.abs(analysis.min), 1);

  return result.rows.slice(0, 6).map((row, index) => {
    const rawValue = toNumericValue(row[analysis.valueColumn]) ?? SAMPLE_ROWS[index % SAMPLE_ROWS.length].rawValue;
    const label = String(row[analysis.labelColumn] ?? `Row ${index + 1}`);
    const value = Math.max(8, Math.min(100, Math.round((Math.abs(rawValue) / max) * 100)));

    return {
      displayValue: formatNumber(rawValue),
      label,
      rawValue,
      value,
    };
  });
}

export function buildChartSpec({
  canvasMode,
  chartType,
  metric,
  question,
  result,
}: {
  canvasMode: CanvasMode;
  chartType: ChartType;
  metric: SemanticMetric;
  question: string;
  result: QueryResult | null;
}): ChartSpec {
  const analysis = analyzeResult(result);
  const rows = deriveChartRows(result);
  const source = analysis.source;
  const trimmedQuestion = question.trim();
  const recommendationByType: Record<ChartType, string> = {
    bar: source === 'query-result' ? 'ranked comparison using executed result rows' : 'bar comparison using sample segments',
    forecast: source === 'query-result' ? 'forecast-ready trend with current result baseline' : 'forecast draft awaiting live rows',
    line: source === 'query-result' ? 'trend view from current metric column' : 'trend draft awaiting time-series rows',
    scatter: source === 'query-result' ? 'outlier scan against the selected numeric column' : 'outlier draft awaiting live rows',
  };
  const title = canvasMode === 'story'
    ? `${metric.name} decision story`
    : canvasMode === 'explore' && trimmedQuestion
      ? trimmedQuestion.slice(0, 68)
    : source === 'query-result'
      ? `${labelize(analysis.valueColumn)} by ${labelize(analysis.labelColumn)}`
      : `${metric.name} by segment`;

  return {
    analysis,
    confidence: source === 'query-result' ? 0.86 : 0.58,
    metricName: metric.name,
    recommendation: recommendationByType[chartType],
    rows,
    source,
    title,
    type: chartType,
  };
}

export function buildDashboardTiles(result: QueryResult | null, metric: SemanticMetric): DashboardTile[] {
  const analysis = analyzeResult(result);

  if (analysis.source === 'sample') {
    return [
      { label: metric.name, value: metric.certified ? 'Certified' : 'Draft', delta: metric.owner, tone: metric.certified ? 'good' : 'warn' },
      { label: 'Rows', value: `${analysis.rowCount}`, delta: 'sample model', tone: 'neutral' },
      { label: 'Average', value: formatNumber(analysis.average), delta: analysis.valueColumn, tone: 'good' },
      { label: 'Source', value: 'Sample', delta: 'run a query', tone: 'warn' },
    ];
  }

  return [
    { label: 'Rows', value: `${analysis.rowCount}`, delta: `${analysis.columns} columns`, tone: 'good' },
    { label: labelize(analysis.valueColumn), value: formatNumber(analysis.total), delta: `avg ${formatNumber(analysis.average)}`, tone: 'good' },
    { label: 'Max', value: formatNumber(analysis.max), delta: labelize(analysis.labelColumn), tone: 'neutral' },
    { label: 'Evidence', value: 'Live', delta: 'last query result', tone: 'good' },
  ];
}

export function buildExplorationBrief({
  chartSpec,
  metric,
  question,
}: {
  chartSpec: ChartSpec;
  metric: SemanticMetric;
  question: string;
}): ExplorationBrief {
  const topRow = chartSpec.rows.reduce((leader, row) => (row.rawValue > leader.rawValue ? row : leader), chartSpec.rows[0]);
  const questionText = question.trim() || `Explain ${metric.name.toLowerCase()} and recommend next action.`;
  const evidenceText = chartSpec.source === 'query-result'
    ? `Evidence comes from ${chartSpec.analysis.rowCount} executed row${chartSpec.analysis.rowCount === 1 ? '' : 's'} using ${labelize(chartSpec.analysis.valueColumn)}.`
    : 'Evidence is a sample semantic model until a query result is available.';

  return {
    bullets: [
      `Question: ${questionText}`,
      evidenceText,
      `Top signal: ${topRow.label} at ${topRow.displayValue}; average is ${formatNumber(chartSpec.analysis.average)}.`,
      `${metric.name} is ${metric.certified ? 'certified' : 'draft'} at ${metric.grain} grain for ${metric.owner}.`,
    ],
    title: chartSpec.source === 'query-result' ? 'Result-backed narrative' : 'Draft narrative',
    warning: metric.certified ? undefined : 'Metric owner approval is required before stakeholder sharing.',
  };
}

export function buildPinnedResultArtifact({
  connectionName,
  query,
  result,
}: {
  connectionName?: string;
  query: string;
  result: QueryResult;
}): PinnedArtifact {
  return {
    createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    id: `result_${Date.now()}`,
    source: 'query-result',
    summary: `${summarizeQueryResult(result)} from ${connectionName ?? 'selected data link'}. ${query.trim().split('\n')[0]?.slice(0, 72) ?? 'Untitled query'}`,
    title: 'Pinned query result',
  };
}

export function buildPinnedChartArtifact(chartSpec: ChartSpec, brief: ExplorationBrief): PinnedArtifact {
  return {
    createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    id: `chart_${Date.now()}`,
    source: chartSpec.source,
    summary: `${brief.title}: ${chartSpec.title} with ${Math.round(chartSpec.confidence * 100)}% confidence.`,
    title: chartSpec.title,
  };
}

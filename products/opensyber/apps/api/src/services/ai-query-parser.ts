/**
 * AI Query Parser
 *
 * Parses natural language security queries into structured filters.
 * Supports agent activity, events, and secrets queries.
 */

export interface Filter {
  field: string;
  operator: 'eq' | 'contains' | 'gt' | 'lt' | 'in';
  value: string | number | string[];
}

export interface TimeRange {
  from: string;
  to: string;
}

export interface ParsedQuery {
  table: string;
  filters: Filter[];
  timeRange?: TimeRange;
  sortBy?: string;
  limit?: number;
}

interface PatternRule {
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => Partial<ParsedQuery>;
}

const TABLE_KEYWORDS: Record<string, string> = {
  agent: 'agent_activity',
  event: 'agent_activity',
  activity: 'agent_activity',
  secret: 'agent_activity',
  credential: 'agent_activity',
  finding: 'cspm_findings',
  vulnerability: 'cspm_findings',
  alert: 'alerts',
  incident: 'incidents',
  policy: 'policies',
  oauth: 'saas_oauth_apps',
  app: 'saas_oauth_apps',
};

const TIME_EXPRESSIONS: Record<string, number> = {
  'last hour': 1 / 24,
  'last 24 hours': 1,
  'today': 1,
  'yesterday': 2,
  'last week': 7,
  'last 7 days': 7,
  'last month': 30,
  'last 30 days': 30,
  'last quarter': 90,
  'last 90 days': 90,
};

const SEVERITY_TERMS: Record<string, string> = {
  critical: 'critical',
  severe: 'critical',
  high: 'high',
  dangerous: 'high',
  medium: 'medium',
  moderate: 'medium',
  low: 'low',
  minor: 'low',
};

const PATTERN_RULES: PatternRule[] = [
  {
    pattern: /agents?\s+that\s+accessed\s+(.+?)(?:\s+files?)?$/i,
    extract: (m) => ({
      table: 'agent_activity',
      filters: [{ field: 'filePath', operator: 'contains', value: m[1]?.trim() ?? '' }],
    }),
  },
  {
    pattern: /secrets?\s+detected\s+by\s+(\w+)/i,
    extract: (m) => ({
      table: 'agent_activity',
      filters: [
        { field: 'eventType', operator: 'eq', value: 'secret_access' },
        { field: 'agentName', operator: 'eq', value: m[1] ?? '' },
      ],
    }),
  },
  {
    pattern: /(critical|high|medium|low)\s+events?/i,
    extract: (m) => ({
      table: 'agent_activity',
      filters: [{ field: 'risk', operator: 'eq', value: SEVERITY_TERMS[m[1]?.toLowerCase() ?? ''] ?? m[1] ?? '' }],
    }),
  },
  {
    pattern: /failed\s+(login|auth|authentication)/i,
    extract: () => ({
      table: 'agent_activity',
      filters: [{ field: 'eventType', operator: 'eq', value: 'auth_failure' }],
    }),
  },
  {
    pattern: /network\s+(calls?|requests?)\s+to\s+(.+)/i,
    extract: (m) => ({
      table: 'agent_activity',
      filters: [
        { field: 'eventType', operator: 'eq', value: 'network_call' },
        { field: 'destination', operator: 'contains', value: m[2]?.trim() ?? '' },
      ],
    }),
  },
  {
    pattern: /oauth\s+apps?\s+with\s+(excessive|too many)\s+(permissions?|scopes?)/i,
    extract: () => ({
      table: 'saas_oauth_apps',
      filters: [{ field: 'riskLevel', operator: 'in', value: ['high', 'critical'] }],
    }),
  },
  {
    pattern: /open\s+(findings?|vulnerabilit)/i,
    extract: () => ({
      table: 'cspm_findings',
      filters: [{ field: 'status', operator: 'eq', value: 'open' }],
    }),
  },
];

/**
 * Extract time range from the query string
 */
function extractTimeRange(query: string): TimeRange | undefined {
  const lower = query.toLowerCase();
  for (const [expr, days] of Object.entries(TIME_EXPRESSIONS)) {
    if (lower.includes(expr)) {
      const from = new Date(Date.now() - days * 86400000).toISOString();
      return { from, to: new Date().toISOString() };
    }
  }
  return undefined;
}

/**
 * Infer the target table from query keywords
 */
function inferTable(query: string): string {
  const lower = query.toLowerCase();
  for (const [keyword, table] of Object.entries(TABLE_KEYWORDS)) {
    if (lower.includes(keyword)) return table;
  }
  return 'agent_activity';
}

/**
 * Parse a natural language query into structured filters
 */
export function parseNaturalLanguageQuery(query: string): ParsedQuery {
  const timeRange = extractTimeRange(query);

  for (const rule of PATTERN_RULES) {
    const match = query.match(rule.pattern);
    if (match) {
      const extracted = rule.extract(match);
      return {
        table: extracted.table ?? inferTable(query),
        filters: extracted.filters ?? [],
        timeRange,
        sortBy: 'createdAt',
        limit: 100,
      };
    }
  }

  // Fallback: extract severity and table from keywords
  const filters: Filter[] = [];
  const lower = query.toLowerCase();

  for (const [term, severity] of Object.entries(SEVERITY_TERMS)) {
    if (lower.includes(term)) {
      filters.push({ field: 'risk', operator: 'eq', value: severity });
      break;
    }
  }

  return {
    table: inferTable(query),
    filters,
    timeRange,
    sortBy: 'createdAt',
    limit: 100,
  };
}

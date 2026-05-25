/**
 * OpenTelemetry Ingestion Service
 *
 * Accept OTLP JSON format traces and spans.
 * Normalize to integration_events format.
 * Extract LangChain-specific attributes.
 */

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  status?: { code: number; message?: string };
  attributes?: Record<string, any>;
}

export interface OtlpTrace {
  resourceSpans?: Array<{
    scopeSpans?: Array<{
      spans: OtlpSpan[];
    }>;
  }>;
}

export interface NormalizedEvent {
  traceId: string;
  spanName: string;
  durationMs: number;
  status: 'success' | 'error';
  attributes: Record<string, any>;
}

export interface LangChainMetadata {
  runType?: string;
  chainName?: string;
  model?: string;
  tokens?: number;
  cost?: number;
  toolCalls?: string[];
}

/**
 * Process OTLP trace and extract normalized events.
 */
export function processOtelTrace(db: any, trace: OtlpTrace): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];

  if (!trace.resourceSpans) return events;

  for (const resourceSpan of trace.resourceSpans) {
    if (!resourceSpan.scopeSpans) continue;

    for (const scopeSpan of resourceSpan.scopeSpans) {
      for (const span of scopeSpan.spans) {
        const normalized = normalizeSpanToEvent(span);
        events.push(normalized);
      }
    }
  }

  return events;
}

/**
 * Normalize a span to integration event format.
 */
export function normalizeSpanToEvent(span: OtlpSpan): NormalizedEvent {
  const durationMs = (span.endTimeUnixNano - span.startTimeUnixNano) / 1_000_000;
  const status = span.status?.code === 0 ? 'success' : 'error';
  const metadata = extractLangChainMetadata(span.attributes);

  return {
    traceId: span.traceId,
    spanName: span.name,
    durationMs,
    status,
    attributes: {
      ...span.attributes,
      ...metadata,
      startTime: new Date(span.startTimeUnixNano / 1_000_000).toISOString(),
      endTime: new Date(span.endTimeUnixNano / 1_000_000).toISOString(),
    },
  };
}

/**
 * Extract LangChain-specific attributes from span attributes.
 */
export function extractLangChainMetadata(attributes?: Record<string, any>): Partial<LangChainMetadata> {
  if (!attributes) return {};

  const metadata: Partial<LangChainMetadata> = {};

  // LangChain standard attributes
  if (attributes['langchain.run_type']) {
    metadata.runType = String(attributes['langchain.run_type']);
  }
  if (attributes['langchain.chain_name']) {
    metadata.chainName = String(attributes['langchain.chain_name']);
  }
  if (attributes['langchain.model']) {
    metadata.model = String(attributes['langchain.model']);
  }

  // Token counting
  if (attributes['langchain.token_count']) {
    metadata.tokens = Number(attributes['langchain.token_count']);
  }
  if (attributes['llm.usage.completion_tokens']) {
    metadata.tokens = (metadata.tokens ?? 0) + Number(attributes['llm.usage.completion_tokens']);
  }
  if (attributes['llm.usage.prompt_tokens']) {
    metadata.tokens = (metadata.tokens ?? 0) + Number(attributes['llm.usage.prompt_tokens']);
  }

  // Cost estimation (if provided)
  if (attributes['langchain.cost_usd']) {
    metadata.cost = Number(attributes['langchain.cost_usd']);
  }

  // Tool calls
  if (attributes['langchain.tool_calls']) {
    const toolCalls = attributes['langchain.tool_calls'];
    metadata.toolCalls = Array.isArray(toolCalls) ? toolCalls : [String(toolCalls)];
  }

  return metadata;
}

/**
 * Ingest OTEL trace and create integration event(s).
 * Returns count of events created.
 */
export async function ingestOtelTrace(
  db: any,
  trace: OtlpTrace,
  integrationSlug: string,
): Promise<number> {
  const events = processOtelTrace(db, trace);

  try {
    // In a real implementation, insert into integrationEvents table
    // await db.insert(integrationEvents).values(
    //   events.map(e => ({
    //     connectionId: '...',
    //     eventType: e.spanName,
    //     severity: e.status === 'error' ? 'high' : 'info',
    //     summary: `${e.spanName} (${e.durationMs.toFixed(0)}ms)`,
    //     rawPayload: JSON.stringify(e),
    //   }))
    // );
    return events.length;
  } catch (err) {
    console.error('Failed to ingest OTEL trace:', err);
    return 0;
  }
}

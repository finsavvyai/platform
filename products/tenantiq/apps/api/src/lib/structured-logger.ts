/**
 * Structured logging for AI operations — wraps Sentry spans
 * and provides standardized breadcrumbs for the AI pipeline.
 */

import * as Sentry from '@sentry/cloudflare';
import { addBreadcrumb, captureException } from './sentry';
import { logger } from './logger';

export type AIOperation = 'security-scan' | 'license-optimize' | 'ask' | 'chain';
export type AISource = 'booster' | 'cache' | 'claw-gateway' | 'anthropic' | 'openclaw';

export interface AIOperationLog {
	operation: AIOperation;
	tenantId: string;
	source: AISource;
	durationMs: number;
	tokensSaved?: number;
	cacheHit: boolean;
	error?: string;
}

/** Log a completed AI operation with structured data and Sentry breadcrumb. */
export function logAIOperation(log: AIOperationLog): void {
	const data: Record<string, unknown> = {
		operation: log.operation,
		tenantId: log.tenantId,
		source: log.source,
		durationMs: log.durationMs,
		cacheHit: log.cacheHit,
	};

	if (log.tokensSaved !== undefined) {
		data.tokensSaved = log.tokensSaved;
	}
	if (log.error) {
		data.error = log.error;
	}

	// Structured console log
	const level = log.error ? 'warn' : 'info';
	if (level === 'warn') {
		logger.warn(`ai.${log.operation}`, data);
	} else {
		logger.info(`ai.${log.operation}`, data);
	}

	// Sentry breadcrumb for trace context
	addBreadcrumb('ai.pipeline', `${log.operation} via ${log.source}`, data, level === 'warn' ? 'warning' : 'info');

	// Tag current Sentry scope with AI metadata
	Sentry.setTag('ai.operation', log.operation);
	Sentry.setTag('ai.source', log.source);
	if (log.cacheHit) {
		Sentry.setTag('ai.cache', 'hit');
	}
}

/**
 * Wrap an async function in a Sentry performance span.
 * Automatically tracks duration, logs breadcrumbs, and captures errors.
 */
export async function withAISpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
	const start = Date.now();

	addBreadcrumb('ai.span', `${name} started`, { timestamp: start });

	try {
		const result = await Sentry.startSpan(
			{ name, op: 'ai.operation' },
			async () => fn(),
		);

		const durationMs = Date.now() - start;
		addBreadcrumb('ai.span', `${name} completed`, { durationMs });

		return result;
	} catch (error) {
		const durationMs = Date.now() - start;
		addBreadcrumb('ai.span', `${name} failed`, { durationMs }, 'error');

		if (error instanceof Error) {
			captureException(error, { span: name, durationMs });
		}
		throw error;
	}
}

/** Record the start of an AI pipeline stage (for multi-step chains). */
export function markPipelineStage(
	stage: string,
	metadata?: Record<string, unknown>,
): void {
	addBreadcrumb('ai.pipeline.stage', stage, {
		...metadata,
		timestamp: Date.now(),
	});
}

/**
 * Create a scoped logger for a specific AI operation.
 * Returns a child logger pre-tagged with operation context.
 */
export function createAILogger(operation: AIOperation, tenantId: string) {
	return logger.child({
		module: 'ai',
		operation,
		tenantId,
	});
}

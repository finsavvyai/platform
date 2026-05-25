import { configure, getLogger, type LogRecord } from '@logtape/logtape';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
	tenantId?: string;
	userId?: string;
	requestId?: string;
	[key: string]: unknown;
}

/** JSON sink for Cloudflare Workers structured log capture. */
function jsonConsoleSink(record: LogRecord): void {
	const json = JSON.stringify({
		level: record.level,
		category: record.category.join('.'),
		message: record.message
			.map((part) => (typeof part === 'string' ? part : JSON.stringify(part)))
			.join(''),
		...record.properties,
		timestamp: new Date(record.timestamp).toISOString(),
	});

	switch (record.level) {
		case 'error':
		case 'fatal':
			console.error(json);
			break;
		case 'warning':
			console.warn(json);
			break;
		default:
			console.log(json);
			break;
	}
}

let configured = false;

/** Initialise LogTape once. Safe to call multiple times. */
export async function setupLogging(): Promise<void> {
	if (configured) return;
	configured = true;

	await configure({
		sinks: { console: jsonConsoleSink },
		loggers: [
			{ category: ['tenantiq'], sinks: ['console'], lowestLevel: 'info' },
			{ category: ['tenantiq', 'ai'], sinks: ['console'], lowestLevel: 'debug' },
		],
	});
}

/**
 * Structured logger for Cloudflare Workers.
 * Uses LogTape underneath; outputs JSON for Logpush/Datadog/etc.
 */
class Logger {
	private context: LogContext = {};
	private categoryPath: string[];

	constructor(category: string[] = ['tenantiq']) {
		this.categoryPath = category;
	}

	private get ltLogger() {
		return getLogger(this.categoryPath);
	}

	/** Create a child logger with additional context and optional sub-category. */
	child(context: LogContext): Logger {
		const subCategory = context.module
			? [...this.categoryPath, String(context.module)]
			: this.categoryPath;
		const child = new Logger(subCategory);
		child.context = { ...this.context, ...context };
		return child;
	}

	debug(message: string, data?: Record<string, unknown>) {
		this.ltLogger.debug(message, { ...this.context, ...data });
	}

	info(message: string, data?: Record<string, unknown>) {
		this.ltLogger.info(message, { ...this.context, ...data });
	}

	warn(message: string, data?: Record<string, unknown>) {
		this.ltLogger.warning(message, { ...this.context, ...data });
	}

	error(message: string, error?: unknown, data?: Record<string, unknown>) {
		const errorData: Record<string, unknown> = { ...data };
		if (error instanceof Error) {
			errorData.error = error.message;
			errorData.stack = error.stack;
		} else if (error != null) {
			errorData.error = String(error);
		}
		this.ltLogger.error(message, { ...this.context, ...errorData });
	}
}

export const logger = new Logger();

/** Convenience: log an error with context string and optional metadata */
export function logError(context: string, error: unknown, meta?: Record<string, unknown>) {
	const lt = getLogger(['tenantiq']);
	const msg = error instanceof Error ? error.message : String(error);
	const stack = error instanceof Error ? error.stack : undefined;
	lt.error(msg, { context, stack, ...meta });
}

/** Convenience: log an info message with context string and optional metadata */
export function logInfo(context: string, message: string, meta?: Record<string, unknown>) {
	getLogger(['tenantiq']).info(message, { context, ...meta });
}

/** Convenience: log a warning with context string and optional metadata */
export function logWarn(context: string, message: string, meta?: Record<string, unknown>) {
	getLogger(['tenantiq']).warning(message, { context, ...meta });
}

export type { LogLevel, LogContext, Logger };

/**
 * Logger — lightweight structured logging for Cloudflare Workers
 * No external dependencies.
 */

interface LoggerInstance {
  info: (msg: string, data?: Record<string, unknown>) => void;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
  debug: (msg: string, data?: Record<string, unknown>) => void;
  child: (ctx: Record<string, unknown>) => LoggerInstance;
}

function createLogger(base: Record<string, unknown> = {}): LoggerInstance {
  const log = (level: string, msg: string, data?: Record<string, unknown>) => {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      JSON.stringify({ level, msg, ...base, ...data, ts: new Date().toISOString() }),
    );
  };
  return {
    info: (m, d) => log('info', m, d),
    warn: (m, d) => log('warn', m, d),
    error: (m, d) => log('error', m, d),
    debug: (m, d) => log('debug', m, d),
    child: (ctx) => createLogger({ ...base, ...ctx }),
  };
}

const rootLogger = createLogger({ service: 'qestro-backend' });

export const systemLogger = rootLogger.child({ service: 'system-integration' });
export const webSocketLogger = rootLogger.child({ service: 'websocket' });
export const zeroSyncLogger = rootLogger.child({ service: 'zerosync' });
export const apiLogger = rootLogger.child({ service: 'api' });
export const testLogger = rootLogger.child({ service: 'testing' });
export const authLogger = rootLogger.child({ service: 'auth' });
export const recordingLogger = rootLogger.child({ service: 'recording' });

export const performanceLogger = {
  startTimer: (label: string) => {
    const start = Date.now();
    return { stop: () => ({ label, duration: Date.now() - start }) };
  },
};

export const errorContext = {
  capture: (error: Error, context: Record<string, unknown> = {}) => {
    rootLogger.error('Captured error', { error: error.message, stack: error.stack, ...context });
    return { error: error.message, ...context };
  },
};

export const loggers = {
  systemEvent: (event: string, data: Record<string, unknown> = {}) =>
    systemLogger.info(`System Event: ${event}`, data),
  componentEvent: (component: string, event: string, data: Record<string, unknown> = {}) =>
    rootLogger.info(`Component Event: ${component}:${event}`, data),
  apiRequest: (method: string, path: string, statusCode: number, duration: number, userId?: string, reqId?: string) =>
    apiLogger.info('API Request', { method, path, statusCode, duration: `${duration}ms`, userId, requestId: reqId }),
  authEvent: (event: string, userId?: string, data: Record<string, unknown> = {}) =>
    authLogger.info(`Auth Event: ${event}`, { userId, ...data }),
  testEvent: (event: string, testId?: string, data: Record<string, unknown> = {}) =>
    testLogger.info(`Test Event: ${event}`, { testId, ...data }),
  recordingEvent: (event: string, sessionId?: string, data: Record<string, unknown> = {}) =>
    recordingLogger.info(`Recording Event: ${event}`, { sessionId, ...data }),
  wsEvent: (event: string, connectionId?: string, data: Record<string, unknown> = {}) =>
    webSocketLogger.info(`WebSocket Event: ${event}`, { connectionId, ...data }),
  syncEvent: (event: string, data: Record<string, unknown> = {}) =>
    zeroSyncLogger.info(`Sync Event: ${event}`, data),
};

export const errorReporter = {
  report: (error: Error, context: Record<string, unknown> = {}) => {
    rootLogger.error('Error Report', { error: error.message, ...context });
    return { error: error.message, ...context };
  },
  reportCritical: (error: Error, context: Record<string, unknown> = {}) => {
    rootLogger.error('Critical Error Report', { error: error.message, ...context });
    return { error: error.message, ...context };
  },
};

export const healthLogger = {
  checkPassed: (component: string, duration: number) =>
    rootLogger.debug(`Health Check Passed: ${component}`, { duration: `${duration}ms` }),
  checkFailed: (component: string, error: Error, duration: number) =>
    rootLogger.warn(`Health Check Failed: ${component}`, { error: error.message, duration: `${duration}ms` }),
  systemHealth: (status: string, components: Record<string, string>) =>
    rootLogger.info('System Health Status', { status, components }),
};

export const auditLogger = {
  securityEvent: (event: string, userId?: string, data: Record<string, unknown> = {}) =>
    rootLogger.warn(`Security Event: ${event}`, { userId, ts: new Date().toISOString(), ...data }),
  accessAttempt: (userId: string, resource: string, action: string, success: boolean, ip?: string) =>
    rootLogger.info('Access Attempt', { userId, resource, action, success, ip }),
};

export const logRecordingEvent = (sessionId: string, event: string, data: Record<string, unknown> = {}) =>
  rootLogger.info(`Recording Event: ${event}`, { sessionId, ...data });

export const logUserAction = (userId: string, action: string, target?: string, data: Record<string, unknown> = {}) =>
  auditLogger.accessAttempt(userId, target || 'unknown', action, true, typeof data.ip === 'string' ? data.ip : undefined);

export const logger = rootLogger;
export default rootLogger;

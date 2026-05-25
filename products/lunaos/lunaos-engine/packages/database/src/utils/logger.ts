import { createLogger, format, transports, Logger } from 'winston';

const { combine, timestamp, errors, json, printf, colorize } = format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
  const stackStr = stack ? `\n${stack}` : '';
  return `${timestamp} [${level}]: ${message}${metaStr}${stackStr}`;
});

// Create logger instance
export const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'database-layer' },
  transports: [
    // Console transport for development
    new transports.Console({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        consoleFormat
      ),
    }),
  ],
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        printf(({ level, message, timestamp, stack }) => {
          return `${timestamp} [${level}]: ${message}\n${stack}`;
        })
      ),
    }),
  ],
  rejectionHandlers: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        printf(({ level, message, timestamp, stack }) => {
          return `${timestamp} [${level}]: ${message}\n${stack}`;
        })
      ),
    }),
  ],
});

// Add file transport for production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new transports.File({
      filename: 'logs/database-error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json()
      ),
    })
  );

  logger.add(
    new transports.File({
      filename: 'logs/database-combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json()
      ),
    })
  );
}

export default logger;

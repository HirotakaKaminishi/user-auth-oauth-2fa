import winston from 'winston';
import { config } from './index';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Custom log format for console
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Create Winston logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),
  defaultMeta: {
    service: 'user-auth-service',
    environment: config.server.env,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.logging.format === 'json'
        ? combine(json())
        : combine(colorize(), consoleFormat),
    }),

    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(json()),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(json()),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// Log level configuration in test environment
if (config.server.isTest) {
  logger.transports.forEach((t) => (t.silent = true));
}

export default logger;

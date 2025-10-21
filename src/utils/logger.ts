/**
 * Logger Utility
 * LSP-compatible logging (stderr for logs, stdout for LSP protocol)
 */

import { Connection } from 'vscode-languageserver';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Logger class for LSP-compatible logging
 */
export class Logger {
  private level: LogLevel = LogLevel.INFO;
  private connection: Connection | null = null;
  private context: string = '';

  constructor(context: string = 'HomeAssistantLSP') {
    this.context = context;
  }

  /**
   * Set the LSP connection for logging
   */
  setConnection(connection: Connection): void {
    this.connection = connection;
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel | string): void {
    const normalizedLevel = level.toUpperCase();
    if (normalizedLevel in LOG_LEVEL_PRIORITY) {
      this.level = normalizedLevel as LogLevel;
    }
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  /**
   * Format log message
   */
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    let formattedMessage = `[${timestamp}] [${level}] [${this.context}] ${message}`;

    if (data !== undefined) {
      if (typeof data === 'object') {
        try {
          formattedMessage += ` ${JSON.stringify(data)}`;
        } catch {
          formattedMessage += ` [Object]`;
        }
      } else {
        formattedMessage += ` ${data}`;
      }
    }

    return formattedMessage;
  }

  /**
   * Log a message
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, data);

    // Use LSP connection if available, otherwise fallback to stderr
    if (this.connection) {
      // Use the appropriate console method based on log level
      switch (level) {
        case LogLevel.ERROR:
          this.connection.console.error(formattedMessage);
          break;
        case LogLevel.WARN:
          this.connection.console.warn(formattedMessage);
          break;
        case LogLevel.INFO:
          this.connection.console.info(formattedMessage);
          break;
        case LogLevel.DEBUG:
        default:
          this.connection.console.log(formattedMessage);
          break;
      }
    } else {
      // Write to stderr to avoid interfering with LSP protocol on stdout
      process.stderr.write(formattedMessage + '\n');
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | any): void {
    const errorData = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    this.log(LogLevel.ERROR, message, errorData);
  }

  /**
   * Create a child logger with a new context
   */
  child(childContext: string): Logger {
    const childLogger = new Logger(`${this.context}:${childContext}`);
    childLogger.setLevel(this.level);
    if (this.connection) {
      childLogger.setConnection(this.connection);
    }
    return childLogger;
  }
}

// Global logger instance
let globalLogger: Logger | null = null;

/**
 * Get or create the global logger instance
 */
export function getLogger(context?: string): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(context || 'HomeAssistantLSP');
  } else if (context) {
    return globalLogger.child(context);
  }
  return globalLogger;
}

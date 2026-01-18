/**
 * Logger utility for LocalDevine
 * Only logs in development mode unless explicitly enabled
 */

const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  forceLog?: boolean;  // Force log even in production
}

class Logger {
  private prefix: string;

  constructor(prefix: string = 'LocalDevine') {
    this.prefix = prefix;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (isDev) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (isDev) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, options?: LogOptions, ...args: unknown[]): void {
    if (isDev || options?.forceLog) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, options?: LogOptions, ...args: unknown[]): void {
    // Always log errors, but with more detail in dev
    if (isDev || options?.forceLog) {
      console.error(this.formatMessage('error', message), ...args);
    } else {
      // In production, log minimal error info
      console.error(`[${this.prefix}] Error: ${message}`);
    }
  }

  /**
   * Create a child logger with a sub-prefix
   */
  child(subPrefix: string): Logger {
    return new Logger(`${this.prefix}:${subPrefix}`);
  }
}

// Default logger instance
const logger = new Logger();

// Named loggers for different modules
export const serviceLogger = new Logger('ServiceManager');
export const configLogger = new Logger('ConfigManager');
export const pathLogger = new Logger('PathResolver');
export const trayLogger = new Logger('TrayManager');
export const hostsLogger = new Logger('HostsManager');
export const databaseLogger = new Logger('DatabaseManager');
export const envLogger = new Logger('EnvManager');
export const sslLogger = new Logger('SSLManager');

export default logger;

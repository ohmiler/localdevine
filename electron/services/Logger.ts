/**
 * Logger utility for LocalDevine
 * - Development: Console logging only
 * - Production: Console + File logging for debugging
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogOptions {
  forceLog?: boolean;  // Force log even in production
  toFile?: boolean;    // Force write to file
}

// File logging configuration
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB per log file
const MAX_LOG_FILES = 5; // Keep 5 log files

class FileLogger {
  private static instance: FileLogger;
  private logDir: string = '';
  private currentLogFile: string = '';
  private initialized: boolean = false;
  private writeQueue: string[] = [];
  private isWriting: boolean = false;

  private constructor() {}

  static getInstance(): FileLogger {
    if (!FileLogger.instance) {
      FileLogger.instance = new FileLogger();
    }
    return FileLogger.instance;
  }

  initialize(): void {
    if (this.initialized) return;
    
    try {
      // Get user data path for logs
      if (app.isPackaged) {
        this.logDir = path.join(app.getPath('userData'), 'logs');
      } else {
        this.logDir = path.join(__dirname, '../..', 'logs');
      }
      
      // Create logs directory if not exists
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      
      // Set current log file
      this.currentLogFile = path.join(this.logDir, 'localdevine.log');
      
      // Rotate logs if needed
      this.rotateLogsIfNeeded();
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize file logger:', error);
    }
  }

  private rotateLogsIfNeeded(): void {
    try {
      if (!fs.existsSync(this.currentLogFile)) return;
      
      const stats = fs.statSync(this.currentLogFile);
      if (stats.size < MAX_LOG_SIZE) return;
      
      // Rotate existing log files
      for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
        const oldFile = path.join(this.logDir, `localdevine.${i}.log`);
        const newFile = path.join(this.logDir, `localdevine.${i + 1}.log`);
        
        if (fs.existsSync(oldFile)) {
          if (i === MAX_LOG_FILES - 1) {
            // Delete oldest file
            fs.unlinkSync(oldFile);
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }
      
      // Rename current log to .1.log
      fs.renameSync(this.currentLogFile, path.join(this.logDir, 'localdevine.1.log'));
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  write(message: string): void {
    if (!this.initialized) {
      this.initialize();
    }
    
    this.writeQueue.push(message + '\n');
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return;
    
    this.isWriting = true;
    
    try {
      const messages = this.writeQueue.splice(0, this.writeQueue.length);
      const content = messages.join('');
      
      fs.appendFileSync(this.currentLogFile, content, 'utf8');
      
      // Check if rotation is needed after write
      this.rotateLogsIfNeeded();
    } catch (error) {
      console.error('Failed to write to log file:', error);
    } finally {
      this.isWriting = false;
      
      // Process remaining items if any
      if (this.writeQueue.length > 0) {
        this.processQueue();
      }
    }
  }

  getLogDir(): string {
    if (!this.initialized) {
      this.initialize();
    }
    return this.logDir;
  }

  getLogFile(): string {
    if (!this.initialized) {
      this.initialize();
    }
    return this.currentLogFile;
  }
}

class Logger {
  private prefix: string;
  private fileLogger: FileLogger;

  constructor(prefix: string = 'LocalDevine') {
    this.prefix = prefix;
    this.fileLogger = FileLogger.getInstance();
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}] ${message}`;
  }

  private formatArgs(args: unknown[]): string {
    if (args.length === 0) return '';
    return ' ' + args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
  }

  private writeToFile(formattedMessage: string, args: unknown[]): void {
    const fullMessage = formattedMessage + this.formatArgs(args);
    this.fileLogger.write(fullMessage);
  }

  debug(message: string, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage('debug', message);
    
    if (isDev) {
      console.log(formattedMessage, ...args);
    }
    // Debug logs not written to file in production (too verbose)
  }

  info(message: string, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage('info', message);
    
    if (isDev) {
      console.info(formattedMessage, ...args);
    } else {
      // In production, write info to file
      this.writeToFile(formattedMessage, args);
    }
  }

  warn(message: string, options?: LogOptions, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage('warn', message);
    
    if (isDev || options?.forceLog) {
      console.warn(formattedMessage, ...args);
    }
    
    // Always write warnings to file in production
    if (!isDev || options?.toFile) {
      this.writeToFile(formattedMessage, args);
    }
  }

  error(message: string, options?: LogOptions, ...args: unknown[]): void {
    const formattedMessage = this.formatMessage('error', message);
    
    // Always log errors to console
    if (isDev || options?.forceLog) {
      console.error(formattedMessage, ...args);
    } else {
      console.error(`[${this.prefix}] Error: ${message}`);
    }
    
    // Always write errors to file
    this.writeToFile(formattedMessage, args);
  }

  /**
   * Create a child logger with a sub-prefix
   */
  child(subPrefix: string): Logger {
    return new Logger(`${this.prefix}:${subPrefix}`);
  }

  /**
   * Get the log directory path
   */
  static getLogDir(): string {
    return FileLogger.getInstance().getLogDir();
  }

  /**
   * Get the current log file path
   */
  static getLogFile(): string {
    return FileLogger.getInstance().getLogFile();
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

// Export Logger class for static method access
export { Logger };

export default logger;

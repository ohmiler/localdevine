import { app, BrowserWindow, session } from 'electron';
import path from 'path';

import { ServiceManager } from './services/ServiceManager';
import logger, { Logger } from './services/Logger';
import TrayManager from './services/TrayManager';
import ConfigManager from './services/ConfigManager';
import HostsManager from './services/HostsManager';
import ProjectTemplateManager from './services/ProjectTemplateManager';
import DatabaseManager from './services/DatabaseManager';
import EnvManager from './services/EnvManager';
import SSLManager from './services/SSLManager';
import AutoUpdater from './services/AutoUpdater';
import { registerIPCHandlers, initializeIPC } from './ipc';

// Initialize file logger
try {
  Logger.getLogDir(); // This will initialize the FileLogger
  logger.info('File logger initialized successfully');
} catch (error) {
  console.error('Failed to initialize file logger:', error);
}

// Basic error handling to catch the 'string' issue
if (typeof app === 'undefined') {
  logger.error('FATAL: electron module returned undefined/string. Exiting.', { forceLog: true });
  process.exit(1);
}

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { forceLog: true });
  if (error.stack) logger.error(error.stack, { forceLog: true });
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`, { forceLog: true });
});

// Set AppUserModelID for Windows
if (process.platform === 'win32') {
  app.setAppUserModelId('com.localdevine.app');
}

// Prevent multiple instances - only allow one instance to run
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

let mainWindow: BrowserWindow | null;
let serviceManager: ServiceManager | null;
let trayManager: TrayManager | null;
let configManager: ConfigManager | null;
let hostsManager: HostsManager | null;
let projectTemplateManager: ProjectTemplateManager | null;
let autoUpdater: AutoUpdater | null;

function createWindow(): BrowserWindow {
  // Use .ico for Windows for better taskbar support
  const iconPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'icon.ico')
    : path.join(__dirname, '../public/icon.ico');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'LocalDevine',
    icon: iconPath,
  });

  // Window error handlers
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    logger.error(`Window failed to load: ${errorCode} - ${errorDescription}`, { forceLog: true });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error(`Renderer process gone: ${details.reason}`, { forceLog: true });
  });

  // In production, load the built file
  // In dev, load Vite dev server for hot reload
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    // Use Vite dev server for hot reload in development
    const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    
    // Open DevTools in development mode
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  return mainWindow;
}

// Register all IPC handlers BEFORE app ready
registerIPCHandlers();

app.whenReady().then(() => {
  // Set Content Security Policy
  // In dev mode: relaxed CSP to allow Vite HMR (Hot Module Replacement)
  // In production: strict CSP for security
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "img-src 'self' data:; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "connect-src 'self' https://api.github.com;"
          ]
        }
      });
    });
  }
  // In dev mode, no CSP restrictions to allow Vite dev server with HMR

  const win = createWindow();

  // Initialize managers
  configManager = new ConfigManager();
  serviceManager = new ServiceManager(win, configManager);
  hostsManager = new HostsManager();
  projectTemplateManager = new ProjectTemplateManager();
  const databaseManager = new DatabaseManager(configManager);
  databaseManager.setMainWindow(win);
  const envManager = new EnvManager();
  const sslManager = new SSLManager();

  // Initialize IPC with manager references
  initializeIPC(win, serviceManager, configManager, hostsManager, projectTemplateManager, databaseManager, envManager, sslManager);

  // Start health monitoring
  serviceManager.startHealthMonitoring(5000);

  // Create system tray
  trayManager = new TrayManager(win, serviceManager, app);
  trayManager.create();

  // Initialize auto updater (only in production)
  if (app.isPackaged) {
    autoUpdater = new AutoUpdater(win);
    autoUpdater.checkOnStartup(10000); // Check for updates 10 seconds after startup
  }
});

// Properly quit when all windows are closed (Windows & Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS: re-create window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const win = createWindow();
    configManager = new ConfigManager();
    serviceManager = new ServiceManager(win, configManager);
    hostsManager = new HostsManager();
    projectTemplateManager = new ProjectTemplateManager();
    const databaseManager = new DatabaseManager(configManager);
    databaseManager.setMainWindow(win);
    
    initializeIPC(win, serviceManager, configManager, hostsManager, projectTemplateManager, databaseManager);
    
    trayManager = new TrayManager(win, serviceManager, app);
    trayManager.create();
  }
});

// Shutdown timeout constant (10 seconds)
const SHUTDOWN_TIMEOUT_MS = 10000;
let isQuitting = false;

// Cleanup all services before quitting with timeout protection
app.on('before-quit', async (event) => {
  // Prevent re-entry
  if (isQuitting) return;

  // Set tray to quitting mode
  if (trayManager) {
    trayManager.setQuitting(true);
  }

  if (serviceManager && serviceManager.hasRunningServices()) {
    event.preventDefault();
    isQuitting = true;
    logger.info('Stopping all services before quit...');

    // Create a timeout promise that forces quit
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        logger.warn(`Shutdown timeout (${SHUTDOWN_TIMEOUT_MS}ms) reached. Force quitting...`, { forceLog: true });
        resolve();
      }, SHUTDOWN_TIMEOUT_MS);
    });

    // Race between stopAllServices and timeout
    try {
      await Promise.race([
        serviceManager.stopAllServices(),
        timeoutPromise
      ]);
    } catch (error) {
      logger.error(`Error during shutdown: ${error}`, { forceLog: true });
    }

    // Force quit regardless of result
    app.exit(0);
  }
});

// Cleanup tray on quit
app.on('will-quit', () => {
  if (trayManager) {
    trayManager.destroy();
  }
});

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const ServiceManager_1 = require("./services/ServiceManager");
const Logger_1 = __importStar(require("./services/Logger"));
const TrayManager_1 = __importDefault(require("./services/TrayManager"));
const ConfigManager_1 = __importDefault(require("./services/ConfigManager"));
const HostsManager_1 = __importDefault(require("./services/HostsManager"));
const ProjectTemplateManager_1 = __importDefault(require("./services/ProjectTemplateManager"));
const DatabaseManager_1 = __importDefault(require("./services/DatabaseManager"));
const AutoUpdater_1 = __importDefault(require("./services/AutoUpdater"));
const ipc_1 = require("./ipc");
// Initialize file logger
try {
    Logger_1.Logger.getLogDir(); // This will initialize the FileLogger
    Logger_1.default.info('File logger initialized successfully');
}
catch (error) {
    console.error('Failed to initialize file logger:', error);
}
// Basic error handling to catch the 'string' issue
if (typeof electron_1.app === 'undefined') {
    Logger_1.default.error('FATAL: electron module returned undefined/string. Exiting.', { forceLog: true });
    process.exit(1);
}
// Global error handlers
process.on('uncaughtException', (error) => {
    Logger_1.default.error(`Uncaught Exception: ${error.message}`, { forceLog: true });
    if (error.stack)
        Logger_1.default.error(error.stack, { forceLog: true });
});
process.on('unhandledRejection', (reason) => {
    Logger_1.default.error(`Unhandled Rejection: ${reason}`, { forceLog: true });
});
// Set AppUserModelID for Windows
if (process.platform === 'win32') {
    electron_1.app.setAppUserModelId('com.localdevine.app');
}
// Prevent multiple instances - only allow one instance to run
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    // Another instance is already running, quit this one
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}
let mainWindow;
let serviceManager;
let trayManager;
let configManager;
let hostsManager;
let projectTemplateManager;
let autoUpdater;
function createWindow() {
    // Use .ico for Windows for better taskbar support
    const iconPath = electron_1.app.isPackaged
        ? path_1.default.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'icon.ico')
        : path_1.default.join(__dirname, '../public/icon.ico');
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js'),
        },
        title: 'LocalDevine',
        icon: iconPath,
    });
    // Window error handlers
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        Logger_1.default.error(`Window failed to load: ${errorCode} - ${errorDescription}`, { forceLog: true });
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        Logger_1.default.error(`Renderer process gone: ${details.reason}`, { forceLog: true });
    });
    // In production, load the built file
    // In dev, load Vite dev server for hot reload
    if (electron_1.app.isPackaged) {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    else {
        // Use Vite dev server for hot reload in development
        const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
        mainWindow.loadURL(VITE_DEV_SERVER_URL);
        // Open DevTools in development mode
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    return mainWindow;
}
// Register all IPC handlers BEFORE app ready
(0, ipc_1.registerIPCHandlers)();
electron_1.app.whenReady().then(() => {
    // Set Content Security Policy
    // In dev mode: relaxed CSP to allow Vite HMR (Hot Module Replacement)
    // In production: strict CSP for security
    if (electron_1.app.isPackaged) {
        electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
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
    configManager = new ConfigManager_1.default();
    serviceManager = new ServiceManager_1.ServiceManager(win, configManager);
    hostsManager = new HostsManager_1.default();
    projectTemplateManager = new ProjectTemplateManager_1.default();
    const databaseManager = new DatabaseManager_1.default(configManager);
    databaseManager.setMainWindow(win);
    // Initialize IPC with manager references
    (0, ipc_1.initializeIPC)(win, serviceManager, configManager, hostsManager, projectTemplateManager, databaseManager);
    // Start health monitoring
    serviceManager.startHealthMonitoring(5000);
    // Create system tray
    trayManager = new TrayManager_1.default(win, serviceManager, electron_1.app);
    trayManager.create();
    // Initialize auto updater (only in production)
    if (electron_1.app.isPackaged) {
        autoUpdater = new AutoUpdater_1.default(win);
        autoUpdater.checkOnStartup(10000); // Check for updates 10 seconds after startup
    }
});
// Properly quit when all windows are closed (Windows & Linux)
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// macOS: re-create window when dock icon is clicked
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        const win = createWindow();
        configManager = new ConfigManager_1.default();
        serviceManager = new ServiceManager_1.ServiceManager(win, configManager);
        hostsManager = new HostsManager_1.default();
        projectTemplateManager = new ProjectTemplateManager_1.default();
        const databaseManager = new DatabaseManager_1.default(configManager);
        databaseManager.setMainWindow(win);
        (0, ipc_1.initializeIPC)(win, serviceManager, configManager, hostsManager, projectTemplateManager, databaseManager);
        trayManager = new TrayManager_1.default(win, serviceManager, electron_1.app);
        trayManager.create();
    }
});
// Shutdown timeout constant (10 seconds)
const SHUTDOWN_TIMEOUT_MS = 10000;
let isQuitting = false;
// Cleanup all services before quitting with timeout protection
electron_1.app.on('before-quit', async (event) => {
    // Prevent re-entry
    if (isQuitting)
        return;
    // Set tray to quitting mode
    if (trayManager) {
        trayManager.setQuitting(true);
    }
    if (serviceManager && serviceManager.hasRunningServices()) {
        event.preventDefault();
        isQuitting = true;
        Logger_1.default.info('Stopping all services before quit...');
        // Create a timeout promise that forces quit
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                Logger_1.default.warn(`Shutdown timeout (${SHUTDOWN_TIMEOUT_MS}ms) reached. Force quitting...`, { forceLog: true });
                resolve();
            }, SHUTDOWN_TIMEOUT_MS);
        });
        // Race between stopAllServices and timeout
        try {
            await Promise.race([
                serviceManager.stopAllServices(),
                timeoutPromise
            ]);
        }
        catch (error) {
            Logger_1.default.error(`Error during shutdown: ${error}`, { forceLog: true });
        }
        // Force quit regardless of result
        electron_1.app.exit(0);
    }
});
// Cleanup tray on quit
electron_1.app.on('will-quit', () => {
    if (trayManager) {
        trayManager.destroy();
    }
});

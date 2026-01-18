"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const ServiceManager_1 = require("./services/ServiceManager");
const Logger_1 = __importDefault(require("./services/Logger"));
const TrayManager_1 = __importDefault(require("./services/TrayManager"));
const ConfigManager_1 = __importDefault(require("./services/ConfigManager"));
const HostsManager_1 = __importDefault(require("./services/HostsManager"));
const ProjectTemplateManager_1 = __importDefault(require("./services/ProjectTemplateManager"));
const DatabaseManager_1 = __importDefault(require("./services/DatabaseManager"));
const AutoUpdater_1 = __importDefault(require("./services/AutoUpdater"));
const ipc_1 = require("./ipc");
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
        width: 1000,
        height: 700,
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
    // In dev, load localhost (but use built version for testing)
    if (electron_1.app.isPackaged) {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    else {
        // Use built version instead of dev server for testing
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    return mainWindow;
}
// Register all IPC handlers BEFORE app ready
(0, ipc_1.registerIPCHandlers)();
electron_1.app.whenReady().then(() => {
    // Set Content Security Policy (allow Google Fonts)
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
// Cleanup all services before quitting
electron_1.app.on('before-quit', async (event) => {
    // Set tray to quitting mode
    if (trayManager) {
        trayManager.setQuitting(true);
    }
    if (serviceManager && serviceManager.hasRunningServices()) {
        event.preventDefault();
        Logger_1.default.info('Stopping all services before quit...');
        await serviceManager.stopAllServices();
        electron_1.app.quit();
    }
});
// Cleanup tray on quit
electron_1.app.on('will-quit', () => {
    if (trayManager) {
        trayManager.destroy();
    }
});

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const ServiceManager_1 = require("./services/ServiceManager");
const TrayManager_1 = __importDefault(require("./services/TrayManager"));
const ConfigManager_1 = __importDefault(require("./services/ConfigManager"));
// Basic error handling to catch the 'string' issue
if (typeof electron_1.app === 'undefined') {
    console.error('FATAL: electron module returned undefined/string. Exiting.');
    process.exit(1);
}
let mainWindow;
let serviceManager;
let trayManager;
let configManager;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path_1.default.join(__dirname, 'preload.js'),
        },
        title: 'LocalDevine',
        icon: path_1.default.join(__dirname, '../public/icon.png'),
    });
    // In production, load the built file
    // In dev, load localhost
    if (electron_1.app.isPackaged) {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    else {
        mainWindow.loadURL('http://localhost:5173');
    }
    return mainWindow;
}
electron_1.app.whenReady().then(() => {
    const win = createWindow();
    // Initialize config manager first
    configManager = new ConfigManager_1.default();
    // Pass config to service manager
    serviceManager = new ServiceManager_1.ServiceManager(win, configManager);
    // Create system tray
    trayManager = new TrayManager_1.default(win, serviceManager, electron_1.app);
    trayManager.create();
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
        console.log('Stopping all services before quit...');
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
// IPC Handlers - Service Control
electron_1.ipcMain.on('start-service', (event, serviceName) => {
    if (serviceManager)
        serviceManager.startService(serviceName);
});
electron_1.ipcMain.on('stop-service', (event, serviceName) => {
    if (serviceManager)
        serviceManager.stopService(serviceName);
});
electron_1.ipcMain.on('start-all-services', () => {
    if (serviceManager)
        serviceManager.startAllServices();
});
electron_1.ipcMain.on('stop-all-services', () => {
    if (serviceManager)
        serviceManager.stopAllServices();
});
// IPC Handlers - Config
electron_1.ipcMain.handle('get-version', () => {
    return electron_1.app.getVersion();
});
electron_1.ipcMain.handle('get-config', () => {
    return configManager ? configManager.get() : null;
});
electron_1.ipcMain.handle('save-config', async (event, config) => {
    return configManager ? configManager.save(config) : { success: false, error: 'ConfigManager not initialized' };
});
// IPC Handlers - Folder Operations
electron_1.ipcMain.on('open-folder', (event, folderType) => {
    let folderPath;
    switch (folderType) {
        case 'www':
            folderPath = path_1.default.join(__dirname, '../www');
            break;
        case 'config':
            folderPath = path_1.default.join(__dirname, '../');
            break;
        case 'bin':
            folderPath = path_1.default.join(__dirname, '../bin');
            break;
        default:
            return;
    }
    electron_1.shell.openPath(folderPath);
});
electron_1.ipcMain.on('open-terminal', () => {
    const wwwPath = path_1.default.join(__dirname, '../www');
    // Open PowerShell in www directory
    (0, child_process_1.spawn)('powershell.exe', [], {
        cwd: wwwPath,
        detached: true,
        shell: true
    });
});
// IPC Handlers - Folder Selection
electron_1.ipcMain.handle('select-folder', async () => {
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});
// IPC Handlers - Virtual Hosts
electron_1.ipcMain.handle('get-vhosts', () => {
    return configManager ? configManager.getVHosts() : [];
});
electron_1.ipcMain.handle('add-vhost', async (event, vhost) => {
    if (!configManager)
        return { success: false, error: 'ConfigManager not initialized' };
    const result = configManager.addVHost(vhost);
    // Notify to regenerate nginx config
    if (result.success && serviceManager) {
        serviceManager.generateConfigs();
    }
    return result;
});
electron_1.ipcMain.handle('remove-vhost', async (event, id) => {
    if (!configManager)
        return { success: false, error: 'ConfigManager not initialized' };
    const result = configManager.removeVHost(id);
    // Notify to regenerate nginx config
    if (result.success && serviceManager) {
        serviceManager.generateConfigs();
    }
    return result;
});
// IPC Handlers - PHP Versions
electron_1.ipcMain.handle('get-php-versions', () => {
    return configManager ? configManager.getPHPVersions() : [];
});
electron_1.ipcMain.handle('set-php-version', async (event, version) => {
    if (!configManager)
        return { success: false, error: 'ConfigManager not initialized' };
    return configManager.setPHPVersion(version);
});

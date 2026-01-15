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
const HostsManager_1 = __importDefault(require("./services/HostsManager"));
const ProjectTemplateManager_1 = __importDefault(require("./services/ProjectTemplateManager"));
const PathResolver_1 = __importDefault(require("./services/PathResolver"));
// Basic error handling to catch the 'string' issue
if (typeof electron_1.app === 'undefined') {
    console.error('FATAL: electron module returned undefined/string. Exiting.');
    process.exit(1);
}
let mainWindow;
let serviceManager;
let trayManager;
let configManager;
let hostsManager;
let projectTemplateManager;
function createWindow() {
    const pathResolver = PathResolver_1.default.getInstance();
    const iconPath = electron_1.app.isPackaged
        ? path_1.default.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'icon.png')
        : path_1.default.join(__dirname, '../public/icon.png');
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
electron_1.app.whenReady().then(() => {
    const win = createWindow();
    // Initialize config manager first
    configManager = new ConfigManager_1.default();
    // Pass config to service manager
    serviceManager = new ServiceManager_1.ServiceManager(win, configManager);
    // Initialize hosts manager
    hostsManager = new HostsManager_1.default();
    // Initialize project template manager
    projectTemplateManager = new ProjectTemplateManager_1.default();
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
    const pathResolver = PathResolver_1.default.getInstance();
    let folderPath;
    switch (folderType) {
        case 'www':
            folderPath = pathResolver.wwwDir;
            break;
        case 'config':
            folderPath = pathResolver.basePath;
            break;
        case 'bin':
            folderPath = pathResolver.binDir;
            break;
        default:
            return;
    }
    electron_1.shell.openPath(folderPath);
});
electron_1.ipcMain.on('open-terminal', () => {
    const pathResolver = PathResolver_1.default.getInstance();
    // Open PowerShell in www directory
    (0, child_process_1.spawn)('powershell.exe', [], {
        cwd: pathResolver.wwwDir,
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
    if (result.success && serviceManager) {
        // Regenerate Apache config
        serviceManager.generateConfigs();
        // Restart Apache to apply new config
        await serviceManager.stopService('apache');
        await new Promise(resolve => setTimeout(resolve, 500));
        await serviceManager.startService('apache');
        // Auto-add to hosts file
        if (hostsManager) {
            const hostsResult = await hostsManager.addEntry('127.0.0.1', vhost.domain, `LocalDevine - ${vhost.name}`);
            if (!hostsResult.success) {
                console.log('Failed to add hosts entry:', hostsResult.error);
                // Don't fail the whole operation, just log the error
            }
        }
    }
    return result;
});
electron_1.ipcMain.handle('remove-vhost', async (event, id) => {
    if (!configManager)
        return { success: false, error: 'ConfigManager not initialized' };
    // Get the vhost domain before removing (to remove from hosts file)
    const vhosts = configManager.getVHosts();
    const vhostToRemove = vhosts.find(v => v.id === id);
    const result = configManager.removeVHost(id);
    if (result.success && serviceManager) {
        // Regenerate Apache config
        serviceManager.generateConfigs();
        // Restart Apache to apply new config
        await serviceManager.stopService('apache');
        await new Promise(resolve => setTimeout(resolve, 500));
        await serviceManager.startService('apache');
        // Auto-remove from hosts file
        if (hostsManager && vhostToRemove) {
            const hostsResult = await hostsManager.removeEntry(vhostToRemove.domain);
            if (!hostsResult.success) {
                console.log('Failed to remove hosts entry:', hostsResult.error);
            }
        }
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
// IPC Handlers - Hosts File
electron_1.ipcMain.handle('get-hosts-entries', () => {
    if (!hostsManager)
        return { success: false, error: 'HostsManager not initialized' };
    return hostsManager.readHostsFile();
});
electron_1.ipcMain.handle('add-hosts-entry', async (event, ip, hostname, comment) => {
    if (!hostsManager)
        return { success: false, error: 'HostsManager not initialized' };
    return hostsManager.addEntry(ip, hostname, comment);
});
electron_1.ipcMain.handle('remove-hosts-entry', async (event, hostname) => {
    if (!hostsManager)
        return { success: false, error: 'HostsManager not initialized' };
    return hostsManager.removeEntry(hostname);
});
electron_1.ipcMain.handle('toggle-hosts-entry', async (event, hostname) => {
    if (!hostsManager)
        return { success: false, error: 'HostsManager not initialized' };
    return hostsManager.toggleEntry(hostname);
});
electron_1.ipcMain.handle('restore-hosts-backup', async () => {
    if (!hostsManager)
        return { success: false, error: 'HostsManager not initialized' };
    return hostsManager.restoreBackup();
});
electron_1.ipcMain.handle('check-hosts-admin-rights', () => {
    if (!hostsManager)
        return false;
    return hostsManager.checkAdminRights();
});
electron_1.ipcMain.on('request-hosts-admin-rights', () => {
    if (hostsManager)
        hostsManager.requestAdminRights();
});
// IPC Handlers - Project Templates
electron_1.ipcMain.handle('get-templates', () => {
    if (!projectTemplateManager)
        return [];
    return projectTemplateManager.getTemplates();
});
electron_1.ipcMain.handle('get-projects', () => {
    if (!projectTemplateManager)
        return [];
    return projectTemplateManager.getProjects();
});
electron_1.ipcMain.handle('create-project', async (event, options) => {
    if (!projectTemplateManager)
        return { success: false, message: 'ProjectTemplateManager not initialized' };
    return projectTemplateManager.createProject(options);
});
electron_1.ipcMain.handle('delete-project', async (event, projectName) => {
    if (!projectTemplateManager)
        return { success: false, message: 'ProjectTemplateManager not initialized' };
    return projectTemplateManager.deleteProject(projectName);
});
electron_1.ipcMain.handle('open-project-folder', async (event, projectName) => {
    const pathResolver = PathResolver_1.default.getInstance();
    const projectPath = path_1.default.join(pathResolver.wwwDir, projectName);
    electron_1.shell.openPath(projectPath);
});
electron_1.ipcMain.handle('open-project-browser', async (event, projectName) => {
    const port = configManager ? configManager.getPort('apache') : 80;
    electron_1.shell.openExternal(`http://localhost:${port}/${projectName}`);
});
electron_1.ipcMain.handle('open-browser', async (event, url) => {
    electron_1.shell.openExternal(url);
});

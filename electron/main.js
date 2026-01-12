const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Basic error handling to catch the 'string' issue
if (typeof app === 'undefined') {
  console.error('FATAL: electron module returned undefined/string. Exiting.');
  process.exit(1);
}

const ServiceManager = require('./services/ServiceManager');
const TrayManager = require('./services/TrayManager');
const ConfigManager = require('./services/ConfigManager');

let mainWindow;
let serviceManager;
let trayManager;
let configManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'LocalDevine',
    icon: path.join(__dirname, '../public/icon.png'),
  });

  // In production, load the built file
  // In dev, load localhost
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  return mainWindow;
}

app.whenReady().then(() => {
  const win = createWindow();

  // Initialize config manager first
  configManager = new ConfigManager();

  // Pass config to service manager
  serviceManager = new ServiceManager(win, configManager);

  // Create system tray
  trayManager = new TrayManager(win, serviceManager, app);
  trayManager.create();
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
    trayManager = new TrayManager(win, serviceManager, app);
    trayManager.create();
  }
});

// Cleanup all services before quitting
app.on('before-quit', async (event) => {
  // Set tray to quitting mode
  if (trayManager) {
    trayManager.setQuitting(true);
  }

  if (serviceManager && serviceManager.hasRunningServices()) {
    event.preventDefault();
    console.log('Stopping all services before quit...');
    await serviceManager.stopAllServices();
    app.quit();
  }
});

// Cleanup tray on quit
app.on('will-quit', () => {
  if (trayManager) {
    trayManager.destroy();
  }
});

// IPC Handlers - Service Control
ipcMain.on('start-service', (event, serviceName) => {
  if (serviceManager) serviceManager.startService(serviceName);
});

ipcMain.on('stop-service', (event, serviceName) => {
  if (serviceManager) serviceManager.stopService(serviceName);
});

ipcMain.on('start-all-services', () => {
  if (serviceManager) serviceManager.startAllServices();
});

ipcMain.on('stop-all-services', () => {
  if (serviceManager) serviceManager.stopAllServices();
});

// IPC Handlers - Config
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-config', () => {
  return configManager ? configManager.get() : null;
});

ipcMain.handle('save-config', (event, config) => {
  return configManager ? configManager.save(config) : { success: false, error: 'ConfigManager not initialized' };
});

// IPC Handlers - Folder Operations
ipcMain.on('open-folder', (event, folderType) => {
  let folderPath;
  switch (folderType) {
    case 'www':
      folderPath = path.join(__dirname, '../www');
      break;
    case 'config':
      folderPath = path.join(__dirname, '../');
      break;
    case 'bin':
      folderPath = path.join(__dirname, '../bin');
      break;
    default:
      return;
  }
  shell.openPath(folderPath);
});

ipcMain.on('open-terminal', () => {
  const wwwPath = path.join(__dirname, '../www');
  // Open PowerShell in www directory
  spawn('powershell.exe', [], {
    cwd: wwwPath,
    detached: true,
    shell: true
  });
});

// IPC Handlers - Folder Selection
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// IPC Handlers - Virtual Hosts
ipcMain.handle('get-vhosts', () => {
  return configManager ? configManager.getVHosts() : [];
});

ipcMain.handle('add-vhost', (event, vhost) => {
  if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
  const result = configManager.addVHost(vhost);
  // Notify to regenerate nginx config
  if (result.success && serviceManager) {
    serviceManager.generateConfigs();
  }
  return result;
});

ipcMain.handle('remove-vhost', (event, id) => {
  if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
  const result = configManager.removeVHost(id);
  // Notify to regenerate nginx config
  if (result.success && serviceManager) {
    serviceManager.generateConfigs();
  }
  return result;
});

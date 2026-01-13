const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Import compiled TypeScript services from dist-electron
const { ServiceManager } = require('../dist-electron/services/ServiceManager');
const TrayManager = require('../dist-electron/services/TrayManager').default;
const ConfigManager = require('../dist-electron/services/ConfigManager').default;

console.log('Electron app starting...');
console.log('app type:', typeof app);
console.log('BrowserWindow type:', typeof BrowserWindow);

let mainWindow;
let serviceManager;
let trayManager;
let configManager;

function createWindow() {
  console.log('Creating Electron window...');
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'LocalDevine',
    icon: path.join(__dirname, '../public/icon.png'),
  });

  console.log('Window created, loading URL...');

  // In production, load the built file
  // In dev, load localhost
  if (app.isPackaged) {
    console.log('Loading production file...');
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    console.log('Loading development URL: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
  }

  // Add debug logging
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window finished loading');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Window failed to load:', errorCode, errorDescription);
  });

  mainWindow.on('closed', () => {
    console.log('Window closed');
    mainWindow = null;
  });

  return mainWindow;
}

app.whenReady().then(() => {
  console.log('Electron app is ready');
  const win = createWindow();

  // Initialize config manager first
  configManager = new ConfigManager();

  // Pass config to service manager
  serviceManager = new ServiceManager(win, configManager);

  // Create system tray
  trayManager = new TrayManager(win, serviceManager, app);
  trayManager.create();

  // Start health monitoring
  console.log('Starting health monitoring...');
  serviceManager.startHealthMonitoring(5000); // Check every 5 seconds

  // Auto-start services if enabled
  const config = configManager.get();
  if (config.autoStart) {
    console.log('Auto-starting all services...');
    setTimeout(() => {
      serviceManager.startAllServices();
    }, 1000); // Small delay to ensure window is ready
  }
});

// Properly quit when all windows are closed (Windows & Linux)
app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// macOS: re-create window when dock icon is clicked
app.on('activate', () => {
  console.log('App activated');
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
  console.log('App before quit');
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
  console.log('App will quit');
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

ipcMain.handle('save-config', async (event, config) => {
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

ipcMain.handle('add-vhost', async (event, vhost) => {
  if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
  const result = configManager.addVHost(vhost);
  if (result.success && serviceManager) {
    serviceManager.generateConfigs();
  }
  return result;
});

ipcMain.handle('remove-vhost', async (event, id) => {
  if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
  const result = configManager.removeVHost(id);
  if (result.success && serviceManager) {
    serviceManager.generateConfigs();
  }
  return result;
});

// IPC Handlers - PHP Versions
ipcMain.handle('get-php-versions', () => {
  return configManager ? configManager.getPHPVersions() : [];
});

ipcMain.handle('set-php-version', async (event, version) => {
  if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
  return configManager.setPHPVersion(version);
});
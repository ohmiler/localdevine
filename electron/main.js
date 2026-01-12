const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Basic error handling to catch the 'string' issue
if (typeof app === 'undefined') {
  console.error('FATAL: electron module returned undefined/string. Exiting.');
  process.exit(1);
}

const ServiceManager = require('./services/ServiceManager');
const TrayManager = require('./services/TrayManager');

let mainWindow;
let serviceManager;
let trayManager;

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
  serviceManager = new ServiceManager(win);

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
    serviceManager = new ServiceManager(win);
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

// IPC Handlers
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

// Get app version
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

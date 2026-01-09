const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Basic error handling to catch the 'string' issue
if (typeof app === 'undefined') {
  console.error('FATAL: electron module returned undefined/string. Exiting.');
  process.exit(1);
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'LocalDevine',
  });

  // In production, load the built file
  // In dev, load localhost (but we are building now)
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    // Fallback if needed
    mainWindow.loadURL('http://localhost:5173');
  }

  return mainWindow;
}

const ServiceManager = require('./services/ServiceManager');

let serviceManager;

app.whenReady().then(() => {
  const win = createWindow();
  serviceManager = new ServiceManager(win);
});

ipcMain.on('start-service', (event, serviceName) => {
  if (serviceManager) serviceManager.startService(serviceName);
});

ipcMain.on('stop-service', (event, serviceName) => {
  if (serviceManager) serviceManager.stopService(serviceName);
});


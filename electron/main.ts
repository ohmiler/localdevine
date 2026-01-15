import { app, BrowserWindow, ipcMain, shell, dialog, IpcMainEvent } from 'electron';
import path from 'path';
import { spawn } from 'child_process';

import { ServiceManager } from './services/ServiceManager';
import TrayManager from './services/TrayManager';
import ConfigManager from './services/ConfigManager';
import HostsManager from './services/HostsManager';
import ProjectTemplateManager from './services/ProjectTemplateManager';
import PathResolver from './services/PathResolver';
import { VHostConfig } from './services/ServiceManager';

// Basic error handling to catch the 'string' issue
if (typeof app === 'undefined') {
  console.error('FATAL: electron module returned undefined/string. Exiting.');
  process.exit(1);
}

let mainWindow: BrowserWindow | null;
let serviceManager: ServiceManager | null;
let trayManager: TrayManager | null;
let configManager: ConfigManager | null;
let hostsManager: HostsManager | null;
let projectTemplateManager: ProjectTemplateManager | null;

function createWindow(): BrowserWindow {
  const pathResolver = PathResolver.getInstance();
  const iconPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'icon.png')
    : path.join(__dirname, '../public/icon.png');

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'LocalDevine',
    icon: iconPath,
  });

  // In production, load the built file
  // In dev, load localhost (but use built version for testing)
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    // Use built version instead of dev server for testing
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return mainWindow;
}

app.whenReady().then(() => {
  const win = createWindow();

  // Initialize config manager first
  configManager = new ConfigManager();

  // Pass config to service manager
  serviceManager = new ServiceManager(win, configManager);

  // Initialize hosts manager
  hostsManager = new HostsManager();

  // Initialize project template manager
  projectTemplateManager = new ProjectTemplateManager();

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
ipcMain.on('start-service', (event: IpcMainEvent, serviceName: 'php' | 'apache' | 'mariadb') => {
  if (serviceManager) serviceManager.startService(serviceName);
});

ipcMain.on('stop-service', (event: IpcMainEvent, serviceName: 'php' | 'apache' | 'mariadb') => {
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

ipcMain.handle('save-config', async (event: any, config: any) => {
  return configManager ? configManager.save(config) : { success: false, error: 'ConfigManager not initialized' };
});

// IPC Handlers - Folder Operations
ipcMain.on('open-folder', (event: IpcMainEvent, folderType: string) => {
  const pathResolver = PathResolver.getInstance();
  let folderPath: string;
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
  shell.openPath(folderPath);
});

ipcMain.on('open-terminal', () => {
  const pathResolver = PathResolver.getInstance();
  // Open PowerShell in www directory
  spawn('powershell.exe', [], {
    cwd: pathResolver.wwwDir,
    detached: true,
    shell: true
  });
});

// IPC Handlers - Folder Selection
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
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

ipcMain.handle('add-vhost', async (event: any, vhost: Omit<VHostConfig, 'id' | 'createdAt'>) => {
  if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
  const result = configManager.addVHost(vhost);
  
  if (result.success && serviceManager) {
    // Regenerate Apache config
    serviceManager.generateConfigs();
    
    // Auto-add to hosts file
    if (hostsManager) {
      const hostsResult = hostsManager.addEntry('127.0.0.1', vhost.domain, `LocalDevine - ${vhost.name}`);
      if (!hostsResult.success) {
        console.log('Failed to add hosts entry:', hostsResult.error);
        // Don't fail the whole operation, just log the error
      }
    }
  }
  return result;
});

ipcMain.handle('remove-vhost', async (event: any, id: string) => {
  if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
  
  // Get the vhost domain before removing (to remove from hosts file)
  const vhosts = configManager.getVHosts();
  const vhostToRemove = vhosts.find(v => v.id === id);
  
  const result = configManager.removeVHost(id);
  
  if (result.success && serviceManager) {
    // Regenerate Apache config
    serviceManager.generateConfigs();
    
    // Auto-remove from hosts file
    if (hostsManager && vhostToRemove) {
      const hostsResult = hostsManager.removeEntry(vhostToRemove.domain);
      if (!hostsResult.success) {
        console.log('Failed to remove hosts entry:', hostsResult.error);
      }
    }
  }
  return result;
});

// IPC Handlers - PHP Versions
ipcMain.handle('get-php-versions', () => {
  return configManager ? configManager.getPHPVersions() : [];
});

ipcMain.handle('set-php-version', async (event: any, version: string) => {
  if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
  return configManager.setPHPVersion(version);
});

// IPC Handlers - Hosts File
ipcMain.handle('get-hosts-entries', () => {
  if (!hostsManager) return { success: false, error: 'HostsManager not initialized' };
  return hostsManager.readHostsFile();
});

ipcMain.handle('add-hosts-entry', async (event: any, ip: string, hostname: string, comment?: string) => {
  if (!hostsManager) return { success: false, error: 'HostsManager not initialized' };
  return hostsManager.addEntry(ip, hostname, comment);
});

ipcMain.handle('remove-hosts-entry', async (event: any, hostname: string) => {
  if (!hostsManager) return { success: false, error: 'HostsManager not initialized' };
  return hostsManager.removeEntry(hostname);
});

ipcMain.handle('toggle-hosts-entry', async (event: any, hostname: string) => {
  if (!hostsManager) return { success: false, error: 'HostsManager not initialized' };
  return hostsManager.toggleEntry(hostname);
});

ipcMain.handle('restore-hosts-backup', async () => {
  if (!hostsManager) return { success: false, error: 'HostsManager not initialized' };
  return hostsManager.restoreBackup();
});

ipcMain.handle('check-hosts-admin-rights', () => {
  if (!hostsManager) return false;
  return hostsManager.checkAdminRights();
});

ipcMain.on('request-hosts-admin-rights', () => {
  if (hostsManager) hostsManager.requestAdminRights();
});

// IPC Handlers - Project Templates
ipcMain.handle('get-templates', () => {
  if (!projectTemplateManager) return [];
  return projectTemplateManager.getTemplates();
});

ipcMain.handle('get-projects', () => {
  if (!projectTemplateManager) return [];
  return projectTemplateManager.getProjects();
});

ipcMain.handle('create-project', async (event: any, options: any) => {
  if (!projectTemplateManager) return { success: false, message: 'ProjectTemplateManager not initialized' };
  return projectTemplateManager.createProject(options);
});

ipcMain.handle('delete-project', async (event: any, projectName: string) => {
  if (!projectTemplateManager) return { success: false, message: 'ProjectTemplateManager not initialized' };
  return projectTemplateManager.deleteProject(projectName);
});

ipcMain.handle('open-project-folder', async (event: any, projectName: string) => {
  const pathResolver = PathResolver.getInstance();
  const projectPath = path.join(pathResolver.wwwDir, projectName);
  shell.openPath(projectPath);
});

ipcMain.handle('open-project-browser', async (event: any, projectName: string) => {
  const port = configManager ? configManager.getPort('apache') : 80;
  shell.openExternal(`http://localhost:${port}/${projectName}`);
});

ipcMain.handle('open-browser', async (event: any, url: string) => {
  shell.openExternal(url);
});

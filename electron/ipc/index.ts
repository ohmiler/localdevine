/**
 * IPC Handlers - Organized by module
 * Centralizes all IPC communication between main and renderer processes
 */

import { ipcMain, shell, dialog, IpcMainEvent, IpcMainInvokeEvent, app, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

import { ServiceManager, VHostConfig } from '../services/ServiceManager';
import ConfigManager, { Config } from '../services/ConfigManager';
import HostsManager from '../services/HostsManager';
import ProjectTemplateManager, { CreateProjectOptions } from '../services/ProjectTemplateManager';
import PathResolver from '../services/PathResolver';
import ConfigBackupManager, { ConfigFileType } from '../services/ConfigBackupManager';
import logger from '../services/Logger';

// Module references - will be set during initialization
let mainWindow: BrowserWindow | null = null;
let serviceManager: ServiceManager | null = null;
let configManager: ConfigManager | null = null;
let hostsManager: HostsManager | null = null;
let projectTemplateManager: ProjectTemplateManager | null = null;

/**
 * Initialize IPC handlers with module references
 */
export function initializeIPC(
  win: BrowserWindow,
  services: ServiceManager,
  config: ConfigManager,
  hosts: HostsManager,
  projects: ProjectTemplateManager
): void {
  mainWindow = win;
  serviceManager = services;
  configManager = config;
  hostsManager = hosts;
  projectTemplateManager = projects;
}

/**
 * Register all IPC handlers - call this BEFORE app.whenReady()
 */
export function registerIPCHandlers(): void {
  registerServiceHandlers();
  registerConfigHandlers();
  registerFolderHandlers();
  registerVHostHandlers();
  registerHostsHandlers();
  registerProjectHandlers();
}

// ============================================
// Service Handlers
// ============================================
function registerServiceHandlers(): void {
  ipcMain.on('start-service', (_event: IpcMainEvent, serviceName: 'php' | 'apache' | 'mariadb') => {
    if (serviceManager) serviceManager.startService(serviceName);
  });

  ipcMain.on('stop-service', (_event: IpcMainEvent, serviceName: 'php' | 'apache' | 'mariadb') => {
    if (serviceManager) serviceManager.stopService(serviceName);
  });

  ipcMain.on('start-all-services', () => {
    logger.debug('IPC: start-all-services received');
    if (serviceManager) {
      logger.debug('IPC: calling serviceManager.startAllServices()');
      serviceManager.startAllServices();
    } else {
      logger.error('IPC: serviceManager is null!');
    }
  });

  ipcMain.on('stop-all-services', () => {
    if (serviceManager) serviceManager.stopAllServices();
  });
}

// ============================================
// Config Handlers
// ============================================
function registerConfigHandlers(): void {
  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-config', () => {
    return configManager ? configManager.get() : null;
  });

  ipcMain.handle('save-config', async (_event: IpcMainInvokeEvent, config: Partial<Config>) => {
    return configManager ? configManager.save(config) : { success: false, error: 'ConfigManager not initialized' };
  });

  ipcMain.handle('get-php-versions', () => {
    return configManager ? configManager.getPHPVersions() : [];
  });

  ipcMain.handle('set-php-version', async (_event: IpcMainInvokeEvent, version: string) => {
    if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
    return configManager.setPHPVersion(version);
  });

  // Data Path handlers
  ipcMain.handle('get-data-path', () => {
    const pathResolver = PathResolver.getInstance();
    return {
      current: pathResolver.getDataPath(),
      default: PathResolver.getDefaultDataPath(),
      isCustom: pathResolver.isUsingCustomPath()
    };
  });

  ipcMain.handle('set-data-path', async (_event: IpcMainInvokeEvent, newPath: string) => {
    const pathResolver = PathResolver.getInstance();
    const result = pathResolver.saveDataPath(newPath);
    if (result.success) {
      // Note: App needs to restart for path change to take effect
      return { success: true, needsRestart: true };
    }
    return result;
  });

  // Config Backup handlers
  ipcMain.handle('get-config-backups', async (_event: IpcMainInvokeEvent, fileType: ConfigFileType) => {
    const backupManager = ConfigBackupManager.getInstance();
    return backupManager.getBackups(fileType);
  });

  ipcMain.handle('restore-config-backup', async (_event: IpcMainInvokeEvent, fileType: ConfigFileType, backupPath?: string) => {
    const backupManager = ConfigBackupManager.getInstance();
    return backupManager.restoreBackup(fileType, backupPath);
  });
}

// ============================================
// Folder Handlers
// ============================================
function registerFolderHandlers(): void {
  ipcMain.on('open-folder', (_event: IpcMainEvent, folderType: string) => {
    const pathResolver = PathResolver.getInstance();
    let folderPath: string;
    switch (folderType) {
      case 'www':
        folderPath = pathResolver.wwwDir;
        break;
      case 'config':
        // Open user config directory (C:\LocalDevine\config) not basePath
        folderPath = path.join(pathResolver.userDataPath, 'config');
        break;
      case 'bin':
        folderPath = pathResolver.binDir;
        break;
      default:
        return;
    }
    shell.openPath(folderPath);
  });

  ipcMain.on('open-folder-path', (_event: IpcMainEvent, folderPath: string) => {
    if (folderPath) {
      shell.openPath(folderPath);
    }
  });

  // Log Files handlers
  ipcMain.on('open-log-file', (_event: IpcMainEvent, logType: string) => {
    const pathResolver = PathResolver.getInstance();
    let logPath: string;
    
    switch (logType) {
      case 'apache-error':
        logPath = path.join(pathResolver.userDataPath, 'logs', 'apache', 'error.log');
        break;
      case 'apache-access':
        logPath = path.join(pathResolver.userDataPath, 'logs', 'apache', 'access.log');
        break;
      default:
        return;
    }
    
    // Open log file with default system editor
    if (fs.existsSync(logPath)) {
      shell.openPath(logPath);
    } else {
      // If log file doesn't exist, open containing folder
      shell.openPath(path.dirname(logPath));
    }
  });

  ipcMain.on('open-config-file', (_event: IpcMainEvent, fileType: string) => {
    const pathResolver = PathResolver.getInstance();
    const backupManager = ConfigBackupManager.getInstance();
    let filePath: string;
    
    switch (fileType) {
      case 'php.ini':
        filePath = pathResolver.phpIniPath;
        break;
      case 'httpd.conf':
        filePath = path.join(pathResolver.userDataPath, 'config', 'httpd.conf');
        break;
      case 'config.json':
        filePath = pathResolver.configPath;
        break;
      case 'my.ini':
        // MariaDB config file location
        filePath = path.join(pathResolver.userDataPath, 'config', 'my.ini');
        break;
      default:
        return;
    }
    
    // Create backup before opening file for editing
    if (fs.existsSync(filePath)) {
      const backup = backupManager.createBackup(fileType as ConfigFileType);
      if (backup) {
        logger.debug(`Created backup before opening ${fileType}: ${backup.backup}`);
      }
    }
    
    // Open file with default system editor
    if (fs.existsSync(filePath)) {
      shell.openPath(filePath);
    } else {
      // If file doesn't exist, open containing folder
      shell.openPath(path.dirname(filePath));
    }
  });

  ipcMain.on('open-terminal', () => {
    const pathResolver = PathResolver.getInstance();
    spawn('powershell.exe', [], {
      cwd: pathResolver.wwwDir,
      detached: true,
      shell: true
    });
  });

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.on('open-browser', (_event: IpcMainEvent, url: string) => {
    shell.openExternal(url);
  });
}

// ============================================
// Virtual Hosts Handlers
// ============================================
function registerVHostHandlers(): void {
  ipcMain.handle('get-vhosts', () => {
    return configManager ? configManager.getVHosts() : [];
  });

  ipcMain.handle('add-vhost', async (_event: IpcMainInvokeEvent, vhost: Omit<VHostConfig, 'id' | 'createdAt'>) => {
    if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
    const result = configManager.addVHost(vhost);
    
    if (result.success && serviceManager) {
      serviceManager.generateConfigs();
      await serviceManager.stopService('apache');
      await new Promise(resolve => setTimeout(resolve, 500));
      await serviceManager.startService('apache');
      
      if (hostsManager) {
        const hostsResult = await hostsManager.addEntry('127.0.0.1', vhost.domain, `LocalDevine - ${vhost.name}`);
        if (!hostsResult.success) {
          logger.warn(`Failed to add hosts entry: ${hostsResult.error}`);
        }
      }
    }
    return result;
  });

  ipcMain.handle('remove-vhost', async (_event: IpcMainInvokeEvent, id: string) => {
    if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
    
    const vhosts = configManager.getVHosts();
    const vhostToRemove = vhosts.find(v => v.id === id);
    
    const result = configManager.removeVHost(id);
    
    if (result.success && serviceManager) {
      serviceManager.generateConfigs();
      await serviceManager.stopService('apache');
      await new Promise(resolve => setTimeout(resolve, 500));
      await serviceManager.startService('apache');
      
      if (hostsManager && vhostToRemove) {
        const hostsResult = await hostsManager.removeEntry(vhostToRemove.domain);
        if (!hostsResult.success) {
          logger.warn(`Failed to remove hosts entry: ${hostsResult.error}`);
        }
      }
    }
    return result;
  });
}

// ============================================
// Hosts File Handlers
// ============================================
function registerHostsHandlers(): void {
  ipcMain.handle('get-hosts-entries', () => {
    if (!hostsManager) return { success: false, error: 'HostsManager not initialized' };
    return hostsManager.readHostsFile();
  });

  ipcMain.handle('add-hosts-entry', async (_event: IpcMainInvokeEvent, ip: string, hostname: string, comment?: string) => {
    if (!hostsManager) return { success: false, error: 'HostsManager not initialized' };
    return hostsManager.addEntry(ip, hostname, comment);
  });

  ipcMain.handle('remove-hosts-entry', async (_event: IpcMainInvokeEvent, hostname: string) => {
    if (!hostsManager) return { success: false, error: 'HostsManager not initialized' };
    return hostsManager.removeEntry(hostname);
  });

  ipcMain.handle('toggle-hosts-entry', async (_event: IpcMainInvokeEvent, hostname: string) => {
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
    if (hostsManager) {
      hostsManager.requestAdminRights();
    }
  });
}

// ============================================
// Project Template Handlers
// ============================================
function registerProjectHandlers(): void {
  ipcMain.handle('get-templates', () => {
    return projectTemplateManager ? projectTemplateManager.getTemplates() : [];
  });

  ipcMain.handle('get-projects', () => {
    return projectTemplateManager ? projectTemplateManager.getProjects() : [];
  });

  ipcMain.handle('create-project', async (_event: IpcMainInvokeEvent, options: CreateProjectOptions) => {
    return projectTemplateManager ? projectTemplateManager.createProject(options) : { success: false, error: 'ProjectTemplateManager not initialized' };
  });

  ipcMain.handle('delete-project', async (_event: IpcMainInvokeEvent, projectName: string) => {
    return projectTemplateManager ? projectTemplateManager.deleteProject(projectName) : { success: false, error: 'ProjectTemplateManager not initialized' };
  });

  ipcMain.handle('open-project-folder', async (_event: IpcMainInvokeEvent, projectName: string) => {
    if (!projectTemplateManager) return;
    const pathResolver = PathResolver.getInstance();
    const projectPath = path.join(pathResolver.wwwDir, projectName);
    shell.openPath(projectPath);
  });

  ipcMain.handle('open-project-browser', async (_event: IpcMainInvokeEvent, projectName: string) => {
    const port = configManager ? configManager.getPort('apache') : 80;
    shell.openExternal(`http://localhost:${port}/${projectName}`);
  });
}

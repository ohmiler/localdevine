/**
 * IPC Handlers - Organized by module
 * Centralizes all IPC communication between main and renderer processes
 */

import { ipcMain, shell, dialog, IpcMainEvent, IpcMainInvokeEvent, app, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';

import { ServiceManager, VHostConfig } from '../services/ServiceManager';
import ConfigManager, { Config } from '../services/ConfigManager';
import HostsManager from '../services/HostsManager';
import ProjectTemplateManager, { CreateProjectOptions } from '../services/ProjectTemplateManager';
import DatabaseManager from '../services/DatabaseManager';
import EnvManager, { EnvVariable } from '../services/EnvManager';
import SSLManager from '../services/SSLManager';
import PathResolver from '../services/PathResolver';
import logger from '../services/Logger';

// ============================================
// Input Validation Functions
// ============================================

// Validate CreateProjectOptions
function validateCreateProjectOptions(options: unknown): options is CreateProjectOptions {
    if (!options || typeof options !== 'object') return false;
    const opts = options as Record<string, unknown>;
    return (
        typeof opts.templateId === 'string' &&
        typeof opts.projectName === 'string' &&
        opts.projectName.length > 0 &&
        (opts.databaseName === undefined || typeof opts.databaseName === 'string') &&
        typeof opts.projectPath === 'string'
    );
}

// Validate project name format
function isValidProjectName(name: unknown): name is string {
    if (typeof name !== 'string' || name.trim() === '') return false;
    // Check for path traversal
    if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
    // Only allow safe characters
    return /^[a-zA-Z0-9_.-]+$/.test(name);
}

// Validate service name
function isValidServiceName(name: unknown): name is 'php' | 'apache' | 'mariadb' {
    return name === 'php' || name === 'apache' || name === 'mariadb';
}

// Validate VHost input
function validateVHostInput(vhost: unknown): vhost is Omit<VHostConfig, 'id' | 'createdAt'> {
    if (!vhost || typeof vhost !== 'object') return false;
    const v = vhost as Record<string, unknown>;
    return (
        typeof v.name === 'string' && v.name.length > 0 &&
        typeof v.domain === 'string' && v.domain.length > 0 &&
        typeof v.path === 'string' && v.path.length > 0 &&
        (v.phpVersion === undefined || typeof v.phpVersion === 'string')
    );
}

// Validate hostname
function isValidHostname(hostname: unknown): hostname is string {
    if (typeof hostname !== 'string' || hostname.trim() === '') return false;
    const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
    return hostnameRegex.test(hostname) && hostname.length <= 253;
}

// Validate IP address
function isValidIP(ip: unknown): ip is string {
    if (typeof ip !== 'string') return false;
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
}

// Module references - will be set during initialization
let mainWindow: BrowserWindow | null = null;
let serviceManager: ServiceManager | null = null;
let configManager: ConfigManager | null = null;
let hostsManager: HostsManager | null = null;
let projectTemplateManager: ProjectTemplateManager | null = null;
let databaseManager: DatabaseManager | null = null;
let envManager: EnvManager | null = null;

/**
 * Initialize IPC handlers with module references
 */
export function initializeIPC(
  win: BrowserWindow,
  services: ServiceManager,
  config: ConfigManager,
  hosts: HostsManager,
  projects: ProjectTemplateManager,
  database?: DatabaseManager,
  env?: EnvManager
): void {
  mainWindow = win;
  serviceManager = services;
  configManager = config;
  hostsManager = hosts;
  projectTemplateManager = projects;
  databaseManager = database || null;
  envManager = env || null;
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
  registerDatabaseHandlers();
  registerEnvHandlers();
  registerSSLHandlers();
}

// ============================================
// Service Handlers
// ============================================
function registerServiceHandlers(): void {
  ipcMain.on('start-service', (_event: IpcMainEvent, serviceName: unknown) => {
    if (!isValidServiceName(serviceName)) {
      logger.warn(`Invalid service name: ${serviceName}`);
      return;
    }
    if (serviceManager) serviceManager.startService(serviceName);
  });

  ipcMain.on('stop-service', (_event: IpcMainEvent, serviceName: unknown) => {
    if (!isValidServiceName(serviceName)) {
      logger.warn(`Invalid service name: ${serviceName}`);
      return;
    }
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
        folderPath = pathResolver.configDir;
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

  // Refocus main window (useful after operations that steal focus)
  ipcMain.handle('refocus-window', () => {
    if (mainWindow) {
      mainWindow.focus();
      // Also focus the webContents to ensure input focus is restored
      mainWindow.webContents.focus();
    }
    return { success: true };
  });
}

// ============================================
// Virtual Hosts Handlers
// ============================================
function registerVHostHandlers(): void {
  ipcMain.handle('get-vhosts', () => {
    return configManager ? configManager.getVHosts() : [];
  });

  ipcMain.handle('add-vhost', async (_event: IpcMainInvokeEvent, vhost: unknown) => {
    if (!configManager) return { success: false, error: 'ConfigManager not initialized' };
    
    // Validate input
    if (!validateVHostInput(vhost)) {
      return { success: false, error: 'Invalid vhost configuration' };
    }
    
    const result = configManager.addVHost(vhost);
    
    if (result.success && serviceManager) {
      serviceManager.generateConfigs();
      
      // Only restart Apache if it was already running
      const healthStatus = serviceManager.getHealthStatus();
      const apacheStatus = healthStatus['apache']?.status;
      if (apacheStatus === 'running') {
        await serviceManager.stopService('apache');
        await new Promise(resolve => setTimeout(resolve, 500));
        await serviceManager.startService('apache');
      }
      
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
      
      // Only restart Apache if it was already running
      const healthStatus = serviceManager.getHealthStatus();
      const apacheStatus = healthStatus['apache']?.status;
      if (apacheStatus === 'running') {
        await serviceManager.stopService('apache');
        await new Promise(resolve => setTimeout(resolve, 500));
        await serviceManager.startService('apache');
      }
      
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

  ipcMain.handle('add-hosts-entry', async (_event: IpcMainInvokeEvent, ip: unknown, hostname: unknown, comment?: unknown) => {
    if (!hostsManager) return { success: false, error: 'HostsManager not initialized' };
    
    // Validate inputs
    if (!isValidIP(ip)) {
      return { success: false, error: 'Invalid IP address format' };
    }
    if (!isValidHostname(hostname)) {
      return { success: false, error: 'Invalid hostname format' };
    }
    const sanitizedComment = typeof comment === 'string' ? comment.substring(0, 100) : undefined;
    
    return hostsManager.addEntry(ip, hostname, sanitizedComment);
  });

  ipcMain.handle('remove-hosts-entry', async (_event: IpcMainInvokeEvent, hostname: unknown) => {
    if (!hostsManager) return { success: false, error: 'HostsManager not initialized' };
    
    if (!isValidHostname(hostname)) {
      return { success: false, error: 'Invalid hostname format' };
    }
    
    return hostsManager.removeEntry(hostname);
  });

  ipcMain.handle('toggle-hosts-entry', async (_event: IpcMainInvokeEvent, hostname: unknown) => {
    if (!hostsManager) return { success: false, error: 'HostsManager not initialized' };
    
    if (!isValidHostname(hostname)) {
      return { success: false, error: 'Invalid hostname format' };
    }
    
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

  ipcMain.handle('create-project', async (_event: IpcMainInvokeEvent, options: unknown) => {
    if (!projectTemplateManager) return { success: false, error: 'ProjectTemplateManager not initialized' };
    
    // Validate input
    if (!validateCreateProjectOptions(options)) {
      return { success: false, error: 'Invalid project options' };
    }
    
    return projectTemplateManager.createProject(options);
  });

  ipcMain.handle('delete-project', async (_event: IpcMainInvokeEvent, projectName: unknown) => {
    if (!projectTemplateManager) return { success: false, error: 'ProjectTemplateManager not initialized' };
    
    // Validate input
    if (!isValidProjectName(projectName)) {
      return { success: false, error: 'Invalid project name' };
    }
    
    return projectTemplateManager.deleteProject(projectName);
  });

  ipcMain.handle('open-project-folder', async (_event: IpcMainInvokeEvent, projectName: unknown) => {
    if (!projectTemplateManager) return;
    
    // Validate input
    if (!isValidProjectName(projectName)) {
      logger.warn(`Invalid project name for open-project-folder: ${projectName}`);
      return;
    }
    
    const pathResolver = PathResolver.getInstance();
    const projectPath = path.join(pathResolver.wwwDir, projectName);
    shell.openPath(projectPath);
  });

  ipcMain.handle('open-project-browser', async (_event: IpcMainInvokeEvent, projectName: unknown) => {
    // Special case: empty string means open localhost root
    if (projectName === '') {
      const port = configManager ? configManager.getPort('apache') : 80;
      shell.openExternal(`http://localhost:${port}`);
      return;
    }
    
    // Validate input for project names
    if (!isValidProjectName(projectName)) {
      logger.warn(`Invalid project name for open-project-browser: ${projectName}`);
      return;
    }
    
    const port = configManager ? configManager.getPort('apache') : 80;
    shell.openExternal(`http://localhost:${port}/${projectName}`);
  });
}

// ============================================
// Database Handlers
// ============================================
function registerDatabaseHandlers(): void {
  // List all databases
  ipcMain.handle('db-list', async () => {
    if (!databaseManager) return { success: false, error: 'DatabaseManager not initialized', data: [] };
    try {
      const databases = await databaseManager.listDatabases();
      return { success: true, data: databases };
    } catch (error) {
      return { success: false, error: (error as Error).message, data: [] };
    }
  });

  // Create database
  ipcMain.handle('db-create', async (_event: IpcMainInvokeEvent, name: string) => {
    if (!databaseManager) return { success: false, error: 'DatabaseManager not initialized' };
    if (!name || typeof name !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(name)) {
      return { success: false, error: 'Invalid database name' };
    }
    return databaseManager.createDatabase(name);
  });

  // Delete database
  ipcMain.handle('db-delete', async (_event: IpcMainInvokeEvent, name: string) => {
    if (!databaseManager) return { success: false, error: 'DatabaseManager not initialized' };
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Invalid database name' };
    }
    return databaseManager.deleteDatabase(name);
  });

  // List tables in a database
  ipcMain.handle('db-tables', async (_event: IpcMainInvokeEvent, database: string) => {
    if (!databaseManager) return { success: false, error: 'DatabaseManager not initialized', data: [] };
    if (!database || typeof database !== 'string') {
      return { success: false, error: 'Invalid database name', data: [] };
    }
    try {
      const tables = await databaseManager.listTables(database);
      return { success: true, data: tables };
    } catch (error) {
      return { success: false, error: (error as Error).message, data: [] };
    }
  });

  // Import SQL file
  ipcMain.handle('db-import', async (_event: IpcMainInvokeEvent, database: string, filePath: string) => {
    if (!databaseManager) return { success: false, error: 'DatabaseManager not initialized' };
    if (!database || typeof database !== 'string') {
      return { success: false, error: 'Invalid database name' };
    }
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'Invalid file path' };
    }
    return databaseManager.importSQL(database, filePath);
  });

  // Export database
  ipcMain.handle('db-export', async (_event: IpcMainInvokeEvent, database: string, outputPath: string) => {
    if (!databaseManager) return { success: false, error: 'DatabaseManager not initialized' };
    if (!database || typeof database !== 'string') {
      return { success: false, error: 'Invalid database name' };
    }
    if (!outputPath || typeof outputPath !== 'string') {
      return { success: false, error: 'Invalid output path' };
    }
    return databaseManager.exportDatabase(database, outputPath);
  });

  // Execute SQL query
  ipcMain.handle('db-query', async (_event: IpcMainInvokeEvent, database: string, query: string) => {
    if (!databaseManager) return { success: false, error: 'DatabaseManager not initialized' };
    if (!database || typeof database !== 'string') {
      return { success: false, error: 'Invalid database name' };
    }
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'Invalid query' };
    }
    return databaseManager.executeQuery(database, query);
  });

  // Test database connection
  ipcMain.handle('db-test-connection', async () => {
    if (!databaseManager) return { success: false, error: 'DatabaseManager not initialized' };
    return databaseManager.testConnection();
  });

  // Select SQL file dialog
  ipcMain.handle('db-select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'SQL Files', extensions: ['sql'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
    }
    return { success: false, filePath: null };
  });

  // Save SQL file dialog
  ipcMain.handle('db-save-file', async (_event: IpcMainInvokeEvent, defaultName: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName || 'export.sql',
      filters: [
        { name: 'SQL Files', extensions: ['sql'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePath) {
      return { success: true, filePath: result.filePath };
    }
    return { success: false, filePath: null };
  });
}

// ============================================
// Environment Variable Handlers
// ============================================
function registerEnvHandlers(): void {
  // List all env files
  ipcMain.handle('env-list-files', async () => {
    if (!envManager) {
      envManager = new EnvManager();
    }
    return { success: true, data: envManager.listEnvFiles() };
  });

  // Get specific env file
  ipcMain.handle('env-get-file', async (_event: IpcMainInvokeEvent, filename: string) => {
    if (!envManager) {
      envManager = new EnvManager();
    }
    if (typeof filename !== 'string') {
      return { success: false, error: 'Invalid filename' };
    }
    const file = envManager.getEnvFile(filename);
    if (file) {
      return { success: true, data: file };
    }
    return { success: false, error: 'File not found' };
  });

  // Create new env file
  ipcMain.handle('env-create-file', async (_event: IpcMainInvokeEvent, filename: string, variables?: EnvVariable[]) => {
    if (!envManager) {
      envManager = new EnvManager();
    }
    if (typeof filename !== 'string') {
      return { success: false, error: 'Invalid filename' };
    }
    return envManager.createEnvFile(filename, variables || []);
  });

  // Save env file
  ipcMain.handle('env-save-file', async (_event: IpcMainInvokeEvent, filename: string, variables: EnvVariable[]) => {
    if (!envManager) {
      envManager = new EnvManager();
    }
    if (typeof filename !== 'string' || !Array.isArray(variables)) {
      return { success: false, error: 'Invalid parameters' };
    }
    return envManager.saveEnvFile(filename, variables);
  });

  // Delete env file
  ipcMain.handle('env-delete-file', async (_event: IpcMainInvokeEvent, filename: string) => {
    if (!envManager) {
      envManager = new EnvManager();
    }
    if (typeof filename !== 'string') {
      return { success: false, error: 'Invalid filename' };
    }
    return envManager.deleteEnvFile(filename);
  });

  // Get env directory path
  ipcMain.handle('env-get-dir', async () => {
    if (!envManager) {
      envManager = new EnvManager();
    }
    return { success: true, path: envManager.getEnvDir() };
  });

  // Open env directory in file explorer
  ipcMain.handle('env-open-dir', async () => {
    if (!envManager) {
      envManager = new EnvManager();
    }
    shell.openPath(envManager.getEnvDir());
    return { success: true };
  });
}

// ============================================
// SSL Manager IPC Handlers
// ============================================

let sslManager: SSLManager | null = null;

function registerSSLHandlers(): void {
  // List all certificates
  ipcMain.handle('ssl-list-certs', async () => {
    if (!sslManager) {
      sslManager = new SSLManager();
    }
    return sslManager.listCertificates();
  });

  // Generate new certificate
  ipcMain.handle('ssl-generate-cert', async (_event: IpcMainInvokeEvent, domain: string) => {
    if (!sslManager) {
      sslManager = new SSLManager();
    }
    if (typeof domain !== 'string' || !domain.trim()) {
      return { success: false, error: 'Invalid domain name' };
    }
    return sslManager.generateCertificate(domain.trim());
  });

  // Delete certificate
  ipcMain.handle('ssl-delete-cert', async (_event: IpcMainInvokeEvent, domain: string) => {
    if (!sslManager) {
      sslManager = new SSLManager();
    }
    if (typeof domain !== 'string' || !domain.trim()) {
      return { success: false, error: 'Invalid domain name' };
    }
    return sslManager.deleteCertificate(domain.trim());
  });

  // Trust certificate (add to Windows store)
  ipcMain.handle('ssl-trust-cert', async (_event: IpcMainInvokeEvent, domain: string) => {
    if (!sslManager) {
      sslManager = new SSLManager();
    }
    if (typeof domain !== 'string' || !domain.trim()) {
      return { success: false, error: 'Invalid domain name' };
    }
    return sslManager.trustCertificate(domain.trim());
  });

  // Untrust certificate (remove from Windows store)
  ipcMain.handle('ssl-untrust-cert', async (_event: IpcMainInvokeEvent, domain: string) => {
    if (!sslManager) {
      sslManager = new SSLManager();
    }
    if (typeof domain !== 'string' || !domain.trim()) {
      return { success: false, error: 'Invalid domain name' };
    }
    return sslManager.untrustCertificate(domain.trim());
  });

  // Get certificate info
  ipcMain.handle('ssl-get-cert-info', async (_event: IpcMainInvokeEvent, domain: string) => {
    if (!sslManager) {
      sslManager = new SSLManager();
    }
    if (typeof domain !== 'string' || !domain.trim()) {
      return { success: false, error: 'Invalid domain name' };
    }
    return sslManager.getCertificateInfo(domain.trim());
  });

  // Get Apache SSL config snippet
  ipcMain.handle('ssl-get-apache-config', async (_event: IpcMainInvokeEvent, domain: string) => {
    if (!sslManager) {
      sslManager = new SSLManager();
    }
    if (typeof domain !== 'string' || !domain.trim()) {
      return { success: false, error: 'Invalid domain name' };
    }
    return { success: true, config: sslManager.getApacheSSLConfig(domain.trim()) };
  });

  // Open SSL directory
  ipcMain.handle('ssl-open-dir', async () => {
    if (!sslManager) {
      sslManager = new SSLManager();
    }
    sslManager.openSSLDir();
    return { success: true };
  });

  // Get SSL directory path
  ipcMain.handle('ssl-get-dir', async () => {
    if (!sslManager) {
      sslManager = new SSLManager();
    }
    return { success: true, path: sslManager.getSSLDir() };
  });

  // Check OpenSSL availability
  ipcMain.handle('ssl-check-openssl', async () => {
    if (!sslManager) {
      sslManager = new SSLManager();
    }
    return sslManager.checkOpenSSL();
  });
}

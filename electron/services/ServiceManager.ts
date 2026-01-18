import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import PathResolver from './PathResolver';
import { serviceLogger as logger } from './Logger';

// Type definitions
export type ServiceStatus = 'running' | 'stopped' | 'error';

export interface LogEntry {
    time: string;
    service: string;
    message: string;
}

export interface ServiceHealth {
    service: string;
    status: ServiceStatus;
    isHealthy: boolean;
    lastCheck: string;
    error?: string;
    // Extended health metrics
    pid?: number;
    uptime?: number; // in seconds
    memoryUsage?: number; // in MB
    cpuUsage?: number; // percentage
    port?: number;
}

export interface VHostConfig {
    id: string;
    name: string;
    domain: string;
    path: string;
    createdAt: string;
}

export interface ServiceProcesses {
    php: import('child_process').ChildProcess | null;
    apache: import('child_process').ChildProcess | null;
    mariadb: import('child_process').ChildProcess | null;
}

export interface ConfigManager {
    getPort(service: string): number;
    getVHosts(): VHostConfig[];
    getPHPPath(): string;
}

export interface MainWindow {
    webContents: {
        send(channel: string, ...args: any[]): void;
    };
    isDestroyed(): boolean;
}

export class ServiceManager {
    private mainWindow: MainWindow;
    private configManager: ConfigManager | null;
    private processes: ServiceProcesses;
    private pathResolver: PathResolver;
    private binDir: string;
    private wwwDir: string;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private healthStatus: Record<string, ServiceHealth> = {};
    private lastNotificationTime: Record<string, number> = {};
    private serviceStartTime: Record<string, number> = {}; // Track when each service was started
    private readonly WARMUP_PERIOD_MS = 15000; // 15 seconds grace period after service start (MariaDB init takes time)

    constructor(mainWindow: MainWindow, configManager: ConfigManager | null) {
        this.mainWindow = mainWindow;
        this.configManager = configManager;
        this.processes = {
            php: null,
            apache: null,
            mariadb: null
        };
        
        // Use PathResolver for correct paths in both dev and production
        this.pathResolver = PathResolver.getInstance();
        this.binDir = this.pathResolver.binDir;
        this.wwwDir = this.pathResolver.wwwDir;
        
        // Log paths for debugging
        this.pathResolver.logPaths();
        
        // Initialize health status
        this.initializeHealthStatus();
    }

    private initializeHealthStatus(): void {
        const services: Array<keyof ServiceProcesses> = ['php', 'apache', 'mariadb'];
        services.forEach(service => {
            this.healthStatus[service] = {
                service,
                status: 'stopped',
                isHealthy: false,
                lastCheck: new Date().toISOString()
            };
        });
    }

    getPort(service: string): number {
        if (this.configManager) {
            return this.configManager.getPort(service);
        }
        // Fallback defaults
        const defaults: Record<string, number> = { php: 9000, apache: 80, mariadb: 3306 };
        return defaults[service] || 0;
    }

    // Health Check Methods
    startHealthMonitoring(intervalMs: number = 5000): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(() => {
            this.checkAllServicesHealth();
        }, intervalMs);

        // Initial check
        this.checkAllServicesHealth();
    }

    stopHealthMonitoring(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    private async checkAllServicesHealth(): Promise<void> {
        const services: Array<keyof ServiceProcesses> = ['php', 'apache', 'mariadb'];
        
        for (const service of services) {
            try {
                await this.checkServiceHealth(service);
            } catch (error) {
                this.log('system', `Health check error for ${service}: ${(error as Error).message}`);
            }
        }

        // Send health status to UI
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            logger.debug('Sending health-status to renderer');
            this.mainWindow.webContents.send('health-status', this.healthStatus);
        } else {
            logger.debug('Cannot send health-status: window is destroyed or null');
        }
    }

    private async checkServiceHealth(serviceName: keyof ServiceProcesses): Promise<void> {
        const process = this.processes[serviceName];
        const health = this.healthStatus[serviceName];
        
        // Always set port
        health.port = this.getPort(serviceName);
        
        if (!process || process.killed) {
            health.status = 'stopped';
            health.isHealthy = false;
            health.lastCheck = new Date().toISOString();
            health.error = undefined;
            health.pid = undefined;
            health.uptime = undefined;
            health.memoryUsage = undefined;
            health.cpuUsage = undefined;
            return;
        }

        try {
            // Check if process is still running
            if (process.pid) {
                await this.isProcessRunning(process.pid);
                
                // Get process metrics
                const metrics = await this.getProcessMetrics(process.pid);
                health.pid = process.pid;
                health.memoryUsage = metrics.memory;
                health.cpuUsage = metrics.cpu;
                
                // Calculate uptime
                const startTime = this.serviceStartTime[serviceName];
                if (startTime) {
                    health.uptime = Math.floor((Date.now() - startTime) / 1000);
                }
                
                // Service-specific health checks
                switch (serviceName) {
                    case 'php':
                        await this.checkPHPHealth();
                        break;
                    case 'apache':
                        await this.checkApacheHealth();
                        break;
                    case 'mariadb':
                        await this.checkMariaDBHealth();
                        break;
                }

                health.status = 'running';
                health.isHealthy = true;
                health.error = undefined;
            } else {
                health.status = 'error';
                health.isHealthy = false;
                health.error = 'Process has no PID';
            }
        } catch (error) {
            health.status = 'error';
            health.isHealthy = false;
            health.error = (error as Error).message;
        }

        health.lastCheck = new Date().toISOString();
        
        // Check and send notifications if needed
        this.checkAndNotify(serviceName, health);
    }

    private async isProcessRunning(pid: number): Promise<void> {
        return new Promise((resolve, reject) => {
            exec(`tasklist /FI "PID eq ${pid}" /NH`, (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                
                if (stdout.includes(pid.toString())) {
                    resolve();
                } else {
                    reject(new Error('Process not found'));
                }
            });
        });
    }

    private async checkPHPHealth(): Promise<void> {
        const port = this.getPort('php');
        return new Promise((resolve, reject) => {
            const net = require('net');
            const socket = new net.Socket();

            socket.setTimeout(2000);
            
            socket.connect(port, '127.0.0.1', () => {
                socket.destroy();
                resolve();
            });

            socket.on('error', () => {
                socket.destroy();
                reject(new Error('PHP-CGI not responding'));
            });

            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('PHP-CGI timeout'));
            });
        });
    }

    private async checkApacheHealth(): Promise<void> {
        const port = this.getPort('apache');
        return new Promise((resolve, reject) => {
            const http = require('http');
            
            const req = http.get(`http://localhost:${port}`, (res: any) => {
                res.destroy();
                resolve();
            });

            req.on('error', () => {
                reject(new Error('Apache not responding'));
            });

            req.setTimeout(2000, () => {
                req.destroy();
                reject(new Error('Apache timeout'));
            });
        });
    }

    private async checkMariaDBHealth(): Promise<void> {
        const port = this.getPort('mariadb');
        return new Promise((resolve, reject) => {
            const net = require('net');
            const socket = new net.Socket();

            socket.setTimeout(2000);
            
            socket.connect(port, '127.0.0.1', () => {
                // Wait a bit for MariaDB to respond with handshake
                socket.once('data', (_data: Buffer) => {
                    socket.destroy();
                    resolve();
                });
                
                // If no data received within timeout, consider it unhealthy
                setTimeout(() => {
                    socket.destroy();
                    reject(new Error('MariaDB not responding'));
                }, 1500);
            });

            socket.on('error', () => {
                socket.destroy();
                reject(new Error('MariaDB not responding'));
            });

            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('MariaDB timeout'));
            });
        });
    }

    getHealthStatus(): Record<string, ServiceHealth> {
        return this.healthStatus;
    }

    // Get process metrics (CPU, Memory)
    private async getProcessMetrics(pid: number): Promise<{ cpu: number; memory: number }> {
        return new Promise((resolve) => {
            // Use WMIC on Windows to get process info
            exec(`wmic process where ProcessId=${pid} get WorkingSetSize,PercentProcessorTime /format:csv`, (error, stdout) => {
                if (error) {
                    resolve({ cpu: 0, memory: 0 });
                    return;
                }

                try {
                    const lines = stdout.trim().split('\n').filter(line => line.trim());
                    if (lines.length >= 2) {
                        const values = lines[1].split(',');
                        // WorkingSetSize is in bytes, convert to MB
                        const memoryBytes = parseInt(values[2] || '0', 10);
                        const memoryMB = Math.round(memoryBytes / (1024 * 1024) * 10) / 10;
                        // CPU percentage (WMIC may not always return accurate CPU)
                        const cpu = parseInt(values[1] || '0', 10);
                        resolve({ cpu, memory: memoryMB });
                    } else {
                        resolve({ cpu: 0, memory: 0 });
                    }
                } catch {
                    resolve({ cpu: 0, memory: 0 });
                }
            });
        });
    }

    // Notification Methods
    private sendNotification(title: string, body: string, service?: string): void {
        // Send to UI for native notification
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('service-notification', {
                title,
                body,
                service,
                timestamp: new Date().toISOString()
            });
        }

        // Log the notification
        this.log('system', `Notification: ${title} - ${body}`);
    }

    private shouldNotify(serviceName: keyof ServiceProcesses, type: 'error' | 'warning'): boolean {
        const key = `${serviceName}-${type}`;
        const now = Date.now();
        const lastTime = this.lastNotificationTime[key] || 0;
        
        // Prevent notification spam - only notify once every 30 seconds
        return now - lastTime > 30000;
    }

    private markNotificationSent(serviceName: keyof ServiceProcesses, type: 'error' | 'warning'): void {
        const key = `${serviceName}-${type}`;
        this.lastNotificationTime[key] = Date.now();
    }

    private isInWarmupPeriod(serviceName: keyof ServiceProcesses): boolean {
        const startTime = this.serviceStartTime[serviceName];
        if (!startTime) return false;
        return Date.now() - startTime < this.WARMUP_PERIOD_MS;
    }

    private checkAndNotify(serviceName: keyof ServiceProcesses, health: ServiceHealth): void {
        const displayName = serviceName === 'mariadb' ? 'MariaDB' : serviceName.toUpperCase();
        
        // Skip error notifications during warmup period (service just started)
        if (this.isInWarmupPeriod(serviceName) && health.status === 'error') {
            logger.debug(`${serviceName} is in warmup period, skipping error notification`);
            return;
        }
        
        // Service crashed or stopped unexpectedly
        if (health.status === 'error') {
            if (this.shouldNotify(serviceName, 'error')) {
                this.sendNotification(
                    `${displayName} Error`,
                    `${displayName} encountered an error: ${health.error || 'Unknown error'}`,
                    serviceName
                );
                this.markNotificationSent(serviceName, 'error');
            }
            return;
        }

        // Service stopped (but was running before)
        if (health.status === 'stopped' && this.processes[serviceName]) {
            if (this.shouldNotify(serviceName, 'error')) {
                this.sendNotification(
                    `${displayName} Stopped`,
                    `${displayName} has stopped unexpectedly`,
                    serviceName
                );
                this.markNotificationSent(serviceName, 'error');
            }
            return;
        }

        // Service unhealthy but running (skip during warmup period)
        if (health.status === 'running' && !health.isHealthy) {
            if (!this.isInWarmupPeriod(serviceName) && this.shouldNotify(serviceName, 'warning')) {
                this.sendNotification(
                    `${displayName} Warning`,
                    `${displayName} is running but not responding properly: ${health.error || 'Health check failed'}`,
                    serviceName
                );
                this.markNotificationSent(serviceName, 'warning');
            }
            return;
        }

        // Service recovered
        const previousHealth = this.healthStatus[serviceName];
        if (previousHealth && 
            (previousHealth.status === 'error' || previousHealth.status === 'stopped' || !previousHealth.isHealthy) &&
            health.status === 'running' && health.isHealthy) {
            
            this.sendNotification(
                `${displayName} Recovered`,
                `${displayName} is now running properly`,
                serviceName
            );
        }
    }

    generateConfigs(): void {
        // Write config to userDataPath (C:\LocalDevine\config) instead of Program Files
        // This avoids permission issues when app is installed in Program Files
        const configDir = path.join(this.pathResolver.userDataPath, 'config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        // Create logs directory in userDataPath
        const logsDir = path.join(this.pathResolver.userDataPath, 'logs', 'apache');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        const apacheConfPath = path.join(configDir, 'httpd.conf');
        const wwwPath = this.wwwDir.replace(/\\/g, '/');
        const apachePort = this.getPort('apache');
        const phpPath = (this.configManager ? this.configManager.getPHPPath() : path.join(this.binDir, 'php')).replace(/\\/g, '/');
        const apachePath = path.join(this.binDir, 'apache').replace(/\\/g, '/');
        const logsPath = logsDir.replace(/\\/g, '/');

        // Get virtual hosts from config
        const vhosts = this.configManager ? this.configManager.getVHosts() : [];

        // Generate vhost blocks
        let vhostBlocks = '';
        for (const vhost of vhosts) {
            const vhostPath = vhost.path.replace(/\\/g, '/');
            vhostBlocks += `
<VirtualHost *:${apachePort}>
    ServerName ${vhost.domain}
    DocumentRoot "${vhostPath}"
    <Directory "${vhostPath}">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
`;
        }

        const confContent = `
ServerRoot "${apachePath}"
Listen ${apachePort}
ServerName localhost:${apachePort}

LoadModule actions_module modules/mod_actions.so
LoadModule alias_module modules/mod_alias.so
LoadModule authz_core_module modules/mod_authz_core.so
LoadModule authz_host_module modules/mod_authz_host.so
LoadModule autoindex_module modules/mod_autoindex.so
LoadModule cgi_module modules/mod_cgi.so
LoadModule dir_module modules/mod_dir.so
LoadModule env_module modules/mod_env.so
LoadModule log_config_module modules/mod_log_config.so
LoadModule mime_module modules/mod_mime.so
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule setenvif_module modules/mod_setenvif.so

<IfModule dir_module>
    DirectoryIndex index.php index.html index.htm
</IfModule>

<IfModule mime_module>
    TypesConfig conf/mime.types
    AddType application/x-httpd-php .php
</IfModule>

# PHP via CGI
ScriptAlias /php-cgi/ "${phpPath}/"
Action application/x-httpd-php "/php-cgi/php-cgi.exe"
AddHandler application/x-httpd-php .php

<Directory "${phpPath}">
    AllowOverride None
    Options ExecCGI
    Require all granted
</Directory>

DocumentRoot "${wwwPath}"
<Directory "${wwwPath}">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>

ErrorLog "${logsPath}/error.log"
LogLevel warn
PidFile "${logsPath}/httpd.pid"

<IfModule log_config_module>
    LogFormat "%h %l %u %t \\"%r\\" %>s %b" common
    CustomLog "${logsPath}/access.log" common
</IfModule>

# Default VirtualHost for localhost (must be first!)
<VirtualHost *:${apachePort}>
    ServerName localhost
    ServerAlias 127.0.0.1
    DocumentRoot "${wwwPath}"
    <Directory "${wwwPath}">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
${vhostBlocks}
`;
        fs.writeFileSync(apacheConfPath, confContent.trim());
        const vhostCount = vhosts.length;
        this.log('system', `Config generated (Apache:${apachePort}, PHP, VHosts:${vhostCount})`);
    }

    log(service: string, message: string | Buffer): void {
        const messageStr = message.toString().trim();
        
        // Skip empty messages
        if (!messageStr) {
            return;
        }
        
        // Filter out harmless MariaDB health check warnings
        if (service === 'mariadb' && (
            messageStr.includes('unauthenticated') ||
            messageStr.includes('Got an error reading communication packets') ||
            messageStr.includes('This connection closed normally without authentication')
        )) {
            return; // Skip these messages
        }
        
        // Filter out harmless Apache warnings (not errors)
        if (service === 'apache' && (
            messageStr.includes('NameVirtualHost has no effect') ||
            messageStr.includes('AH00548') // NameVirtualHost deprecation warning code
        )) {
            return; // Skip deprecated warnings
        }
        
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('log-entry', {
                time: new Date().toLocaleTimeString(),
                service,
                message: messageStr
            } as LogEntry);
        } else {
            logger.info(`[${service}] ${messageStr}`);
        }
    }

    hasRunningServices(): boolean {
        return Object.values(this.processes).some(p => p !== null);
    }

    async startAllServices(): Promise<void> {
        this.log('system', 'Starting all services...');
        const services: Array<keyof ServiceProcesses> = ['php', 'apache', 'mariadb'];
        for (const service of services) {
            this.log('system', `Checking ${service}...`);
            if (!this.processes[service]) {
                try {
                    this.log('system', `Starting ${service}...`);
                    await this.startService(service);
                    // Different services need different startup times
                    // MariaDB may need longer on first run due to initialization
                    let delay = 500;
                    if (service === 'apache') delay = 2000;
                    if (service === 'mariadb') delay = 3000; // MariaDB needs more time
                    this.log('system', `Waiting ${delay}ms before next service...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } catch (e) {
                    this.log('system', `Error starting ${service}: ${(e as Error).message}`);
                }
            } else {
                this.log('system', `${service} already running`);
            }
        }
        this.log('system', 'All services started.');
    }

    async stopAllServices(): Promise<void> {
        const services: Array<keyof ServiceProcesses> = ['php', 'apache', 'mariadb'];
        const stopPromises = services.map(service => this.stopService(service));
        await Promise.all(stopPromises);
    }

    async initMariaDB(cwd: string): Promise<void> {
        const dataDir = this.pathResolver.mariadbDataDir;
        const mysqlDir = path.join(dataDir, 'mysql');
        
        // Check if MariaDB is already initialized by looking for mysql system database
        if (fs.existsSync(mysqlDir)) {
            logger.debug(`MariaDB already initialized (found ${mysqlDir})`);
            return Promise.resolve();
        }
        
        this.log('mariadb', `Initializing data directory at ${dataDir}...`);
        const initCmd = path.join(cwd, 'bin/mysql_install_db.exe');

        // Ensure directory exists and is empty for fresh init
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        } else {
            // Clean up any partial/failed init files
            const files = fs.readdirSync(dataDir);
            for (const file of files) {
                const filePath = path.join(dataDir, file);
                try {
                    if (fs.statSync(filePath).isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }
                } catch (e) {
                    logger.warn(`Could not clean up ${filePath}: ${(e as Error).message}`);
                }
            }
            this.log('mariadb', 'Cleaned up partial initialization files');
        }

        return new Promise((resolve, reject) => {
            // mysql_install_db on Windows doesn't support --basedir, use cwd instead
            const initProcess = spawn(initCmd, [`--datadir=${dataDir}`], { 
                cwd,
                windowsHide: true 
            });

            initProcess.stdout?.on('data', (data) => this.log('mariadb', data));
            initProcess.stderr?.on('data', (data) => this.log('mariadb', data));

            initProcess.on('close', async (code) => {
                if (code === 0) {
                    this.log('mariadb', 'Data directory initialized.');
                    
                    // Set root password after initialization
                    try {
                        await this.setRootPassword(cwd, dataDir);
                        this.log('mariadb', 'Root password set to "root"');
                    } catch (e) {
                        logger.warn(`Password setting skipped: ${(e as Error).message}`);
                    }
                    resolve();
                } else {
                    this.log('mariadb', `Initialization failed with code ${code}`);
                    reject(new Error(`Init failed with code ${code}`));
                }
            });

            initProcess.on('error', (err) => {
                this.log('mariadb', `Initialization error: ${err.message}`);
                reject(err);
            });
        });
    }

    // Set root password after MariaDB initialization
    private async setRootPassword(cwd: string, dataDir: string): Promise<void> {
        return new Promise((resolve) => {
            const mysqldCmd = path.join(cwd, 'bin/mysqld.exe');
            const mysqlCmd = path.join(cwd, 'bin/mysql.exe');
            const port = 3307; // Temporary port for setup

            // Start MariaDB temporarily with skip-grant-tables
            this.log('mariadb', 'Starting temporary MariaDB to set password...');
            const tempServer = spawn(mysqldCmd, [
                '--console',
                `--port=${port}`,
                `--basedir=${cwd}`,
                `--datadir=${dataDir}`,
                '--skip-grant-tables'
            ], { cwd, windowsHide: true });

            let serverKilled = false;
            const killServer = () => {
                if (!serverKilled) {
                    serverKilled = true;
                    tempServer.kill();
                    // Also kill by taskkill to be sure
                    exec(`taskkill /F /PID ${tempServer.pid} /T`, () => {});
                }
            };

            // Wait for server to start (5 seconds)
            setTimeout(async () => {
                try {
                    // For MariaDB 10.4+, use SET PASSWORD syntax
                    const sql = "FLUSH PRIVILEGES; SET PASSWORD FOR 'root'@'localhost' = PASSWORD('root'); FLUSH PRIVILEGES;";
                    
                    this.log('mariadb', 'Setting root password...');
                    
                    const sqlProcess = spawn(mysqlCmd, [
                        '-u', 'root',
                        '-P', port.toString(),
                        '--host=127.0.0.1',
                        '-e', sql
                    ], { cwd });

                    sqlProcess.stdout.on('data', (data) => this.log('mariadb', data));
                    sqlProcess.stderr.on('data', (data) => this.log('mariadb', data));

                    sqlProcess.on('close', (code) => {
                        killServer();
                        
                        if (code === 0) {
                            this.log('mariadb', 'Root password set to "root" successfully');
                        } else {
                            this.log('mariadb', `Password setting returned code ${code}, trying alternative method...`);
                            
                            // Try alternative: ALTER USER
                            const sqlProcess2 = spawn(mysqlCmd, [
                                '-u', 'root',
                                '-P', port.toString(),
                                '--host=127.0.0.1',
                                '-e', "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'root'; FLUSH PRIVILEGES;"
                            ], { cwd });

                            sqlProcess2.on('close', (code2) => {
                                killServer();
                                if (code2 === 0) {
                                    this.log('mariadb', 'Root password set via ALTER USER');
                                } else {
                                    this.log('mariadb', 'Warning: Could not set root password automatically');
                                }
                                resolve();
                            });
                            return;
                        }
                        resolve();
                    });
                } catch (e) {
                    this.log('mariadb', `Error setting password: ${(e as Error).message}`);
                    killServer();
                    resolve();
                }
            }, 5000);

            tempServer.on('error', (err) => {
                this.log('mariadb', `Temp server error: ${err.message}`);
                resolve();
            });
        });
    }

    async startService(serviceName: keyof ServiceProcesses): Promise<void> {
        logger.debug(`startService called for: ${serviceName}`);
        
        if (this.processes[serviceName]) {
            this.log(serviceName, 'Already running.');
            return;
        }

        let cmd: string, args: string[], cwd: string | undefined;
        const phpPort = this.getPort('php');
        const mariadbPort = this.getPort('mariadb');

        switch (serviceName) {
            case 'php':
                // Ensure session tmp directory exists (required by php.ini)
                const sessionTmpDir = this.pathResolver.tmpDir;
                if (!fs.existsSync(sessionTmpDir)) {
                    fs.mkdirSync(sessionTmpDir, { recursive: true });
                    this.log('php', `Created session directory: ${sessionTmpDir}`);
                }
                
                // Run PHP-CGI on configured port using selected version
                const phpPath = this.configManager ? this.configManager.getPHPPath() : path.join(this.binDir, 'php');
                cmd = path.join(phpPath, 'php-cgi.exe');
                
                // Use php.ini from user config folder (so user can edit it)
                const userPhpIni = this.pathResolver.phpIniPath;
                if (fs.existsSync(userPhpIni)) {
                    args = ['-b', `127.0.0.1:${phpPort}`, '-c', userPhpIni];
                    this.log('php', `Using php.ini from: ${userPhpIni}`);
                } else {
                    args = ['-b', `127.0.0.1:${phpPort}`];
                    this.log('php', 'Using default php.ini from PHP folder');
                }
                break;
            case 'apache':
                this.generateConfigs(); // Generate before start
                cmd = path.join(this.binDir, 'apache/bin/httpd.exe');
                cwd = path.join(this.binDir, 'apache');
                
                // Ensure logs directory exists in userDataPath (writable location)
                const logsDir = path.join(this.pathResolver.userDataPath, 'logs', 'apache');
                if (!fs.existsSync(logsDir)) {
                    fs.mkdirSync(logsDir, { recursive: true });
                    this.log('apache', `Created logs directory: ${logsDir}`);
                }
                
                // Clean up stale pid file to prevent "Unclean shutdown" warning
                const pidFile = path.join(logsDir, 'httpd.pid');
                if (fs.existsSync(pidFile)) {
                    try {
                        fs.unlinkSync(pidFile);
                        this.log('apache', 'Cleaned up stale PID file');
                    } catch {
                        // Ignore if can't delete
                    }
                }
                
                // Use config from userDataPath (C:\LocalDevine\config) to avoid permission issues
                const apacheConfPath = path.join(this.pathResolver.userDataPath, 'config', 'httpd.conf');
                args = ['-X', '-f', apacheConfPath];
                break;
            case 'mariadb':
                cmd = path.join(this.binDir, 'mariadb/bin/mysqld.exe');
                cwd = path.join(this.binDir, 'mariadb');
                const mariadbBasedir = path.join(this.binDir, 'mariadb');

                // Initialize Data Directory if not exists (async)
                try {
                    await this.initMariaDB(cwd);
                } catch (e) {
                    this.log('mariadb', `Failed to initialize: ${(e as Error).message}`);
                    this.notifyStatus(serviceName, 'stopped');
                    return;
                }
                // Use external data directory at C:\LocalDevine\data\mariadb
                // --basedir is needed so MariaDB can find share/errmsg.sys
                args = [
                    '--console',
                    `--port=${mariadbPort}`,
                    `--basedir=${mariadbBasedir}`,
                    `--datadir=${this.pathResolver.mariadbDataDir}`
                ];
                break;
            default:
                this.log('system', `Unknown service: ${serviceName}`);
                return;
        }

        this.log(serviceName, `Starting on port ${this.getPort(serviceName)}...`);
        logger.debug(`Command: ${cmd}`);
        logger.debug(`Args: ${args.join(' ')}`);
        logger.debug(`CWD: ${cwd || 'undefined'}`);

        if (!fs.existsSync(cmd)) {
            this.log(serviceName, `Executable not found: ${cmd}`);
            logger.error(`Executable not found: ${cmd}`);
            this.notifyStatus(serviceName, 'stopped');
            return;
        }
        logger.debug('Executable exists, spawning...');

        try {
            // Spawn with Windows-specific options for better compatibility
            const spawnOptions: import('child_process').SpawnOptions = {
                cwd,
                stdio: ['ignore', 'pipe', 'pipe'], // stdin ignored, stdout/stderr piped
                windowsHide: true, // Hide console window on Windows
                detached: false, // Keep child attached to parent
                shell: false, // Don't use shell to avoid path issues
                env: {
                    ...process.env,
                    // Ensure proper PATH for DLL resolution
                    PATH: process.env.PATH
                }
            };
            
            // Log to UI for debugging in production
            this.log(serviceName, `Spawning: ${cmd}`);
            this.log(serviceName, `Args: ${args.join(' ')}`);
            this.log(serviceName, `CWD: ${cwd || 'default'}`);
            this.log(serviceName, `Executable exists: ${fs.existsSync(cmd)}`);
            logger.debug(`Spawning ${serviceName} with options: cwd=${cwd}, cmd=${cmd}, args=${args.join(' ')}`);
            
            const child = spawn(cmd, args, spawnOptions);
            
            // Check if spawn was successful
            if (!child.pid) {
                this.log(serviceName, 'Failed to spawn process - no PID returned');
                this.notifyStatus(serviceName, 'stopped');
                return;
            }
            
            logger.debug(`${serviceName} spawned with PID: ${child.pid}`);
            this.log(serviceName, `Started successfully with PID: ${child.pid}`);
            
            this.processes[serviceName] = child;
            this.serviceStartTime[serviceName] = Date.now(); // Track service start time for warmup period
            this.notifyStatus(serviceName, 'running');

            child.stdout?.on('data', (data) => this.log(serviceName, data));
            child.stderr?.on('data', (data) => this.log(serviceName, data));

            child.on('close', (code, signal) => {
                // Log all close events for debugging
                this.log(serviceName, `Process closed - code: ${code}, signal: ${signal}`);
                this.processes[serviceName] = null;
                this.notifyStatus(serviceName, 'stopped');
            });

            child.on('error', (err) => {
                this.log(serviceName, `Failed to start: ${err.message}`);
                logger.error(`${serviceName} spawn error: ${err.message}`);
                this.processes[serviceName] = null;
                this.notifyStatus(serviceName, 'stopped');
            });

        } catch (e) {
            this.log(serviceName, `Error: ${(e as Error).message}`);
            logger.error(`${serviceName} catch error: ${(e as Error).message}`);
        }
    }

    stopService(serviceName: keyof ServiceProcesses): Promise<void> {
        return new Promise((resolve) => {
            const child = this.processes[serviceName];
            if (child) {
                const pid = child.pid;
                if (pid) {
                    this.log(serviceName, `Stopping (PID: ${pid})...`);

                    // Kill using PID instead of /IM for safety
                    this.killByPID(pid, serviceName)
                        .then(() => {
                            this.processes[serviceName] = null;
                            this.notifyStatus(serviceName, 'stopped');
                            resolve();
                        })
                        .catch((err) => {
                            this.log(serviceName, `Kill error: ${(err as Error).message}`);
                            // Try force kill as fallback
                            child.kill('SIGKILL');
                            this.processes[serviceName] = null;
                            this.notifyStatus(serviceName, 'stopped');
                            resolve();
                        });
                } else {
                    resolve();
                }
            } else {
                resolve();
            }
        });
    }

    killByPID(pid: number, serviceName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Use taskkill with PID for safer termination
            exec(`taskkill /F /PID ${pid} /T`, (error, stdout, stderr) => {
                if (error) {
                    // Check if process already terminated
                    if (stderr.includes('not found') || stderr.includes('ไม่พบ')) {
                        this.log(serviceName, 'Process already terminated.');
                        resolve();
                    } else {
                        reject(error);
                    }
                } else {
                    this.log(serviceName, 'Stopped successfully.');
                    resolve();
                }
            });
        });
    }

    notifyStatus(service: string, status: ServiceStatus): void {
        logger.debug(`notifyStatus: ${service} -> ${status}`);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            logger.debug('Sending service-status to renderer');
            this.mainWindow.webContents.send('service-status', { service, status });
        } else {
            logger.warn('mainWindow not available!');
        }
    }
}

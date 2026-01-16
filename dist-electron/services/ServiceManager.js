"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceManager = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const PathResolver_1 = __importDefault(require("./PathResolver"));
const Logger_1 = require("./Logger");
class ServiceManager {
    constructor(mainWindow, configManager) {
        this.healthCheckInterval = null;
        this.healthStatus = {};
        this.lastNotificationTime = {};
        this.serviceStartTime = {}; // Track when each service was started
        this.WARMUP_PERIOD_MS = 10000; // 10 seconds grace period after service start
        this.mainWindow = mainWindow;
        this.configManager = configManager;
        this.processes = {
            php: null,
            apache: null,
            mariadb: null
        };
        // Use PathResolver for correct paths in both dev and production
        this.pathResolver = PathResolver_1.default.getInstance();
        this.binDir = this.pathResolver.binDir;
        this.wwwDir = this.pathResolver.wwwDir;
        // Log paths for debugging
        this.pathResolver.logPaths();
        // Initialize health status
        this.initializeHealthStatus();
    }
    initializeHealthStatus() {
        const services = ['php', 'apache', 'mariadb'];
        services.forEach(service => {
            this.healthStatus[service] = {
                service,
                status: 'stopped',
                isHealthy: false,
                lastCheck: new Date().toISOString()
            };
        });
    }
    getPort(service) {
        if (this.configManager) {
            return this.configManager.getPort(service);
        }
        // Fallback defaults
        const defaults = { php: 9000, apache: 80, mariadb: 3306 };
        return defaults[service] || 0;
    }
    // Health Check Methods
    startHealthMonitoring(intervalMs = 5000) {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        this.healthCheckInterval = setInterval(() => {
            this.checkAllServicesHealth();
        }, intervalMs);
        // Initial check
        this.checkAllServicesHealth();
    }
    stopHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
    async checkAllServicesHealth() {
        const services = ['php', 'apache', 'mariadb'];
        for (const service of services) {
            try {
                await this.checkServiceHealth(service);
            }
            catch (error) {
                this.log('system', `Health check error for ${service}: ${error.message}`);
            }
        }
        // Send health status to UI
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            Logger_1.serviceLogger.debug('Sending health-status to renderer');
            this.mainWindow.webContents.send('health-status', this.healthStatus);
        }
        else {
            Logger_1.serviceLogger.debug('Cannot send health-status: window is destroyed or null');
        }
    }
    async checkServiceHealth(serviceName) {
        const process = this.processes[serviceName];
        const health = this.healthStatus[serviceName];
        if (!process || process.killed) {
            health.status = 'stopped';
            health.isHealthy = false;
            health.lastCheck = new Date().toISOString();
            health.error = undefined;
            return;
        }
        try {
            // Check if process is still running
            if (process.pid) {
                await this.isProcessRunning(process.pid);
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
            }
            else {
                health.status = 'error';
                health.isHealthy = false;
                health.error = 'Process has no PID';
            }
        }
        catch (error) {
            health.status = 'error';
            health.isHealthy = false;
            health.error = error.message;
        }
        health.lastCheck = new Date().toISOString();
        // Check and send notifications if needed
        this.checkAndNotify(serviceName, health);
    }
    async isProcessRunning(pid) {
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)(`tasklist /FI "PID eq ${pid}" /NH`, (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                if (stdout.includes(pid.toString())) {
                    resolve();
                }
                else {
                    reject(new Error('Process not found'));
                }
            });
        });
    }
    async checkPHPHealth() {
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
    async checkApacheHealth() {
        const port = this.getPort('apache');
        return new Promise((resolve, reject) => {
            const http = require('http');
            const req = http.get(`http://localhost:${port}`, (res) => {
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
    async checkMariaDBHealth() {
        const port = this.getPort('mariadb');
        return new Promise((resolve, reject) => {
            const net = require('net');
            const socket = new net.Socket();
            socket.setTimeout(2000);
            socket.connect(port, '127.0.0.1', () => {
                // Wait a bit for MariaDB to respond with handshake
                socket.once('data', (data) => {
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
    getHealthStatus() {
        return this.healthStatus;
    }
    // Notification Methods
    sendNotification(title, body, service) {
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
    shouldNotify(serviceName, type) {
        const key = `${serviceName}-${type}`;
        const now = Date.now();
        const lastTime = this.lastNotificationTime[key] || 0;
        // Prevent notification spam - only notify once every 30 seconds
        return now - lastTime > 30000;
    }
    markNotificationSent(serviceName, type) {
        const key = `${serviceName}-${type}`;
        this.lastNotificationTime[key] = Date.now();
    }
    isInWarmupPeriod(serviceName) {
        const startTime = this.serviceStartTime[serviceName];
        if (!startTime)
            return false;
        return Date.now() - startTime < this.WARMUP_PERIOD_MS;
    }
    checkAndNotify(serviceName, health) {
        const displayName = serviceName === 'mariadb' ? 'MariaDB' : serviceName.toUpperCase();
        // Skip error notifications during warmup period (service just started)
        if (this.isInWarmupPeriod(serviceName) && health.status === 'error') {
            Logger_1.serviceLogger.debug(`${serviceName} is in warmup period, skipping error notification`);
            return;
        }
        // Service crashed or stopped unexpectedly
        if (health.status === 'error') {
            if (this.shouldNotify(serviceName, 'error')) {
                this.sendNotification(`${displayName} Error`, `${displayName} encountered an error: ${health.error || 'Unknown error'}`, serviceName);
                this.markNotificationSent(serviceName, 'error');
            }
            return;
        }
        // Service stopped (but was running before)
        if (health.status === 'stopped' && this.processes[serviceName]) {
            if (this.shouldNotify(serviceName, 'error')) {
                this.sendNotification(`${displayName} Stopped`, `${displayName} has stopped unexpectedly`, serviceName);
                this.markNotificationSent(serviceName, 'error');
            }
            return;
        }
        // Service unhealthy but running (skip during warmup period)
        if (health.status === 'running' && !health.isHealthy) {
            if (!this.isInWarmupPeriod(serviceName) && this.shouldNotify(serviceName, 'warning')) {
                this.sendNotification(`${displayName} Warning`, `${displayName} is running but not responding properly: ${health.error || 'Health check failed'}`, serviceName);
                this.markNotificationSent(serviceName, 'warning');
            }
            return;
        }
        // Service recovered
        const previousHealth = this.healthStatus[serviceName];
        if (previousHealth &&
            (previousHealth.status === 'error' || previousHealth.status === 'stopped' || !previousHealth.isHealthy) &&
            health.status === 'running' && health.isHealthy) {
            this.sendNotification(`${displayName} Recovered`, `${displayName} is now running properly`, serviceName);
        }
    }
    generateConfigs() {
        const apacheConfPath = path_1.default.join(this.binDir, 'apache/conf/httpd.conf');
        const wwwPath = this.wwwDir.replace(/\\/g, '/');
        const apachePort = this.getPort('apache');
        const phpPath = (this.configManager ? this.configManager.getPHPPath() : path_1.default.join(this.binDir, 'php')).replace(/\\/g, '/');
        const apachePath = path_1.default.join(this.binDir, 'apache').replace(/\\/g, '/');
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

ErrorLog "logs/error.log"
LogLevel warn

<IfModule log_config_module>
    LogFormat "%h %l %u %t \\"%r\\" %>s %b" common
    CustomLog "logs/access.log" common
</IfModule>

# Enable NameVirtualHost
NameVirtualHost *:${apachePort}

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
        fs_1.default.writeFileSync(apacheConfPath, confContent.trim());
        const vhostCount = vhosts.length;
        this.log('system', `Config generated (Apache:${apachePort}, PHP, VHosts:${vhostCount})`);
    }
    log(service, message) {
        const messageStr = message.toString().trim();
        // Filter out harmless MariaDB health check warnings
        if (service === 'mariadb' && (messageStr.includes('unauthenticated') ||
            messageStr.includes('Got an error reading communication packets') ||
            messageStr.includes('This connection closed normally without authentication'))) {
            return; // Skip these messages
        }
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('log-entry', {
                time: new Date().toLocaleTimeString(),
                service,
                message: messageStr
            });
        }
        else {
            Logger_1.serviceLogger.info(`[${service}] ${messageStr}`);
        }
    }
    hasRunningServices() {
        return Object.values(this.processes).some(p => p !== null);
    }
    async startAllServices() {
        const services = ['php', 'apache', 'mariadb'];
        for (const service of services) {
            if (!this.processes[service]) {
                await this.startService(service);
                // Apache needs more time to fully start
                const delay = service === 'apache' ? 2000 : 500;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    async stopAllServices() {
        const services = ['php', 'apache', 'mariadb'];
        const stopPromises = services.map(service => this.stopService(service));
        await Promise.all(stopPromises);
    }
    async initMariaDB(cwd) {
        const dataDir = this.pathResolver.mariadbDataDir;
        if (!fs_1.default.existsSync(dataDir) || fs_1.default.readdirSync(dataDir).length === 0) {
            this.log('mariadb', `Initializing data directory at ${dataDir}...`);
            const initCmd = path_1.default.join(cwd, 'bin/mysql_install_db.exe');
            // Ensure directory exists
            if (!fs_1.default.existsSync(dataDir)) {
                fs_1.default.mkdirSync(dataDir, { recursive: true });
            }
            return new Promise((resolve, reject) => {
                const initProcess = (0, child_process_1.spawn)(initCmd, [`--datadir=${dataDir}`], { cwd });
                initProcess.stdout.on('data', (data) => this.log('mariadb', data));
                initProcess.stderr.on('data', (data) => this.log('mariadb', data));
                initProcess.on('close', async (code) => {
                    if (code === 0) {
                        this.log('mariadb', 'Data directory initialized.');
                        // Set root password after initialization
                        await this.setRootPassword(cwd, dataDir);
                        this.log('mariadb', 'Root password set to "root"');
                        resolve();
                    }
                    else {
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
        return Promise.resolve();
    }
    // Set root password after MariaDB initialization
    async setRootPassword(cwd, dataDir) {
        return new Promise((resolve, reject) => {
            const mysqldCmd = path_1.default.join(cwd, 'bin/mysqld.exe');
            const mysqlCmd = path_1.default.join(cwd, 'bin/mysql.exe');
            const port = 3307; // Temporary port for setup
            // Start MariaDB temporarily
            this.log('mariadb', 'Starting temporary MariaDB to set password...');
            const tempServer = (0, child_process_1.spawn)(mysqldCmd, [
                '--console',
                `--port=${port}`,
                `--datadir=${dataDir}`,
                '--skip-grant-tables'
            ], { cwd });
            // Wait for server to start
            setTimeout(async () => {
                try {
                    // Run SQL to set password
                    const sqlProcess = (0, child_process_1.spawn)(mysqlCmd, [
                        '-u', 'root',
                        '-P', port.toString(),
                        '-e', "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'root'; FLUSH PRIVILEGES;"
                    ], { cwd });
                    sqlProcess.on('close', (code) => {
                        // Kill temp server
                        tempServer.kill();
                        if (code === 0) {
                            this.log('mariadb', 'Password set successfully');
                            resolve();
                        }
                        else {
                            // If ALTER USER fails, try UPDATE
                            const sqlProcess2 = (0, child_process_1.spawn)(mysqlCmd, [
                                '-u', 'root',
                                '-P', port.toString(),
                                '-e', "FLUSH PRIVILEGES; UPDATE mysql.user SET Password=PASSWORD('root') WHERE User='root'; FLUSH PRIVILEGES;"
                            ], { cwd });
                            sqlProcess2.on('close', () => {
                                tempServer.kill();
                                resolve();
                            });
                        }
                    });
                }
                catch (e) {
                    tempServer.kill();
                    resolve(); // Continue even if password setting fails
                }
            }, 3000);
            tempServer.on('error', () => {
                resolve(); // Continue even if failed
            });
        });
    }
    async startService(serviceName) {
        Logger_1.serviceLogger.debug(`startService called for: ${serviceName}`);
        if (this.processes[serviceName]) {
            this.log(serviceName, 'Already running.');
            return;
        }
        let cmd, args, cwd;
        const phpPort = this.getPort('php');
        const mariadbPort = this.getPort('mariadb');
        switch (serviceName) {
            case 'php':
                // Run PHP-CGI on configured port using selected version
                const phpPath = this.configManager ? this.configManager.getPHPPath() : path_1.default.join(this.binDir, 'php');
                cmd = path_1.default.join(phpPath, 'php-cgi.exe');
                args = ['-b', `127.0.0.1:${phpPort}`];
                break;
            case 'apache':
                this.generateConfigs(); // Generate before start
                cmd = path_1.default.join(this.binDir, 'apache/bin/httpd.exe');
                cwd = path_1.default.join(this.binDir, 'apache');
                // Clean up stale pid file to prevent "Unclean shutdown" warning
                const pidFile = path_1.default.join(this.binDir, 'apache/logs/httpd.pid');
                if (fs_1.default.existsSync(pidFile)) {
                    try {
                        fs_1.default.unlinkSync(pidFile);
                        this.log('apache', 'Cleaned up stale PID file');
                    }
                    catch (e) {
                        // Ignore if can't delete
                    }
                }
                args = ['-X']; // Run in foreground (single process mode)
                break;
            case 'mariadb':
                cmd = path_1.default.join(this.binDir, 'mariadb/bin/mysqld.exe');
                cwd = path_1.default.join(this.binDir, 'mariadb');
                // Initialize Data Directory if not exists (async)
                try {
                    await this.initMariaDB(cwd);
                }
                catch (e) {
                    this.log('mariadb', `Failed to initialize: ${e.message}`);
                    this.notifyStatus(serviceName, 'stopped');
                    return;
                }
                // Use external data directory at C:\LocalDevine\data\mariadb
                args = ['--console', `--port=${mariadbPort}`, `--datadir=${this.pathResolver.mariadbDataDir}`];
                break;
            default:
                this.log('system', `Unknown service: ${serviceName}`);
                return;
        }
        this.log(serviceName, `Starting on port ${this.getPort(serviceName)}...`);
        Logger_1.serviceLogger.debug(`Command: ${cmd}`);
        Logger_1.serviceLogger.debug(`Args: ${args.join(' ')}`);
        Logger_1.serviceLogger.debug(`CWD: ${cwd || 'undefined'}`);
        if (!fs_1.default.existsSync(cmd)) {
            this.log(serviceName, `Executable not found: ${cmd}`);
            Logger_1.serviceLogger.error(`Executable not found: ${cmd}`);
            this.notifyStatus(serviceName, 'stopped');
            return;
        }
        Logger_1.serviceLogger.debug('Executable exists, spawning...');
        try {
            const child = (0, child_process_1.spawn)(cmd, args, { cwd });
            this.processes[serviceName] = child;
            this.serviceStartTime[serviceName] = Date.now(); // Track service start time for warmup period
            this.notifyStatus(serviceName, 'running');
            child.stdout.on('data', (data) => this.log(serviceName, data));
            child.stderr.on('data', (data) => this.log(serviceName, data));
            child.on('close', (code) => {
                this.log(serviceName, `Exited with code ${code}`);
                this.processes[serviceName] = null;
                this.notifyStatus(serviceName, 'stopped');
            });
            child.on('error', (err) => {
                this.log(serviceName, `Failed to start: ${err.message}`);
                this.processes[serviceName] = null;
                this.notifyStatus(serviceName, 'stopped');
            });
        }
        catch (e) {
            this.log(serviceName, `Error: ${e.message}`);
        }
    }
    stopService(serviceName) {
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
                        this.log(serviceName, `Kill error: ${err.message}`);
                        // Try force kill as fallback
                        child.kill('SIGKILL');
                        this.processes[serviceName] = null;
                        this.notifyStatus(serviceName, 'stopped');
                        resolve();
                    });
                }
                else {
                    resolve();
                }
            }
            else {
                resolve();
            }
        });
    }
    killByPID(pid, serviceName) {
        return new Promise((resolve, reject) => {
            // Use taskkill with PID for safer termination
            (0, child_process_1.exec)(`taskkill /F /PID ${pid} /T`, (error, stdout, stderr) => {
                if (error) {
                    // Check if process already terminated
                    if (stderr.includes('not found') || stderr.includes('ไม่พบ')) {
                        this.log(serviceName, 'Process already terminated.');
                        resolve();
                    }
                    else {
                        reject(error);
                    }
                }
                else {
                    this.log(serviceName, 'Stopped successfully.');
                    resolve();
                }
            });
        });
    }
    notifyStatus(service, status) {
        Logger_1.serviceLogger.debug(`notifyStatus: ${service} -> ${status}`);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            Logger_1.serviceLogger.debug('Sending service-status to renderer');
            this.mainWindow.webContents.send('service-status', { service, status });
        }
        else {
            Logger_1.serviceLogger.warn('mainWindow not available!');
        }
    }
}
exports.ServiceManager = ServiceManager;

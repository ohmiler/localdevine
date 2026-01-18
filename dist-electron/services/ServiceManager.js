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
        this.WARMUP_PERIOD_MS = 15000; // 15 seconds grace period after service start (MariaDB init takes time)
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
                socket.once('data', (_data) => {
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
    // Get process metrics (CPU, Memory)
    async getProcessMetrics(pid) {
        return new Promise((resolve) => {
            // Use WMIC on Windows to get process info
            (0, child_process_1.exec)(`wmic process where ProcessId=${pid} get WorkingSetSize,PercentProcessorTime /format:csv`, (error, stdout) => {
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
                    }
                    else {
                        resolve({ cpu: 0, memory: 0 });
                    }
                }
                catch {
                    resolve({ cpu: 0, memory: 0 });
                }
            });
        });
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
        // Write config to userDataPath (C:\LocalDevine\config) instead of Program Files
        // This avoids permission issues when app is installed in Program Files
        const configDir = path_1.default.join(this.pathResolver.userDataPath, 'config');
        if (!fs_1.default.existsSync(configDir)) {
            fs_1.default.mkdirSync(configDir, { recursive: true });
        }
        // Create logs directory in userDataPath
        const logsDir = path_1.default.join(this.pathResolver.userDataPath, 'logs', 'apache');
        if (!fs_1.default.existsSync(logsDir)) {
            fs_1.default.mkdirSync(logsDir, { recursive: true });
        }
        const apacheConfPath = path_1.default.join(configDir, 'httpd.conf');
        const wwwPath = this.wwwDir.replace(/\\/g, '/');
        const apachePort = this.getPort('apache');
        const phpPath = (this.configManager ? this.configManager.getPHPPath() : path_1.default.join(this.binDir, 'php')).replace(/\\/g, '/');
        const apachePath = path_1.default.join(this.binDir, 'apache').replace(/\\/g, '/');
        const logsPath = logsDir.replace(/\\/g, '/');
        const configPath = configDir.replace(/\\/g, '/');
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

# Include SSL Configuration (if exists)
IncludeOptional "${configPath}/httpd-ssl.conf"

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
        // Skip empty messages
        if (!messageStr) {
            return;
        }
        // Filter out harmless MariaDB health check warnings
        if (service === 'mariadb' && (messageStr.includes('unauthenticated') ||
            messageStr.includes('Got an error reading communication packets') ||
            messageStr.includes('This connection closed normally without authentication'))) {
            return; // Skip these messages
        }
        // Filter out harmless Apache warnings (not errors)
        if (service === 'apache' && (messageStr.includes('NameVirtualHost has no effect') ||
            messageStr.includes('AH00548') // NameVirtualHost deprecation warning code
        )) {
            return; // Skip deprecated warnings
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
        this.log('system', 'Starting all services...');
        const services = ['php', 'apache', 'mariadb'];
        for (const service of services) {
            this.log('system', `Checking ${service}...`);
            if (!this.processes[service]) {
                try {
                    this.log('system', `Starting ${service}...`);
                    await this.startService(service);
                    // Different services need different startup times
                    // MariaDB may need longer on first run due to initialization
                    let delay = 500;
                    if (service === 'apache')
                        delay = 2000;
                    if (service === 'mariadb')
                        delay = 3000; // MariaDB needs more time
                    this.log('system', `Waiting ${delay}ms before next service...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                catch (e) {
                    this.log('system', `Error starting ${service}: ${e.message}`);
                }
            }
            else {
                this.log('system', `${service} already running`);
            }
        }
        this.log('system', 'All services started.');
    }
    async stopAllServices() {
        const services = ['php', 'apache', 'mariadb'];
        const stopPromises = services.map(service => this.stopService(service));
        await Promise.all(stopPromises);
    }
    async initMariaDB(cwd) {
        const dataDir = this.pathResolver.mariadbDataDir;
        const mysqlDir = path_1.default.join(dataDir, 'mysql');
        // Check if MariaDB is already initialized by looking for mysql system database
        if (fs_1.default.existsSync(mysqlDir)) {
            Logger_1.serviceLogger.debug(`MariaDB already initialized (found ${mysqlDir})`);
            return Promise.resolve();
        }
        this.log('mariadb', `Initializing data directory at ${dataDir}...`);
        const initCmd = path_1.default.join(cwd, 'bin/mysql_install_db.exe');
        // Ensure directory exists and is empty for fresh init
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
        else {
            // Clean up any partial/failed init files
            const files = fs_1.default.readdirSync(dataDir);
            for (const file of files) {
                const filePath = path_1.default.join(dataDir, file);
                try {
                    if (fs_1.default.statSync(filePath).isDirectory()) {
                        fs_1.default.rmSync(filePath, { recursive: true, force: true });
                    }
                    else {
                        fs_1.default.unlinkSync(filePath);
                    }
                }
                catch (e) {
                    Logger_1.serviceLogger.warn(`Could not clean up ${filePath}: ${e.message}`);
                }
            }
            this.log('mariadb', 'Cleaned up partial initialization files');
        }
        return new Promise((resolve, reject) => {
            // mysql_install_db on Windows doesn't support --basedir, use cwd instead
            const initProcess = (0, child_process_1.spawn)(initCmd, [`--datadir=${dataDir}`], {
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
                    }
                    catch (e) {
                        Logger_1.serviceLogger.warn(`Password setting skipped: ${e.message}`);
                    }
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
    // Set root password after MariaDB initialization
    async setRootPassword(cwd, dataDir) {
        return new Promise((resolve) => {
            const mysqldCmd = path_1.default.join(cwd, 'bin/mysqld.exe');
            const mysqlCmd = path_1.default.join(cwd, 'bin/mysql.exe');
            const port = 3307; // Temporary port for setup
            // Start MariaDB temporarily with skip-grant-tables
            this.log('mariadb', 'Starting temporary MariaDB to set password...');
            const tempServer = (0, child_process_1.spawn)(mysqldCmd, [
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
                    (0, child_process_1.exec)(`taskkill /F /PID ${tempServer.pid} /T`, () => { });
                }
            };
            // Wait for server to start (5 seconds)
            setTimeout(async () => {
                try {
                    // For MariaDB 10.4+, use SET PASSWORD syntax
                    const sql = "FLUSH PRIVILEGES; SET PASSWORD FOR 'root'@'localhost' = PASSWORD('root'); FLUSH PRIVILEGES;";
                    this.log('mariadb', 'Setting root password...');
                    const sqlProcess = (0, child_process_1.spawn)(mysqlCmd, [
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
                        }
                        else {
                            this.log('mariadb', `Password setting returned code ${code}, trying alternative method...`);
                            // Try alternative: ALTER USER
                            const sqlProcess2 = (0, child_process_1.spawn)(mysqlCmd, [
                                '-u', 'root',
                                '-P', port.toString(),
                                '--host=127.0.0.1',
                                '-e', "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY 'root'; FLUSH PRIVILEGES;"
                            ], { cwd });
                            sqlProcess2.on('close', (code2) => {
                                killServer();
                                if (code2 === 0) {
                                    this.log('mariadb', 'Root password set via ALTER USER');
                                }
                                else {
                                    this.log('mariadb', 'Warning: Could not set root password automatically');
                                }
                                resolve();
                            });
                            return;
                        }
                        resolve();
                    });
                }
                catch (e) {
                    this.log('mariadb', `Error setting password: ${e.message}`);
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
                // Ensure session tmp directory exists (required by php.ini)
                const sessionTmpDir = this.pathResolver.tmpDir;
                if (!fs_1.default.existsSync(sessionTmpDir)) {
                    fs_1.default.mkdirSync(sessionTmpDir, { recursive: true });
                    this.log('php', `Created session directory: ${sessionTmpDir}`);
                }
                // Run PHP-CGI on configured port using selected version
                const phpPath = this.configManager ? this.configManager.getPHPPath() : path_1.default.join(this.binDir, 'php');
                cmd = path_1.default.join(phpPath, 'php-cgi.exe');
                // Use php.ini from user config folder (so user can edit it)
                const userPhpIni = this.pathResolver.phpIniPath;
                if (fs_1.default.existsSync(userPhpIni)) {
                    args = ['-b', `127.0.0.1:${phpPort}`, '-c', userPhpIni];
                    this.log('php', `Using php.ini from: ${userPhpIni}`);
                }
                else {
                    args = ['-b', `127.0.0.1:${phpPort}`];
                    this.log('php', 'Using default php.ini from PHP folder');
                }
                break;
            case 'apache':
                this.generateConfigs(); // Generate before start
                cmd = path_1.default.join(this.binDir, 'apache/bin/httpd.exe');
                cwd = path_1.default.join(this.binDir, 'apache');
                // Ensure logs directory exists in userDataPath (writable location)
                const logsDir = path_1.default.join(this.pathResolver.userDataPath, 'logs', 'apache');
                if (!fs_1.default.existsSync(logsDir)) {
                    fs_1.default.mkdirSync(logsDir, { recursive: true });
                    this.log('apache', `Created logs directory: ${logsDir}`);
                }
                // Clean up stale pid file to prevent "Unclean shutdown" warning
                const pidFile = path_1.default.join(logsDir, 'httpd.pid');
                if (fs_1.default.existsSync(pidFile)) {
                    try {
                        fs_1.default.unlinkSync(pidFile);
                        this.log('apache', 'Cleaned up stale PID file');
                    }
                    catch {
                        // Ignore if can't delete
                    }
                }
                // Use config from userDataPath (C:\LocalDevine\config) to avoid permission issues
                const apacheConfPath = path_1.default.join(this.pathResolver.userDataPath, 'config', 'httpd.conf');
                args = ['-X', '-f', apacheConfPath];
                break;
            case 'mariadb':
                cmd = path_1.default.join(this.binDir, 'mariadb/bin/mysqld.exe');
                cwd = path_1.default.join(this.binDir, 'mariadb');
                const mariadbBasedir = path_1.default.join(this.binDir, 'mariadb');
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
            // Spawn with Windows-specific options for better compatibility
            const spawnOptions = {
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
            this.log(serviceName, `Executable exists: ${fs_1.default.existsSync(cmd)}`);
            Logger_1.serviceLogger.debug(`Spawning ${serviceName} with options: cwd=${cwd}, cmd=${cmd}, args=${args.join(' ')}`);
            const child = (0, child_process_1.spawn)(cmd, args, spawnOptions);
            // Check if spawn was successful
            if (!child.pid) {
                this.log(serviceName, 'Failed to spawn process - no PID returned');
                this.notifyStatus(serviceName, 'stopped');
                return;
            }
            Logger_1.serviceLogger.debug(`${serviceName} spawned with PID: ${child.pid}`);
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
                Logger_1.serviceLogger.error(`${serviceName} spawn error: ${err.message}`);
                this.processes[serviceName] = null;
                this.notifyStatus(serviceName, 'stopped');
            });
        }
        catch (e) {
            this.log(serviceName, `Error: ${e.message}`);
            Logger_1.serviceLogger.error(`${serviceName} catch error: ${e.message}`);
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

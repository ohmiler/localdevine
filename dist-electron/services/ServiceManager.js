"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceManager = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class ServiceManager {
    constructor(mainWindow, configManager) {
        this.healthCheckInterval = null;
        this.healthStatus = {};
        this.mainWindow = mainWindow;
        this.configManager = configManager;
        this.processes = {
            php: null,
            nginx: null,
            mariadb: null
        };
        this.binDir = path_1.default.join(__dirname, '../../bin');
        this.wwwDir = path_1.default.join(__dirname, '../../www');
        // Initialize health status
        this.initializeHealthStatus();
    }
    initializeHealthStatus() {
        const services = ['php', 'nginx', 'mariadb'];
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
        const defaults = { php: 9000, nginx: 80, mariadb: 3306 };
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
        const services = ['php', 'nginx', 'mariadb'];
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
            this.mainWindow.webContents.send('health-status', this.healthStatus);
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
                    case 'nginx':
                        await this.checkNginxHealth();
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
    async checkNginxHealth() {
        const port = this.getPort('nginx');
        return new Promise((resolve, reject) => {
            const http = require('http');
            const req = http.get(`http://localhost:${port}`, (res) => {
                res.destroy();
                resolve();
            });
            req.on('error', () => {
                reject(new Error('Nginx not responding'));
            });
            req.setTimeout(2000, () => {
                req.destroy();
                reject(new Error('Nginx timeout'));
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
                socket.destroy();
                resolve();
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
    generateConfigs() {
        const nginxConfPath = path_1.default.join(this.binDir, 'nginx/conf/nginx.conf');
        const wwwPathForNginx = this.wwwDir.replace(/\\/g, '/'); // Nginx likes forward slashes
        const nginxPort = this.getPort('nginx');
        const phpPort = this.getPort('php');
        // Get virtual hosts from config
        const vhosts = this.configManager ? this.configManager.getVHosts() : [];
        // Generate vhost server blocks
        let vhostBlocks = '';
        for (const vhost of vhosts) {
            const vhostPath = vhost.path.replace(/\\/g, '/');
            vhostBlocks += `
    server {
        listen       ${nginxPort};
        server_name  ${vhost.domain};
        
        root   "${vhostPath}"; 
        index  index.php index.html index.htm;

        location / {
            try_files $uri $uri/ /index.php?$query_string;
        }

        location ~ \\.php$ {
            try_files $uri =404;
            fastcgi_pass   127.0.0.1:${phpPort};
            fastcgi_index  index.php;
            fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
            include        fastcgi_params;
        }
    }
`;
        }
        const confContent = `
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    # Default server (localhost)
    server {
        listen       ${nginxPort};
        server_name  localhost;
        
        root   "${wwwPathForNginx}"; 
        index  index.php index.html index.htm;

        location / {
            try_files $uri $uri/ =404;
        }

        location ~ \\.php$ {
            try_files $uri =404;
            fastcgi_pass   127.0.0.1:${phpPort};
            fastcgi_index  index.php;
            fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
            include        fastcgi_params;
        }
    }
${vhostBlocks}}
`;
        fs_1.default.writeFileSync(nginxConfPath, confContent.trim());
        const vhostCount = vhosts.length;
        this.log('system', `Config generated (Nginx:${nginxPort}, PHP:${phpPort}, VHosts:${vhostCount})`);
    }
    log(service, message) {
        const messageStr = message.toString().trim();
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('log-entry', {
                time: new Date().toLocaleTimeString(),
                service,
                message: messageStr
            });
        }
        else {
            console.log(`[${service}] ${messageStr}`);
        }
    }
    hasRunningServices() {
        return Object.values(this.processes).some(p => p !== null);
    }
    async startAllServices() {
        const services = ['php', 'nginx', 'mariadb'];
        for (const service of services) {
            if (!this.processes[service]) {
                await this.startService(service);
                // Small delay between starts
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }
    async stopAllServices() {
        const services = ['php', 'nginx', 'mariadb'];
        const stopPromises = services.map(service => this.stopService(service));
        await Promise.all(stopPromises);
    }
    async initMariaDB(cwd) {
        const dataDir = path_1.default.join(cwd, 'data');
        if (!fs_1.default.existsSync(dataDir)) {
            this.log('mariadb', 'Initializing data directory... (This may take a moment)');
            const initCmd = path_1.default.join(cwd, 'bin/mysql_install_db.exe');
            return new Promise((resolve, reject) => {
                const initProcess = (0, child_process_1.spawn)(initCmd, ['--datadir=data'], { cwd });
                initProcess.stdout.on('data', (data) => this.log('mariadb', data));
                initProcess.stderr.on('data', (data) => this.log('mariadb', data));
                initProcess.on('close', (code) => {
                    if (code === 0) {
                        this.log('mariadb', 'Data directory initialized.');
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
    async startService(serviceName) {
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
            case 'nginx':
                this.generateConfigs(); // Generate before start
                cmd = path_1.default.join(this.binDir, 'nginx/nginx.exe');
                cwd = path_1.default.join(this.binDir, 'nginx');
                args = [];
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
                args = ['--console', `--port=${mariadbPort}`];
                break;
            default:
                this.log('system', `Unknown service: ${serviceName}`);
                return;
        }
        this.log(serviceName, `Starting on port ${this.getPort(serviceName)}...`);
        if (!fs_1.default.existsSync(cmd)) {
            this.log(serviceName, `Executable not found! Please run setup script.`);
            this.notifyStatus(serviceName, 'stopped');
            return;
        }
        try {
            const child = (0, child_process_1.spawn)(cmd, args, { cwd });
            this.processes[serviceName] = child;
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
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('service-status', { service, status });
        }
    }
}
exports.ServiceManager = ServiceManager;

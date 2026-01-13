import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';

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
}

export interface VHostConfig {
    id: string;
    name: string;
    domain: string;
    path: string;
    createdAt: string;
}

export interface ServiceProcesses {
    php: import('child_process').ChildProcessWithoutNullStreams | null;
    nginx: import('child_process').ChildProcessWithoutNullStreams | null;
    mariadb: import('child_process').ChildProcessWithoutNullStreams | null;
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
    private binDir: string;
    private wwwDir: string;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private healthStatus: Record<string, ServiceHealth> = {};
    private lastNotificationTime: Record<string, number> = {};

    constructor(mainWindow: MainWindow, configManager: ConfigManager | null) {
        this.mainWindow = mainWindow;
        this.configManager = configManager;
        this.processes = {
            php: null,
            nginx: null,
            mariadb: null
        };
        this.binDir = path.join(__dirname, '../../bin');
        this.wwwDir = path.join(__dirname, '../../www');
        
        // Initialize health status
        this.initializeHealthStatus();
    }

    private initializeHealthStatus(): void {
        const services: Array<keyof ServiceProcesses> = ['php', 'nginx', 'mariadb'];
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
        const defaults: Record<string, number> = { php: 9000, nginx: 80, mariadb: 3306 };
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
        const services: Array<keyof ServiceProcesses> = ['php', 'nginx', 'mariadb'];
        
        for (const service of services) {
            try {
                await this.checkServiceHealth(service);
            } catch (error) {
                this.log('system', `Health check error for ${service}: ${(error as Error).message}`);
            }
        }

        // Send health status to UI
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('health-status', this.healthStatus);
        }
    }

    private async checkServiceHealth(serviceName: keyof ServiceProcesses): Promise<void> {
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

    private async checkNginxHealth(): Promise<void> {
        const port = this.getPort('nginx');
        return new Promise((resolve, reject) => {
            const http = require('http');
            
            const req = http.get(`http://localhost:${port}`, (res: any) => {
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

    private async checkMariaDBHealth(): Promise<void> {
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

    getHealthStatus(): Record<string, ServiceHealth> {
        return this.healthStatus;
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

    private checkAndNotify(serviceName: keyof ServiceProcesses, health: ServiceHealth): void {
        const displayName = serviceName === 'mariadb' ? 'MariaDB' : serviceName.toUpperCase();
        
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

        // Service unhealthy but running
        if (health.status === 'running' && !health.isHealthy) {
            if (this.shouldNotify(serviceName, 'warning')) {
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
        const nginxConfPath = path.join(this.binDir, 'nginx/conf/nginx.conf');
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
        fs.writeFileSync(nginxConfPath, confContent.trim());
        const vhostCount = vhosts.length;
        this.log('system', `Config generated (Nginx:${nginxPort}, PHP:${phpPort}, VHosts:${vhostCount})`);
    }

    log(service: string, message: string | Buffer): void {
        const messageStr = message.toString().trim();
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('log-entry', {
                time: new Date().toLocaleTimeString(),
                service,
                message: messageStr
            } as LogEntry);
        } else {
            console.log(`[${service}] ${messageStr}`);
        }
    }

    hasRunningServices(): boolean {
        return Object.values(this.processes).some(p => p !== null);
    }

    async startAllServices(): Promise<void> {
        const services: Array<keyof ServiceProcesses> = ['php', 'nginx', 'mariadb'];
        for (const service of services) {
            if (!this.processes[service]) {
                await this.startService(service);
                // Small delay between starts
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    async stopAllServices(): Promise<void> {
        const services: Array<keyof ServiceProcesses> = ['php', 'nginx', 'mariadb'];
        const stopPromises = services.map(service => this.stopService(service));
        await Promise.all(stopPromises);
    }

    async initMariaDB(cwd: string): Promise<void> {
        const dataDir = path.join(cwd, 'data');
        if (!fs.existsSync(dataDir)) {
            this.log('mariadb', 'Initializing data directory... (This may take a moment)');
            const initCmd = path.join(cwd, 'bin/mysql_install_db.exe');

            return new Promise((resolve, reject) => {
                const initProcess = spawn(initCmd, ['--datadir=data'], { cwd });

                initProcess.stdout.on('data', (data) => this.log('mariadb', data));
                initProcess.stderr.on('data', (data) => this.log('mariadb', data));

                initProcess.on('close', (code) => {
                    if (code === 0) {
                        this.log('mariadb', 'Data directory initialized.');
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
        return Promise.resolve();
    }

    async startService(serviceName: keyof ServiceProcesses): Promise<void> {
        if (this.processes[serviceName]) {
            this.log(serviceName, 'Already running.');
            return;
        }

        let cmd: string, args: string[], cwd: string | undefined;
        const phpPort = this.getPort('php');
        const mariadbPort = this.getPort('mariadb');

        switch (serviceName) {
            case 'php':
                // Run PHP-CGI on configured port using selected version
                const phpPath = this.configManager ? this.configManager.getPHPPath() : path.join(this.binDir, 'php');
                cmd = path.join(phpPath, 'php-cgi.exe');
                args = ['-b', `127.0.0.1:${phpPort}`];
                break;
            case 'nginx':
                this.generateConfigs(); // Generate before start
                cmd = path.join(this.binDir, 'nginx/nginx.exe');
                cwd = path.join(this.binDir, 'nginx');
                args = [];
                break;
            case 'mariadb':
                cmd = path.join(this.binDir, 'mariadb/bin/mysqld.exe');
                cwd = path.join(this.binDir, 'mariadb');

                // Initialize Data Directory if not exists (async)
                try {
                    await this.initMariaDB(cwd);
                } catch (e) {
                    this.log('mariadb', `Failed to initialize: ${(e as Error).message}`);
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

        if (!fs.existsSync(cmd)) {
            this.log(serviceName, `Executable not found! Please run setup script.`);
            this.notifyStatus(serviceName, 'stopped');
            return;
        }

        try {
            const child = spawn(cmd, args, { cwd });
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

        } catch (e) {
            this.log(serviceName, `Error: ${(e as Error).message}`);
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
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('service-status', { service, status });
        }
    }
}

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
    }

    getPort(service: string): number {
        if (this.configManager) {
            return this.configManager.getPort(service);
        }
        // Fallback defaults
        const defaults: Record<string, number> = { php: 9000, nginx: 80, mariadb: 3306 };
        return defaults[service] || 0;
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

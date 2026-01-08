const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ServiceManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.processes = {
            php: null,
            nginx: null,
            mariadb: null
        };
        this.binDir = path.join(__dirname, '../../bin');
    }

    log(service, message) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('log-entry', {
                time: new Date().toLocaleTimeString(),
                service,
                message: message.toString().trim()
            });
        } else {
            console.log(`[${service}] ${message}`);
        }
    }

    startService(serviceName) {
        if (this.processes[serviceName]) {
            this.log(serviceName, 'Already running.');
            return;
        }

        let cmd, args, cwd;

        switch (serviceName) {
            case 'php':
                // Run PHP-CGI on port 9000
                cmd = path.join(this.binDir, 'php/php-cgi.exe');
                args = ['-b', '127.0.0.1:9000'];
                break;
            case 'nginx':
                cmd = path.join(this.binDir, 'nginx/nginx.exe');
                cwd = path.join(this.binDir, 'nginx');
                args = []; // Nginx reads conf/nginx.conf by default relative to cwd
                break;
            case 'mariadb':
                cmd = path.join(this.binDir, 'mariadb/bin/mysqld.exe');
                args = ['--console'];
                cwd = path.join(this.binDir, 'mariadb');
                break;
            default:
                this.log('system', `Unknown service: ${serviceName}`);
                return;
        }

        this.log(serviceName, `Starting from ${cmd}...`);

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
            this.log(serviceName, `Error: ${e.message}`);
        }
    }

    stopService(serviceName) {
        const child = this.processes[serviceName];
        if (child) {
            this.log(serviceName, 'Stopping...');
            child.kill();
            // Nginx might need specific kill command or taskkill if it spawns workers
            if (serviceName === 'nginx') {
                spawn('taskkill', ['/F', '/IM', 'nginx.exe']);
            }
            if (serviceName === 'php') {
                spawn('taskkill', ['/F', '/IM', 'php-cgi.exe']);
            }
            this.processes[serviceName] = null;
            this.notifyStatus(serviceName, 'stopped');
        }
    }

    notifyStatus(service, status) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('service-status', { service, status });
        }
    }
}

module.exports = ServiceManager;

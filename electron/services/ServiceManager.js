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
        this.wwwDir = path.join(__dirname, '../../www');
    }

    generateConfigs() {
        const nginxConfPath = path.join(this.binDir, 'nginx/conf/nginx.conf');
        const wwwPathForNginx = this.wwwDir.replace(/\\/g, '/'); // Nginx likes forward slashes

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

    server {
        listen       80;
        server_name  localhost;
        
        root   "${wwwPathForNginx}"; 
        index  index.php index.html index.htm;

        location / {
            try_files $uri $uri/ =404;
        }

        location ~ \\.php$ {
            try_files $uri =404;
            fastcgi_pass   127.0.0.1:9000;
            fastcgi_index  index.php;
            fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
            include        fastcgi_params;
        }
    }
}
`;
        fs.writeFileSync(nginxConfPath, confContent.trim());
        this.log('system', 'Dynamic configuration generated.');
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
                this.generateConfigs(); // Generate before start
                cmd = path.join(this.binDir, 'nginx/nginx.exe');
                cwd = path.join(this.binDir, 'nginx');
                args = [];
                break;
            case 'mariadb':
                cmd = path.join(this.binDir, 'mariadb/bin/mysqld.exe');
                cwd = path.join(this.binDir, 'mariadb');

                // Initialize Data Directory if not exists
                const dataDir = path.join(cwd, 'data');
                if (!fs.existsSync(dataDir)) {
                    this.log('mariadb', 'Initializing data directory... (This may take a moment)');
                    const initCmd = path.join(cwd, 'bin/mysql_install_db.exe');
                    try {
                        // Use execSync for blocking init before starting server
                        // Need require('child_process').execSync
                        require('child_process').execSync(`"${initCmd}" --datadir=data`, { cwd });
                        this.log('mariadb', 'Data directory initialized.');
                    } catch (e) {
                        this.log('mariadb', `Initialization failed: ${e.message}`);
                    }
                }
                args = ['--console'];
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
            if (serviceName === 'mariadb') {
                spawn('taskkill', ['/F', '/IM', 'mysqld.exe']);
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

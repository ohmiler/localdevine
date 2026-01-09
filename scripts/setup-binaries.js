const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync, exec } = require('child_process');

// Configuration
const BIN_DIR = path.join(__dirname, '../bin');
const DOWNLOADS = {
    php: {
        url: 'https://windows.php.net/downloads/releases/php-8.5.1-nts-Win32-vs17-x64.zip',
        dest: path.join(BIN_DIR, 'php'),
        zip: 'php.zip'
    },
    nginx: {
        url: 'https://nginx.org/download/nginx-1.24.0.zip',
        dest: path.join(BIN_DIR, 'nginx_temp'), // Nginx zips contain a root folder, need to handle
        zip: 'nginx.zip',
        finalDest: path.join(BIN_DIR, 'nginx')
    },
    mariadb: {
        url: 'https://archive.mariadb.org/mariadb-11.2.2/winx64-packages/mariadb-11.2.2-winx64.zip',
        dest: path.join(BIN_DIR, 'mariadb_temp'),
        zip: 'mariadb.zip',
        finalDest: path.join(BIN_DIR, 'mariadb')
    }
};

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };
        const request = https.get(url, options, (response) => {
            // Handle Redirects
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }

            const file = fs.createWriteStream(dest);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
};

const extractZip = (zipPath, destDir) => {
    console.log(`Extracting ${zipPath} to ${destDir}...`);
    // Use PowerShell to extract (Native on Windows 10+)
    const psCommand = `powershell -command "Expand-Archive -Force '${zipPath}' '${destDir}'"`;
    execSync(psCommand);
};

const moveFiles = (src, dest) => {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    const files = fs.readdirSync(src);
    files.forEach(file => {
        const oldPath = path.join(src, file);
        const newPath = path.join(dest, file);

        if (fs.lstatSync(oldPath).isDirectory()) {
            // Recursive move/merge
            if (file.startsWith('nginx-')) {
                // Flatten nginx-x.x.x folder
                moveFiles(oldPath, dest);
            } else {
                moveFiles(oldPath, newPath);
            }
        } else {
            // If file exists (like conf/nginx.conf), we might want to keep OURS
            // But for now, let's overwrite if it's not the user's custom config
            // Actually, let's only copy if not exists for config?
            // No, standard way: overwrite, but we have custom config waiting...
            // Let's protect confirm files if needed. 
            // Simplest fix for EPERM: Copy then Unlink
            try {
                fs.copyFileSync(oldPath, newPath);
                // fs.unlinkSync(oldPath); // Optional: cleanup source
            } catch (e) {
                console.log(`Warning: could not move ${file}: ${e.message}`);
            }
        }
    });
}

(async () => {
    console.log('Starting Auto-Downloader...');

    if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR);

    // 1. Setup PHP
    if (!fs.existsSync(path.join(DOWNLOADS.php.dest, 'php-cgi.exe'))) {
        console.log('Downloading PHP...');
        if (!fs.existsSync(DOWNLOADS.php.dest)) fs.mkdirSync(DOWNLOADS.php.dest);
        const zipPath = path.join(DOWNLOADS.php.dest, 'php.zip');

        await downloadFile(DOWNLOADS.php.url, zipPath);
        extractZip(zipPath, DOWNLOADS.php.dest);
        fs.unlinkSync(zipPath); // Setup cleanup
        console.log('PHP Setup Complete.');
    } else {
        console.log('PHP already exists.');
    }

    // 2. Setup Nginx
    if (!fs.existsSync(path.join(DOWNLOADS.nginx.finalDest, 'nginx.exe'))) {
        console.log('Downloading Nginx...');
        if (!fs.existsSync(DOWNLOADS.nginx.dest)) fs.mkdirSync(DOWNLOADS.nginx.dest);
        const zipPath = path.join(BIN_DIR, 'nginx.zip');

        await downloadFile(DOWNLOADS.nginx.url, zipPath);
        extractZip(zipPath, DOWNLOADS.nginx.dest);

        // Handle Nginx folder nesting
        moveFiles(DOWNLOADS.nginx.dest, DOWNLOADS.nginx.finalDest);

        fs.unlinkSync(zipPath);
        // fs.rmdirSync(DOWNLOADS.nginx.dest, { recursive: true }); // Cleanup temp
        console.log('Nginx Setup Complete.');
    } else {
        console.log('Nginx already exists.');
    }

    // 3. Setup MariaDB
    if (!fs.existsSync(path.join(DOWNLOADS.mariadb.finalDest, 'bin/mysqld.exe'))) {
        console.log('Downloading MariaDB...');
        if (!fs.existsSync(DOWNLOADS.mariadb.dest)) fs.mkdirSync(DOWNLOADS.mariadb.dest);
        const zipPath = path.join(BIN_DIR, 'mariadb.zip');

        await downloadFile(DOWNLOADS.mariadb.url, zipPath);
        extractZip(zipPath, DOWNLOADS.mariadb.dest);

        // Handle MariaDB folder nesting (flatten)
        const nestedDir = fs.readdirSync(DOWNLOADS.mariadb.dest).find(f => f.startsWith('mariadb-'));
        if (nestedDir) {
            moveFiles(path.join(DOWNLOADS.mariadb.dest, nestedDir), DOWNLOADS.mariadb.finalDest);
        }

        fs.unlinkSync(zipPath);
        console.log('MariaDB Setup Complete.');
    } else {
        console.log('MariaDB already exists.');
    }

    console.log('Use "npm run electron:dev" to start the app!');
})();

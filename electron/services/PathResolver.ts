import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/**
 * PathResolver - Resolves paths correctly for both development and production modes
 * In development: paths are relative to project root
 * In production: 
 *   - bin (Apache, PHP, MariaDB) stays in app resources
 *   - www, data, config goes to C:\LocalDevine for easy access (like XAMPP)
 */
export class PathResolver {
    private static _instance: PathResolver;
    private _basePath: string;
    private _resourcesPath: string;
    private _userDataPath: string; // C:\LocalDevine

    private constructor() {
        if (app.isPackaged) {
            // Production mode
            this._resourcesPath = process.resourcesPath;
            this._basePath = path.join(this._resourcesPath, 'app.asar.unpacked');
            
            // User data at C:\LocalDevine (like XAMPP)
            this._userDataPath = 'C:\\LocalDevine';
            
            // Create directories if they don't exist
            this.ensureDirectories();
        } else {
            // Development mode - use project root
            this._basePath = path.join(__dirname, '../..');
            this._resourcesPath = this._basePath;
            this._userDataPath = this._basePath;
        }
    }

    private ensureDirectories(): void {
        const dirs = [
            this._userDataPath,
            path.join(this._userDataPath, 'www'),
            path.join(this._userDataPath, 'data'),
            path.join(this._userDataPath, 'data', 'mariadb'),
            path.join(this._userDataPath, 'config'),
            path.join(this._userDataPath, 'tmp')
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`Created directory: ${dir}`);
            }
        }

        // Copy default files to www if they don't exist
        this.copyDefaultFiles();
    }

    private copyDefaultFiles(): void {
        const wwwDir = path.join(this._userDataPath, 'www');
        const sourceWwwDir = path.join(this._basePath, 'www');

        // Copy adminer.php if exists in source and not in destination
        const adminerSrc = path.join(sourceWwwDir, 'adminer.php');
        const adminerDest = path.join(wwwDir, 'adminer.php');
        if (fs.existsSync(adminerSrc) && !fs.existsSync(adminerDest)) {
            fs.copyFileSync(adminerSrc, adminerDest);
            console.log('Copied adminer.php to www');
        }

        // Copy updated php.ini to production
        if (app.isPackaged) {
            const sourcePhpIni = path.join(this._basePath, 'bin/php/php.ini');
            const destPhpIni = path.join(this._basePath, 'app.asar.unpacked/bin/php/php.ini');
            if (fs.existsSync(sourcePhpIni) && fs.existsSync(destPhpIni)) {
                fs.copyFileSync(sourcePhpIni, destPhpIni);
                console.log('Updated php.ini with pdo_mysql extension');
            }
        }

        // Create default index.php if www is empty
        const indexPath = path.join(wwwDir, 'index.php');
        if (!fs.existsSync(indexPath)) {
            const defaultIndex = `<?php
/**
 * LocalDevine - Welcome Page
 * Your local PHP development environment
 */
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LocalDevine - Welcome</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 3rem;
            border-radius: 1rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            text-align: center;
            max-width: 600px;
        }
        h1 { color: #4f46e5; margin-bottom: 1rem; font-size: 2.5rem; }
        p { color: #6b7280; margin-bottom: 1.5rem; line-height: 1.6; }
        .info { background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; }
        .info strong { color: #374151; }
        .links { margin-top: 2rem; }
        .links a {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 0.5rem;
            margin: 0.5rem;
            transition: transform 0.2s;
        }
        .links a:hover { transform: translateY(-2px); }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 LocalDevine</h1>
        <p>Your local PHP development environment is ready!</p>
        
        <div class="info">
            <strong>PHP Version:</strong> <?php echo phpversion(); ?><br>
            <strong>Server:</strong> <?php echo \$_SERVER['SERVER_SOFTWARE'] ?? 'Apache'; ?><br>
            <strong>Document Root:</strong> <?php echo \$_SERVER['DOCUMENT_ROOT']; ?>
        </div>
        
        <p>Create your projects in <code>C:\\LocalDevine\\www</code></p>
        
        <div class="links">
            <a href="/adminer.php">📊 Database (Adminer)</a>
            <a href="phpinfo.php">ℹ️ PHP Info</a>
        </div>
    </div>
</body>
</html>`;
            fs.writeFileSync(indexPath, defaultIndex);
            console.log('Created default index.php');
        }

        // Create phpinfo.php
        const phpinfoPath = path.join(wwwDir, 'phpinfo.php');
        if (!fs.existsSync(phpinfoPath)) {
            fs.writeFileSync(phpinfoPath, '<?php phpinfo();');
            console.log('Created phpinfo.php');
        }
    }

    static getInstance(): PathResolver {
        if (!PathResolver._instance) {
            PathResolver._instance = new PathResolver();
        }
        return PathResolver._instance;
    }

    get basePath(): string {
        return this._basePath;
    }

    get userDataPath(): string {
        return this._userDataPath;
    }

    get binDir(): string {
        // bin stays in app resources (Apache, PHP, MariaDB executables)
        return path.join(this._basePath, 'bin');
    }

    get wwwDir(): string {
        // www goes to C:\LocalDevine\www for easy access
        return path.join(this._userDataPath, 'www');
    }

    get configPath(): string {
        // Config at C:\LocalDevine\config\config.json
        return path.join(this._userDataPath, 'config', 'config.json');
    }

    get tmpDir(): string {
        return path.join(this._userDataPath, 'tmp');
    }

    get mariadbDataDir(): string {
        // MariaDB data at C:\LocalDevine\data\mariadb
        return path.join(this._userDataPath, 'data', 'mariadb');
    }

    getPhpPath(version: string): string {
        return path.join(this.binDir, version);
    }

    getApachePath(): string {
        return path.join(this.binDir, 'apache');
    }

    getMariaDBPath(): string {
        return path.join(this.binDir, 'mariadb');
    }

    // For debugging
    logPaths(): void {
        console.log('PathResolver - isPackaged:', app.isPackaged);
        console.log('PathResolver - basePath:', this._basePath);
        console.log('PathResolver - userDataPath:', this._userDataPath);
        console.log('PathResolver - binDir:', this.binDir);
        console.log('PathResolver - wwwDir:', this.wwwDir);
        console.log('PathResolver - mariadbDataDir:', this.mariadbDataDir);
        console.log('PathResolver - configPath:', this.configPath);
    }
}

export default PathResolver;

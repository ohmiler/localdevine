import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { pathLogger as logger } from './Logger';

/**
 * PathResolver - Resolves paths correctly for both development and production modes
 * In development: paths are relative to project root
 * In production: 
 *   - bin (Apache, PHP, MariaDB) stays in app resources
 *   - www, data, config goes to user-configurable path (default: C:\LocalDevine)
 */

interface AppSettings {
    dataPath: string;
}

export class PathResolver {
    private static _instance: PathResolver;
    private _basePath: string;
    private _resourcesPath: string;
    private _userDataPath: string;
    private _settingsPath: string;
    private static readonly DEFAULT_DATA_PATH = 'C:\\LocalDevine';

    private constructor() {
        if (app.isPackaged) {
            // Production mode
            this._resourcesPath = process.resourcesPath;
            this._basePath = path.join(this._resourcesPath, 'app.asar.unpacked');
            
            // Settings stored in %APPDATA%\LocalDevine\settings.json
            this._settingsPath = path.join(app.getPath('appData'), 'LocalDevine', 'settings.json');
            
            // Load user data path from settings (or use default)
            this._userDataPath = this.loadDataPath();
            
            // Create directories if they don't exist
            this.ensureDirectories();
        } else {
            // Development mode - use project root
            this._basePath = path.join(__dirname, '../..');
            this._resourcesPath = this._basePath;
            this._settingsPath = path.join(this._basePath, 'settings.json');
            this._userDataPath = this._basePath;
            
            // Also ensure directories in dev mode (for tmp, data, etc.)
            this.ensureDirectories();
        }
    }

    /**
     * Load data path from settings file, or return default
     */
    private loadDataPath(): string {
        try {
            // Ensure settings directory exists
            const settingsDir = path.dirname(this._settingsPath);
            if (!fs.existsSync(settingsDir)) {
                fs.mkdirSync(settingsDir, { recursive: true });
            }

            if (fs.existsSync(this._settingsPath)) {
                const settings: AppSettings = JSON.parse(fs.readFileSync(this._settingsPath, 'utf8'));
                if (settings.dataPath && fs.existsSync(settings.dataPath)) {
                    logger.debug(`Using custom data path: ${settings.dataPath}`);
                    return settings.dataPath;
                }
            }
        } catch (error) {
            logger.error(`Failed to load settings: ${(error as Error).message}`);
        }
        
        logger.debug(`Using default data path: ${PathResolver.DEFAULT_DATA_PATH}`);
        return PathResolver.DEFAULT_DATA_PATH;
    }

    /**
     * Save data path to settings file
     */
    saveDataPath(newPath: string): { success: boolean; error?: string } {
        try {
            // Validate path
            if (!newPath || newPath.trim() === '') {
                return { success: false, error: 'Path cannot be empty' };
            }

            // Create directory if it doesn't exist
            if (!fs.existsSync(newPath)) {
                fs.mkdirSync(newPath, { recursive: true });
            }

            // Ensure settings directory exists
            const settingsDir = path.dirname(this._settingsPath);
            if (!fs.existsSync(settingsDir)) {
                fs.mkdirSync(settingsDir, { recursive: true });
            }

            // Save settings
            const settings: AppSettings = { dataPath: newPath };
            fs.writeFileSync(this._settingsPath, JSON.stringify(settings, null, 2));
            
            logger.debug(`Saved data path: ${newPath}`);
            return { success: true };
        } catch (error) {
            logger.error(`Failed to save settings: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Get the current data path
     */
    getDataPath(): string {
        return this._userDataPath;
    }

    /**
     * Get the default data path
     */
    static getDefaultDataPath(): string {
        return PathResolver.DEFAULT_DATA_PATH;
    }

    /**
     * Check if using custom data path
     */
    isUsingCustomPath(): boolean {
        return this._userDataPath !== PathResolver.DEFAULT_DATA_PATH;
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
                logger.debug(`Created directory: ${dir}`);
            }
        }

        // Copy default files to www if they don't exist
        this.copyDefaultFiles();
    }

    private copyDefaultFiles(): void {
        const wwwDir = path.join(this._userDataPath, 'www');
        const sourceWwwDir = path.join(this._basePath, 'www');
        const configDir = path.join(this._userDataPath, 'config');

        // Copy adminer.php if exists in source and not in destination
        const adminerSrc = path.join(sourceWwwDir, 'adminer.php');
        const adminerDest = path.join(wwwDir, 'adminer.php');
        if (fs.existsSync(adminerSrc) && !fs.existsSync(adminerDest)) {
            fs.copyFileSync(adminerSrc, adminerDest);
            logger.debug('Copied adminer.php to www');
        }

        // Copy php.ini to user config directory for easy editing
        // This allows users to customize PHP settings without modifying app resources
        const userPhpIni = path.join(configDir, 'php.ini');
        const sourcePhpIni = path.join(this._basePath, 'bin/php/php.ini');
        
        if (!fs.existsSync(userPhpIni) && fs.existsSync(sourcePhpIni)) {
            // Update session.save_path to use userDataPath
            let phpIniContent = fs.readFileSync(sourcePhpIni, 'utf8');
            const sessionSavePath = path.join(this._userDataPath, 'tmp').replace(/\\/g, '/');
            phpIniContent = phpIniContent.replace(
                /session\.save_path\s*=.*/,
                `session.save_path = "${sessionSavePath}"`
            );
            fs.writeFileSync(userPhpIni, phpIniContent);
            logger.debug(`Copied php.ini to user config: ${userPhpIni}`);
        }

        // Create MariaDB my.ini template for easy customization
        const userMyIni = path.join(configDir, 'my.ini');
        if (!fs.existsSync(userMyIni)) {
            const mariadbBasedir = path.join(this.binDir, 'mariadb').replace(/\\/g, '/');
            const mariadbDataDir = this.mariadbDataDir.replace(/\\/g, '/');
            const mariadbPluginDir = path.join(mariadbBasedir, 'lib', 'plugin').replace(/\\/g, '/');
            
            const myIniContent = `[mysqld]
# MariaDB Configuration for LocalDevine
# This file allows you to customize MariaDB settings

# Data directory
datadir=${mariadbDataDir}

# Base directory
basedir=${mariadbBasedir}

# Plugin directory
plugin-dir=${mariadbPluginDir}

# Default port (can be overridden by ServiceManager)
port=3306

# Character set
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci

# Allow files to be imported/exported from any directory
secure-file-priv=

[client]
# Client configuration
plugin-dir=${mariadbPluginDir}
default-character-set=utf8mb4

# You can add more configuration options below
# For example:
# max_connections=151
# query_cache_size=0
# query_cache_type=0
`;
            fs.writeFileSync(userMyIni, myIniContent);
            logger.debug(`Created my.ini template: ${userMyIni}`);
        }

        // Copy updated php.ini to production app.asar.unpacked (for PHP to find if -c not specified)
        if (app.isPackaged) {
            const destPhpIni = path.join(this._basePath, 'bin/php/php.ini');
            if (fs.existsSync(sourcePhpIni) && fs.existsSync(path.dirname(destPhpIni))) {
                // Also ensure the original location has the updated php.ini
                if (fs.existsSync(destPhpIni)) {
                    fs.copyFileSync(sourcePhpIni, destPhpIni);
                    logger.debug('Updated php.ini in app resources');
                }
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
        
        <p>Create your projects in the <code>www</code> folder</p>
        
        <div class="links">
            <a href="/adminer.php">📊 Database (Adminer)</a>
            <a href="phpinfo.php">ℹ️ PHP Info</a>
        </div>
    </div>
</body>
</html>`;
            fs.writeFileSync(indexPath, defaultIndex);
            logger.debug('Created default index.php');
        }

        // Create phpinfo.php
        const phpinfoPath = path.join(wwwDir, 'phpinfo.php');
        if (!fs.existsSync(phpinfoPath)) {
            fs.writeFileSync(phpinfoPath, '<?php phpinfo();');
            logger.debug('Created phpinfo.php');
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
        // www goes to userDataPath/www for easy access
        return path.join(this._userDataPath, 'www');
    }

    get configPath(): string {
        // Config at userDataPath/config/config.json
        return path.join(this._userDataPath, 'config', 'config.json');
    }

    get tmpDir(): string {
        return path.join(this._userDataPath, 'tmp');
    }

    get mariadbDataDir(): string {
        // MariaDB data at userDataPath/data/mariadb
        return path.join(this._userDataPath, 'data', 'mariadb');
    }

    get phpIniPath(): string {
        // php.ini at userDataPath/config/php.ini for easy user customization
        return path.join(this._userDataPath, 'config', 'php.ini');
    }

    get myIniPath(): string {
        // my.ini at userDataPath/config/my.ini for MariaDB customization
        return path.join(this._userDataPath, 'config', 'my.ini');
    }

    get settingsPath(): string {
        return this._settingsPath;
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
        logger.debug(`isPackaged: ${app.isPackaged}`);
        logger.debug(`basePath: ${this._basePath}`);
        logger.debug(`userDataPath: ${this._userDataPath}`);
        logger.debug(`binDir: ${this.binDir}`);
        logger.debug(`wwwDir: ${this.wwwDir}`);
        logger.debug(`mariadbDataDir: ${this.mariadbDataDir}`);
        logger.debug(`configPath: ${this.configPath}`);
    }
}

export default PathResolver;

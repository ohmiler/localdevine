import path from 'path';
import { app } from 'electron';

/**
 * PathResolver - Resolves paths correctly for both development and production modes
 * In development: paths are relative to project root
 * In production: paths are in resources folder (unpacked from asar)
 */
export class PathResolver {
    private static _instance: PathResolver;
    private _basePath: string;
    private _resourcesPath: string;

    private constructor() {
        if (app.isPackaged) {
            // Production mode - use resources path
            this._resourcesPath = process.resourcesPath;
            this._basePath = path.join(this._resourcesPath, 'app.asar.unpacked');
        } else {
            // Development mode - use project root
            this._basePath = path.join(__dirname, '../..');
            this._resourcesPath = this._basePath;
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

    get binDir(): string {
        return path.join(this._basePath, 'bin');
    }

    get wwwDir(): string {
        return path.join(this._basePath, 'www');
    }

    get configPath(): string {
        // Config should be writable, so in production use userData
        if (app.isPackaged) {
            return path.join(app.getPath('userData'), 'config.json');
        }
        return path.join(this._basePath, 'config.json');
    }

    get tmpDir(): string {
        if (app.isPackaged) {
            return path.join(app.getPath('userData'), 'tmp');
        }
        return path.join(this._basePath, 'tmp');
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
        console.log('PathResolver - binDir:', this.binDir);
        console.log('PathResolver - wwwDir:', this.wwwDir);
        console.log('PathResolver - configPath:', this.configPath);
    }
}

export default PathResolver;

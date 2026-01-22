import fs from 'fs';
import path from 'path';
import { VHostConfig } from './ServiceManager';
import PathResolver from './PathResolver';
import { configLogger as logger } from './Logger';

export interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
}

export interface Config {
    ports: {
        php: number;
        apache: number;
        mariadb: number;
    };
    database: DatabaseConfig;
    autoStart: boolean;
    vhosts: VHostConfig[];
    phpVersion: string;
}

export interface PHPVersion {
    id: string;
    name: string;
    path: string;
}

export interface SaveResult {
    success: boolean;
    error?: string;
}

export type AddVHostResult = SaveResult;

export default class ConfigManager {
    private configPath: string;
    private binDir: string;
    private defaultConfig: Config;
    private config: Config;

    constructor() {
        // Use PathResolver for correct paths in both dev and production
        const pathResolver = PathResolver.getInstance();
        this.configPath = pathResolver.configPath;
        this.binDir = pathResolver.binDir;
        this.defaultConfig = {
            ports: {
                php: 9000,
                apache: 80,
                mariadb: 3306
            },
            database: {
                host: '127.0.0.1',
                port: 3306,
                user: 'root',
                password: 'root'
            },
            autoStart: false,
            vhosts: [],
            phpVersion: 'php'
        };
        this.config = this.load();
    }

    load(): Config {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                const loaded = JSON.parse(data) as Partial<Config>;
                // Merge with defaults to ensure all keys exist
                return {
                    ...this.defaultConfig,
                    ...loaded,
                    ports: { ...this.defaultConfig.ports, ...loaded.ports },
                    database: { ...this.defaultConfig.database, ...(loaded.database || {}) },
                    vhosts: loaded.vhosts || [],
                    phpVersion: loaded.phpVersion || 'php'
                };
            }
        } catch (error) {
            logger.error(`Error loading config: ${(error as Error).message}`);
        }
        return { ...this.defaultConfig };
    }

    save(newConfig: Partial<Config>): SaveResult {
        try {
            this.config = {
                ...this.config,
                ...newConfig,
                ports: { ...this.config.ports, ...(newConfig.ports || {}) },
                vhosts: newConfig.vhosts !== undefined ? newConfig.vhosts : this.config.vhosts,
                phpVersion: newConfig.phpVersion !== undefined ? newConfig.phpVersion : this.config.phpVersion
            };
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            return { success: true };
        } catch (error) {
            logger.error(`Error saving config: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        }
    }

    get(): Config {
        return this.config;
    }

    getPort(service: keyof Config['ports']): number {
        return this.config.ports[service] || this.defaultConfig.ports[service];
    }

    getDatabaseConfig(): DatabaseConfig {
        return this.config.database || this.defaultConfig.database;
    }

    // Virtual Hosts methods
    getVHosts(): VHostConfig[] {
        return this.config.vhosts || [];
    }

    addVHost(vhost: Omit<VHostConfig, 'id' | 'createdAt'>): AddVHostResult {
        // vhost = { name, domain, path }
        const vhosts = this.getVHosts();

        // Check if domain already exists
        if (vhosts.some(v => v.domain === vhost.domain)) {
            return { success: false, error: 'Domain already exists' };
        }

        vhosts.push({
            id: Date.now().toString(),
            name: vhost.name,
            domain: vhost.domain,
            path: vhost.path,
            createdAt: new Date().toISOString()
        });

        this.config.vhosts = vhosts;
        return this.save(this.config);
    }

    removeVHost(id: string): SaveResult {
        const vhosts = this.getVHosts().filter(v => v.id !== id);
        this.config.vhosts = vhosts;
        return this.save(this.config);
    }

    // PHP Version methods
    getPHPVersions(): PHPVersion[] {
        const versions: PHPVersion[] = [];
        try {
            const entries = fs.readdirSync(this.binDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('php')) {
                    const phpCgiPath = path.join(this.binDir, entry.name, 'php-cgi.exe');
                    if (fs.existsSync(phpCgiPath)) {
                        // Format display name with dots (e.g., "PHP 8.1", "PHP 8.5 (default)")
                        let displayName: string;
                        if (entry.name === 'php') {
                            displayName = 'PHP 8.5 (default)';
                        } else {
                            // Convert php81 -> PHP 8.1, php82 -> PHP 8.2, etc.
                            const match = entry.name.match(/php(\d)(\d)/);
                            if (match) {
                                displayName = `PHP ${match[1]}.${match[2]}`;
                            } else {
                                displayName = entry.name.toUpperCase();
                            }
                        }
                        versions.push({
                            id: entry.name,
                            name: displayName,
                            path: path.join(this.binDir, entry.name)
                        });
                    }
                }
            }
            // Sort by version descending (8.5, 8.4, 8.3, 8.2, 8.1)
            versions.sort((a, b) => {
                // Extract version numbers for sorting
                const getVersion = (name: string): number => {
                    const match = name.match(/PHP (\d+\.\d+)/);
                    return match ? parseFloat(match[1]) : 0;
                };
                return getVersion(b.name) - getVersion(a.name);
            });
        } catch (error) {
            logger.error(`Error scanning PHP versions: ${(error as Error).message}`);
        }
        return versions;
    }

    getPHPVersion(): string {
        return this.config.phpVersion || 'php';
    }

    setPHPVersion(version: string): SaveResult {
        this.config.phpVersion = version;
        return this.save(this.config);
    }

    getPHPPath(): string {
        return path.join(this.binDir, this.getPHPVersion());
    }
}

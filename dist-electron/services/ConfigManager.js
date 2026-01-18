"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const PathResolver_1 = __importDefault(require("./PathResolver"));
const Logger_1 = require("./Logger");
class ConfigManager {
    constructor() {
        // Use PathResolver for correct paths in both dev and production
        const pathResolver = PathResolver_1.default.getInstance();
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
    load() {
        try {
            if (fs_1.default.existsSync(this.configPath)) {
                const data = fs_1.default.readFileSync(this.configPath, 'utf8');
                const loaded = JSON.parse(data);
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
        }
        catch (error) {
            Logger_1.configLogger.error(`Error loading config: ${error.message}`);
        }
        return { ...this.defaultConfig };
    }
    save(newConfig) {
        try {
            this.config = {
                ...this.config,
                ...newConfig,
                ports: { ...this.config.ports, ...(newConfig.ports || {}) },
                vhosts: newConfig.vhosts !== undefined ? newConfig.vhosts : this.config.vhosts,
                phpVersion: newConfig.phpVersion !== undefined ? newConfig.phpVersion : this.config.phpVersion
            };
            fs_1.default.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            return { success: true };
        }
        catch (error) {
            Logger_1.configLogger.error(`Error saving config: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    get() {
        return this.config;
    }
    getPort(service) {
        return this.config.ports[service] || this.defaultConfig.ports[service];
    }
    getDatabaseConfig() {
        return this.config.database || this.defaultConfig.database;
    }
    // Virtual Hosts methods
    getVHosts() {
        return this.config.vhosts || [];
    }
    addVHost(vhost) {
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
    removeVHost(id) {
        const vhosts = this.getVHosts().filter(v => v.id !== id);
        this.config.vhosts = vhosts;
        return this.save(this.config);
    }
    // PHP Version methods
    getPHPVersions() {
        const versions = [];
        try {
            const entries = fs_1.default.readdirSync(this.binDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('php')) {
                    const phpCgiPath = path_1.default.join(this.binDir, entry.name, 'php-cgi.exe');
                    if (fs_1.default.existsSync(phpCgiPath)) {
                        versions.push({
                            id: entry.name,
                            name: entry.name === 'php' ? 'PHP (default)' : entry.name.toUpperCase().replace('PHP', 'PHP '),
                            path: path_1.default.join(this.binDir, entry.name)
                        });
                    }
                }
            }
        }
        catch (error) {
            Logger_1.configLogger.error(`Error scanning PHP versions: ${error.message}`);
        }
        return versions;
    }
    getPHPVersion() {
        return this.config.phpVersion || 'php';
    }
    setPHPVersion(version) {
        this.config.phpVersion = version;
        return this.save(this.config);
    }
    getPHPPath() {
        return path_1.default.join(this.binDir, this.getPHPVersion());
    }
}
exports.default = ConfigManager;

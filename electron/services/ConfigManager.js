const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../../config.json');
        this.binDir = path.join(__dirname, '../../bin');
        this.defaultConfig = {
            ports: {
                php: 9000,
                nginx: 80,
                mariadb: 3306
            },
            autoStart: false,
            vhosts: [],
            phpVersion: 'php'
        };
        this.config = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                const loaded = JSON.parse(data);
                // Merge with defaults to ensure all keys exist
                return {
                    ...this.defaultConfig,
                    ...loaded,
                    ports: { ...this.defaultConfig.ports, ...loaded.ports },
                    vhosts: loaded.vhosts || [],
                    phpVersion: loaded.phpVersion || 'php'
                };
            }
        } catch (error) {
            console.error('Error loading config:', error.message);
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
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            return { success: true };
        } catch (error) {
            console.error('Error saving config:', error.message);
            return { success: false, error: error.message };
        }
    }

    get() {
        return this.config;
    }

    getPort(service) {
        return this.config.ports[service] || this.defaultConfig.ports[service];
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
            const entries = fs.readdirSync(this.binDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && entry.name.startsWith('php')) {
                    const phpCgiPath = path.join(this.binDir, entry.name, 'php-cgi.exe');
                    if (fs.existsSync(phpCgiPath)) {
                        versions.push({
                            id: entry.name,
                            name: entry.name === 'php' ? 'PHP (default)' : entry.name.toUpperCase().replace('PHP', 'PHP '),
                            path: path.join(this.binDir, entry.name)
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error scanning PHP versions:', error.message);
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
        return path.join(this.binDir, this.getPHPVersion());
    }
}

module.exports = ConfigManager;

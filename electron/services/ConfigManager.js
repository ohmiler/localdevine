const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../../config.json');
        this.defaultConfig = {
            ports: {
                php: 9000,
                nginx: 80,
                mariadb: 3306
            },
            autoStart: false
        };
        this.config = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                const loaded = JSON.parse(data);
                // Merge with defaults to ensure all keys exist
                return { ...this.defaultConfig, ...loaded, ports: { ...this.defaultConfig.ports, ...loaded.ports } };
            }
        } catch (error) {
            console.error('Error loading config:', error.message);
        }
        return { ...this.defaultConfig };
    }

    save(newConfig) {
        try {
            this.config = { ...this.config, ...newConfig, ports: { ...this.config.ports, ...newConfig.ports } };
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
}

module.exports = ConfigManager;

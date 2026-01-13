"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class HostsManager {
    constructor() {
        this.hostsPath = path_1.default.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
        this.backupPath = path_1.default.join(__dirname, '../../hosts.backup');
    }
    // Read and parse hosts file
    readHostsFile() {
        try {
            if (!fs_1.default.existsSync(this.hostsPath)) {
                return { success: false, error: 'Hosts file not found' };
            }
            const content = fs_1.default.readFileSync(this.hostsPath, 'utf8');
            const lines = content.split('\n');
            const entries = [];
            lines.forEach((line, index) => {
                const trimmedLine = line.trim();
                // Skip empty lines and pure comments
                if (!trimmedLine || trimmedLine.startsWith('#')) {
                    return;
                }
                // Check if line is commented out
                const isEnabled = !trimmedLine.startsWith('#');
                const activeLine = isEnabled ? trimmedLine : trimmedLine.substring(1).trim();
                // Parse IP and hostname
                const parts = activeLine.split(/\s+/);
                if (parts.length >= 2) {
                    const ip = parts[0];
                    const hostname = parts[1];
                    // Extract comment if present
                    const commentMatch = activeLine.match(/#\s*(.+)$/);
                    const comment = commentMatch ? commentMatch[1] : undefined;
                    // Validate IP format (basic)
                    if (this.isValidIP(ip)) {
                        entries.push({
                            ip,
                            hostname,
                            comment,
                            enabled: isEnabled,
                            line: index
                        });
                    }
                }
            });
            return { success: true, entries };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to read hosts file: ${error.message}`
            };
        }
    }
    // Write entries back to hosts file
    writeHostsFile(entries) {
        try {
            // Create backup first
            const backupResult = this.createBackup();
            if (!backupResult.success) {
                return backupResult;
            }
            // Read current file to preserve comments and structure
            const currentContent = fs_1.default.readFileSync(this.hostsPath, 'utf8');
            const lines = currentContent.split('\n');
            // Create a map of entries by line number
            const entryMap = new Map();
            entries.forEach(entry => {
                entryMap.set(entry.line, entry);
            });
            // Update lines
            const updatedLines = lines.map((line, index) => {
                const entry = entryMap.get(index);
                if (!entry) {
                    return line; // Keep original line (comments, empty lines)
                }
                // Reconstruct the line
                let newLine = `${entry.ip}\t${entry.hostname}`;
                if (entry.comment) {
                    newLine += ` # ${entry.comment}`;
                }
                return entry.enabled ? newLine : `# ${newLine}`;
            });
            // Write back to file
            const newContent = updatedLines.join('\n');
            fs_1.default.writeFileSync(this.hostsPath, newContent, 'utf8');
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to write hosts file: ${error.message}`
            };
        }
    }
    // Add new entry
    addEntry(ip, hostname, comment) {
        try {
            const result = this.readHostsFile();
            if (!result.success || !result.entries) {
                return result;
            }
            // Check if hostname already exists
            const existing = result.entries.find(e => e.hostname.toLowerCase() === hostname.toLowerCase());
            if (existing) {
                return { success: false, error: `Hostname ${hostname} already exists` };
            }
            // Validate IP
            if (!this.isValidIP(ip)) {
                return { success: false, error: 'Invalid IP address format' };
            }
            // Add new entry at the end
            const newEntry = {
                ip,
                hostname,
                comment,
                enabled: true,
                line: result.entries.length
            };
            result.entries.push(newEntry);
            return this.writeHostsFile(result.entries);
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to add entry: ${error.message}`
            };
        }
    }
    // Remove entry
    removeEntry(hostname) {
        try {
            const result = this.readHostsFile();
            if (!result.success || !result.entries) {
                return result;
            }
            const filteredEntries = result.entries.filter(e => e.hostname.toLowerCase() !== hostname.toLowerCase());
            if (filteredEntries.length === result.entries.length) {
                return { success: false, error: `Hostname ${hostname} not found` };
            }
            return this.writeHostsFile(filteredEntries);
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to remove entry: ${error.message}`
            };
        }
    }
    // Toggle entry enabled/disabled
    toggleEntry(hostname) {
        try {
            const result = this.readHostsFile();
            if (!result.success || !result.entries) {
                return result;
            }
            const entry = result.entries.find(e => e.hostname.toLowerCase() === hostname.toLowerCase());
            if (!entry) {
                return { success: false, error: `Hostname ${hostname} not found` };
            }
            entry.enabled = !entry.enabled;
            return this.writeHostsFile(result.entries);
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to toggle entry: ${error.message}`
            };
        }
    }
    // Restore from backup
    restoreBackup() {
        try {
            if (!fs_1.default.existsSync(this.backupPath)) {
                return { success: false, error: 'No backup file found' };
            }
            fs_1.default.copyFileSync(this.backupPath, this.hostsPath);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to restore backup: ${error.message}`
            };
        }
    }
    // Check if we have admin rights
    checkAdminRights() {
        try {
            // Try to read the hosts file
            fs_1.default.readFileSync(this.hostsPath, 'utf8');
            return true;
        }
        catch (error) {
            return false;
        }
    }
    // Request admin rights and restart
    requestAdminRights() {
        const { spawn } = require('child_process');
        const scriptPath = path_1.default.join(__dirname, '../../scripts/request-admin.js');
        // Create a simple script to restart with admin rights
        const vbsScript = `
Set objShell = CreateObject("Shell.Application")
objShell.ShellExecute "node", "${scriptPath}", "", "runas", 1
        `;
        const vbsPath = path_1.default.join(__dirname, '../../temp-admin.vbs');
        fs_1.default.writeFileSync(vbsPath, vbsScript);
        spawn('cscript', [vbsPath], { detached: true });
        process.exit(0);
    }
    // Private methods
    createBackup() {
        try {
            if (fs_1.default.existsSync(this.hostsPath)) {
                fs_1.default.copyFileSync(this.hostsPath, this.backupPath);
            }
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to create backup: ${error.message}`
            };
        }
    }
    isValidIP(ip) {
        // Basic IPv4 validation
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipv4Regex.test(ip);
    }
}
exports.default = HostsManager;

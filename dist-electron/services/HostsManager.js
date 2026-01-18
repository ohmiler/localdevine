"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const electron_1 = require("electron");
const Logger_1 = require("./Logger");
class HostsManager {
    // Validation: ตรวจสอบ path ว่าอยู่ใน temp directory ที่อนุญาต
    validateSourcePath(sourcePath) {
        const resolvedSource = path_1.default.resolve(sourcePath);
        const resolvedTempDir = path_1.default.resolve(this.tempDir);
        return resolvedSource.startsWith(resolvedTempDir + path_1.default.sep);
    }
    // Escape string สำหรับ PowerShell (ป้องกัน Command Injection)
    escapePowerShellString(str) {
        // Replace single quotes with two single quotes (PowerShell escape)
        return str.replace(/'/g, "''");
    }
    // Validate hostname format
    validateHostname(hostname) {
        if (!hostname || typeof hostname !== 'string') {
            return { valid: false, error: 'Hostname is required' };
        }
        // ตรวจสอบ hostname format
        const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
        if (!hostnameRegex.test(hostname)) {
            return { valid: false, error: 'Invalid hostname format' };
        }
        // ความยาวสูงสุด 253 characters
        if (hostname.length > 253) {
            return { valid: false, error: 'Hostname is too long (max 253 characters)' };
        }
        return { valid: true };
    }
    constructor() {
        this.hostsPath = path_1.default.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
        // Use user-configured data path for backup
        if (electron_1.app.isPackaged) {
            const PathResolver = require('./PathResolver').default;
            const pathResolver = PathResolver.getInstance();
            const dataPath = pathResolver.getDataPath();
            if (!fs_1.default.existsSync(dataPath)) {
                fs_1.default.mkdirSync(dataPath, { recursive: true });
            }
            this.backupPath = path_1.default.join(dataPath, 'hosts.backup');
            this.tempDir = dataPath;
        }
        else {
            this.backupPath = path_1.default.join(__dirname, '../../hosts.backup');
            this.tempDir = path_1.default.dirname(this.backupPath);
        }
        Logger_1.hostsLogger.debug(`Backup path: ${this.backupPath}`);
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
    // Add new entry - using elevated PowerShell
    async addEntry(ip, hostname, comment) {
        try {
            // Validate hostname (ป้องกัน injection)
            const hostnameValidation = this.validateHostname(hostname);
            if (!hostnameValidation.valid) {
                return { success: false, error: hostnameValidation.error };
            }
            // Validate IP
            if (!this.isValidIP(ip)) {
                return { success: false, error: 'Invalid IP address format' };
            }
            // Sanitize comment (remove newlines and control characters)
            const sanitizedComment = comment ? comment.replace(/[\r\n\t]/g, ' ').substring(0, 100) : undefined;
            // Create backup first
            const backupResult = this.createBackup();
            if (!backupResult.success) {
                return backupResult;
            }
            // Read current content
            const currentContent = fs_1.default.readFileSync(this.hostsPath, 'utf8');
            // Check if hostname already exists
            const lines = currentContent.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#'))
                    continue;
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 2 && parts[1].toLowerCase() === hostname.toLowerCase()) {
                    return { success: false, error: `Hostname ${hostname} already exists` };
                }
            }
            // Build new line
            let newLine = `${ip}\t${hostname}`;
            if (sanitizedComment) {
                newLine += `\t# ${sanitizedComment}`;
            }
            // Write new content to temp file
            const needsNewline = !currentContent.endsWith('\n');
            const newContent = currentContent + (needsNewline ? '\n' : '') + newLine + '\n';
            const tempFile = path_1.default.join(this.backupPath.replace('hosts.backup', 'hosts.temp'));
            fs_1.default.writeFileSync(tempFile, newContent, 'utf8');
            // Use elevated PowerShell to copy temp file to hosts
            return await this.elevatedCopyToHosts(tempFile);
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to add entry: ${error.message}`
            };
        }
    }
    // Remove entry - rewrite file without the entry (using elevated PowerShell)
    async removeEntry(hostname) {
        try {
            // Validate hostname (ป้องกัน injection)
            const hostnameValidation = this.validateHostname(hostname);
            if (!hostnameValidation.valid) {
                return { success: false, error: hostnameValidation.error };
            }
            // Create backup first
            const backupResult = this.createBackup();
            if (!backupResult.success) {
                return backupResult;
            }
            // Read current content
            const currentContent = fs_1.default.readFileSync(this.hostsPath, 'utf8');
            const lines = currentContent.split('\n');
            let found = false;
            const newLines = lines.filter(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#'))
                    return true;
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 2 && parts[1].toLowerCase() === hostname.toLowerCase()) {
                    found = true;
                    return false; // Remove this line
                }
                return true;
            });
            if (!found) {
                return { success: false, error: `Hostname ${hostname} not found` };
            }
            // Write to temp file first
            const tempFile = path_1.default.join(this.backupPath.replace('hosts.backup', 'hosts.temp'));
            fs_1.default.writeFileSync(tempFile, newLines.join('\n'), 'utf8');
            // Use elevated PowerShell to copy temp file to hosts
            return await this.elevatedCopyToHosts(tempFile);
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to remove entry: ${error.message}`
            };
        }
    }
    // Use elevated PowerShell to write to hosts file
    elevatedCopyToHosts(sourceFile) {
        return new Promise((resolve) => {
            // Validate source file path (ป้องกัน Command Injection)
            if (!this.validateSourcePath(sourceFile)) {
                resolve({ success: false, error: 'Source file path is not allowed' });
                return;
            }
            // Escape paths for PowerShell (ป้องกัน Command Injection)
            const srcPath = this.escapePowerShellString(sourceFile.replace(/\\/g, '/'));
            const destPath = this.escapePowerShellString(this.hostsPath.replace(/\\/g, '/'));
            // Create a PowerShell script that copies the file
            const scriptContent = `Copy-Item -Path '${srcPath}' -Destination '${destPath}' -Force`;
            const scriptPath = sourceFile.replace('.temp', '.ps1');
            try {
                fs_1.default.writeFileSync(scriptPath, scriptContent, 'utf8');
            }
            catch (err) {
                resolve({ success: false, error: `Failed to create script: ${err.message}` });
                return;
            }
            // Run PowerShell as Admin
            const command = `powershell -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-ExecutionPolicy Bypass -File \\"${scriptPath.replace(/\\/g, '/')}\\"'"`;
            (0, child_process_1.exec)(command, (error) => {
                // Clean up temp files
                try {
                    if (fs_1.default.existsSync(sourceFile))
                        fs_1.default.unlinkSync(sourceFile);
                    if (fs_1.default.existsSync(scriptPath))
                        fs_1.default.unlinkSync(scriptPath);
                }
                catch {
                    // Ignore cleanup errors
                }
                if (error) {
                    resolve({
                        success: false,
                        error: `Failed to write hosts file. Please run LocalDevine as Administrator.`
                    });
                }
                else {
                    resolve({ success: true });
                }
            });
        });
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
        catch {
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

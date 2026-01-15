import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

export interface HostsEntry {
    ip: string;
    hostname: string;
    comment?: string;
    enabled: boolean;
    line: number;
}

export interface HostsFileResult {
    success: boolean;
    entries?: HostsEntry[];
    error?: string;
}

export interface HostsOperationResult {
    success: boolean;
    error?: string;
}

export default class HostsManager {
    private hostsPath: string;
    private backupPath: string;

    constructor() {
        this.hostsPath = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
        this.backupPath = path.join(__dirname, '../../hosts.backup');
    }

    // Read and parse hosts file
    readHostsFile(): HostsFileResult {
        try {
            if (!fs.existsSync(this.hostsPath)) {
                return { success: false, error: 'Hosts file not found' };
            }

            const content = fs.readFileSync(this.hostsPath, 'utf8');
            const lines = content.split('\n');
            const entries: HostsEntry[] = [];

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
        } catch (error) {
            return { 
                success: false, 
                error: `Failed to read hosts file: ${(error as Error).message}` 
            };
        }
    }

    // Write entries back to hosts file
    writeHostsFile(entries: HostsEntry[]): HostsOperationResult {
        try {
            // Create backup first
            const backupResult = this.createBackup();
            if (!backupResult.success) {
                return backupResult;
            }

            // Read current file to preserve comments and structure
            const currentContent = fs.readFileSync(this.hostsPath, 'utf8');
            const lines = currentContent.split('\n');

            // Create a map of entries by line number
            const entryMap = new Map<number, HostsEntry>();
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
            fs.writeFileSync(this.hostsPath, newContent, 'utf8');

            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: `Failed to write hosts file: ${(error as Error).message}` 
            };
        }
    }

    // Add new entry - append directly to file
    addEntry(ip: string, hostname: string, comment?: string): HostsOperationResult {
        try {
            // Create backup first
            const backupResult = this.createBackup();
            if (!backupResult.success) {
                return backupResult;
            }

            // Read current content
            const currentContent = fs.readFileSync(this.hostsPath, 'utf8');
            
            // Check if hostname already exists
            const lines = currentContent.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const parts = trimmed.split(/\s+/);
                if (parts.length >= 2 && parts[1].toLowerCase() === hostname.toLowerCase()) {
                    return { success: false, error: `Hostname ${hostname} already exists` };
                }
            }

            // Validate IP
            if (!this.isValidIP(ip)) {
                return { success: false, error: 'Invalid IP address format' };
            }

            // Build new line
            let newLine = `${ip}\t${hostname}`;
            if (comment) {
                newLine += `\t# ${comment}`;
            }

            // Append to file (ensure newline before if needed)
            const needsNewline = !currentContent.endsWith('\n');
            const contentToAppend = (needsNewline ? '\n' : '') + newLine + '\n';
            
            fs.appendFileSync(this.hostsPath, contentToAppend, 'utf8');
            
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: `Failed to add entry: ${(error as Error).message}` 
            };
        }
    }

    // Remove entry - rewrite file without the entry
    removeEntry(hostname: string): HostsOperationResult {
        try {
            // Create backup first
            const backupResult = this.createBackup();
            if (!backupResult.success) {
                return backupResult;
            }

            // Read current content
            const currentContent = fs.readFileSync(this.hostsPath, 'utf8');
            const lines = currentContent.split('\n');
            
            let found = false;
            const newLines = lines.filter(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return true;
                
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

            // Write back
            fs.writeFileSync(this.hostsPath, newLines.join('\n'), 'utf8');
            
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: `Failed to remove entry: ${(error as Error).message}` 
            };
        }
    }

    // Toggle entry enabled/disabled
    toggleEntry(hostname: string): HostsOperationResult {
        try {
            const result = this.readHostsFile();
            if (!result.success || !result.entries) {
                return result;
            }

            const entry = result.entries.find(e => 
                e.hostname.toLowerCase() === hostname.toLowerCase()
            );

            if (!entry) {
                return { success: false, error: `Hostname ${hostname} not found` };
            }

            entry.enabled = !entry.enabled;
            return this.writeHostsFile(result.entries);
        } catch (error) {
            return { 
                success: false, 
                error: `Failed to toggle entry: ${(error as Error).message}` 
            };
        }
    }

    // Restore from backup
    restoreBackup(): HostsOperationResult {
        try {
            if (!fs.existsSync(this.backupPath)) {
                return { success: false, error: 'No backup file found' };
            }

            fs.copyFileSync(this.backupPath, this.hostsPath);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: `Failed to restore backup: ${(error as Error).message}` 
            };
        }
    }

    // Check if we have admin rights
    checkAdminRights(): boolean {
        try {
            // Try to read the hosts file
            fs.readFileSync(this.hostsPath, 'utf8');
            return true;
        } catch (error) {
            return false;
        }
    }

    // Request admin rights and restart
    requestAdminRights(): void {
        const { spawn } = require('child_process');
        const scriptPath = path.join(__dirname, '../../scripts/request-admin.js');
        
        // Create a simple script to restart with admin rights
        const vbsScript = `
Set objShell = CreateObject("Shell.Application")
objShell.ShellExecute "node", "${scriptPath}", "", "runas", 1
        `;
        
        const vbsPath = path.join(__dirname, '../../temp-admin.vbs');
        fs.writeFileSync(vbsPath, vbsScript);
        
        spawn('cscript', [vbsPath], { detached: true });
        process.exit(0);
    }

    // Private methods
    private createBackup(): HostsOperationResult {
        try {
            if (fs.existsSync(this.hostsPath)) {
                fs.copyFileSync(this.hostsPath, this.backupPath);
            }
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: `Failed to create backup: ${(error as Error).message}` 
            };
        }
    }

    private isValidIP(ip: string): boolean {
        // Basic IPv4 validation
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipv4Regex.test(ip);
    }
}

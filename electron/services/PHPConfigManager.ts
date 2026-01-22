/**
 * PHPConfigManager - Manages PHP configuration (php.ini)
 * Provides functionality to read, parse, and modify php.ini settings
 */

import fs from 'fs';
import path from 'path';
import PathResolver from './PathResolver';
import { serviceLogger as logger } from './Logger';

export interface PHPConfigValue {
    key: string;
    value: string;
    section: string;
    comment?: string;
    isCommented: boolean;
    line: number;
}

export interface PHPConfigSection {
    name: string;
    settings: PHPConfigValue[];
}

export interface PHPExtension {
    name: string;
    enabled: boolean;
    available: boolean;
}

export interface CommonSetting {
    key: string;
    label: string;
    description: string;
    type: 'boolean' | 'number' | 'string' | 'size' | 'select';
    options?: string[];
    defaultValue: string;
    category: string;
}

// Common PHP settings that users frequently modify
export const COMMON_SETTINGS: CommonSetting[] = [
    // Error Handling
    { key: 'display_errors', label: 'Display Errors', description: 'Show PHP errors in browser', type: 'boolean', defaultValue: 'On', category: 'Error Handling' },
    { key: 'display_startup_errors', label: 'Display Startup Errors', description: 'Show errors during PHP startup', type: 'boolean', defaultValue: 'On', category: 'Error Handling' },
    { key: 'error_reporting', label: 'Error Reporting', description: 'Error reporting level', type: 'select', options: ['E_ALL', 'E_ALL & ~E_NOTICE', 'E_ALL & ~E_NOTICE & ~E_DEPRECATED', 'E_ERROR | E_WARNING | E_PARSE'], defaultValue: 'E_ALL', category: 'Error Handling' },
    { key: 'log_errors', label: 'Log Errors', description: 'Log errors to file', type: 'boolean', defaultValue: 'On', category: 'Error Handling' },
    
    // Resource Limits
    { key: 'memory_limit', label: 'Memory Limit', description: 'Maximum memory a script can use', type: 'size', defaultValue: '128M', category: 'Resource Limits' },
    { key: 'max_execution_time', label: 'Max Execution Time', description: 'Maximum execution time in seconds (0 = unlimited)', type: 'number', defaultValue: '30', category: 'Resource Limits' },
    { key: 'max_input_time', label: 'Max Input Time', description: 'Maximum time to parse input data', type: 'number', defaultValue: '60', category: 'Resource Limits' },
    { key: 'max_input_vars', label: 'Max Input Variables', description: 'Maximum number of input variables', type: 'number', defaultValue: '1000', category: 'Resource Limits' },
    
    // File Uploads
    { key: 'file_uploads', label: 'File Uploads', description: 'Allow file uploads', type: 'boolean', defaultValue: 'On', category: 'File Uploads' },
    { key: 'upload_max_filesize', label: 'Upload Max File Size', description: 'Maximum upload file size', type: 'size', defaultValue: '2M', category: 'File Uploads' },
    { key: 'max_file_uploads', label: 'Max File Uploads', description: 'Maximum files per request', type: 'number', defaultValue: '20', category: 'File Uploads' },
    { key: 'post_max_size', label: 'Post Max Size', description: 'Maximum POST data size', type: 'size', defaultValue: '8M', category: 'File Uploads' },
    
    // Session
    { key: 'session.gc_maxlifetime', label: 'Session Lifetime', description: 'Session garbage collection lifetime in seconds', type: 'number', defaultValue: '1440', category: 'Session' },
    { key: 'session.cookie_lifetime', label: 'Cookie Lifetime', description: 'Session cookie lifetime (0 = until browser closes)', type: 'number', defaultValue: '0', category: 'Session' },
    { key: 'session.use_strict_mode', label: 'Strict Mode', description: 'Use strict session mode', type: 'boolean', defaultValue: '0', category: 'Session' },
    
    // Date/Time
    { key: 'date.timezone', label: 'Timezone', description: 'Default timezone', type: 'select', options: ['Asia/Bangkok', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'Asia/Singapore'], defaultValue: 'Asia/Bangkok', category: 'Date/Time' },
    
    // Miscellaneous
    { key: 'short_open_tag', label: 'Short Open Tag', description: 'Allow short PHP tags <?', type: 'boolean', defaultValue: 'Off', category: 'Miscellaneous' },
    { key: 'allow_url_fopen', label: 'Allow URL Fopen', description: 'Allow opening URLs as files', type: 'boolean', defaultValue: 'On', category: 'Miscellaneous' },
    { key: 'allow_url_include', label: 'Allow URL Include', description: 'Allow including URLs (security risk)', type: 'boolean', defaultValue: 'Off', category: 'Miscellaneous' },
    { key: 'expose_php', label: 'Expose PHP', description: 'Show PHP version in HTTP headers', type: 'boolean', defaultValue: 'On', category: 'Miscellaneous' },
    
    // OPcache
    { key: 'opcache.enable', label: 'OPcache Enable', description: 'Enable OPcache for better performance', type: 'boolean', defaultValue: '1', category: 'OPcache' },
    { key: 'opcache.memory_consumption', label: 'OPcache Memory', description: 'Memory for OPcache in MB', type: 'number', defaultValue: '128', category: 'OPcache' },
];

// Available PHP extensions
export const AVAILABLE_EXTENSIONS = [
    'curl', 'mbstring', 'mysqli', 'pdo_mysql', 'openssl', 'zip',
    'gd', 'intl', 'soap', 'sockets', 'sqlite3', 'pdo_sqlite',
    'fileinfo', 'exif', 'bcmath', 'bz2', 'calendar', 'ctype',
    'dom', 'ftp', 'gettext', 'iconv', 'json', 'ldap', 'odbc',
    'pdo_odbc', 'phar', 'simplexml', 'tokenizer', 'xml', 'xmlreader',
    'xmlwriter', 'xsl', 'opcache', 'redis', 'imagick', 'xdebug'
];

export class PHPConfigManager {
    private pathResolver: PathResolver;
    private phpIniPath: string;

    constructor() {
        this.pathResolver = PathResolver.getInstance();
        this.phpIniPath = path.join(this.pathResolver.binDir, 'php', 'php.ini');
    }

    /**
     * Get the php.ini file path
     */
    getConfigPath(): string {
        return this.phpIniPath;
    }

    /**
     * Check if php.ini exists
     */
    configExists(): boolean {
        return fs.existsSync(this.phpIniPath);
    }

    /**
     * Read and parse php.ini file
     */
    readConfig(): { success: boolean; data?: PHPConfigSection[]; raw?: string; error?: string } {
        try {
            if (!this.configExists()) {
                return { success: false, error: 'php.ini file not found' };
            }

            const content = fs.readFileSync(this.phpIniPath, 'utf-8');
            const sections = this.parseIniContent(content);

            return { success: true, data: sections, raw: content };
        } catch (e) {
            logger.error(`Failed to read php.ini: ${(e as Error).message}`);
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Parse INI content into structured data
     */
    private parseIniContent(content: string): PHPConfigSection[] {
        const lines = content.split('\n');
        const sections: PHPConfigSection[] = [];
        let currentSection: PHPConfigSection = { name: 'PHP', settings: [] };
        sections.push(currentSection);

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            // Skip empty lines
            if (!trimmedLine) return;

            // Check for section header [SectionName]
            const sectionMatch = trimmedLine.match(/^\[(.+)\]$/);
            if (sectionMatch) {
                currentSection = { name: sectionMatch[1], settings: [] };
                sections.push(currentSection);
                return;
            }

            // Check for setting (key = value or ;key = value for commented)
            const isCommented = trimmedLine.startsWith(';');
            const settingLine = isCommented ? trimmedLine.substring(1).trim() : trimmedLine;
            
            // Skip pure comments (lines that don't look like settings)
            if (isCommented && !settingLine.includes('=')) return;

            const settingMatch = settingLine.match(/^([^=]+?)\s*=\s*(.*)$/);
            if (settingMatch) {
                const key = settingMatch[1].trim();
                const value = settingMatch[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes

                currentSection.settings.push({
                    key,
                    value,
                    section: currentSection.name,
                    isCommented,
                    line: index + 1
                });
            }
        });

        return sections.filter(s => s.settings.length > 0 || s.name !== 'PHP');
    }

    /**
     * Get a specific setting value
     */
    getSetting(key: string): string | null {
        const result = this.readConfig();
        if (!result.success || !result.data) return null;

        for (const section of result.data) {
            const setting = section.settings.find(s => s.key === key && !s.isCommented);
            if (setting) return setting.value;
        }
        return null;
    }

    /**
     * Get common settings with current values
     */
    getCommonSettings(): { success: boolean; data?: (CommonSetting & { currentValue: string | null })[]; error?: string } {
        const result = this.readConfig();
        if (!result.success) {
            return { success: false, error: result.error };
        }

        const settings = COMMON_SETTINGS.map(setting => ({
            ...setting,
            currentValue: this.getSetting(setting.key)
        }));

        return { success: true, data: settings };
    }

    /**
     * Update a setting in php.ini
     */
    updateSetting(key: string, value: string): { success: boolean; error?: string } {
        try {
            if (!this.configExists()) {
                return { success: false, error: 'php.ini file not found' };
            }

            let content = fs.readFileSync(this.phpIniPath, 'utf-8');
            const lines = content.split('\n');
            let found = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Match both active and commented settings
                const regex = new RegExp(`^;?\\s*${this.escapeRegex(key)}\\s*=`, 'i');
                if (regex.test(line)) {
                    lines[i] = `${key} = ${value}`;
                    found = true;
                    break;
                }
            }

            // If setting not found, add it to [PHP] section or at the end
            if (!found) {
                // Find [PHP] section or add at beginning
                let phpSectionIndex = lines.findIndex(l => l.trim() === '[PHP]');
                if (phpSectionIndex === -1) {
                    // Add at the beginning after any initial comments
                    let insertIndex = 0;
                    while (insertIndex < lines.length && (lines[insertIndex].startsWith(';') || lines[insertIndex].trim() === '')) {
                        insertIndex++;
                    }
                    lines.splice(insertIndex, 0, `${key} = ${value}`);
                } else {
                    // Add after [PHP] section
                    lines.splice(phpSectionIndex + 1, 0, `${key} = ${value}`);
                }
            }

            // Write back
            fs.writeFileSync(this.phpIniPath, lines.join('\n'));
            logger.info(`Updated php.ini: ${key} = ${value}`);

            return { success: true };
        } catch (e) {
            logger.error(`Failed to update php.ini: ${(e as Error).message}`);
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Update multiple settings at once
     */
    updateSettings(settings: { key: string; value: string }[]): { success: boolean; error?: string } {
        try {
            if (!this.configExists()) {
                return { success: false, error: 'php.ini file not found' };
            }

            let content = fs.readFileSync(this.phpIniPath, 'utf-8');
            
            for (const { key, value } of settings) {
                const lines = content.split('\n');
                let found = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    const regex = new RegExp(`^;?\\s*${this.escapeRegex(key)}\\s*=`, 'i');
                    if (regex.test(line)) {
                        lines[i] = `${key} = ${value}`;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    // Find appropriate section or add at beginning
                    const phpSectionIndex = lines.findIndex(l => l.trim() === '[PHP]');
                    if (phpSectionIndex !== -1) {
                        lines.splice(phpSectionIndex + 1, 0, `${key} = ${value}`);
                    } else {
                        lines.unshift(`${key} = ${value}`);
                    }
                }

                content = lines.join('\n');
            }

            fs.writeFileSync(this.phpIniPath, content);
            logger.info(`Updated ${settings.length} settings in php.ini`);

            return { success: true };
        } catch (e) {
            logger.error(`Failed to update php.ini: ${(e as Error).message}`);
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Get list of enabled extensions
     */
    getExtensions(): { success: boolean; data?: PHPExtension[]; error?: string } {
        try {
            if (!this.configExists()) {
                return { success: false, error: 'php.ini file not found' };
            }

            const content = fs.readFileSync(this.phpIniPath, 'utf-8');
            const extDir = path.join(this.pathResolver.binDir, 'php', 'ext');
            
            // Get available extension files
            let availableExtFiles: string[] = [];
            if (fs.existsSync(extDir)) {
                availableExtFiles = fs.readdirSync(extDir)
                    .filter(f => f.startsWith('php_') && f.endsWith('.dll'))
                    .map(f => f.replace('php_', '').replace('.dll', ''));
            }

            const extensions: PHPExtension[] = AVAILABLE_EXTENSIONS.map(name => {
                // Check if extension is enabled in php.ini
                const enabledRegex = new RegExp(`^\\s*extension\\s*=\\s*${name}\\s*$`, 'im');
                const commentedRegex = new RegExp(`^\\s*;\\s*extension\\s*=\\s*${name}\\s*$`, 'im');
                
                const enabled = enabledRegex.test(content);
                const available = availableExtFiles.includes(name) || enabled;

                return {
                    name,
                    enabled,
                    available
                };
            });

            return { success: true, data: extensions };
        } catch (e) {
            logger.error(`Failed to get extensions: ${(e as Error).message}`);
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Enable or disable an extension
     */
    toggleExtension(extensionName: string, enable: boolean): { success: boolean; error?: string } {
        try {
            if (!this.configExists()) {
                return { success: false, error: 'php.ini file not found' };
            }

            let content = fs.readFileSync(this.phpIniPath, 'utf-8');
            const lines = content.split('\n');
            let found = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Match extension=name or ;extension=name
                const enabledMatch = line.match(/^extension\s*=\s*(.+)$/i);
                const commentedMatch = line.match(/^;\s*extension\s*=\s*(.+)$/i);
                
                const extName = enabledMatch?.[1]?.trim() || commentedMatch?.[1]?.trim();
                
                if (extName === extensionName) {
                    if (enable) {
                        lines[i] = `extension=${extensionName}`;
                    } else {
                        lines[i] = `;extension=${extensionName}`;
                    }
                    found = true;
                    break;
                }
            }

            // If not found and enabling, add it
            if (!found && enable) {
                // Find extension_dir line and add after it
                const extDirIndex = lines.findIndex(l => l.trim().startsWith('extension_dir'));
                if (extDirIndex !== -1) {
                    lines.splice(extDirIndex + 1, 0, `extension=${extensionName}`);
                } else {
                    // Add at beginning of file after [PHP]
                    const phpIndex = lines.findIndex(l => l.trim() === '[PHP]');
                    if (phpIndex !== -1) {
                        lines.splice(phpIndex + 1, 0, `extension=${extensionName}`);
                    } else {
                        lines.unshift(`extension=${extensionName}`);
                    }
                }
            }

            fs.writeFileSync(this.phpIniPath, lines.join('\n'));
            logger.info(`${enable ? 'Enabled' : 'Disabled'} extension: ${extensionName}`);

            return { success: true };
        } catch (e) {
            logger.error(`Failed to toggle extension: ${(e as Error).message}`);
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Get raw php.ini content
     */
    getRawContent(): { success: boolean; content?: string; error?: string } {
        try {
            if (!this.configExists()) {
                return { success: false, error: 'php.ini file not found' };
            }

            const content = fs.readFileSync(this.phpIniPath, 'utf-8');
            return { success: true, content };
        } catch (e) {
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Save raw php.ini content
     */
    saveRawContent(content: string): { success: boolean; error?: string } {
        try {
            // Create backup first
            const backupPath = this.phpIniPath + '.backup';
            if (this.configExists()) {
                fs.copyFileSync(this.phpIniPath, backupPath);
            }

            fs.writeFileSync(this.phpIniPath, content);
            logger.info('Saved raw php.ini content');

            return { success: true };
        } catch (e) {
            logger.error(`Failed to save php.ini: ${(e as Error).message}`);
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Restore from backup
     */
    restoreBackup(): { success: boolean; error?: string } {
        try {
            const backupPath = this.phpIniPath + '.backup';
            if (!fs.existsSync(backupPath)) {
                return { success: false, error: 'No backup file found' };
            }

            fs.copyFileSync(backupPath, this.phpIniPath);
            logger.info('Restored php.ini from backup');

            return { success: true };
        } catch (e) {
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Check if backup exists
     */
    hasBackup(): boolean {
        return fs.existsSync(this.phpIniPath + '.backup');
    }

    // Helper to escape regex special characters
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

export default PHPConfigManager;

import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import PathResolver from './PathResolver';
import { pathLogger as logger } from './Logger';

/**
 * ConfigBackupManager - Manages backups of configuration files
 * Automatically creates backups before opening files for editing
 */

export type ConfigFileType = 'php.ini' | 'httpd.conf' | 'config.json' | 'my.ini';

export interface BackupInfo {
    original: string;
    backup: string;
    timestamp: number;
}

export class ConfigBackupManager {
    private static _instance: ConfigBackupManager;
    private pathResolver: PathResolver;
    private backupDir: string;
    private readonly MAX_BACKUPS = 5; // Keep last 5 backups per file

    private constructor() {
        this.pathResolver = PathResolver.getInstance();
        this.backupDir = path.join(this.pathResolver.userDataPath, 'config', 'backups');
        this.ensureBackupDir();
    }

    static getInstance(): ConfigBackupManager {
        if (!ConfigBackupManager._instance) {
            ConfigBackupManager._instance = new ConfigBackupManager();
        }
        return ConfigBackupManager._instance;
    }

    private ensureBackupDir(): void {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            logger.debug(`Created backup directory: ${this.backupDir}`);
        }
    }

    /**
     * Get config file path for a given type
     */
    private getConfigFilePath(fileType: ConfigFileType): string {
        switch (fileType) {
            case 'php.ini':
                return this.pathResolver.phpIniPath;
            case 'httpd.conf':
                return path.join(this.pathResolver.userDataPath, 'config', 'httpd.conf');
            case 'config.json':
                return this.pathResolver.configPath;
            case 'my.ini':
                return path.join(this.pathResolver.userDataPath, 'config', 'my.ini');
            default:
                throw new Error(`Unknown config file type: ${fileType}`);
        }
    }

    /**
     * Create backup of config file before editing
     */
    createBackup(fileType: ConfigFileType): BackupInfo | null {
        try {
            const filePath = this.getConfigFilePath(fileType);
            
            // If file doesn't exist yet, no need to backup
            if (!fs.existsSync(filePath)) {
                logger.debug(`Config file doesn't exist yet: ${filePath}`);
                return null;
            }

            const timestamp = Date.now();
            const baseName = path.basename(filePath, path.extname(filePath));
            const ext = path.extname(filePath);
            const backupName = `${baseName}.${timestamp}${ext}.backup`;
            const backupPath = path.join(this.backupDir, backupName);

            // Copy file to backup
            fs.copyFileSync(filePath, backupPath);
            
            logger.debug(`Created backup: ${backupPath}`);

            // Clean up old backups (keep only last MAX_BACKUPS)
            this.cleanupOldBackups(fileType);

            return {
                original: filePath,
                backup: backupPath,
                timestamp
            };
        } catch (error) {
            logger.error(`Failed to create backup for ${fileType}: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Get list of backups for a config file
     */
    getBackups(fileType: ConfigFileType): BackupInfo[] {
        try {
            const baseName = path.basename(this.getConfigFilePath(fileType), path.extname(this.getConfigFilePath(fileType)));
            const backups: BackupInfo[] = [];

            if (!fs.existsSync(this.backupDir)) {
                return backups;
            }

            const files = fs.readdirSync(this.backupDir);
            const filePattern = new RegExp(`^${baseName}\\.(\\d+)\\.backup$`);

            for (const file of files) {
                const match = file.match(filePattern);
                if (match) {
                    const timestamp = parseInt(match[1], 10);
                    backups.push({
                        original: this.getConfigFilePath(fileType),
                        backup: path.join(this.backupDir, file),
                        timestamp
                    });
                }
            }

            // Sort by timestamp (newest first)
            return backups.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            logger.error(`Failed to list backups for ${fileType}: ${(error as Error).message}`);
            return [];
        }
    }

    /**
     * Restore config file from backup
     */
    restoreBackup(fileType: ConfigFileType, backupPath?: string): { success: boolean; error?: string } {
        try {
            const filePath = this.getConfigFilePath(fileType);
            let targetBackup: string;

            if (backupPath) {
                // Use specific backup
                targetBackup = backupPath;
            } else {
                // Use latest backup
                const backups = this.getBackups(fileType);
                if (backups.length === 0) {
                    return { success: false, error: 'No backup found' };
                }
                targetBackup = backups[0].backup;
            }

            if (!fs.existsSync(targetBackup)) {
                return { success: false, error: 'Backup file not found' };
            }

            // Copy backup back to original location
            fs.copyFileSync(targetBackup, filePath);
            logger.debug(`Restored ${fileType} from backup: ${targetBackup}`);

            return { success: true };
        } catch (error) {
            logger.error(`Failed to restore backup: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Clean up old backups, keeping only the last MAX_BACKUPS
     */
    private cleanupOldBackups(fileType: ConfigFileType): void {
        try {
            const backups = this.getBackups(fileType);
            
            // Remove backups beyond MAX_BACKUPS
            if (backups.length > this.MAX_BACKUPS) {
                const toRemove = backups.slice(this.MAX_BACKUPS);
                for (const backup of toRemove) {
                    try {
                        fs.unlinkSync(backup.backup);
                        logger.debug(`Removed old backup: ${backup.backup}`);
                    } catch (error) {
                        logger.error(`Failed to remove backup ${backup.backup}: ${(error as Error).message}`);
                    }
                }
            }
        } catch (error) {
            logger.error(`Failed to cleanup backups: ${(error as Error).message}`);
        }
    }

    /**
     * Delete all backups for a config file type
     */
    deleteAllBackups(fileType: ConfigFileType): { success: boolean; error?: string } {
        try {
            const backups = this.getBackups(fileType);
            for (const backup of backups) {
                try {
                    fs.unlinkSync(backup.backup);
                } catch (error) {
                    logger.error(`Failed to delete backup ${backup.backup}: ${(error as Error).message}`);
                }
            }
            logger.debug(`Deleted ${backups.length} backups for ${fileType}`);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }
}

export default ConfigBackupManager;

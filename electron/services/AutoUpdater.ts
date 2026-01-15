/**
 * AutoUpdater Service
 * Handles automatic updates from GitHub Releases
 */

import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import logger from './Logger';

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  info?: UpdateInfo;
  progress?: number;
  error?: string;
}

export class AutoUpdater {
  private mainWindow: BrowserWindow | null = null;
  private updateStatus: UpdateStatus = { status: 'not-available' };

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupAutoUpdater();
    this.registerIPCHandlers();
  }

  private setupAutoUpdater(): void {
    // Configure auto updater
    autoUpdater.autoDownload = false; // Don't auto download, let user decide
    autoUpdater.autoInstallOnAppQuit = true;

    // Event: Checking for update
    autoUpdater.on('checking-for-update', () => {
      logger.debug('Checking for updates...');
      this.updateStatus = { status: 'checking' };
      this.sendStatusToRenderer();
    });

    // Event: Update available
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      logger.info(`Update available: ${info.version}`);
      this.updateStatus = { status: 'available', info };
      this.sendStatusToRenderer();
    });

    // Event: Update not available
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      logger.debug('No updates available');
      this.updateStatus = { status: 'not-available', info };
      this.sendStatusToRenderer();
    });

    // Event: Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      logger.debug(`Download progress: ${percent}%`);
      this.updateStatus = { 
        status: 'downloading', 
        progress: percent,
        info: this.updateStatus.info 
      };
      this.sendStatusToRenderer();
    });

    // Event: Update downloaded
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      logger.info(`Update downloaded: ${info.version}`);
      this.updateStatus = { status: 'downloaded', info };
      this.sendStatusToRenderer();
    });

    // Event: Error
    autoUpdater.on('error', (error: Error) => {
      logger.error(`Update error: ${error.message}`);
      this.updateStatus = { status: 'error', error: error.message };
      this.sendStatusToRenderer();
    });
  }

  private registerIPCHandlers(): void {
    // Check for updates
    ipcMain.handle('check-for-updates', async () => {
      try {
        return await autoUpdater.checkForUpdates();
      } catch (error) {
        logger.error(`Check for updates failed: ${(error as Error).message}`);
        return null;
      }
    });

    // Download update
    ipcMain.handle('download-update', async () => {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Install update (quit and install)
    ipcMain.handle('install-update', () => {
      autoUpdater.quitAndInstall(false, true);
    });

    // Get current update status
    ipcMain.handle('get-update-status', () => {
      return this.updateStatus;
    });
  }

  private sendStatusToRenderer(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-status', this.updateStatus);
    }
  }

  /**
   * Check for updates on app start (after delay)
   */
  checkOnStartup(delayMs: number = 5000): void {
    setTimeout(() => {
      logger.debug('Auto-checking for updates...');
      autoUpdater.checkForUpdates().catch((error) => {
        logger.error(`Startup update check failed: ${error.message}`);
      });
    }, delayMs);
  }
}

export default AutoUpdater;

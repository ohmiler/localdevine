/**
 * MailHog Manager for LocalDevine
 * Manages MailHog email testing server for local development
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { spawn, ChildProcess } from 'child_process';
import { BrowserWindow, shell } from 'electron';
import PathResolver from './PathResolver';
import logger from './Logger';

export interface MailHogStatus {
    installed: boolean;
    running: boolean;
    smtpPort: number;
    httpPort: number;
    version?: string;
}

export interface MailHogConfig {
    smtpPort: number;
    httpPort: number;
    autoStart: boolean;
}

export interface DownloadProgress {
    phase: string;
    percent: number;
    message: string;
}

const DEFAULT_CONFIG: MailHogConfig = {
    smtpPort: 1025,
    httpPort: 8025,
    autoStart: false
};

// MailHog download URL (Windows AMD64)
const MAILHOG_DOWNLOAD_URL = 'https://github.com/mailhog/MailHog/releases/download/v1.0.1/MailHog_windows_amd64.exe';
const MAILHOG_VERSION = '1.0.1';

export class MailHogManager {
    private static instance: MailHogManager;
    private mainWindow: BrowserWindow | null = null;
    private pathResolver: PathResolver;
    private mailhogProcess: ChildProcess | null = null;
    private config: MailHogConfig = DEFAULT_CONFIG;
    private configPath: string;
    private mailhogDir: string;
    private mailhogExe: string;

    private constructor() {
        this.pathResolver = PathResolver.getInstance();
        this.mailhogDir = path.join(this.pathResolver.binDir, 'mailhog');
        this.mailhogExe = path.join(this.mailhogDir, 'MailHog.exe');
        this.configPath = path.join(this.pathResolver.userDataPath, 'config', 'mailhog.json');
        this.loadConfig();
    }

    static getInstance(): MailHogManager {
        if (!MailHogManager.instance) {
            MailHogManager.instance = new MailHogManager();
        }
        return MailHogManager.instance;
    }

    setMainWindow(window: BrowserWindow): void {
        this.mainWindow = window;
    }

    private loadConfig(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
            }
        } catch (error) {
            logger.warn(`Failed to load MailHog config: ${(error as Error).message}`);
        }
    }

    private saveConfig(): void {
        try {
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
        } catch (error) {
            logger.error(`Failed to save MailHog config: ${(error as Error).message}`);
        }
    }

    getConfig(): MailHogConfig {
        return { ...this.config };
    }

    updateConfig(newConfig: Partial<MailHogConfig>): { success: boolean; message: string } {
        try {
            this.config = { ...this.config, ...newConfig };
            this.saveConfig();
            return { success: true, message: 'Config updated successfully' };
        } catch (error) {
            return { success: false, message: (error as Error).message };
        }
    }

    isInstalled(): boolean {
        return fs.existsSync(this.mailhogExe);
    }

    isRunning(): boolean {
        return this.mailhogProcess !== null && !this.mailhogProcess.killed;
    }

    async getStatus(): Promise<MailHogStatus> {
        return {
            installed: this.isInstalled(),
            running: this.isRunning(),
            smtpPort: this.config.smtpPort,
            httpPort: this.config.httpPort,
            version: this.isInstalled() ? MAILHOG_VERSION : undefined
        };
    }

    async install(onProgress?: (progress: DownloadProgress) => void): Promise<{ success: boolean; message: string }> {
        try {
            if (this.isInstalled()) {
                return { success: true, message: 'MailHog is already installed' };
            }

            // Create mailhog directory
            if (!fs.existsSync(this.mailhogDir)) {
                fs.mkdirSync(this.mailhogDir, { recursive: true });
            }

            onProgress?.({ phase: 'download', percent: 0, message: 'Downloading MailHog...' });
            logger.info('Starting MailHog download...');

            // Download MailHog
            await this.downloadFile(
                MAILHOG_DOWNLOAD_URL,
                this.mailhogExe,
                (percent) => {
                    onProgress?.({ phase: 'download', percent, message: `Downloading MailHog... ${percent}%` });
                }
            );

            onProgress?.({ phase: 'complete', percent: 100, message: 'MailHog installed successfully!' });
            logger.info('MailHog installed successfully');

            return { success: true, message: 'MailHog installed successfully' };
        } catch (error) {
            const errorMsg = (error as Error).message;
            logger.error(`MailHog installation failed: ${errorMsg}`);
            return { success: false, message: `Installation failed: ${errorMsg}` };
        }
    }

    private downloadFile(url: string, destPath: string, onProgress?: (percent: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);

            const request = https.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 302 || response.statusCode === 301) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        file.close();
                        fs.unlinkSync(destPath);
                        this.downloadFile(redirectUrl, destPath, onProgress)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }
                }

                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(destPath);
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = 0;

                response.on('data', (chunk: Buffer) => {
                    downloadedSize += chunk.length;
                    if (totalSize > 0) {
                        const percent = Math.round((downloadedSize / totalSize) * 100);
                        onProgress?.(percent);
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            });

            request.on('error', (err) => {
                file.close();
                fs.unlinkSync(destPath);
                reject(err);
            });

            file.on('error', (err) => {
                file.close();
                fs.unlinkSync(destPath);
                reject(err);
            });
        });
    }

    async uninstall(): Promise<{ success: boolean; message: string }> {
        try {
            // Stop if running
            if (this.isRunning()) {
                await this.stop();
            }

            // Remove mailhog directory
            if (fs.existsSync(this.mailhogDir)) {
                fs.rmSync(this.mailhogDir, { recursive: true, force: true });
            }

            logger.info('MailHog uninstalled successfully');
            return { success: true, message: 'MailHog uninstalled successfully' };
        } catch (error) {
            const errorMsg = (error as Error).message;
            logger.error(`MailHog uninstall failed: ${errorMsg}`);
            return { success: false, message: `Uninstall failed: ${errorMsg}` };
        }
    }

    async start(): Promise<{ success: boolean; message: string }> {
        try {
            if (!this.isInstalled()) {
                return { success: false, message: 'MailHog is not installed' };
            }

            if (this.isRunning()) {
                return { success: true, message: 'MailHog is already running' };
            }

            logger.info(`Starting MailHog on SMTP:${this.config.smtpPort}, HTTP:${this.config.httpPort}`);

            this.mailhogProcess = spawn(this.mailhogExe, [
                '-smtp-bind-addr', `127.0.0.1:${this.config.smtpPort}`,
                '-api-bind-addr', `127.0.0.1:${this.config.httpPort}`,
                '-ui-bind-addr', `127.0.0.1:${this.config.httpPort}`
            ], {
                detached: false,
                stdio: 'pipe',
                windowsHide: true
            });

            this.mailhogProcess.on('error', (err) => {
                logger.error(`MailHog process error: ${err.message}`);
                this.mailhogProcess = null;
            });

            this.mailhogProcess.on('exit', (code) => {
                logger.info(`MailHog exited with code ${code}`);
                this.mailhogProcess = null;
            });

            // Wait a bit for process to start
            await new Promise(resolve => setTimeout(resolve, 500));

            if (this.isRunning()) {
                logger.info('MailHog started successfully');
                return { success: true, message: 'MailHog started successfully' };
            } else {
                return { success: false, message: 'MailHog failed to start' };
            }
        } catch (error) {
            const errorMsg = (error as Error).message;
            logger.error(`MailHog start failed: ${errorMsg}`);
            return { success: false, message: `Start failed: ${errorMsg}` };
        }
    }

    async stop(): Promise<{ success: boolean; message: string }> {
        try {
            if (!this.isRunning()) {
                return { success: true, message: 'MailHog is not running' };
            }

            if (this.mailhogProcess) {
                this.mailhogProcess.kill('SIGTERM');
                
                // Wait for process to exit
                await new Promise<void>((resolve) => {
                    const timeout = setTimeout(() => {
                        if (this.mailhogProcess) {
                            this.mailhogProcess.kill('SIGKILL');
                        }
                        resolve();
                    }, 3000);

                    if (this.mailhogProcess) {
                        this.mailhogProcess.on('exit', () => {
                            clearTimeout(timeout);
                            resolve();
                        });
                    } else {
                        clearTimeout(timeout);
                        resolve();
                    }
                });

                this.mailhogProcess = null;
            }

            logger.info('MailHog stopped successfully');
            return { success: true, message: 'MailHog stopped successfully' };
        } catch (error) {
            const errorMsg = (error as Error).message;
            logger.error(`MailHog stop failed: ${errorMsg}`);
            return { success: false, message: `Stop failed: ${errorMsg}` };
        }
    }

    openUI(): void {
        const url = `http://localhost:${this.config.httpPort}`;
        shell.openExternal(url);
    }

    getSmtpConfig(): { host: string; port: number } {
        return {
            host: '127.0.0.1',
            port: this.config.smtpPort
        };
    }

    getPhpIniConfig(): string {
        return `; MailHog SMTP Configuration
[mail function]
SMTP = 127.0.0.1
smtp_port = ${this.config.smtpPort}
sendmail_from = test@localdevine.test`;
    }

    getLaravelEnvConfig(): string {
        return `MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=${this.config.smtpPort}
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="test@localdevine.test"
MAIL_FROM_NAME="\${APP_NAME}"`;
    }

    getSymfonyEnvConfig(): string {
        return `MAILER_DSN=smtp://127.0.0.1:${this.config.smtpPort}`;
    }
}

export default MailHogManager;

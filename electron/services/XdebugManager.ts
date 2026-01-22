/**
 * XdebugManager - Manages Xdebug installation and configuration
 * Provides functionality to download, install, enable/disable, and configure Xdebug
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import PathResolver from './PathResolver';
import { serviceLogger as logger } from './Logger';

export interface XdebugStatus {
    installed: boolean;
    enabled: boolean;
    version: string | null;
    phpVersion: string | null;
    mode: string;
    port: number;
    ideKey: string;
    startWithRequest: string;
    dllPath: string | null;
}

export interface XdebugConfig {
    mode: 'off' | 'develop' | 'debug' | 'profile' | 'trace' | 'coverage';
    port: number;
    ideKey: string;
    startWithRequest: 'yes' | 'no' | 'trigger' | 'default';
    clientHost: string;
    clientPort: number;
    logLevel: number;
    logPath: string;
}

export interface DownloadProgress {
    percent: number;
    downloaded: number;
    total: number;
    status: string;
}

type ProgressCallback = (progress: DownloadProgress) => void;

// Xdebug download URLs for different PHP versions (Windows x64 NTS)
const XDEBUG_DOWNLOADS: Record<string, string> = {
    '8.5': 'https://xdebug.org/files/php_xdebug-3.5.0-8.5-nts-vs17-x86_64.dll',
    '8.4': 'https://xdebug.org/files/php_xdebug-3.5.0-8.4-nts-vs17-x86_64.dll',
    '8.3': 'https://xdebug.org/files/php_xdebug-3.5.0-8.3-nts-vs16-x86_64.dll',
    '8.2': 'https://xdebug.org/files/php_xdebug-3.5.0-8.2-nts-vs16-x86_64.dll',
    '8.1': 'https://xdebug.org/files/php_xdebug-3.5.0-8.1-nts-vs16-x86_64.dll',
    '8.0': 'https://xdebug.org/files/php_xdebug-3.5.0-8.0-nts-vs16-x86_64.dll',
};

export class XdebugManager {
    private pathResolver: PathResolver;
    private phpPath: string;
    private phpIniPath: string;
    private extDir: string;

    constructor() {
        this.pathResolver = PathResolver.getInstance();
        this.phpPath = path.join(this.pathResolver.binDir, 'php');
        // Use the same php.ini that Apache uses (from config folder)
        this.phpIniPath = this.pathResolver.phpIniPath;
        this.extDir = path.join(this.phpPath, 'ext');
    }

    /**
     * Get current PHP version
     */
    async getPHPVersion(): Promise<string | null> {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            const phpExe = path.join(this.phpPath, 'php.exe');
            
            if (!fs.existsSync(phpExe)) {
                resolve(null);
                return;
            }

            exec(`"${phpExe}" -v`, (error: Error | null, stdout: string) => {
                if (error) {
                    resolve(null);
                    return;
                }
                
                const match = stdout.match(/PHP (\d+\.\d+)/);
                if (match) {
                    resolve(match[1]);
                } else {
                    resolve(null);
                }
            });
        });
    }

    /**
     * Check if Xdebug DLL exists
     */
    isXdebugInstalled(): boolean {
        const dllPath = path.join(this.extDir, 'php_xdebug.dll');
        return fs.existsSync(dllPath);
    }

    /**
     * Check if Xdebug is enabled in php.ini
     */
    isXdebugEnabled(): boolean {
        if (!fs.existsSync(this.phpIniPath)) {
            return false;
        }

        const content = fs.readFileSync(this.phpIniPath, 'utf-8');
        // Check for uncommented zend_extension=xdebug
        const enabledRegex = /^\s*zend_extension\s*=\s*xdebug/im;
        return enabledRegex.test(content);
    }

    /**
     * Get current Xdebug configuration
     */
    getXdebugConfig(): XdebugConfig {
        const defaults: XdebugConfig = {
            mode: 'debug',
            port: 9003,
            ideKey: 'VSCODE',
            startWithRequest: 'yes',
            clientHost: '127.0.0.1',
            clientPort: 9003,
            logLevel: 0,
            logPath: ''
        };

        if (!fs.existsSync(this.phpIniPath)) {
            return defaults;
        }

        const content = fs.readFileSync(this.phpIniPath, 'utf-8');
        
        // Parse xdebug settings
        const modeMatch = content.match(/xdebug\.mode\s*=\s*(.+)/i);
        const portMatch = content.match(/xdebug\.client_port\s*=\s*(\d+)/i);
        const ideKeyMatch = content.match(/xdebug\.idekey\s*=\s*(.+)/i);
        const startMatch = content.match(/xdebug\.start_with_request\s*=\s*(.+)/i);
        const clientHostMatch = content.match(/xdebug\.client_host\s*=\s*(.+)/i);
        const logLevelMatch = content.match(/xdebug\.log_level\s*=\s*(\d+)/i);
        const logPathMatch = content.match(/xdebug\.log\s*=\s*(.+)/i);

        return {
            mode: (modeMatch?.[1]?.trim() || defaults.mode) as XdebugConfig['mode'],
            port: parseInt(portMatch?.[1] || String(defaults.port)),
            ideKey: ideKeyMatch?.[1]?.trim() || defaults.ideKey,
            startWithRequest: (startMatch?.[1]?.trim() || defaults.startWithRequest) as XdebugConfig['startWithRequest'],
            clientHost: clientHostMatch?.[1]?.trim() || defaults.clientHost,
            clientPort: parseInt(portMatch?.[1] || String(defaults.clientPort)),
            logLevel: parseInt(logLevelMatch?.[1] || String(defaults.logLevel)),
            logPath: logPathMatch?.[1]?.trim() || defaults.logPath
        };
    }

    /**
     * Get full Xdebug status
     */
    async getStatus(): Promise<XdebugStatus> {
        const phpVersion = await this.getPHPVersion();
        const installed = this.isXdebugInstalled();
        const enabled = this.isXdebugEnabled();
        const config = this.getXdebugConfig();
        const dllPath = installed ? path.join(this.extDir, 'php_xdebug.dll') : null;

        // Get Xdebug version if installed
        let version: string | null = null;
        if (installed && enabled) {
            version = await this.getXdebugVersion();
        }

        return {
            installed,
            enabled,
            version,
            phpVersion,
            mode: config.mode,
            port: config.port,
            ideKey: config.ideKey,
            startWithRequest: config.startWithRequest,
            dllPath
        };
    }

    /**
     * Get Xdebug version from PHP
     */
    async getXdebugVersion(): Promise<string | null> {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            const phpExe = path.join(this.phpPath, 'php.exe');
            const phpIniDir = path.dirname(this.phpIniPath);
            
            // Use -c option to specify the correct php.ini directory
            exec(`"${phpExe}" -c "${phpIniDir}" -r "echo phpversion('xdebug');"`, { cwd: this.phpPath }, (error: Error | null, stdout: string) => {
                if (error || !stdout.trim()) {
                    resolve(null);
                    return;
                }
                resolve(stdout.trim());
            });
        });
    }

    /**
     * Download and install Xdebug
     */
    async install(onProgress?: ProgressCallback): Promise<{ success: boolean; error?: string }> {
        try {
            const phpVersion = await this.getPHPVersion();
            if (!phpVersion) {
                return { success: false, error: 'Could not detect PHP version' };
            }

            // Check if we have a download URL for this PHP version
            const downloadUrl = XDEBUG_DOWNLOADS[phpVersion];
            if (!downloadUrl) {
                return { success: false, error: `Xdebug not available for PHP ${phpVersion}. Supported: ${Object.keys(XDEBUG_DOWNLOADS).join(', ')}` };
            }

            onProgress?.({ percent: 0, downloaded: 0, total: 0, status: 'Starting download...' });

            // Download Xdebug DLL
            const dllPath = path.join(this.extDir, 'php_xdebug.dll');
            await this.downloadFile(downloadUrl, dllPath, onProgress);

            onProgress?.({ percent: 100, downloaded: 0, total: 0, status: 'Download complete!' });

            logger.info(`Xdebug installed successfully for PHP ${phpVersion}`);
            return { success: true };
        } catch (e) {
            logger.error(`Failed to install Xdebug: ${(e as Error).message}`);
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Download a file with progress
     */
    private downloadFile(url: string, destPath: string, onProgress?: ProgressCallback): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);
            
            const request = https.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
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
                    reject(new Error(`Download failed with status ${response.statusCode}`));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = 0;

                response.on('data', (chunk: Buffer) => {
                    downloadedSize += chunk.length;
                    const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
                    onProgress?.({
                        percent,
                        downloaded: downloadedSize,
                        total: totalSize,
                        status: `Downloading... ${percent}%`
                    });
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            });

            request.on('error', (err) => {
                file.close();
                if (fs.existsSync(destPath)) {
                    fs.unlinkSync(destPath);
                }
                reject(err);
            });
        });
    }

    /**
     * Enable Xdebug in php.ini
     */
    enable(config?: Partial<XdebugConfig>): { success: boolean; error?: string } {
        try {
            if (!this.isXdebugInstalled()) {
                return { success: false, error: 'Xdebug is not installed' };
            }

            if (!fs.existsSync(this.phpIniPath)) {
                return { success: false, error: 'php.ini not found' };
            }

            let content = fs.readFileSync(this.phpIniPath, 'utf-8');
            const currentConfig = this.getXdebugConfig();
            const newConfig = { ...currentConfig, ...config };

            // Remove existing Xdebug configuration
            content = this.removeXdebugConfig(content);

            // Ensure extension_dir is absolute path (for production mode compatibility)
            const absoluteExtDir = this.extDir.replace(/\\/g, '/');
            if (content.includes('extension_dir = "ext"')) {
                content = content.replace(
                    'extension_dir = "ext"',
                    `extension_dir = "${absoluteExtDir}"`
                );
            }

            // Add new Xdebug configuration
            const xdebugConfig = `
; Xdebug Configuration
zend_extension=xdebug
xdebug.mode=${newConfig.mode}
xdebug.client_host=${newConfig.clientHost}
xdebug.client_port=${newConfig.clientPort}
xdebug.start_with_request=${newConfig.startWithRequest}
xdebug.idekey=${newConfig.ideKey}
xdebug.log_level=${newConfig.logLevel}
${newConfig.logPath ? `xdebug.log=${newConfig.logPath}` : ''}
`;

            content += xdebugConfig;
            fs.writeFileSync(this.phpIniPath, content);

            logger.info('Xdebug enabled successfully');
            return { success: true };
        } catch (e) {
            logger.error(`Failed to enable Xdebug: ${(e as Error).message}`);
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Disable Xdebug in php.ini
     */
    disable(): { success: boolean; error?: string } {
        try {
            if (!fs.existsSync(this.phpIniPath)) {
                return { success: false, error: 'php.ini not found' };
            }

            let content = fs.readFileSync(this.phpIniPath, 'utf-8');
            content = this.removeXdebugConfig(content);
            fs.writeFileSync(this.phpIniPath, content);

            logger.info('Xdebug disabled successfully');
            return { success: true };
        } catch (e) {
            logger.error(`Failed to disable Xdebug: ${(e as Error).message}`);
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Remove Xdebug configuration from content
     */
    private removeXdebugConfig(content: string): string {
        // Remove Xdebug section
        content = content.replace(/\n*;\s*Xdebug Configuration[\s\S]*?(?=\n\[|$)/gi, '');
        
        // Remove individual xdebug lines
        content = content.replace(/^\s*;?\s*zend_extension\s*=\s*xdebug.*$/gim, '');
        content = content.replace(/^\s*;?\s*xdebug\.\w+\s*=.*$/gim, '');
        
        // Clean up extra blank lines
        content = content.replace(/\n{3,}/g, '\n\n');
        
        return content.trim() + '\n';
    }

    /**
     * Update Xdebug configuration
     */
    updateConfig(config: Partial<XdebugConfig>): { success: boolean; error?: string } {
        if (!this.isXdebugEnabled()) {
            return { success: false, error: 'Xdebug is not enabled' };
        }
        return this.enable(config);
    }

    /**
     * Uninstall Xdebug
     */
    uninstall(): { success: boolean; error?: string } {
        try {
            // First disable it
            this.disable();

            // Remove DLL
            const dllPath = path.join(this.extDir, 'php_xdebug.dll');
            if (fs.existsSync(dllPath)) {
                fs.unlinkSync(dllPath);
            }

            logger.info('Xdebug uninstalled successfully');
            return { success: true };
        } catch (e) {
            logger.error(`Failed to uninstall Xdebug: ${(e as Error).message}`);
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Get VS Code launch.json configuration
     */
    getVSCodeConfig(): object {
        const config = this.getXdebugConfig();
        return {
            version: '0.2.0',
            configurations: [
                {
                    name: 'Listen for Xdebug',
                    type: 'php',
                    request: 'launch',
                    port: config.clientPort,
                    pathMappings: {
                        '/var/www/html': '${workspaceFolder}'
                    }
                },
                {
                    name: 'Launch currently open script',
                    type: 'php',
                    request: 'launch',
                    program: '${file}',
                    cwd: '${fileDirname}',
                    port: config.clientPort,
                    runtimeExecutable: path.join(this.phpPath, 'php.exe')
                }
            ]
        };
    }

    /**
     * Test Xdebug connection
     */
    async testConnection(): Promise<{ success: boolean; message: string }> {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            const phpExe = path.join(this.phpPath, 'php.exe');
            const phpIniDir = path.dirname(this.phpIniPath);
            
            // Use -c option to specify the correct php.ini directory
            exec(`"${phpExe}" -c "${phpIniDir}" -r "var_dump(extension_loaded('xdebug'));"`, { cwd: this.phpPath }, (error: Error | null, stdout: string) => {
                if (error) {
                    resolve({ success: false, message: 'Failed to run PHP' });
                    return;
                }
                
                if (stdout.includes('true')) {
                    resolve({ success: true, message: 'Xdebug is loaded and working!' });
                } else {
                    resolve({ success: false, message: 'Xdebug is not loaded. Restart PHP service.' });
                }
            });
        });
    }
}

export default XdebugManager;

import fs from 'fs';
import path from 'path';
import https from 'https';
import { IncomingMessage } from 'http';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { Extract } from 'unzipper';
import PathResolver from './PathResolver';
import { configLogger as logger } from './Logger';

export interface PHPVersionInfo {
    version: string;
    displayName: string;
    url: string;
    size: string;
    installed: boolean;
}

export interface DownloadProgress {
    version: string;
    progress: number;
    downloaded: number;
    total: number;
    status: 'downloading' | 'extracting' | 'completed' | 'error';
    error?: string;
}

// PHP download URLs from windows.php.net (updated Jan 2026)
const PHP_VERSIONS: Record<string, { url: string; size: string }> = {
    '8.1': {
        url: 'https://windows.php.net/downloads/releases/php-8.1.34-nts-Win32-vs16-x64.zip',
        size: '~28 MB'
    },
    '8.2': {
        url: 'https://windows.php.net/downloads/releases/php-8.2.30-nts-Win32-vs16-x64.zip',
        size: '~29 MB'
    },
    '8.3': {
        url: 'https://windows.php.net/downloads/releases/php-8.3.29-nts-Win32-vs16-x64.zip',
        size: '~30 MB'
    },
    '8.4': {
        url: 'https://windows.php.net/downloads/releases/php-8.4.16-nts-Win32-vs17-x64.zip',
        size: '~31 MB'
    }
};

export default class PHPDownloader {
    private pathResolver: PathResolver;
    private binDir: string;
    private tempDir: string;
    private progressCallback?: (progress: DownloadProgress) => void;

    constructor() {
        this.pathResolver = PathResolver.getInstance();
        this.binDir = this.pathResolver.binDir;
        this.tempDir = this.pathResolver.tmpDir;
        logger.info(`PHPDownloader initialized - binDir: ${this.binDir}, tempDir: ${this.tempDir}`);
    }

    setProgressCallback(callback: (progress: DownloadProgress) => void): void {
        this.progressCallback = callback;
    }

    private sendProgress(progress: DownloadProgress): void {
        if (this.progressCallback) {
            this.progressCallback(progress);
        }
    }

    getAvailableVersions(): PHPVersionInfo[] {
        const versions: PHPVersionInfo[] = [];
        
        for (const [version, info] of Object.entries(PHP_VERSIONS)) {
            const folderId = `php${version.replace('.', '')}`;
            const phpPath = path.join(this.binDir, folderId);
            const isInstalled = fs.existsSync(path.join(phpPath, 'php-cgi.exe'));
            
            versions.push({
                version,
                displayName: `PHP ${version}`,
                url: info.url,
                size: info.size,
                installed: isInstalled
            });
        }
        
        // Check default PHP (8.5)
        const defaultPhpPath = path.join(this.binDir, 'php');
        const defaultInstalled = fs.existsSync(path.join(defaultPhpPath, 'php-cgi.exe'));
        
        versions.unshift({
            version: '8.5',
            displayName: 'PHP 8.5 (default)',
            url: '',
            size: 'Included',
            installed: defaultInstalled
        });
        
        return versions;
    }

    getInstalledVersions(): string[] {
        const installed: string[] = [];
        
        // Check default PHP
        const defaultPhpPath = path.join(this.binDir, 'php');
        if (fs.existsSync(path.join(defaultPhpPath, 'php-cgi.exe'))) {
            installed.push('8.5');
        }
        
        // Check other versions
        for (const version of Object.keys(PHP_VERSIONS)) {
            const folderId = `php${version.replace('.', '')}`;
            const phpPath = path.join(this.binDir, folderId);
            if (fs.existsSync(path.join(phpPath, 'php-cgi.exe'))) {
                installed.push(version);
            }
        }
        
        return installed;
    }

    async downloadVersion(version: string): Promise<{ success: boolean; error?: string }> {
        const versionInfo = PHP_VERSIONS[version];
        if (!versionInfo) {
            return { success: false, error: `Unknown PHP version: ${version}` };
        }

        const folderId = `php${version.replace('.', '')}`;
        const targetPath = path.join(this.binDir, folderId);
        const tempZipPath = path.join(this.tempDir, `php${version.replace('.', '')}.zip`);

        try {
            logger.info(`Starting download for PHP ${version}`);
            logger.info(`Target path: ${targetPath}`);
            logger.info(`Temp zip path: ${tempZipPath}`);
            logger.info(`URL: ${versionInfo.url}`);
            
            // Ensure temp directory exists
            if (!fs.existsSync(this.tempDir)) {
                logger.info(`Creating temp directory: ${this.tempDir}`);
                fs.mkdirSync(this.tempDir, { recursive: true });
            }

            // Ensure target directory exists
            if (!fs.existsSync(targetPath)) {
                logger.info(`Creating target directory: ${targetPath}`);
                fs.mkdirSync(targetPath, { recursive: true });
            }

            logger.info(`Downloading PHP ${version} from ${versionInfo.url}`);
            
            // Download the file
            await this.downloadFile(versionInfo.url, tempZipPath, version);
            
            logger.info(`Extracting PHP ${version} to ${targetPath}`);
            
            // Extract the file
            this.sendProgress({
                version,
                progress: 100,
                downloaded: 0,
                total: 0,
                status: 'extracting'
            });
            
            await this.extractZip(tempZipPath, targetPath);
            
            // Clean up temp file
            if (fs.existsSync(tempZipPath)) {
                fs.unlinkSync(tempZipPath);
            }
            
            this.sendProgress({
                version,
                progress: 100,
                downloaded: 0,
                total: 0,
                status: 'completed'
            });
            
            logger.info(`PHP ${version} installed successfully`);
            return { success: true };
            
        } catch (error) {
            const err = error as Error;
            const errorMsg = err.message;
            logger.error(`Failed to download PHP ${version}: ${errorMsg}`);
            logger.error(`Error stack: ${err.stack}`);
            
            this.sendProgress({
                version,
                progress: 0,
                downloaded: 0,
                total: 0,
                status: 'error',
                error: errorMsg
            });
            
            // Clean up on error
            if (fs.existsSync(tempZipPath)) {
                fs.unlinkSync(tempZipPath);
            }
            
            return { success: false, error: errorMsg };
        }
    }

    private downloadFile(url: string, destPath: string, version: string): Promise<void> {
        return new Promise((resolve, reject) => {
            logger.info(`Starting HTTP download from: ${url}`);
            
            const makeRequest = (currentUrl: string, redirectCount = 0) => {
                if (redirectCount > 5) {
                    reject(new Error('Too many redirects'));
                    return;
                }
                
                const urlObj = new URL(currentUrl);
                const options = {
                    hostname: urlObj.hostname,
                    port: urlObj.port || 443,
                    path: urlObj.pathname + urlObj.search,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'LocalDevine/1.0',
                        'Accept': '*/*'
                    }
                };
                
                logger.info(`Making request to: ${urlObj.hostname}${urlObj.pathname}`);
                
                const req = https.request(options, (response: IncomingMessage) => {
                    logger.info(`Response status: ${response.statusCode}`);
                    
                    // Handle redirects
                    if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
                        const redirectUrl = response.headers.location;
                        logger.info(`Redirect to: ${redirectUrl}`);
                        if (redirectUrl) {
                            // Handle relative URLs
                            const fullUrl = redirectUrl.startsWith('http') ? redirectUrl : `https://${urlObj.hostname}${redirectUrl}`;
                            makeRequest(fullUrl, redirectCount + 1);
                            return;
                        }
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`Download failed with status ${response.statusCode}`));
                        return;
                    }

                    const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                    logger.info(`Total size: ${totalSize} bytes`);
                    let downloadedSize = 0;

                    const file = createWriteStream(destPath);

                    response.on('data', (chunk: Buffer) => {
                        downloadedSize += chunk.length;
                        const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
                        
                        this.sendProgress({
                            version,
                            progress,
                            downloaded: downloadedSize,
                            total: totalSize,
                            status: 'downloading'
                        });
                    });

                    response.pipe(file);

                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });

                    file.on('error', (err) => {
                        fs.unlink(destPath, () => {});
                        reject(err);
                    });
                });
                
                req.on('error', (err) => {
                    logger.error(`Request error: ${err.message}`);
                    reject(err);
                });
                
                req.end();
            };

            makeRequest(url);
        });
    }

    private async extractZip(zipPath: string, destPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.createReadStream(zipPath)
                .pipe(Extract({ path: destPath }))
                .on('close', () => resolve())
                .on('error', (err: Error) => reject(err));
        });
    }

    async downloadMultipleVersions(versions: string[]): Promise<{ success: boolean; results: Record<string, boolean> }> {
        const results: Record<string, boolean> = {};
        
        for (const version of versions) {
            const result = await this.downloadVersion(version);
            results[version] = result.success;
        }
        
        const allSuccess = Object.values(results).every(r => r);
        return { success: allSuccess, results };
    }
}

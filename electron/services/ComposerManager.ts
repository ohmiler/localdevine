/**
 * ComposerManager - Manages Composer operations for PHP projects
 * Provides functionality to check, install, and run Composer commands
 */

import { spawn, exec, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import PathResolver from './PathResolver';
import ConfigManager from './ConfigManager';
import { serviceLogger as logger } from './Logger';

export interface ComposerStatus {
    installed: boolean;
    version: string | null;
    path: string | null;
    phpPath: string | null;
}

export interface ComposerRunResult {
    success: boolean;
    output: string;
    error?: string;
    exitCode: number | null;
}

export interface ComposerPackage {
    name: string;
    version: string;
    description: string;
    type?: 'require' | 'require-dev';
}

export interface ProjectComposerInfo {
    hasComposer: boolean;
    packages: ComposerPackage[];
    requireCount: number;
    requireDevCount: number;
    lockExists: boolean;
    vendorExists: boolean;
}

type OutputCallback = (data: string) => void;

export class ComposerManager {
    private pathResolver: PathResolver;
    private configManager: ConfigManager | null;
    private composerPath: string | null = null;
    private runningProcesses: Map<string, ChildProcess> = new Map();

    constructor(configManager?: ConfigManager) {
        this.pathResolver = PathResolver.getInstance();
        this.configManager = configManager || null;
        this.detectComposer();
    }

    /**
     * Detect if Composer is installed and find its path
     */
    private async detectComposer(): Promise<void> {
        // Check in bin folder first (bundled composer)
        const bundledComposer = path.join(this.pathResolver.binDir, 'composer.phar');
        if (fs.existsSync(bundledComposer)) {
            this.composerPath = bundledComposer;
            logger.info(`Found bundled Composer at: ${bundledComposer}`);
            return;
        }

        // Check in PATH (system-wide composer)
        try {
            const result = await this.execPromise('where composer.bat 2>nul || where composer.phar 2>nul || where composer 2>nul');
            if (result.trim()) {
                this.composerPath = result.trim().split('\n')[0];
                logger.info(`Found system Composer at: ${this.composerPath}`);
                return;
            }
        } catch {
            // composer not in PATH
        }

        logger.info('Composer not found');
        this.composerPath = null;
    }

    /**
     * Get the current PHP executable path
     */
    private getPHPPath(): string {
        if (this.configManager) {
            return path.join(this.configManager.getPHPPath(), 'php.exe');
        }
        return path.join(this.pathResolver.binDir, 'php', 'php.exe');
    }

    /**
     * Check Composer status
     */
    async getStatus(): Promise<ComposerStatus> {
        await this.detectComposer();
        
        const phpPath = this.getPHPPath();
        let version: string | null = null;

        if (this.composerPath) {
            try {
                const cmd = this.composerPath.endsWith('.phar')
                    ? `"${phpPath}" "${this.composerPath}" --version`
                    : `"${this.composerPath}" --version`;
                
                const result = await this.execPromise(cmd);
                const match = result.match(/Composer version (\d+\.\d+\.\d+)/);
                if (match) {
                    version = match[1];
                }
            } catch (e) {
                logger.warn(`Failed to get Composer version: ${(e as Error).message}`);
            }
        }

        return {
            installed: this.composerPath !== null,
            version,
            path: this.composerPath,
            phpPath
        };
    }

    /**
     * Download and install Composer to bin folder
     */
    async installComposer(onProgress?: (message: string) => void): Promise<{ success: boolean; error?: string }> {
        const composerPharPath = path.join(this.pathResolver.binDir, 'composer.phar');
        const phpPath = this.getPHPPath();

        // Check if PHP exists
        if (!fs.existsSync(phpPath)) {
            return { success: false, error: 'PHP not found. Please start PHP service first.' };
        }

        onProgress?.('Downloading Composer installer...');

        try {
            // Download composer-setup.php
            const setupPath = path.join(this.pathResolver.binDir, 'composer-setup.php');
            await this.downloadFile('https://getcomposer.org/installer', setupPath);
            
            onProgress?.('Verifying installer...');

            // Verify the installer (optional but recommended)
            const expectedSig = await this.downloadString('https://composer.github.io/installer.sig');
            const actualSig = await this.execPromise(`"${phpPath}" -r "echo hash_file('sha384', '${setupPath.replace(/\\/g, '/')}');"`);
            
            if (expectedSig.trim() !== actualSig.trim()) {
                fs.unlinkSync(setupPath);
                return { success: false, error: 'Installer signature verification failed' };
            }

            onProgress?.('Installing Composer...');

            // Run the installer
            const installCmd = `"${phpPath}" "${setupPath}" --install-dir="${this.pathResolver.binDir}" --filename=composer.phar`;
            await this.execPromise(installCmd);

            // Clean up
            if (fs.existsSync(setupPath)) {
                fs.unlinkSync(setupPath);
            }

            // Verify installation
            if (fs.existsSync(composerPharPath)) {
                this.composerPath = composerPharPath;
                onProgress?.('Composer installed successfully!');
                return { success: true };
            } else {
                return { success: false, error: 'Composer installation failed - file not created' };
            }
        } catch (e) {
            return { success: false, error: (e as Error).message };
        }
    }

    /**
     * Run a Composer command in a project directory
     */
    async runCommand(
        projectPath: string, 
        command: string, 
        args: string[] = [],
        onOutput?: OutputCallback
    ): Promise<ComposerRunResult> {
        if (!this.composerPath) {
            return { success: false, output: '', error: 'Composer is not installed', exitCode: null };
        }

        const phpPath = this.getPHPPath();
        
        // Build command arguments
        const composerArgs = this.composerPath.endsWith('.phar')
            ? [this.composerPath, command, ...args, '--no-interaction', '--ansi']
            : [command, ...args, '--no-interaction', '--ansi'];

        const executable = this.composerPath.endsWith('.phar') ? phpPath : this.composerPath;

        return new Promise((resolve) => {
            let output = '';
            let errorOutput = '';

            const process = spawn(executable, composerArgs, {
                cwd: projectPath,
                shell: true,
                env: {
                    ...globalThis.process.env,
                    COMPOSER_HOME: path.join(this.pathResolver.userDataPath, 'composer'),
                    COMPOSER_CACHE_DIR: path.join(this.pathResolver.userDataPath, 'composer', 'cache')
                }
            });

            // Store running process for potential cancellation
            const processId = `${projectPath}-${Date.now()}`;
            this.runningProcesses.set(processId, process);

            process.stdout?.on('data', (data: Buffer) => {
                const text = this.stripAnsi(data.toString());
                output += text;
                onOutput?.(text);
            });

            process.stderr?.on('data', (data: Buffer) => {
                const text = this.stripAnsi(data.toString());
                errorOutput += text;
                onOutput?.(text);
            });

            process.on('close', (code) => {
                this.runningProcesses.delete(processId);
                resolve({
                    success: code === 0,
                    output: output + errorOutput,
                    error: code !== 0 ? errorOutput || 'Command failed' : undefined,
                    exitCode: code
                });
            });

            process.on('error', (err) => {
                this.runningProcesses.delete(processId);
                resolve({
                    success: false,
                    output,
                    error: err.message,
                    exitCode: null
                });
            });
        });
    }

    /**
     * Run composer install
     */
    async install(projectPath: string, onOutput?: OutputCallback): Promise<ComposerRunResult> {
        return this.runCommand(projectPath, 'install', [], onOutput);
    }

    /**
     * Run composer update
     */
    async update(projectPath: string, onOutput?: OutputCallback): Promise<ComposerRunResult> {
        return this.runCommand(projectPath, 'update', [], onOutput);
    }

    /**
     * Run composer require
     */
    async require(projectPath: string, packageName: string, isDev: boolean = false, onOutput?: OutputCallback): Promise<ComposerRunResult> {
        const args = isDev ? ['--dev', packageName] : [packageName];
        return this.runCommand(projectPath, 'require', args, onOutput);
    }

    /**
     * Run composer remove
     */
    async remove(projectPath: string, packageName: string, isDev: boolean = false, onOutput?: OutputCallback): Promise<ComposerRunResult> {
        const args = isDev ? ['--dev', packageName] : [packageName];
        return this.runCommand(projectPath, 'remove', args, onOutput);
    }

    /**
     * Run composer dump-autoload
     */
    async dumpAutoload(projectPath: string, onOutput?: OutputCallback): Promise<ComposerRunResult> {
        return this.runCommand(projectPath, 'dump-autoload', ['-o'], onOutput);
    }

    /**
     * Get project Composer info (packages, etc.)
     */
    async getProjectInfo(projectPath: string): Promise<ProjectComposerInfo> {
        const composerJsonPath = path.join(projectPath, 'composer.json');
        const composerLockPath = path.join(projectPath, 'composer.lock');
        const vendorPath = path.join(projectPath, 'vendor');

        const result: ProjectComposerInfo = {
            hasComposer: false,
            packages: [],
            requireCount: 0,
            requireDevCount: 0,
            lockExists: fs.existsSync(composerLockPath),
            vendorExists: fs.existsSync(vendorPath)
        };

        if (!fs.existsSync(composerJsonPath)) {
            return result;
        }

        result.hasComposer = true;

        try {
            const composerJson = JSON.parse(fs.readFileSync(composerJsonPath, 'utf-8'));
            
            // Count packages from require
            if (composerJson.require) {
                result.requireCount = Object.keys(composerJson.require).filter(k => k !== 'php').length;
                for (const [name, version] of Object.entries(composerJson.require)) {
                    if (name !== 'php') {
                        result.packages.push({
                            name,
                            version: version as string,
                            description: '',
                            type: 'require'
                        });
                    }
                }
            }

            // Count and add packages from require-dev
            if (composerJson['require-dev']) {
                result.requireDevCount = Object.keys(composerJson['require-dev']).length;
                for (const [name, version] of Object.entries(composerJson['require-dev'])) {
                    result.packages.push({
                        name,
                        version: version as string,
                        description: '',
                        type: 'require-dev'
                    });
                }
            }
        } catch (e) {
            logger.warn(`Failed to parse composer.json: ${(e as Error).message}`);
        }

        return result;
    }

    /**
     * Create a new composer.json file
     */
    async init(projectPath: string, projectName: string, onOutput?: OutputCallback): Promise<ComposerRunResult> {
        const composerJsonPath = path.join(projectPath, 'composer.json');
        
        // Create basic composer.json if doesn't exist
        if (!fs.existsSync(composerJsonPath)) {
            const basicComposer = {
                name: `localdevine/${projectName}`,
                description: `${projectName} project`,
                type: 'project',
                require: {
                    php: '>=8.0'
                },
                autoload: {
                    psr4: {
                        'App\\': 'src/'
                    }
                },
                config: {
                    'optimize-autoloader': true
                }
            };

            fs.writeFileSync(composerJsonPath, JSON.stringify(basicComposer, null, 4));
            onOutput?.(`Created composer.json for ${projectName}\n`);
        }

        return { success: true, output: 'composer.json created', exitCode: 0 };
    }

    /**
     * Search for packages
     */
    async search(query: string): Promise<ComposerPackage[]> {
        if (!this.composerPath) {
            return [];
        }

        try {
            const result = await this.runCommand(this.pathResolver.binDir, 'search', [query, '--format=json']);
            if (result.success) {
                const packages = JSON.parse(result.output);
                return packages.slice(0, 20).map((pkg: any) => ({
                    name: pkg.name,
                    version: pkg.version || 'latest',
                    description: pkg.description || ''
                }));
            }
        } catch (e) {
            logger.warn(`Composer search failed: ${(e as Error).message}`);
        }

        return [];
    }

    /**
     * Cancel all running processes
     */
    cancelAll(): void {
        for (const [id, process] of this.runningProcesses) {
            process.kill();
            this.runningProcesses.delete(id);
        }
    }

    // Helper methods
    private execPromise(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            exec(command, { windowsHide: true }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout || stderr);
                }
            });
        });
    }

    private downloadFile(url: string, destPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);
            const protocol = url.startsWith('https') ? https : http;
            
            protocol.get(url, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Handle redirect
                    this.downloadFile(response.headers.location!, destPath)
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });
    }

    private downloadString(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            
            protocol.get(url, (response) => {
                let data = '';
                response.on('data', (chunk) => data += chunk);
                response.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    private stripAnsi(str: string): string {
        // Remove ANSI escape codes for clean output
        return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    }
}

export default ComposerManager;

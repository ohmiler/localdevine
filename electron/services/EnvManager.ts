import fs from 'fs';
import path from 'path';
import { envLogger as logger } from './Logger';
import PathResolver from './PathResolver';

export interface EnvVariable {
    key: string;
    value: string;
    comment?: string;
}

export interface EnvFile {
    name: string;
    path: string;
    variables: EnvVariable[];
    lastModified?: string;
}

export interface EnvOperationResult {
    success: boolean;
    message?: string;
    error?: string;
}

export class EnvManager {
    private pathResolver: PathResolver;
    private envDir: string;

    constructor() {
        this.pathResolver = PathResolver.getInstance();
        this.envDir = path.join(this.pathResolver.userDataPath, 'config', 'env');
        this.ensureEnvDir();
    }

    private ensureEnvDir(): void {
        if (!fs.existsSync(this.envDir)) {
            fs.mkdirSync(this.envDir, { recursive: true });
            logger.info(`Created env directory: ${this.envDir}`);
            
            // Create default .env file
            this.createDefaultEnvFile();
        }
    }

    private createDefaultEnvFile(): void {
        const defaultEnv = `# LocalDevine Environment Variables
# This file is loaded automatically

# Application
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=localdevine
DB_USERNAME=root
DB_PASSWORD=

# Mail (example)
# MAIL_MAILER=smtp
# MAIL_HOST=smtp.mailtrap.io
# MAIL_PORT=2525
# MAIL_USERNAME=null
# MAIL_PASSWORD=null
`;
        const envPath = path.join(this.envDir, '.env');
        fs.writeFileSync(envPath, defaultEnv, 'utf-8');
        logger.info('Created default .env file');
    }

    /**
     * List all .env files in the env directory
     */
    listEnvFiles(): EnvFile[] {
        try {
            const files = fs.readdirSync(this.envDir)
                .filter(f => f.startsWith('.env') || f.endsWith('.env'));
            
            return files.map(filename => {
                const filePath = path.join(this.envDir, filename);
                const stats = fs.statSync(filePath);
                const content = fs.readFileSync(filePath, 'utf-8');
                
                return {
                    name: filename,
                    path: filePath,
                    variables: this.parseEnvContent(content),
                    lastModified: stats.mtime.toISOString()
                };
            });
        } catch (error) {
            logger.error(`Failed to list env files: ${(error as Error).message}`);
            return [];
        }
    }

    /**
     * Get a specific .env file
     */
    getEnvFile(filename: string): EnvFile | null {
        try {
            // Validate filename
            if (!this.isValidEnvFilename(filename)) {
                logger.error(`Invalid env filename: ${filename}`);
                return null;
            }

            const filePath = path.join(this.envDir, filename);
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const stats = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf-8');

            return {
                name: filename,
                path: filePath,
                variables: this.parseEnvContent(content),
                lastModified: stats.mtime.toISOString()
            };
        } catch (error) {
            logger.error(`Failed to get env file: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * Create a new .env file
     */
    createEnvFile(filename: string, variables: EnvVariable[] = []): EnvOperationResult {
        try {
            // Validate filename
            if (!this.isValidEnvFilename(filename)) {
                return { success: false, error: 'Invalid filename. Must start with . or end with .env' };
            }

            const filePath = path.join(this.envDir, filename);
            if (fs.existsSync(filePath)) {
                return { success: false, error: 'File already exists' };
            }

            const content = this.buildEnvContent(variables);
            fs.writeFileSync(filePath, content, 'utf-8');
            logger.info(`Created env file: ${filename}`);

            return { success: true, message: `Created ${filename}` };
        } catch (error) {
            logger.error(`Failed to create env file: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Save variables to an .env file
     */
    saveEnvFile(filename: string, variables: EnvVariable[]): EnvOperationResult {
        try {
            // Validate filename
            if (!this.isValidEnvFilename(filename)) {
                return { success: false, error: 'Invalid filename' };
            }

            const filePath = path.join(this.envDir, filename);
            const content = this.buildEnvContent(variables);
            fs.writeFileSync(filePath, content, 'utf-8');
            logger.info(`Saved env file: ${filename}`);

            return { success: true, message: `Saved ${filename}` };
        } catch (error) {
            logger.error(`Failed to save env file: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Delete an .env file
     */
    deleteEnvFile(filename: string): EnvOperationResult {
        try {
            // Validate filename
            if (!this.isValidEnvFilename(filename)) {
                return { success: false, error: 'Invalid filename' };
            }

            // Prevent deleting the main .env file
            if (filename === '.env') {
                return { success: false, error: 'Cannot delete the main .env file' };
            }

            const filePath = path.join(this.envDir, filename);
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File not found' };
            }

            fs.unlinkSync(filePath);
            logger.info(`Deleted env file: ${filename}`);

            return { success: true, message: `Deleted ${filename}` };
        } catch (error) {
            logger.error(`Failed to delete env file: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Get a single variable from an .env file
     */
    getVariable(filename: string, key: string): string | null {
        const envFile = this.getEnvFile(filename);
        if (!envFile) return null;

        const variable = envFile.variables.find(v => v.key === key);
        return variable?.value ?? null;
    }

    /**
     * Set a single variable in an .env file
     */
    setVariable(filename: string, key: string, value: string): EnvOperationResult {
        try {
            const envFile = this.getEnvFile(filename);
            if (!envFile) {
                return { success: false, error: 'File not found' };
            }

            // Validate key
            if (!this.isValidEnvKey(key)) {
                return { success: false, error: 'Invalid variable name. Use only letters, numbers, and underscores.' };
            }

            const existingIndex = envFile.variables.findIndex(v => v.key === key);
            if (existingIndex >= 0) {
                envFile.variables[existingIndex].value = value;
            } else {
                envFile.variables.push({ key, value });
            }

            return this.saveEnvFile(filename, envFile.variables);
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Delete a variable from an .env file
     */
    deleteVariable(filename: string, key: string): EnvOperationResult {
        try {
            const envFile = this.getEnvFile(filename);
            if (!envFile) {
                return { success: false, error: 'File not found' };
            }

            const newVariables = envFile.variables.filter(v => v.key !== key);
            return this.saveEnvFile(filename, newVariables);
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    /**
     * Parse .env content into variables
     */
    private parseEnvContent(content: string): EnvVariable[] {
        const variables: EnvVariable[] = [];
        const lines = content.split('\n');
        let currentComment = '';

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines
            if (!trimmed) {
                currentComment = '';
                continue;
            }

            // Collect comments
            if (trimmed.startsWith('#')) {
                currentComment = trimmed.substring(1).trim();
                continue;
            }

            // Parse variable
            const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
            if (match) {
                let value = match[2];
                
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }

                variables.push({
                    key: match[1],
                    value: value,
                    comment: currentComment || undefined
                });
                currentComment = '';
            }
        }

        return variables;
    }

    /**
     * Build .env content from variables
     */
    private buildEnvContent(variables: EnvVariable[]): string {
        const lines: string[] = ['# LocalDevine Environment Variables', ''];

        for (const variable of variables) {
            if (variable.comment) {
                lines.push(`# ${variable.comment}`);
            }
            
            // Quote value if it contains spaces or special characters
            let value = variable.value;
            if (value.includes(' ') || value.includes('#') || value.includes('"')) {
                value = `"${value.replace(/"/g, '\\"')}"`;
            }
            
            lines.push(`${variable.key}=${value}`);
        }

        return lines.join('\n') + '\n';
    }

    /**
     * Validate env filename
     */
    private isValidEnvFilename(filename: string): boolean {
        // Must start with . or end with .env
        if (!filename.startsWith('.') && !filename.endsWith('.env')) {
            return false;
        }
        // No path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return false;
        }
        return true;
    }

    /**
     * Validate env variable key
     */
    private isValidEnvKey(key: string): boolean {
        return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
    }

    /**
     * Get the env directory path
     */
    getEnvDir(): string {
        return this.envDir;
    }
}

export default EnvManager;

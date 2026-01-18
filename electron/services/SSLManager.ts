import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { sslLogger as logger } from './Logger';
import PathResolver from './PathResolver';
import { shell } from 'electron';

const execAsync = promisify(exec);

export interface SSLCertificate {
    domain: string;
    certPath: string;
    keyPath: string;
    createdAt: string;
    expiresAt: string;
    isTrusted: boolean;
}

export interface SSLOperationResult {
    success: boolean;
    message?: string;
    error?: string;
    data?: SSLCertificate | SSLCertificate[];
}

export class SSLManager {
    private pathResolver: PathResolver;
    private sslDir: string;
    private certsDir: string;
    private openSSLPath: string;

    constructor() {
        this.pathResolver = PathResolver.getInstance();
        this.sslDir = path.join(this.pathResolver.userDataPath, 'ssl');
        this.certsDir = path.join(this.sslDir, 'certs');
        this.openSSLPath = this.findOpenSSL();
        this.ensureSSLDir();
    }

    private findOpenSSL(): string {
        // Try to find OpenSSL in bin directory first (Apache includes OpenSSL)
        const binOpenSSL = path.join(this.pathResolver.binDir, 'apache', 'bin', 'openssl.exe');
        if (fs.existsSync(binOpenSSL)) {
            logger.info(`Found OpenSSL at: ${binOpenSSL}`);
            return binOpenSSL;
        }

        // Try system OpenSSL
        try {
            execSync('openssl version', { stdio: 'pipe' });
            logger.info('Using system OpenSSL');
            return 'openssl';
        } catch {
            logger.warn('OpenSSL not found in system PATH');
        }

        // Default to bin path
        return binOpenSSL;
    }

    private ensureSSLDir(): void {
        if (!fs.existsSync(this.sslDir)) {
            fs.mkdirSync(this.sslDir, { recursive: true });
            logger.info(`Created SSL directory: ${this.sslDir}`);
        }
        if (!fs.existsSync(this.certsDir)) {
            fs.mkdirSync(this.certsDir, { recursive: true });
            logger.info(`Created certs directory: ${this.certsDir}`);
        }
    }

    async listCertificates(): Promise<SSLOperationResult> {
        try {
            const certs: SSLCertificate[] = [];
            
            if (!fs.existsSync(this.certsDir)) {
                return { success: true, data: certs };
            }

            const dirs = fs.readdirSync(this.certsDir);
            
            for (const dir of dirs) {
                const certDir = path.join(this.certsDir, dir);
                const stat = fs.statSync(certDir);
                
                if (stat.isDirectory()) {
                    const certPath = path.join(certDir, 'cert.pem');
                    const keyPath = path.join(certDir, 'key.pem');
                    const metaPath = path.join(certDir, 'meta.json');
                    
                    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
                        let meta = { createdAt: '', expiresAt: '', isTrusted: false };
                        
                        if (fs.existsSync(metaPath)) {
                            try {
                                meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                            } catch {
                                // Use default meta
                            }
                        }
                        
                        certs.push({
                            domain: dir,
                            certPath,
                            keyPath,
                            createdAt: meta.createdAt || stat.birthtime.toISOString(),
                            expiresAt: meta.expiresAt || '',
                            isTrusted: meta.isTrusted || false
                        });
                    }
                }
            }
            
            logger.info(`Found ${certs.length} certificates`);
            return { success: true, data: certs };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Failed to list certificates: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    async generateCertificate(domain: string): Promise<SSLOperationResult> {
        try {
            // Validate domain
            const sanitizedDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '');
            if (!sanitizedDomain) {
                return { success: false, error: 'Invalid domain name' };
            }

            const certDir = path.join(this.certsDir, sanitizedDomain);
            const certPath = path.join(certDir, 'cert.pem');
            const keyPath = path.join(certDir, 'key.pem');
            const metaPath = path.join(certDir, 'meta.json');

            // Check if certificate already exists
            if (fs.existsSync(certPath)) {
                return { success: false, error: `Certificate for ${sanitizedDomain} already exists` };
            }

            // Create directory
            if (!fs.existsSync(certDir)) {
                fs.mkdirSync(certDir, { recursive: true });
            }

            // Check OpenSSL availability
            if (!fs.existsSync(this.openSSLPath) && this.openSSLPath !== 'openssl') {
                return { success: false, error: 'OpenSSL not found. Please ensure LocalDevine runtime is installed.' };
            }

            // Generate self-signed certificate
            const openssl = this.openSSLPath;
            const days = 365;
            const subject = `/CN=${sanitizedDomain}/O=LocalDevine/OU=Development`;
            
            // Create OpenSSL config for SAN (Subject Alternative Names)
            const configPath = path.join(certDir, 'openssl.cnf');
            const configContent = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = ${sanitizedDomain}
O = LocalDevine
OU = Development

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment

[alt_names]
DNS.1 = ${sanitizedDomain}
DNS.2 = *.${sanitizedDomain}
DNS.3 = localhost
IP.1 = 127.0.0.1
`;
            fs.writeFileSync(configPath, configContent);

            // Generate certificate
            const cmd = `"${openssl}" req -x509 -nodes -days ${days} -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -config "${configPath}"`;
            
            logger.info(`Generating certificate for: ${sanitizedDomain}`);
            await execAsync(cmd);

            // Calculate expiry date
            const createdAt = new Date();
            const expiresAt = new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);

            // Save metadata
            const meta = {
                createdAt: createdAt.toISOString(),
                expiresAt: expiresAt.toISOString(),
                isTrusted: false
            };
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

            // Clean up config
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }

            const cert: SSLCertificate = {
                domain: sanitizedDomain,
                certPath,
                keyPath,
                createdAt: meta.createdAt,
                expiresAt: meta.expiresAt,
                isTrusted: false
            };

            logger.info(`Certificate generated successfully for: ${sanitizedDomain}`);
            return { 
                success: true, 
                message: `SSL certificate generated for ${sanitizedDomain}`,
                data: cert
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Failed to generate certificate: ${errorMsg}`);
            return { success: false, error: `Failed to generate certificate: ${errorMsg}` };
        }
    }

    async deleteCertificate(domain: string): Promise<SSLOperationResult> {
        try {
            const certDir = path.join(this.certsDir, domain);
            
            if (!fs.existsSync(certDir)) {
                return { success: false, error: `Certificate for ${domain} not found` };
            }

            // Remove from Windows trust store first
            await this.untrustCertificate(domain);

            // Delete directory
            fs.rmSync(certDir, { recursive: true, force: true });
            
            logger.info(`Certificate deleted: ${domain}`);
            return { success: true, message: `Certificate for ${domain} deleted successfully` };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Failed to delete certificate: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    async trustCertificate(domain: string): Promise<SSLOperationResult> {
        try {
            const certDir = path.join(this.certsDir, domain);
            const certPath = path.join(certDir, 'cert.pem');
            const metaPath = path.join(certDir, 'meta.json');

            if (!fs.existsSync(certPath)) {
                return { success: false, error: `Certificate for ${domain} not found` };
            }

            // Add to Windows Trusted Root store using certutil
            // This requires admin privileges
            const cmd = `certutil -addstore -f "ROOT" "${certPath}"`;
            
            logger.info(`Trusting certificate for: ${domain}`);
            
            try {
                await execAsync(cmd);
            } catch (error) {
                // If failed, it's likely due to lack of admin privileges
                return { 
                    success: false, 
                    error: 'Failed to trust certificate. Please run LocalDevine as Administrator.' 
                };
            }

            // Update metadata
            if (fs.existsSync(metaPath)) {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                meta.isTrusted = true;
                fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
            }

            logger.info(`Certificate trusted: ${domain}`);
            return { success: true, message: `Certificate for ${domain} is now trusted by Windows` };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Failed to trust certificate: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    async untrustCertificate(domain: string): Promise<SSLOperationResult> {
        try {
            const certDir = path.join(this.certsDir, domain);
            const certPath = path.join(certDir, 'cert.pem');
            const metaPath = path.join(certDir, 'meta.json');

            if (!fs.existsSync(certPath)) {
                return { success: true }; // Already doesn't exist
            }

            // Remove from Windows Trusted Root store
            const cmd = `certutil -delstore "ROOT" "${domain}"`;
            
            try {
                await execAsync(cmd);
            } catch {
                // Ignore errors - certificate might not be in store
            }

            // Update metadata
            if (fs.existsSync(metaPath)) {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                meta.isTrusted = false;
                fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
            }

            logger.info(`Certificate untrusted: ${domain}`);
            return { success: true, message: `Certificate for ${domain} removed from trust store` };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Failed to untrust certificate: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    async getCertificateInfo(domain: string): Promise<SSLOperationResult> {
        try {
            const certDir = path.join(this.certsDir, domain);
            const certPath = path.join(certDir, 'cert.pem');
            const keyPath = path.join(certDir, 'key.pem');
            const metaPath = path.join(certDir, 'meta.json');

            if (!fs.existsSync(certPath)) {
                return { success: false, error: `Certificate for ${domain} not found` };
            }

            let meta = { createdAt: '', expiresAt: '', isTrusted: false };
            if (fs.existsSync(metaPath)) {
                meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            }

            const cert: SSLCertificate = {
                domain,
                certPath,
                keyPath,
                createdAt: meta.createdAt,
                expiresAt: meta.expiresAt,
                isTrusted: meta.isTrusted
            };

            return { success: true, data: cert };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, error: errorMsg };
        }
    }

    getApacheSSLConfig(domain: string): string {
        const certDir = path.join(this.certsDir, domain);
        const certPath = path.join(certDir, 'cert.pem').replace(/\\/g, '/');
        const keyPath = path.join(certDir, 'key.pem').replace(/\\/g, '/');

        return `
# SSL Configuration for ${domain}
<VirtualHost *:443>
    ServerName ${domain}
    DocumentRoot "C:/LocalDevine/www/${domain}"
    
    SSLEngine on
    SSLCertificateFile "${certPath}"
    SSLCertificateKeyFile "${keyPath}"
    
    <Directory "C:/LocalDevine/www/${domain}">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
`;
    }

    openSSLDir(): void {
        if (fs.existsSync(this.certsDir)) {
            shell.openPath(this.certsDir);
        }
    }

    getSSLDir(): string {
        return this.certsDir;
    }

    async checkOpenSSL(): Promise<{ available: boolean; version?: string; path?: string }> {
        try {
            const cmd = this.openSSLPath === 'openssl' 
                ? 'openssl version' 
                : `"${this.openSSLPath}" version`;
            
            const { stdout } = await execAsync(cmd);
            return { 
                available: true, 
                version: stdout.trim(),
                path: this.openSSLPath
            };
        } catch {
            return { available: false };
        }
    }
}

export default SSLManager;

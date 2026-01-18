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
    private configDir: string;
    private sslConfigPath: string;
    private httpdConfigPath: string;

    constructor() {
        this.pathResolver = PathResolver.getInstance();
        this.sslDir = path.join(this.pathResolver.userDataPath, 'ssl');
        this.certsDir = path.join(this.sslDir, 'certs');
        this.configDir = path.join(this.pathResolver.userDataPath, 'config');
        this.sslConfigPath = path.join(this.configDir, 'httpd-ssl.conf');
        this.httpdConfigPath = path.join(this.configDir, 'httpd.conf');
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

            // Auto-enable SSL for this domain in Apache config
            await this.enableSSLForDomain(sanitizedDomain);

            logger.info(`Certificate generated successfully for: ${sanitizedDomain}`);
            return { 
                success: true, 
                message: `SSL certificate generated for ${sanitizedDomain}. Apache config updated. Please restart Apache.`,
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

            // Remove SSL VirtualHost from Apache config
            await this.disableSSLForDomain(domain);

            // Delete directory
            fs.rmSync(certDir, { recursive: true, force: true });
            
            logger.info(`Certificate deleted: ${domain}`);
            return { success: true, message: `Certificate for ${domain} deleted successfully. Please restart Apache.` };
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
        const wwwDir = this.pathResolver.wwwDir.replace(/\\/g, '/');
        const domainFolder = domain.replace('.local', '');

        return `
# SSL Configuration for ${domain}
<VirtualHost *:443>
    ServerName ${domain}
    DocumentRoot "${wwwDir}/${domainFolder}"
    
    SSLEngine on
    SSLCertificateFile "${certPath}"
    SSLCertificateKeyFile "${keyPath}"
    
    <Directory "${wwwDir}/${domainFolder}">
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

    // ============================================
    // Apache SSL Configuration Management
    // ============================================

    private getSSLVHostConfig(domain: string, projectPath?: string): string {
        const certPath = path.join(this.certsDir, domain, 'cert.pem').replace(/\\/g, '/');
        const keyPath = path.join(this.certsDir, domain, 'key.pem').replace(/\\/g, '/');
        const docRoot = projectPath || `${this.pathResolver.userDataPath.replace(/\\/g, '/')}/www/${domain.replace('.local', '')}`;
        const phpDir = `${this.pathResolver.binDir.replace(/\\/g, '/')}/php`;

        return `
# SSL VirtualHost for ${domain}
<VirtualHost *:443>
    ServerName ${domain}
    DocumentRoot "${docRoot}"
    
    <Directory "${docRoot}">
        Options Indexes FollowSymLinks ExecCGI
        AllowOverride All
        Require all granted
        AddHandler application/x-httpd-php .php
    </Directory>
    
    # PHP CGI for this VHost
    ScriptAlias /php-cgi-${domain.replace(/\./g, '-')}/ "${phpDir}/"
    Action application/x-httpd-php "/php-cgi-${domain.replace(/\./g, '-')}/php-cgi.exe"
    
    SSLEngine on
    SSLCertificateFile "${certPath}"
    SSLCertificateKeyFile "${keyPath}"
    
    SSLProtocol all -SSLv2 -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite HIGH:MEDIUM:!aNULL:!MD5
    SSLHonorCipherOrder on
</VirtualHost>
`;
    }

    private getSSLConfigHeader(): string {
        const logsDir = `${this.pathResolver.userDataPath.replace(/\\/g, '/')}/logs/apache`;
        
        return `# LocalDevine SSL Configuration
# Auto-generated by SSL Certificate Manager
# Do not edit the header section manually

# SSL Modules
LoadModule ssl_module modules/mod_ssl.so
LoadModule socache_shmcb_module modules/mod_socache_shmcb.so

# Listen on HTTPS port
Listen 443

# SSL Session Cache
SSLSessionCache "shmcb:${logsDir}/ssl_scache(512000)"
SSLSessionCacheTimeout 300

# ============================================
# SSL Virtual Hosts (auto-managed)
# ============================================
`;
    }

    async updateSSLConfig(domain: string, action: 'add' | 'remove', projectPath?: string): Promise<SSLOperationResult> {
        try {
            let configContent = '';
            
            // Read existing config or create new
            if (fs.existsSync(this.sslConfigPath)) {
                configContent = fs.readFileSync(this.sslConfigPath, 'utf-8');
            } else {
                configContent = this.getSSLConfigHeader();
            }

            if (action === 'add') {
                // Check if VHost already exists
                if (configContent.includes(`ServerName ${domain}`)) {
                    logger.info(`SSL VirtualHost for ${domain} already exists`);
                    return { success: true, message: 'VirtualHost already exists' };
                }

                // Add new VHost
                configContent += this.getSSLVHostConfig(domain, projectPath);
                logger.info(`Added SSL VirtualHost for: ${domain}`);
            } else if (action === 'remove') {
                // Remove VHost block
                const vhostPattern = new RegExp(
                    `\\n# SSL VirtualHost for ${domain}[\\s\\S]*?<\\/VirtualHost>\\n`,
                    'g'
                );
                configContent = configContent.replace(vhostPattern, '\n');
                logger.info(`Removed SSL VirtualHost for: ${domain}`);
            }

            // Write config
            fs.writeFileSync(this.sslConfigPath, configContent);

            // Ensure Include directive exists in httpd.conf
            await this.ensureSSLInclude();

            return { success: true, message: `SSL configuration updated for ${domain}` };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Failed to update SSL config: ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }

    private async ensureSSLInclude(): Promise<void> {
        try {
            if (!fs.existsSync(this.httpdConfigPath)) {
                logger.warn('httpd.conf not found, cannot add SSL include');
                return;
            }

            let httpdConfig = fs.readFileSync(this.httpdConfigPath, 'utf-8');
            const sslIncludePath = this.sslConfigPath.replace(/\\/g, '/');
            const includeDirective = `IncludeOptional "${sslIncludePath}"`;

            // Check if include already exists
            if (httpdConfig.includes('httpd-ssl.conf')) {
                logger.info('SSL include directive already exists in httpd.conf');
                return;
            }

            // Find a good place to add the include (before VirtualHost blocks)
            const vhostMatch = httpdConfig.match(/# Default VirtualHost|<VirtualHost/);
            if (vhostMatch && vhostMatch.index !== undefined) {
                const insertPos = vhostMatch.index;
                httpdConfig = 
                    httpdConfig.slice(0, insertPos) + 
                    `# Include SSL Configuration (if exists)\n${includeDirective}\n\n` + 
                    httpdConfig.slice(insertPos);
            } else {
                // Add at the end
                httpdConfig += `\n# Include SSL Configuration (if exists)\n${includeDirective}\n`;
            }

            fs.writeFileSync(this.httpdConfigPath, httpdConfig);
            logger.info('Added SSL include directive to httpd.conf');
        } catch (error) {
            logger.error(`Failed to add SSL include: ${error}`);
        }
    }

    async enableSSLForDomain(domain: string, projectPath?: string): Promise<SSLOperationResult> {
        return this.updateSSLConfig(domain, 'add', projectPath);
    }

    async disableSSLForDomain(domain: string): Promise<SSLOperationResult> {
        return this.updateSSLConfig(domain, 'remove');
    }
}

export default SSLManager;

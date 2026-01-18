import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as readline from 'readline';
import { BrowserWindow } from 'electron';
import PathResolver from './PathResolver';
import ConfigManager from './ConfigManager';
import { databaseLogger as logger } from './Logger';

export interface DatabaseInfo {
    name: string;
    tables: number;
    size: string;
}

export interface TableInfo {
    name: string;
    rows: number;
    size: string;
    engine: string;
}

export interface DatabaseResult {
    success: boolean;
    message?: string;
    error?: string;
}

export interface ImportProgress {
    total: number;
    current: number;
    percentage: number;
    currentQuery?: string;
}

export class DatabaseManager {
    private mainWindow: BrowserWindow | null = null;
    private configManager: ConfigManager | null = null;
    private pathResolver: PathResolver;

    constructor(configManager?: ConfigManager) {
        this.pathResolver = PathResolver.getInstance();
        this.configManager = configManager || null;
    }

    setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
    }

    setConfigManager(configManager: ConfigManager) {
        this.configManager = configManager;
    }

    private getDbConfig() {
        if (this.configManager) {
            return this.configManager.getDatabaseConfig();
        }
        return {
            host: '127.0.0.1',
            port: 3306,
            user: 'root',
            password: 'root'
        };
    }

    private async getConnection(database?: string): Promise<mysql.Connection> {
        const dbConfig = this.getDbConfig();
        const config: mysql.ConnectionOptions = {
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            multipleStatements: true
        };
        
        if (database) {
            config.database = database;
        }

        return mysql.createConnection(config);
    }

    /**
     * List all databases
     */
    async listDatabases(): Promise<DatabaseInfo[]> {
        let connection: mysql.Connection | null = null;
        try {
            connection = await this.getConnection();
            
            const [rows] = await connection.query(`
                SELECT 
                    s.schema_name as name,
                    COUNT(t.table_name) as tables,
                    COALESCE(SUM(t.data_length + t.index_length), 0) as size
                FROM information_schema.schemata s
                LEFT JOIN information_schema.tables t ON s.schema_name = t.table_schema
                WHERE s.schema_name NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
                GROUP BY s.schema_name
                ORDER BY s.schema_name
            `);

            const databases = (rows as any[]).map(row => ({
                name: row.name,
                tables: row.tables || 0,
                size: this.formatBytes(row.size || 0)
            }));

            logger.debug(`Found ${databases.length} databases`);
            return databases;
        } catch (error) {
            logger.error(`Failed to list databases: ${(error as Error).message}`);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Create a new database
     */
    async createDatabase(name: string): Promise<DatabaseResult> {
        // Validate database name
        if (!this.isValidDatabaseName(name)) {
            return { success: false, error: 'Invalid database name. Use only letters, numbers, and underscores.' };
        }

        let connection: mysql.Connection | null = null;
        try {
            connection = await this.getConnection();
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            logger.debug(`Created database: ${name}`);
            return { success: true, message: `Database '${name}' created successfully` };
        } catch (error) {
            logger.error(`Failed to create database: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Delete a database
     */
    async deleteDatabase(name: string): Promise<DatabaseResult> {
        // Prevent deleting system databases
        const systemDbs = ['information_schema', 'performance_schema', 'mysql', 'sys'];
        if (systemDbs.includes(name.toLowerCase())) {
            return { success: false, error: 'Cannot delete system database' };
        }

        let connection: mysql.Connection | null = null;
        try {
            connection = await this.getConnection();
            await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
            logger.debug(`Deleted database: ${name}`);
            return { success: true, message: `Database '${name}' deleted successfully` };
        } catch (error) {
            logger.error(`Failed to delete database: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * List tables in a database
     */
    async listTables(database: string): Promise<TableInfo[]> {
        let connection: mysql.Connection | null = null;
        try {
            connection = await this.getConnection();
            
            const [rows] = await connection.query(`
                SELECT 
                    table_name as name,
                    table_rows as \`rows\`,
                    data_length + index_length as size,
                    engine
                FROM information_schema.tables
                WHERE table_schema = ?
                ORDER BY table_name
            `, [database]);

            const tables = (rows as any[]).map(row => ({
                name: row.name,
                rows: row.rows || 0,
                size: this.formatBytes(row.size || 0),
                engine: row.engine || 'Unknown'
            }));

            logger.debug(`Found ${tables.length} tables in ${database}`);
            return tables;
        } catch (error) {
            logger.error(`Failed to list tables: ${(error as Error).message}`);
            throw error;
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Import SQL file (supports large files with streaming)
     */
    async importSQL(database: string, filePath: string): Promise<DatabaseResult> {
        // Validate file exists
        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'SQL file not found' };
        }

        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        logger.debug(`Importing SQL file: ${filePath} (${this.formatBytes(fileSize)})`);

        let connection: mysql.Connection | null = null;
        try {
            connection = await this.getConnection(database);

            // For small files (< 10MB), read entire file
            if (fileSize < 10 * 1024 * 1024) {
                const sql = fs.readFileSync(filePath, 'utf8');
                await connection.query(sql);
                logger.debug(`Imported SQL file successfully`);
                return { success: true, message: `Imported ${this.formatBytes(fileSize)} successfully` };
            }

            // For large files, use streaming
            return await this.importLargeSQL(connection, filePath, fileSize);
        } catch (error) {
            logger.error(`Failed to import SQL: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Import large SQL file using streaming
     */
    private async importLargeSQL(connection: mysql.Connection, filePath: string, fileSize: number): Promise<DatabaseResult> {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: fs.createReadStream(filePath, { encoding: 'utf8' }),
                crlfDelay: Infinity
            });

            let currentQuery = '';
            let bytesRead = 0;
            let queriesExecuted = 0;
            let inMultiLineComment = false;

            const executeQuery = async (query: string) => {
                if (query.trim()) {
                    try {
                        await connection.query(query);
                        queriesExecuted++;
                        
                        // Send progress to renderer
                        if (this.mainWindow && queriesExecuted % 100 === 0) {
                            const progress: ImportProgress = {
                                total: fileSize,
                                current: bytesRead,
                                percentage: Math.round((bytesRead / fileSize) * 100)
                            };
                            this.mainWindow.webContents.send('import-progress', progress);
                        }
                    } catch (error) {
                        logger.warn(`Query error (continuing): ${(error as Error).message}`);
                    }
                }
            };

            rl.on('line', async (line) => {
                bytesRead += Buffer.byteLength(line, 'utf8') + 1;
                
                // Skip comments and empty lines
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('--') || trimmedLine.startsWith('#') || trimmedLine === '') {
                    return;
                }

                // Handle multi-line comments
                if (trimmedLine.startsWith('/*')) {
                    inMultiLineComment = true;
                }
                if (inMultiLineComment) {
                    if (trimmedLine.endsWith('*/') || trimmedLine.includes('*/')) {
                        inMultiLineComment = false;
                    }
                    return;
                }

                currentQuery += line + '\n';

                // Execute when we hit a semicolon at end of line
                if (trimmedLine.endsWith(';')) {
                    rl.pause();
                    await executeQuery(currentQuery);
                    currentQuery = '';
                    rl.resume();
                }
            });

            rl.on('close', async () => {
                // Execute any remaining query
                if (currentQuery.trim()) {
                    await executeQuery(currentQuery);
                }

                logger.debug(`Import complete: ${queriesExecuted} queries executed`);
                resolve({ 
                    success: true, 
                    message: `Imported successfully. ${queriesExecuted} queries executed.` 
                });
            });

            rl.on('error', (error) => {
                logger.error(`Import error: ${error.message}`);
                resolve({ success: false, error: error.message });
            });
        });
    }

    /**
     * Export database to SQL file
     */
    async exportDatabase(database: string, outputPath: string): Promise<DatabaseResult> {
        let connection: mysql.Connection | null = null;
        try {
            connection = await this.getConnection(database);

            // Get all tables
            const tables = await this.listTables(database);
            
            let sql = `-- Database Export: ${database}\n`;
            sql += `-- Generated by LocalDevine\n`;
            sql += `-- Date: ${new Date().toISOString()}\n\n`;
            sql += `SET NAMES utf8mb4;\n`;
            sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

            for (const table of tables) {
                // Get CREATE TABLE statement
                const [createResult] = await connection.query(`SHOW CREATE TABLE \`${table.name}\``);
                const createStatement = (createResult as any[])[0]['Create Table'];
                
                sql += `-- Table: ${table.name}\n`;
                sql += `DROP TABLE IF EXISTS \`${table.name}\`;\n`;
                sql += `${createStatement};\n\n`;

                // Get data
                const [rows] = await connection.query(`SELECT * FROM \`${table.name}\``);
                if ((rows as any[]).length > 0) {
                    const columns = Object.keys((rows as any[])[0]);
                    const values = (rows as any[]).map(row => {
                        return '(' + columns.map(col => {
                            const val = row[col];
                            if (val === null) return 'NULL';
                            if (typeof val === 'number') return val;
                            return connection!.escape(val);
                        }).join(', ') + ')';
                    });

                    sql += `INSERT INTO \`${table.name}\` (\`${columns.join('`, `')}\`) VALUES\n`;
                    sql += values.join(',\n') + ';\n\n';
                }

                // Send progress
                if (this.mainWindow) {
                    const progress = Math.round((tables.indexOf(table) + 1) / tables.length * 100);
                    this.mainWindow.webContents.send('export-progress', { percentage: progress, table: table.name });
                }
            }

            sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

            // Write to file
            fs.writeFileSync(outputPath, sql, 'utf8');
            
            logger.debug(`Exported database ${database} to ${outputPath}`);
            return { success: true, message: `Exported to ${outputPath}` };
        } catch (error) {
            logger.error(`Failed to export database: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Execute a raw SQL query
     */
    async executeQuery(database: string, query: string): Promise<{ success: boolean; data?: any[]; error?: string; affectedRows?: number }> {
        let connection: mysql.Connection | null = null;
        try {
            connection = await this.getConnection(database);
            const [result] = await connection.query(query);
            
            if (Array.isArray(result)) {
                return { success: true, data: result };
            } else {
                return { success: true, affectedRows: (result as any).affectedRows };
            }
        } catch (error) {
            logger.error(`Query execution failed: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        } finally {
            if (connection) await connection.end();
        }
    }

    /**
     * Test database connection
     */
    async testConnection(): Promise<DatabaseResult> {
        let connection: mysql.Connection | null = null;
        try {
            connection = await this.getConnection();
            await connection.query('SELECT 1');
            return { success: true, message: 'Connection successful' };
        } catch (error) {
            logger.error(`Connection test failed: ${(error as Error).message}`);
            return { success: false, error: (error as Error).message };
        } finally {
            if (connection) await connection.end();
        }
    }

    // Helpers
    private isValidDatabaseName(name: string): boolean {
        return /^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(name) && name.length <= 64;
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

export default DatabaseManager;

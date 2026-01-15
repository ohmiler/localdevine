import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { BrowserWindow } from 'electron';
import PathResolver from './PathResolver';
import logger from './Logger';

export interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'php' | 'nodejs' | 'static';
    hasDatabase: boolean;
    files: TemplateFile[];
}

export interface TemplateFile {
    path: string;
    content: string;
}

export interface CreateProjectOptions {
    templateId: string;
    projectName: string;
    projectPath: string;
    databaseName?: string;
    createDatabase?: boolean;
}

export interface CreateProjectResult {
    success: boolean;
    message: string;
    projectPath?: string;
    databaseName?: string;
}

export class ProjectTemplateManager {
    private mainWindow: BrowserWindow | null = null;
    private wwwPath: string;
    private dbHost = '127.0.0.1';
    private dbPort = 3306;
    private dbUser = 'root';
    private dbPassword = 'root';

    private templates: ProjectTemplate[] = [
        {
            id: 'php-basic',
            name: 'PHP Basic',
            description: 'Simple PHP project with index.php',
            icon: '🐘',
            category: 'php',
            hasDatabase: false,
            files: [
                {
                    path: 'index.php',
                    content: `<?php
/**
 * {{PROJECT_NAME}} - PHP Project
 * Created with LocalDevine
 */

echo "<h1>Welcome to {{PROJECT_NAME}}!</h1>";
echo "<p>Your PHP project is ready.</p>";
echo "<p>PHP Version: " . phpversion() . "</p>";
echo "<p>Server Time: " . date('Y-m-d H:i:s') . "</p>";
?>`
                },
                {
                    path: '.htaccess',
                    content: `RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]`
                }
            ]
        },
        {
            id: 'html-basic',
            name: 'HTML Basic',
            description: 'Simple HTML/CSS/JS website',
            icon: '🌐',
            category: 'static',
            hasDatabase: false,
            files: [
                {
                    path: 'index.html',
                    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PROJECT_NAME}}</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <header>
        <nav>
            <h1>{{PROJECT_NAME}}</h1>
            <ul>
                <li><a href="index.html">Home</a></li>
                <li><a href="about.html">About</a></li>
                <li><a href="contact.html">Contact</a></li>
            </ul>
        </nav>
    </header>

    <main>
        <section class="hero">
            <h2>Welcome to {{PROJECT_NAME}}</h2>
            <p>Your website is ready to go!</p>
        </section>
    </main>

    <footer>
        <p>&copy; 2024 {{PROJECT_NAME}}. Created with LocalDevine.</p>
    </footer>

    <script src="js/main.js"></script>
</body>
</html>`
                },
                {
                    path: 'css/style.css',
                    content: `/* {{PROJECT_NAME}} Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
}

header {
    background: #2c3e50;
    color: white;
    padding: 1rem;
}

nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
}

nav ul {
    display: flex;
    list-style: none;
    gap: 2rem;
}

nav a {
    color: white;
    text-decoration: none;
}

nav a:hover {
    color: #3498db;
}

main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.hero {
    text-align: center;
    padding: 4rem 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 8px;
    margin-bottom: 2rem;
}

.hero h2 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
}

footer {
    background: #2c3e50;
    color: white;
    text-align: center;
    padding: 1rem;
    margin-top: 2rem;
}`
                },
                {
                    path: 'js/main.js',
                    content: `// {{PROJECT_NAME}} JavaScript
console.log('{{PROJECT_NAME}} loaded!');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM ready');
});`
                },
                {
                    path: 'about.html',
                    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About - {{PROJECT_NAME}}</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <header>
        <nav>
            <h1>{{PROJECT_NAME}}</h1>
            <ul>
                <li><a href="index.html">Home</a></li>
                <li><a href="about.html">About</a></li>
                <li><a href="contact.html">Contact</a></li>
            </ul>
        </nav>
    </header>

    <main>
        <h2>About Us</h2>
        <p>This is the about page of {{PROJECT_NAME}}.</p>
    </main>

    <footer>
        <p>&copy; 2024 {{PROJECT_NAME}}. Created with LocalDevine.</p>
    </footer>
</body>
</html>`
                },
                {
                    path: 'contact.html',
                    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact - {{PROJECT_NAME}}</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <header>
        <nav>
            <h1>{{PROJECT_NAME}}</h1>
            <ul>
                <li><a href="index.html">Home</a></li>
                <li><a href="about.html">About</a></li>
                <li><a href="contact.html">Contact</a></li>
            </ul>
        </nav>
    </header>

    <main>
        <h2>Contact Us</h2>
        <p>Get in touch with us!</p>
    </main>

    <footer>
        <p>&copy; 2024 {{PROJECT_NAME}}. Created with LocalDevine.</p>
    </footer>
</body>
</html>`
                }
            ]
        }
    ];

    constructor() {
        // Use PathResolver for correct paths in both dev and production
        const pathResolver = PathResolver.getInstance();
        this.wwwPath = pathResolver.wwwDir;
    }

    setMainWindow(window: BrowserWindow) {
        this.mainWindow = window;
    }

    getTemplates(): ProjectTemplate[] {
        return this.templates.map(t => ({
            ...t,
            files: [] // Don't send file contents to frontend
        }));
    }

    getTemplate(id: string): ProjectTemplate | undefined {
        return this.templates.find(t => t.id === id);
    }

    async createProject(options: CreateProjectOptions): Promise<CreateProjectResult> {
        const template = this.getTemplate(options.templateId);
        
        if (!template) {
            return { success: false, message: 'Template not found' };
        }

        const projectPath = path.join(this.wwwPath, options.projectName);
        const databaseName = options.databaseName || options.projectName.replace(/[^a-zA-Z0-9_]/g, '_');

        try {
            // Check if project already exists
            if (fs.existsSync(projectPath)) {
                return { success: false, message: 'Project already exists' };
            }

            // Create project directory
            fs.mkdirSync(projectPath, { recursive: true });

            // Create database if needed
            if (template.hasDatabase && options.createDatabase !== false) {
                logger.debug(`Creating database: ${databaseName} for template: ${template.id}`);
                const dbResult = await this.createDatabase(databaseName);
                logger.debug(`Database creation result: ${JSON.stringify(dbResult)}`);
                if (!dbResult.success) {
                    // Clean up project directory
                    fs.rmSync(projectPath, { recursive: true, force: true });
                    return dbResult;
                }

                // Run schema if exists
                const schemaFile = template.files.find(f => f.path.includes('schema.sql'));
                if (schemaFile) {
                    await this.runSchema(databaseName, this.replaceVariables(schemaFile.content, options.projectName, databaseName));
                }
            }

            // Create files
            for (const file of template.files) {
                if (file.path.includes('schema.sql')) continue; // Skip schema file
                
                const filePath = path.join(projectPath, file.path);
                const fileDir = path.dirname(filePath);
                
                if (!fs.existsSync(fileDir)) {
                    fs.mkdirSync(fileDir, { recursive: true });
                }

                const content = this.replaceVariables(file.content, options.projectName, databaseName);
                fs.writeFileSync(filePath, content, 'utf8');
            }

            return {
                success: true,
                message: 'Project created successfully',
                projectPath,
                databaseName: template.hasDatabase ? databaseName : undefined
            };

        } catch (error: any) {
            // Clean up on error
            if (fs.existsSync(projectPath)) {
                fs.rmSync(projectPath, { recursive: true, force: true });
            }
            return { success: false, message: `Error creating project: ${error.message}` };
        }
    }

    private replaceVariables(content: string, projectName: string, databaseName: string): string {
        return content
            .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
            .replace(/\{\{DATABASE_NAME\}\}/g, databaseName);
    }

    private async createDatabase(dbName: string): Promise<CreateProjectResult> {
        return new Promise((resolve) => {
            logger.debug(`Connecting to database: ${this.dbHost}:${this.dbPort} as ${this.dbUser}`);
            const mysql = require('mysql2');
            const connection = mysql.createConnection({
                host: this.dbHost,
                port: this.dbPort,
                user: this.dbUser,
                password: this.dbPassword
            });

            connection.connect((err: any) => {
                if (err) {
                    logger.error(`Database connection error: ${err.message}`);
                    resolve({ success: false, message: `Database connection failed: ${err.message}` });
                    return;
                }

                logger.debug(`Connected to database, creating: ${dbName}`);
                connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``, (err: any) => {
                    connection.end();
                    if (err) {
                        logger.error(`Database creation error: ${err.message}`);
                        resolve({ success: false, message: `Failed to create database: ${err.message}` });
                    } else {
                        logger.debug(`Database created successfully: ${dbName}`);
                        resolve({ success: true, message: 'Database created' });
                    }
                });
            });
        });
    }

    private async runSchema(dbName: string, schema: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const mysql = require('mysql2');
            const connection = mysql.createConnection({
                host: this.dbHost,
                port: this.dbPort,
                user: this.dbUser,
                password: this.dbPassword,
                database: dbName,
                multipleStatements: true
            });

            connection.connect((err: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                connection.query(schema, (err: any) => {
                    connection.end();
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    deleteProject(projectName: string): CreateProjectResult {
        const projectPath = path.join(this.wwwPath, projectName);
        
        try {
            if (!fs.existsSync(projectPath)) {
                return { success: false, message: 'Project not found' };
            }

            // Additional check: ensure we're not deleting system folders
            if (projectName === '.' || projectName === '..' || projectName.includes('..')) {
                return { success: false, message: 'Invalid project name' };
            }

            // Try to delete with more robust error handling
            try {
                fs.rmSync(projectPath, { recursive: true, force: true, maxRetries: 3 });
            } catch (rmError: any) {
                // If rmSync fails, try alternative method
                logger.warn(`rmSync failed, trying alternative method: ${rmError.message}`);
                
                // Check if folder is locked by another process
                if (rmError.code === 'EBUSY' || rmError.code === 'ENOTEMPTY') {
                    return { success: false, message: 'Project is in use. Please close any files or processes using this project and try again.' };
                }
                
                throw rmError; // Re-throw other errors
            }

            return { success: true, message: 'Project deleted successfully' };
        } catch (error: any) {
            logger.error(`Delete project error: ${error.message}`);
            return { success: false, message: `Error deleting project: ${error.message}` };
        }
    }

    getProjects(): string[] {
        try {
            const items = fs.readdirSync(this.wwwPath, { withFileTypes: true });
            return items
                .filter(item => item.isDirectory())
                .map(item => item.name)
                .filter(name => !name.startsWith('.'));
        } catch {
            return [];
        }
    }
}

export default ProjectTemplateManager;

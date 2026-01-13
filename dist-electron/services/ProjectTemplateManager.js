"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectTemplateManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ProjectTemplateManager {
    constructor() {
        this.mainWindow = null;
        this.dbHost = '127.0.0.1';
        this.dbPort = 3306;
        this.dbUser = 'root';
        this.dbPassword = 'root';
        this.templates = [
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
                id: 'php-mvc',
                name: 'PHP MVC',
                description: 'MVC pattern with routing and database',
                icon: '🏗️',
                category: 'php',
                hasDatabase: true,
                files: [
                    {
                        path: 'index.php',
                        content: `<?php
/**
 * {{PROJECT_NAME}} - PHP MVC Project
 * Created with LocalDevine
 */

require_once 'config/database.php';
require_once 'app/Router.php';

$router = new Router();
$router->run();
?>`
                    },
                    {
                        path: 'config/database.php',
                        content: `<?php
define('DB_HOST', '127.0.0.1');
define('DB_PORT', 3306);
define('DB_NAME', '{{DATABASE_NAME}}');
define('DB_USER', 'root');
define('DB_PASS', 'root');

class Database {
    private static $instance = null;
    private $conn;

    private function __construct() {
        try {
            $this->conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT);
            if ($this->conn->connect_error) {
                throw new Exception("Connection failed: " . $this->conn->connect_error);
            }
            $this->conn->set_charset("utf8mb4");
        } catch (Exception $e) {
            die("Database connection error: " . $e->getMessage());
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->conn;
    }
}
?>`
                    },
                    {
                        path: 'app/Router.php',
                        content: `<?php
class Router {
    private $routes = [];

    public function __construct() {
        $this->routes = [
            '/' => 'HomeController@index',
            '/about' => 'HomeController@about',
        ];
    }

    public function run() {
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        
        // Remove project folder name from URI
        $parts = explode('/', trim($uri, '/'));
        if (!empty($parts[0])) {
            // Remove first part (project folder name)
            $uri = '/' . implode('/', array_slice($parts, 1));
        }
        
        if (isset($this->routes[$uri])) {
            list($controller, $method) = explode('@', $this->routes[$uri]);
            require_once "controllers/{$controller}.php";
            $controllerInstance = new $controller();
            $controllerInstance->$method();
        } else {
            $this->notFound();
        }
    }

    private function notFound() {
        http_response_code(404);
        echo "<h1>404 - Page Not Found</h1>";
    }
}
?>`
                    },
                    {
                        path: 'app/controllers/HomeController.php',
                        content: `<?php
class HomeController {
    public function index() {
        require_once '../app/views/home.php';
    }

    public function about() {
        require_once '../app/views/about.php';
    }
}
?>`
                    },
                    {
                        path: 'app/views/home.php',
                        content: `<!DOCTYPE html>
<html>
<head>
    <title>{{PROJECT_NAME}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        a { color: #007bff; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to {{PROJECT_NAME}}!</h1>
        <p>Your PHP MVC project is ready.</p>
        <p><a href="about">About</a></p>
    </div>
</body>
</html>`
                    },
                    {
                        path: 'app/views/about.php',
                        content: `<!DOCTYPE html>
<html>
<head>
    <title>About - {{PROJECT_NAME}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        a { color: #007bff; }
    </style>
</head>
<body>
    <div class="container">
        <h1>About {{PROJECT_NAME}}</h1>
        <p>This is a PHP MVC project created with LocalDevine.</p>
        <p><a href="./">Home</a></p>
    </div>
</body>
</html>`
                    },
                    {
                        path: 'app/models/.gitkeep',
                        content: ''
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
                id: 'php-api',
                name: 'PHP REST API',
                description: 'REST API with JSON responses',
                icon: '🔌',
                category: 'php',
                hasDatabase: true,
                files: [
                    {
                        path: 'index.php',
                        content: `<?php
/**
 * {{PROJECT_NAME}} - REST API
 * Created with LocalDevine
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config/database.php';
require_once 'api/Router.php';

$router = new ApiRouter();
$router->handleRequest();
?>`
                    },
                    {
                        path: 'config/database.php',
                        content: `<?php
class Database {
    private $host = '127.0.0.1';
    private $port = 3306;
    private $db_name = '{{DATABASE_NAME}}';
    private $username = 'root';
    private $password = 'root';
    public $conn;

    public function getConnection() {
        $this->conn = null;
        try {
            $this->conn = new mysqli($this->host, $this->username, $this->password, $this->db_name, $this->port);
            $this->conn->set_charset("utf8mb4");
        } catch (Exception $e) {
            echo json_encode(['error' => 'Connection error: ' . $e->getMessage()]);
        }
        return $this->conn;
    }
}
?>`
                    },
                    {
                        path: 'api/Router.php',
                        content: `<?php
class ApiRouter {
    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        
        // Use query parameters for routing (works with Nginx without rewrite)
        $resource = $_GET['r'] ?? $_GET['resource'] ?? '';
        $id = $_GET['id'] ?? null;

        switch ($resource) {
            case 'users':
                require_once 'controllers/UserController.php';
                $controller = new UserController();
                $this->route($controller, $method, $id);
                break;
            case '':
                $this->welcome();
                break;
            default:
                $this->notFound();
        }
    }

    private function route($controller, $method, $id) {
        switch ($method) {
            case 'GET':
                $id ? $controller->show($id) : $controller->index();
                break;
            case 'POST':
                $controller->store();
                break;
            case 'PUT':
                $controller->update($id);
                break;
            case 'DELETE':
                $controller->destroy($id);
                break;
            default:
                $this->methodNotAllowed();
        }
    }

    private function welcome() {
        echo json_encode([
            'message' => 'Welcome to {{PROJECT_NAME}} API',
            'version' => '1.0.0',
            'endpoints' => [
                'GET ?r=users' => 'List all users',
                'GET ?r=users&id=1' => 'Get user by ID',
                'POST ?r=users' => 'Create user',
                'PUT ?r=users&id=1' => 'Update user',
                'DELETE ?r=users&id=1' => 'Delete user'
            ]
        ]);
    }

    private function notFound() {
        http_response_code(404);
        echo json_encode(['error' => 'Resource not found']);
    }

    private function methodNotAllowed() {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
}
?>`
                    },
                    {
                        path: 'api/controllers/UserController.php',
                        content: `<?php
require_once __DIR__ . '/../../config/database.php';

class UserController {
    private $conn;

    public function __construct() {
        $database = new Database();
        $this->conn = $database->getConnection();
    }

    public function index() {
        $result = $this->conn->query("SELECT * FROM users ORDER BY id DESC");
        $users = [];
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }
        echo json_encode(['data' => $users]);
    }

    public function show($id) {
        $stmt = $this->conn->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($user = $result->fetch_assoc()) {
            echo json_encode(['data' => $user]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
        }
    }

    public function store() {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $stmt = $this->conn->prepare("INSERT INTO users (name, email) VALUES (?, ?)");
        $stmt->bind_param("ss", $data['name'], $data['email']);
        
        if ($stmt->execute()) {
            http_response_code(201);
            echo json_encode(['message' => 'User created', 'id' => $this->conn->insert_id]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create user']);
        }
    }

    public function update($id) {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $stmt = $this->conn->prepare("UPDATE users SET name = ?, email = ? WHERE id = ?");
        $stmt->bind_param("ssi", $data['name'], $data['email'], $id);
        
        if ($stmt->execute()) {
            echo json_encode(['message' => 'User updated']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to update user']);
        }
    }

    public function destroy($id) {
        $stmt = $this->conn->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param("i", $id);
        
        if ($stmt->execute()) {
            echo json_encode(['message' => 'User deleted']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete user']);
        }
    }
}
?>`
                    },
                    {
                        path: 'database/schema.sql',
                        content: `-- {{PROJECT_NAME}} Database Schema
-- Run this SQL to create the necessary tables

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sample data
INSERT INTO users (name, email) VALUES 
('John Doe', 'john@example.com'),
('Jane Smith', 'jane@example.com');`
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
        this.wwwPath = path.join(__dirname, '../../www');
    }
    setMainWindow(window) {
        this.mainWindow = window;
    }
    getTemplates() {
        return this.templates.map(t => ({
            ...t,
            files: [] // Don't send file contents to frontend
        }));
    }
    getTemplate(id) {
        return this.templates.find(t => t.id === id);
    }
    async createProject(options) {
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
                const dbResult = await this.createDatabase(databaseName);
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
                if (file.path.includes('schema.sql'))
                    continue; // Skip schema file
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
        }
        catch (error) {
            // Clean up on error
            if (fs.existsSync(projectPath)) {
                fs.rmSync(projectPath, { recursive: true, force: true });
            }
            return { success: false, message: `Error creating project: ${error.message}` };
        }
    }
    replaceVariables(content, projectName, databaseName) {
        return content
            .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
            .replace(/\{\{DATABASE_NAME\}\}/g, databaseName);
    }
    async createDatabase(dbName) {
        return new Promise((resolve) => {
            const mysql = require('mysql2');
            const connection = mysql.createConnection({
                host: this.dbHost,
                port: this.dbPort,
                user: this.dbUser,
                password: this.dbPassword
            });
            connection.connect((err) => {
                if (err) {
                    resolve({ success: false, message: `Database connection failed: ${err.message}` });
                    return;
                }
                connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``, (err) => {
                    connection.end();
                    if (err) {
                        resolve({ success: false, message: `Failed to create database: ${err.message}` });
                    }
                    else {
                        resolve({ success: true, message: 'Database created' });
                    }
                });
            });
        });
    }
    async runSchema(dbName, schema) {
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
            connection.connect((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                connection.query(schema, (err) => {
                    connection.end();
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
        });
    }
    async deleteProject(projectName) {
        const projectPath = path.join(this.wwwPath, projectName);
        try {
            if (!fs.existsSync(projectPath)) {
                return { success: false, message: 'Project not found' };
            }
            fs.rmSync(projectPath, { recursive: true, force: true });
            return { success: true, message: 'Project deleted successfully' };
        }
        catch (error) {
            return { success: false, message: `Error deleting project: ${error.message}` };
        }
    }
    getProjects() {
        try {
            const items = fs.readdirSync(this.wwwPath, { withFileTypes: true });
            return items
                .filter(item => item.isDirectory())
                .map(item => item.name)
                .filter(name => !name.startsWith('.'));
        }
        catch {
            return [];
        }
    }
}
exports.ProjectTemplateManager = ProjectTemplateManager;
exports.default = ProjectTemplateManager;

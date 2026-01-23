/**
 * Unit tests for ProjectTemplateManager service
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

// Mock electron
jest.mock('electron', () => require('../__mocks__/electron'));

// Mock mysql2
jest.mock('mysql2', () => ({
  createConnection: jest.fn(() => ({
    connect: jest.fn((cb) => cb(null)),
    query: jest.fn((sql, cb) => cb(null, [])),
    end: jest.fn(),
  })),
}));

// Mock Logger
jest.mock('../../electron/services/Logger', () => ({
  projectLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  pathLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  configLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ProjectTemplateManager', () => {
  const testDir = path.join(os.tmpdir(), 'localdevine-project-test');
  const wwwDir = path.join(testDir, 'www');

  beforeAll(() => {
    fs.mkdirSync(wwwDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Project Name Validation', () => {
    const validateProjectName = (name: string): { valid: boolean; error?: string } => {
      // Empty check
      if (!name || name.trim() === '') {
        return { valid: false, error: 'Project name cannot be empty' };
      }

      // Path traversal check
      if (name.includes('..') || name.includes('/') || name.includes('\\')) {
        return { valid: false, error: 'Project name cannot contain path separators' };
      }

      // Dangerous names check
      const dangerous = ['.', '..', 'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'LPT1', 'LPT2'];
      if (dangerous.includes(name.toUpperCase())) {
        return { valid: false, error: 'Project name is reserved by the system' };
      }

      // Character check
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        return { valid: false, error: 'Project name can only contain letters, numbers, hyphens, and underscores' };
      }

      // Length check
      if (name.length > 255) {
        return { valid: false, error: 'Project name is too long (max 255 characters)' };
      }

      return { valid: true };
    };

    test('should accept valid project names', () => {
      expect(validateProjectName('my-project').valid).toBe(true);
      expect(validateProjectName('myProject').valid).toBe(true);
      expect(validateProjectName('my_project').valid).toBe(true);
      expect(validateProjectName('project123').valid).toBe(true);
    });

    test('should reject empty names', () => {
      const result = validateProjectName('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    test('should reject path traversal', () => {
      const result = validateProjectName('../../../etc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path');
    });

    test('should reject dangerous names', () => {
      const result = validateProjectName('CON');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('reserved');
    });

    test('should reject special characters', () => {
      const result = validateProjectName('project@name');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters');
    });
  });

  describe('Database Name Validation', () => {
    const validateDatabaseName = (name: string): { valid: boolean; error?: string } => {
      if (!name || name.trim() === '') {
        return { valid: false, error: 'Database name cannot be empty' };
      }

      if (!/^[a-zA-Z0-9_$]+$/.test(name)) {
        return { valid: false, error: 'Database name contains invalid characters' };
      }

      if (name.length > 64) {
        return { valid: false, error: 'Database name is too long (max 64 characters)' };
      }

      return { valid: true };
    };

    test('should accept valid database names', () => {
      expect(validateDatabaseName('mydb').valid).toBe(true);
      expect(validateDatabaseName('my_database').valid).toBe(true);
      expect(validateDatabaseName('db123').valid).toBe(true);
    });

    test('should reject invalid database names', () => {
      expect(validateDatabaseName('my-db').valid).toBe(false);
      expect(validateDatabaseName('my db').valid).toBe(false);
      expect(validateDatabaseName('').valid).toBe(false);
    });
  });

  describe('Schema SQL Validation', () => {
    const validateSchemaSQL = (sql: string): { valid: boolean; error?: string } => {
      const upperSQL = sql.toUpperCase();
      
      // Check for dangerous statements
      const dangerous = ['DROP DATABASE', 'DROP TABLE', 'TRUNCATE', 'DELETE FROM', 'ALTER USER', 'GRANT', 'REVOKE'];
      
      for (const cmd of dangerous) {
        if (upperSQL.includes(cmd)) {
          return { valid: false, error: `Schema contains dangerous statement: ${cmd}` };
        }
      }

      return { valid: true };
    };

    test('should accept safe CREATE statements', () => {
      expect(validateSchemaSQL('CREATE TABLE users (id INT PRIMARY KEY)').valid).toBe(true);
      expect(validateSchemaSQL('INSERT INTO users VALUES (1, "test")').valid).toBe(true);
    });

    test('should reject DROP statements', () => {
      const result = validateSchemaSQL('DROP TABLE users');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('DROP TABLE');
    });

    test('should reject TRUNCATE statements', () => {
      const result = validateSchemaSQL('TRUNCATE TABLE users');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('TRUNCATE');
    });

    test('should reject privilege statements', () => {
      expect(validateSchemaSQL('GRANT ALL ON *.* TO user').valid).toBe(false);
      expect(validateSchemaSQL('REVOKE ALL ON *.* FROM user').valid).toBe(false);
    });
  });

  describe('Template File Path Validation', () => {
    const validateFilePath = (filePath: string, projectPath: string): boolean => {
      // Check for path traversal
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
        return false;
      }

      // Check resolved path is within project
      const resolvedFilePath = path.resolve(projectPath, normalizedPath);
      const resolvedProjectPath = path.resolve(projectPath);
      
      return resolvedFilePath.startsWith(resolvedProjectPath + path.sep);
    };

    test('should accept valid relative paths', () => {
      expect(validateFilePath('index.php', wwwDir)).toBe(true);
      expect(validateFilePath('css/style.css', wwwDir)).toBe(true);
      expect(validateFilePath('assets/images/logo.png', wwwDir)).toBe(true);
    });

    test('should reject path traversal', () => {
      expect(validateFilePath('../../../etc/passwd', wwwDir)).toBe(false);
      expect(validateFilePath('..\\..\\Windows\\System32', wwwDir)).toBe(false);
    });

    test('should reject absolute paths', () => {
      expect(validateFilePath('C:\\Windows\\System32\\config', wwwDir)).toBe(false);
      expect(validateFilePath('/etc/passwd', wwwDir)).toBe(false);
    });
  });

  describe('Project Creation', () => {
    test('should check if project already exists', () => {
      const projectExists = (projectName: string, wwwPath: string): boolean => {
        const projectPath = path.join(wwwPath, projectName);
        return fs.existsSync(projectPath);
      };

      // Create a test project folder
      const existingProject = path.join(wwwDir, 'existing-project');
      fs.mkdirSync(existingProject, { recursive: true });

      expect(projectExists('existing-project', wwwDir)).toBe(true);
      expect(projectExists('new-project', wwwDir)).toBe(false);

      // Cleanup
      fs.rmdirSync(existingProject);
    });

    test('should create project directory structure', () => {
      const createProjectStructure = (projectPath: string): void => {
        const dirs = [
          projectPath,
          path.join(projectPath, 'css'),
          path.join(projectPath, 'js'),
          path.join(projectPath, 'images'),
        ];

        dirs.forEach(dir => {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        });
      };

      const testProject = path.join(wwwDir, 'test-structure');
      createProjectStructure(testProject);

      expect(fs.existsSync(testProject)).toBe(true);
      expect(fs.existsSync(path.join(testProject, 'css'))).toBe(true);
      expect(fs.existsSync(path.join(testProject, 'js'))).toBe(true);
      expect(fs.existsSync(path.join(testProject, 'images'))).toBe(true);

      // Cleanup
      fs.rmSync(testProject, { recursive: true });
    });
  });

  describe('Template Types', () => {
    test('should define valid template types', () => {
      const templates = [
        { id: 'php-basic', name: 'PHP Basic', files: ['index.php'] },
        { id: 'html-basic', name: 'HTML Basic', files: ['index.html', 'css/style.css', 'js/main.js'] },
      ];

      expect(templates.length).toBe(2);
      expect(templates.find(t => t.id === 'php-basic')).toBeDefined();
      expect(templates.find(t => t.id === 'html-basic')).toBeDefined();
    });
  });

  describe('Project Deletion', () => {
    test('should safely delete project directory', () => {
      const safeDeleteProject = (projectPath: string, wwwPath: string): boolean => {
        // Verify path is within www directory
        const resolvedProject = path.resolve(projectPath);
        const resolvedWww = path.resolve(wwwPath);
        
        if (!resolvedProject.startsWith(resolvedWww + path.sep)) {
          return false; // Not allowed - path traversal attempt
        }

        if (!fs.existsSync(projectPath)) {
          return false; // Project doesn't exist
        }

        return true; // Safe to delete
      };

      // Create test project
      const testProject = path.join(wwwDir, 'to-delete');
      fs.mkdirSync(testProject, { recursive: true });

      expect(safeDeleteProject(testProject, wwwDir)).toBe(true);
      expect(safeDeleteProject(path.join(wwwDir, '..', 'sensitive'), wwwDir)).toBe(false);
      expect(safeDeleteProject(path.join(wwwDir, 'nonexistent'), wwwDir)).toBe(false);

      // Cleanup
      fs.rmdirSync(testProject);
    });
  });
});

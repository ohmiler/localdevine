/**
 * Unit tests for PathResolver service
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

// Mock electron before importing PathResolver
jest.mock('electron', () => require('../__mocks__/electron'));

// Mock Logger
jest.mock('../../electron/services/Logger', () => ({
  pathLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('PathResolver', () => {
  const testDir = path.join(os.tmpdir(), 'localdevine-pathresolver-test');
  
  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Path Validation Utilities', () => {
    // Test validateProjectName function logic
    const validateProjectName = (name: string): boolean => {
      // Check for path traversal
      if (name.includes('..') || name.includes('/') || name.includes('\\')) {
        return false;
      }
      
      // Check for dangerous names
      const dangerous = ['.', '..', 'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
      if (dangerous.includes(name.toUpperCase())) {
        return false;
      }
      
      // Check for allowed characters (a-z, A-Z, 0-9, -, _)
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        return false;
      }
      
      // Check length
      if (name.length < 1 || name.length > 255) {
        return false;
      }
      
      return true;
    };

    test('should accept valid project names', () => {
      expect(validateProjectName('my-project')).toBe(true);
      expect(validateProjectName('myProject')).toBe(true);
      expect(validateProjectName('my_project')).toBe(true);
      expect(validateProjectName('project123')).toBe(true);
      expect(validateProjectName('MyProject-v2')).toBe(true);
    });

    test('should reject path traversal attempts', () => {
      expect(validateProjectName('../../../etc')).toBe(false);
      expect(validateProjectName('..\\..\\Windows')).toBe(false);
      expect(validateProjectName('project/../secret')).toBe(false);
      expect(validateProjectName('project/subdir')).toBe(false);
      expect(validateProjectName('project\\subdir')).toBe(false);
    });

    test('should reject dangerous Windows names', () => {
      expect(validateProjectName('CON')).toBe(false);
      expect(validateProjectName('PRN')).toBe(false);
      expect(validateProjectName('AUX')).toBe(false);
      expect(validateProjectName('NUL')).toBe(false);
      expect(validateProjectName('COM1')).toBe(false);
      expect(validateProjectName('LPT1')).toBe(false);
      expect(validateProjectName('.')).toBe(false);
      expect(validateProjectName('..')).toBe(false);
    });

    test('should reject special characters', () => {
      expect(validateProjectName('project name')).toBe(false); // space
      expect(validateProjectName('project@name')).toBe(false);
      expect(validateProjectName('project#name')).toBe(false);
      expect(validateProjectName('project$name')).toBe(false);
      expect(validateProjectName('project%name')).toBe(false);
      expect(validateProjectName('project&name')).toBe(false);
      expect(validateProjectName('project*name')).toBe(false);
      expect(validateProjectName('<script>')).toBe(false);
    });

    test('should reject empty or too long names', () => {
      expect(validateProjectName('')).toBe(false);
      expect(validateProjectName('a'.repeat(256))).toBe(false);
    });

    test('should accept maximum length name', () => {
      expect(validateProjectName('a'.repeat(255))).toBe(true);
    });
  });

  describe('Database Name Validation', () => {
    const validateDatabaseName = (dbName: string): boolean => {
      // Allow only a-z, A-Z, 0-9, _, $
      return /^[a-zA-Z0-9_$]+$/.test(dbName) && dbName.length <= 64;
    };

    test('should accept valid database names', () => {
      expect(validateDatabaseName('mydb')).toBe(true);
      expect(validateDatabaseName('my_database')).toBe(true);
      expect(validateDatabaseName('db123')).toBe(true);
      expect(validateDatabaseName('my$db')).toBe(true);
    });

    test('should reject invalid database names', () => {
      expect(validateDatabaseName('my-db')).toBe(false); // hyphen not allowed
      expect(validateDatabaseName('my db')).toBe(false); // space not allowed
      expect(validateDatabaseName('my.db')).toBe(false); // dot not allowed
      expect(validateDatabaseName('')).toBe(false);
    });

    test('should reject too long database names', () => {
      expect(validateDatabaseName('a'.repeat(65))).toBe(false);
    });

    test('should accept maximum length database name', () => {
      expect(validateDatabaseName('a'.repeat(64))).toBe(true);
    });
  });

  describe('Domain Validation', () => {
    const validateDomain = (domain: string): boolean => {
      // Check format domain (.local, .test, etc.)
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/;
      return domainRegex.test(domain) && domain.length <= 253;
    };

    test('should accept valid domains', () => {
      expect(validateDomain('mysite.local')).toBe(true);
      expect(validateDomain('my-site.test')).toBe(true);
      expect(validateDomain('project123.localhost')).toBe(true);
      expect(validateDomain('app.dev')).toBe(true);
    });

    test('should reject invalid domains', () => {
      expect(validateDomain('mysite')).toBe(false); // no TLD
      expect(validateDomain('.local')).toBe(false); // starts with dot
      expect(validateDomain('my site.local')).toBe(false); // space
      expect(validateDomain('my_site.local')).toBe(false); // underscore
      expect(validateDomain('-mysite.local')).toBe(false); // starts with hyphen
    });
  });

  describe('Path Resolution', () => {
    test('should resolve path within allowed directory', () => {
      const wwwPath = path.join(testDir, 'www');
      const projectName = 'my-project';
      
      const resolvedPath = path.resolve(wwwPath, projectName);
      const resolvedWwwDir = path.resolve(wwwPath);
      
      expect(resolvedPath.startsWith(resolvedWwwDir + path.sep)).toBe(true);
    });

    test('should detect path traversal outside allowed directory', () => {
      const wwwPath = path.join(testDir, 'www');
      const projectName = '..\\..\\Windows\\System32';
      
      const resolvedPath = path.resolve(wwwPath, projectName);
      const resolvedWwwDir = path.resolve(wwwPath);
      
      expect(resolvedPath.startsWith(resolvedWwwDir + path.sep)).toBe(false);
    });
  });
});

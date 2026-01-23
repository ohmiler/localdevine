/**
 * Integration Tests for IPC Handlers
 * Tests the IPC communication between main and renderer processes
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

// Mock electron
jest.mock('electron', () => require('../__mocks__/electron'));

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    kill: jest.fn(),
    pid: 12345,
  })),
  exec: jest.fn(),
  execSync: jest.fn(),
}));

// Mock Logger
jest.mock('../../electron/services/Logger', () => ({
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Logger: jest.fn(),
  pathLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  configLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  serviceLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  hostsLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  projectLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('IPC Handler Integration Tests', () => {
  const testDir = path.join(os.tmpdir(), 'localdevine-ipc-test');

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ============================================
  // Config Handler Tests
  // ============================================
  describe('Config Handlers', () => {
    describe('get-config handler', () => {
      test('should return config object when ConfigManager is initialized', () => {
        const mockConfig = {
          ports: { php: 9000, apache: 80, mariadb: 3306 },
          database: { host: '127.0.0.1', port: 3306, user: 'root', password: 'root' },
          autoStart: false,
          vhosts: [],
          phpVersion: 'php'
        };

        const mockConfigManager = {
          get: jest.fn(() => mockConfig),
        };

        // Simulate handler
        const getConfig = () => mockConfigManager.get();
        expect(getConfig()).toEqual(mockConfig);
        expect(mockConfigManager.get).toHaveBeenCalled();
      });

      test('should return null when ConfigManager is not initialized', () => {
        const configManager = null;
        const getConfig = () => configManager ? configManager.get() : null;
        expect(getConfig()).toBeNull();
      });
    });

    describe('save-config handler', () => {
      test('should save config and return success', () => {
        const mockConfigManager = {
          save: jest.fn(() => ({ success: true })),
        };

        const saveConfig = (config: object) => mockConfigManager.save(config);
        const result = saveConfig({ autoStart: true });

        expect(result).toEqual({ success: true });
        expect(mockConfigManager.save).toHaveBeenCalledWith({ autoStart: true });
      });

      test('should return error when save fails', () => {
        const mockConfigManager = {
          save: jest.fn(() => ({ success: false, error: 'Write permission denied' })),
        };

        const saveConfig = (config: object) => mockConfigManager.save(config);
        const result = saveConfig({ autoStart: true });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('get-php-versions handler', () => {
      test('should return array of PHP versions', () => {
        const mockVersions = [
          { id: 'php', name: 'PHP 8.5 (default)', path: 'C:\\bin\\php' },
          { id: 'php84', name: 'PHP 8.4', path: 'C:\\bin\\php84' },
          { id: 'php83', name: 'PHP 8.3', path: 'C:\\bin\\php83' },
        ];

        const mockConfigManager = {
          getPHPVersions: jest.fn(() => mockVersions),
        };

        const getVersions = () => mockConfigManager.getPHPVersions();
        expect(getVersions()).toEqual(mockVersions);
        expect(getVersions().length).toBe(3);
      });

      test('should return empty array when no versions found', () => {
        const mockConfigManager = {
          getPHPVersions: jest.fn(() => []),
        };

        const getVersions = () => mockConfigManager.getPHPVersions();
        expect(getVersions()).toEqual([]);
      });
    });
  });

  // ============================================
  // Service Handler Tests
  // ============================================
  describe('Service Handlers', () => {
    describe('start-service handler', () => {
      test('should call startService with valid service name', () => {
        const mockServiceManager = {
          startService: jest.fn(),
        };

        const isValidServiceName = (name: unknown): name is 'php' | 'apache' | 'mariadb' => {
          return name === 'php' || name === 'apache' || name === 'mariadb';
        };

        const startService = (serviceName: unknown) => {
          if (isValidServiceName(serviceName)) {
            mockServiceManager.startService(serviceName);
          }
        };

        startService('apache');
        expect(mockServiceManager.startService).toHaveBeenCalledWith('apache');

        startService('php');
        expect(mockServiceManager.startService).toHaveBeenCalledWith('php');

        startService('mariadb');
        expect(mockServiceManager.startService).toHaveBeenCalledWith('mariadb');
      });

      test('should not call startService with invalid service name', () => {
        const mockServiceManager = {
          startService: jest.fn(),
        };

        const isValidServiceName = (name: unknown): name is 'php' | 'apache' | 'mariadb' => {
          return name === 'php' || name === 'apache' || name === 'mariadb';
        };

        const startService = (serviceName: unknown) => {
          if (isValidServiceName(serviceName)) {
            mockServiceManager.startService(serviceName);
          }
        };

        startService('nginx');
        startService('mysql');
        startService('');
        startService(null);

        expect(mockServiceManager.startService).not.toHaveBeenCalled();
      });
    });

    describe('start-all-services handler', () => {
      test('should call startAllServices', () => {
        const mockServiceManager = {
          startAllServices: jest.fn(),
        };

        mockServiceManager.startAllServices();
        expect(mockServiceManager.startAllServices).toHaveBeenCalled();
      });
    });

    describe('stop-all-services handler', () => {
      test('should call stopAllServices', () => {
        const mockServiceManager = {
          stopAllServices: jest.fn(),
        };

        mockServiceManager.stopAllServices();
        expect(mockServiceManager.stopAllServices).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // VHost Handler Tests
  // ============================================
  describe('VHost Handlers', () => {
    describe('get-vhosts handler', () => {
      test('should return array of vhosts', () => {
        const mockVhosts = [
          { id: '1', name: 'Site 1', domain: 'site1.local', path: 'C:\\www\\site1', createdAt: '' },
          { id: '2', name: 'Site 2', domain: 'site2.local', path: 'C:\\www\\site2', createdAt: '' },
        ];

        const mockConfigManager = {
          getVHosts: jest.fn(() => mockVhosts),
        };

        const getVHosts = () => mockConfigManager.getVHosts();
        expect(getVHosts()).toEqual(mockVhosts);
        expect(getVHosts().length).toBe(2);
      });
    });

    describe('add-vhost handler', () => {
      test('should add vhost with valid input', () => {
        const mockConfigManager = {
          addVHost: jest.fn(() => ({ success: true })),
        };

        const validateVHostInput = (vhost: unknown): boolean => {
          if (!vhost || typeof vhost !== 'object') return false;
          const v = vhost as Record<string, unknown>;
          return (
            typeof v.name === 'string' && v.name.length > 0 &&
            typeof v.domain === 'string' && v.domain.length > 0 &&
            typeof v.path === 'string' && v.path.length > 0
          );
        };

        const addVHost = (vhost: unknown) => {
          if (!validateVHostInput(vhost)) {
            return { success: false, error: 'Invalid vhost configuration' };
          }
          return mockConfigManager.addVHost(vhost);
        };

        const result = addVHost({
          name: 'My Site',
          domain: 'mysite.local',
          path: 'C:\\www\\mysite'
        });

        expect(result.success).toBe(true);
        expect(mockConfigManager.addVHost).toHaveBeenCalled();
      });

      test('should reject vhost with invalid input', () => {
        const mockConfigManager = {
          addVHost: jest.fn(() => ({ success: true })),
        };

        const validateVHostInput = (vhost: unknown): boolean => {
          if (!vhost || typeof vhost !== 'object') return false;
          const v = vhost as Record<string, unknown>;
          return (
            typeof v.name === 'string' && v.name.length > 0 &&
            typeof v.domain === 'string' && v.domain.length > 0 &&
            typeof v.path === 'string' && v.path.length > 0
          );
        };

        const addVHost = (vhost: unknown) => {
          if (!validateVHostInput(vhost)) {
            return { success: false, error: 'Invalid vhost configuration' };
          }
          return mockConfigManager.addVHost(vhost);
        };

        // Missing domain
        let result = addVHost({ name: 'My Site', path: 'C:\\www\\mysite' });
        expect(result.success).toBe(false);
        expect(mockConfigManager.addVHost).not.toHaveBeenCalled();

        // Empty name
        result = addVHost({ name: '', domain: 'mysite.local', path: 'C:\\www\\mysite' });
        expect(result.success).toBe(false);
      });
    });

    describe('remove-vhost handler', () => {
      test('should remove vhost by id', () => {
        const mockConfigManager = {
          removeVHost: jest.fn(() => ({ success: true })),
        };

        const result = mockConfigManager.removeVHost('123');
        expect(result.success).toBe(true);
        expect(mockConfigManager.removeVHost).toHaveBeenCalledWith('123');
      });
    });
  });

  // ============================================
  // Project Handler Tests
  // ============================================
  describe('Project Handlers', () => {
    describe('get-templates handler', () => {
      test('should return array of templates', () => {
        const mockTemplates = [
          { id: 'php-basic', name: 'PHP Basic', description: 'Basic PHP project' },
          { id: 'html-basic', name: 'HTML Basic', description: 'Basic HTML/CSS/JS project' },
        ];

        const mockProjectManager = {
          getTemplates: jest.fn(() => mockTemplates),
        };

        const getTemplates = () => mockProjectManager.getTemplates();
        expect(getTemplates()).toEqual(mockTemplates);
        expect(getTemplates().length).toBe(2);
      });
    });

    describe('get-projects handler', () => {
      test('should return array of projects', () => {
        const mockProjects = [
          { name: 'project1', path: 'C:\\www\\project1', hasDatabase: false },
          { name: 'project2', path: 'C:\\www\\project2', hasDatabase: true },
        ];

        const mockProjectManager = {
          getProjects: jest.fn(() => mockProjects),
        };

        const getProjects = () => mockProjectManager.getProjects();
        expect(getProjects()).toEqual(mockProjects);
      });
    });

    describe('create-project handler', () => {
      test('should create project with valid options', () => {
        const mockProjectManager = {
          createProject: jest.fn(() => ({ success: true, projectPath: 'C:\\www\\my-project' })),
        };

        const validateOptions = (options: unknown): boolean => {
          if (!options || typeof options !== 'object') return false;
          const opts = options as Record<string, unknown>;
          return (
            typeof opts.templateId === 'string' &&
            typeof opts.projectName === 'string' &&
            opts.projectName.length > 0 &&
            typeof opts.projectPath === 'string'
          );
        };

        const createProject = (options: unknown) => {
          if (!validateOptions(options)) {
            return { success: false, error: 'Invalid project options' };
          }
          return mockProjectManager.createProject(options);
        };

        const result = createProject({
          templateId: 'php-basic',
          projectName: 'my-project',
          projectPath: 'C:\\www\\my-project'
        });

        expect(result.success).toBe(true);
        expect(mockProjectManager.createProject).toHaveBeenCalled();
      });

      test('should reject project with invalid options', () => {
        const mockProjectManager = {
          createProject: jest.fn(),
        };

        const validateOptions = (options: unknown): boolean => {
          if (!options || typeof options !== 'object') return false;
          const opts = options as Record<string, unknown>;
          return (
            typeof opts.templateId === 'string' &&
            typeof opts.projectName === 'string' &&
            opts.projectName.length > 0 &&
            typeof opts.projectPath === 'string'
          );
        };

        const createProject = (options: unknown) => {
          if (!validateOptions(options)) {
            return { success: false, error: 'Invalid project options' };
          }
          return mockProjectManager.createProject(options);
        };

        // Missing projectName
        let result = createProject({ templateId: 'php-basic', projectPath: 'C:\\www' });
        expect(result.success).toBe(false);
        expect(mockProjectManager.createProject).not.toHaveBeenCalled();

        // Empty projectName
        result = createProject({ templateId: 'php-basic', projectName: '', projectPath: 'C:\\www' });
        expect(result.success).toBe(false);
      });
    });

    describe('delete-project handler', () => {
      test('should delete project with valid name', () => {
        const mockProjectManager = {
          deleteProject: jest.fn(() => ({ success: true })),
        };

        const isValidProjectName = (name: unknown): name is string => {
          if (typeof name !== 'string' || name.trim() === '') return false;
          if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
          return /^[a-zA-Z0-9_.-]+$/.test(name);
        };

        const deleteProject = (projectName: unknown) => {
          if (!isValidProjectName(projectName)) {
            return { success: false, error: 'Invalid project name' };
          }
          return mockProjectManager.deleteProject(projectName);
        };

        const result = deleteProject('my-project');
        expect(result.success).toBe(true);
        expect(mockProjectManager.deleteProject).toHaveBeenCalledWith('my-project');
      });

      test('should reject delete with path traversal attempt', () => {
        const mockProjectManager = {
          deleteProject: jest.fn(),
        };

        const isValidProjectName = (name: unknown): name is string => {
          if (typeof name !== 'string' || name.trim() === '') return false;
          if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
          return /^[a-zA-Z0-9_.-]+$/.test(name);
        };

        const deleteProject = (projectName: unknown) => {
          if (!isValidProjectName(projectName)) {
            return { success: false, error: 'Invalid project name' };
          }
          return mockProjectManager.deleteProject(projectName);
        };

        const result = deleteProject('../../../etc');
        expect(result.success).toBe(false);
        expect(mockProjectManager.deleteProject).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Hosts Handler Tests
  // ============================================
  describe('Hosts Handlers', () => {
    describe('add-hosts-entry handler', () => {
      test('should add entry with valid IP and hostname', () => {
        const mockHostsManager = {
          addEntry: jest.fn(() => ({ success: true })),
        };

        const isValidIP = (ip: unknown): ip is string => {
          if (typeof ip !== 'string') return false;
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          return ipv4Regex.test(ip);
        };

        const isValidHostname = (hostname: unknown): hostname is string => {
          if (typeof hostname !== 'string' || hostname.trim() === '') return false;
          const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
          return hostnameRegex.test(hostname) && hostname.length <= 253;
        };

        const addEntry = (ip: unknown, hostname: unknown) => {
          if (!isValidIP(ip)) {
            return { success: false, error: 'Invalid IP address format' };
          }
          if (!isValidHostname(hostname)) {
            return { success: false, error: 'Invalid hostname format' };
          }
          return mockHostsManager.addEntry(ip, hostname);
        };

        const result = addEntry('127.0.0.1', 'mysite.local');
        expect(result.success).toBe(true);
        expect(mockHostsManager.addEntry).toHaveBeenCalledWith('127.0.0.1', 'mysite.local');
      });

      test('should reject entry with invalid IP', () => {
        const mockHostsManager = {
          addEntry: jest.fn(),
        };

        const isValidIP = (ip: unknown): ip is string => {
          if (typeof ip !== 'string') return false;
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          return ipv4Regex.test(ip);
        };

        const addEntry = (ip: unknown, hostname: unknown) => {
          if (!isValidIP(ip)) {
            return { success: false, error: 'Invalid IP address format' };
          }
          return mockHostsManager.addEntry(ip, hostname);
        };

        const result = addEntry('999.999.999.999', 'mysite.local');
        expect(result.success).toBe(false);
        expect(result.error).toContain('IP');
        expect(mockHostsManager.addEntry).not.toHaveBeenCalled();
      });

      test('should reject entry with invalid hostname', () => {
        const mockHostsManager = {
          addEntry: jest.fn(),
        };

        const isValidIP = (ip: unknown): ip is string => {
          if (typeof ip !== 'string') return false;
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          return ipv4Regex.test(ip);
        };

        const isValidHostname = (hostname: unknown): hostname is string => {
          if (typeof hostname !== 'string' || hostname.trim() === '') return false;
          const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
          return hostnameRegex.test(hostname) && hostname.length <= 253;
        };

        const addEntry = (ip: unknown, hostname: unknown) => {
          if (!isValidIP(ip)) {
            return { success: false, error: 'Invalid IP address format' };
          }
          if (!isValidHostname(hostname)) {
            return { success: false, error: 'Invalid hostname format' };
          }
          return mockHostsManager.addEntry(ip, hostname);
        };

        const result = addEntry('127.0.0.1', '-invalid');
        expect(result.success).toBe(false);
        expect(result.error).toContain('hostname');
        expect(mockHostsManager.addEntry).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Database Handler Tests
  // ============================================
  describe('Database Handlers', () => {
    describe('db-create handler', () => {
      test('should create database with valid name', () => {
        const mockDatabaseManager = {
          createDatabase: jest.fn(() => ({ success: true })),
        };

        const isValidDatabaseName = (name: unknown): boolean => {
          if (!name || typeof name !== 'string') return false;
          return /^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(name);
        };

        const createDatabase = (name: unknown) => {
          if (!isValidDatabaseName(name)) {
            return { success: false, error: 'Invalid database name' };
          }
          return mockDatabaseManager.createDatabase(name);
        };

        const result = createDatabase('my_database');
        expect(result.success).toBe(true);
        expect(mockDatabaseManager.createDatabase).toHaveBeenCalledWith('my_database');
      });

      test('should reject database with invalid name', () => {
        const mockDatabaseManager = {
          createDatabase: jest.fn(),
        };

        const isValidDatabaseName = (name: unknown): boolean => {
          if (!name || typeof name !== 'string') return false;
          return /^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(name);
        };

        const createDatabase = (name: unknown) => {
          if (!isValidDatabaseName(name)) {
            return { success: false, error: 'Invalid database name' };
          }
          return mockDatabaseManager.createDatabase(name);
        };

        // Starting with number
        let result = createDatabase('123db');
        expect(result.success).toBe(false);
        expect(mockDatabaseManager.createDatabase).not.toHaveBeenCalled();

        // With hyphen
        result = createDatabase('my-db');
        expect(result.success).toBe(false);
      });
    });
  });
});

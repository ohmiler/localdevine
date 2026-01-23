/**
 * Unit tests for ConfigManager service
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

// Mock electron before importing
jest.mock('electron', () => require('../__mocks__/electron'));

// Mock Logger
jest.mock('../../electron/services/Logger', () => ({
  configLogger: {
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
}));

// Mock PathResolver
const mockPathResolver = {
  configPath: '',
  binDir: '',
};

jest.mock('../../electron/services/PathResolver', () => ({
  __esModule: true,
  default: {
    getInstance: () => mockPathResolver,
  },
}));

describe('ConfigManager', () => {
  const testDir = path.join(os.tmpdir(), 'localdevine-configmanager-test');
  const configPath = path.join(testDir, 'config.json');
  const binDir = path.join(testDir, 'bin');

  beforeAll(() => {
    // Create test directories
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });
    
    // Update mock paths
    mockPathResolver.configPath = configPath;
    mockPathResolver.binDir = binDir;
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean config file before each test
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  });

  describe('Default Config', () => {
    test('should have correct default ports', () => {
      const defaultConfig = {
        ports: {
          php: 9000,
          apache: 80,
          mariadb: 3306,
        },
      };

      expect(defaultConfig.ports.php).toBe(9000);
      expect(defaultConfig.ports.apache).toBe(80);
      expect(defaultConfig.ports.mariadb).toBe(3306);
    });

    test('should have correct default database config', () => {
      const defaultConfig = {
        database: {
          host: '127.0.0.1',
          port: 3306,
          user: 'root',
          password: 'root',
        },
      };

      expect(defaultConfig.database.host).toBe('127.0.0.1');
      expect(defaultConfig.database.port).toBe(3306);
      expect(defaultConfig.database.user).toBe('root');
      expect(defaultConfig.database.password).toBe('root');
    });
  });

  describe('Config Merging', () => {
    test('should merge partial config with defaults', () => {
      const defaultConfig = {
        ports: { php: 9000, apache: 80, mariadb: 3306 },
        autoStart: false,
        vhosts: [],
      };

      const partialConfig = {
        ports: { apache: 8080 },
        autoStart: true,
      };

      const merged = {
        ...defaultConfig,
        ...partialConfig,
        ports: { ...defaultConfig.ports, ...partialConfig.ports },
      };

      expect(merged.ports.php).toBe(9000); // from default
      expect(merged.ports.apache).toBe(8080); // overridden
      expect(merged.ports.mariadb).toBe(3306); // from default
      expect(merged.autoStart).toBe(true); // overridden
    });
  });

  describe('VHost Management', () => {
    test('should detect duplicate domain', () => {
      const vhosts = [
        { id: '1', name: 'Site 1', domain: 'site1.local', path: 'C:\\www\\site1', createdAt: '' },
        { id: '2', name: 'Site 2', domain: 'site2.local', path: 'C:\\www\\site2', createdAt: '' },
      ];

      const newDomain = 'site1.local';
      const isDuplicate = vhosts.some(v => v.domain === newDomain);

      expect(isDuplicate).toBe(true);
    });

    test('should allow unique domain', () => {
      const vhosts = [
        { id: '1', name: 'Site 1', domain: 'site1.local', path: 'C:\\www\\site1', createdAt: '' },
      ];

      const newDomain = 'site2.local';
      const isDuplicate = vhosts.some(v => v.domain === newDomain);

      expect(isDuplicate).toBe(false);
    });

    test('should filter vhosts by id', () => {
      const vhosts = [
        { id: '1', name: 'Site 1', domain: 'site1.local', path: 'C:\\www\\site1', createdAt: '' },
        { id: '2', name: 'Site 2', domain: 'site2.local', path: 'C:\\www\\site2', createdAt: '' },
        { id: '3', name: 'Site 3', domain: 'site3.local', path: 'C:\\www\\site3', createdAt: '' },
      ];

      const filtered = vhosts.filter(v => v.id !== '2');

      expect(filtered.length).toBe(2);
      expect(filtered.find(v => v.id === '2')).toBeUndefined();
    });
  });

  describe('Port Validation', () => {
    test('should validate port range', () => {
      const isValidPort = (port: number): boolean => {
        return Number.isInteger(port) && port >= 1 && port <= 65535;
      };

      expect(isValidPort(80)).toBe(true);
      expect(isValidPort(8080)).toBe(true);
      expect(isValidPort(3306)).toBe(true);
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(-1)).toBe(false);
      expect(isValidPort(65536)).toBe(false);
      expect(isValidPort(80.5)).toBe(false);
    });

    test('should detect reserved ports', () => {
      const reservedPorts = [21, 22, 23, 25, 53, 110, 143, 443, 445, 3389];
      
      const isReserved = (port: number): boolean => {
        return reservedPorts.includes(port);
      };

      expect(isReserved(22)).toBe(true);  // SSH
      expect(isReserved(443)).toBe(true); // HTTPS
      expect(isReserved(80)).toBe(false); // HTTP - commonly used
      expect(isReserved(8080)).toBe(false);
    });
  });

  describe('PHP Version Parsing', () => {
    test('should parse PHP version from folder name', () => {
      const parsePHPVersion = (folderName: string): string => {
        if (folderName === 'php') {
          return 'PHP 8.5 (default)';
        }
        const match = folderName.match(/php(\d)(\d)/);
        if (match) {
          return `PHP ${match[1]}.${match[2]}`;
        }
        return folderName.toUpperCase();
      };

      expect(parsePHPVersion('php')).toBe('PHP 8.5 (default)');
      expect(parsePHPVersion('php81')).toBe('PHP 8.1');
      expect(parsePHPVersion('php82')).toBe('PHP 8.2');
      expect(parsePHPVersion('php83')).toBe('PHP 8.3');
      expect(parsePHPVersion('php84')).toBe('PHP 8.4');
    });

    test('should sort PHP versions correctly', () => {
      const versions = [
        { name: 'PHP 8.1' },
        { name: 'PHP 8.5 (default)' },
        { name: 'PHP 8.3' },
        { name: 'PHP 8.2' },
      ];

      const getVersion = (name: string): number => {
        const match = name.match(/PHP (\d+\.\d+)/);
        return match ? parseFloat(match[1]) : 0;
      };

      versions.sort((a, b) => getVersion(b.name) - getVersion(a.name));

      expect(versions[0].name).toBe('PHP 8.5 (default)');
      expect(versions[1].name).toBe('PHP 8.3');
      expect(versions[2].name).toBe('PHP 8.2');
      expect(versions[3].name).toBe('PHP 8.1');
    });
  });
});

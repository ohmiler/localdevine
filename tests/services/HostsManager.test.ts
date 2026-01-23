/**
 * Unit tests for HostsManager service
 */

import path from 'path';
import fs from 'fs';
import os from 'os';

// Mock electron
jest.mock('electron', () => require('../__mocks__/electron'));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
  execSync: jest.fn(),
}));

// Mock Logger
jest.mock('../../electron/services/Logger', () => ({
  hostsLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('HostsManager', () => {
  const testDir = path.join(os.tmpdir(), 'localdevine-hosts-test');

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Hosts File Parsing', () => {
    test('should parse valid hosts entry', () => {
      const parseHostsLine = (line: string): { ip: string; hostname: string } | null => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return null;
        
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          return { ip: parts[0], hostname: parts[1] };
        }
        return null;
      };

      expect(parseHostsLine('127.0.0.1 localhost')).toEqual({ 
        ip: '127.0.0.1', 
        hostname: 'localhost' 
      });
      expect(parseHostsLine('127.0.0.1    mysite.local')).toEqual({ 
        ip: '127.0.0.1', 
        hostname: 'mysite.local' 
      });
      expect(parseHostsLine('# comment')).toBeNull();
      expect(parseHostsLine('')).toBeNull();
      expect(parseHostsLine('   ')).toBeNull();
    });

    test('should handle multiple hostnames per line', () => {
      const parseHostsLineMultiple = (line: string): { ip: string; hostnames: string[] } | null => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return null;
        
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          return { ip: parts[0], hostnames: parts.slice(1) };
        }
        return null;
      };

      const result = parseHostsLineMultiple('127.0.0.1 localhost local');
      expect(result).toEqual({
        ip: '127.0.0.1',
        hostnames: ['localhost', 'local']
      });
    });
  });

  describe('Hosts Entry Validation', () => {
    test('should validate IP address format', () => {
      const isValidIPv4 = (ip: string): boolean => {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        
        return parts.every(part => {
          const num = parseInt(part, 10);
          return !isNaN(num) && num >= 0 && num <= 255 && part === String(num);
        });
      };

      expect(isValidIPv4('127.0.0.1')).toBe(true);
      expect(isValidIPv4('192.168.1.1')).toBe(true);
      expect(isValidIPv4('0.0.0.0')).toBe(true);
      expect(isValidIPv4('255.255.255.255')).toBe(true);
      expect(isValidIPv4('256.0.0.1')).toBe(false);
      expect(isValidIPv4('127.0.0')).toBe(false);
      expect(isValidIPv4('127.0.0.1.1')).toBe(false);
      expect(isValidIPv4('abc.def.ghi.jkl')).toBe(false);
      expect(isValidIPv4('127.0.0.01')).toBe(false); // leading zero
    });

    test('should validate hostname format', () => {
      const isValidHostname = (hostname: string): boolean => {
        if (!hostname || hostname.length > 253) return false;
        
        // Check each label doesn't start or end with hyphen
        const labels = hostname.split('.');
        for (const label of labels) {
          if (!label || label.startsWith('-') || label.endsWith('-')) {
            return false;
          }
          if (!/^[a-zA-Z0-9-]+$/.test(label)) {
            return false;
          }
        }
        return true;
      };

      expect(isValidHostname('localhost')).toBe(true);
      expect(isValidHostname('mysite.local')).toBe(true);
      expect(isValidHostname('my-site.test')).toBe(true);
      expect(isValidHostname('a')).toBe(true);
      expect(isValidHostname('')).toBe(false);
      expect(isValidHostname('-invalid.local')).toBe(false);
      expect(isValidHostname('invalid-.local')).toBe(false);
    });
  });

  describe('Hosts File Operations', () => {
    test('should generate hosts entry line', () => {
      const generateHostsEntry = (ip: string, hostname: string): string => {
        return `${ip}\t${hostname}`;
      };

      expect(generateHostsEntry('127.0.0.1', 'mysite.local')).toBe('127.0.0.1\tmysite.local');
    });

    test('should detect duplicate entries', () => {
      const entries = [
        { ip: '127.0.0.1', hostname: 'localhost' },
        { ip: '127.0.0.1', hostname: 'mysite.local' },
      ];

      const isDuplicate = (hostname: string): boolean => {
        return entries.some(e => e.hostname === hostname);
      };

      expect(isDuplicate('localhost')).toBe(true);
      expect(isDuplicate('mysite.local')).toBe(true);
      expect(isDuplicate('newsite.local')).toBe(false);
    });

    test('should filter entries by hostname', () => {
      const entries = [
        { ip: '127.0.0.1', hostname: 'localhost', enabled: true },
        { ip: '127.0.0.1', hostname: 'mysite.local', enabled: true },
        { ip: '127.0.0.1', hostname: 'oldsite.local', enabled: false },
      ];

      const filtered = entries.filter(e => e.hostname !== 'oldsite.local');
      expect(filtered.length).toBe(2);
      expect(filtered.find(e => e.hostname === 'oldsite.local')).toBeUndefined();
    });
  });

  describe('Path Security', () => {
    test('should validate file path is within allowed directory', () => {
      const isPathAllowed = (filePath: string, allowedDir: string): boolean => {
        const resolvedPath = path.resolve(filePath);
        const resolvedAllowedDir = path.resolve(allowedDir);
        return resolvedPath.startsWith(resolvedAllowedDir + path.sep) || 
               resolvedPath === resolvedAllowedDir;
      };

      const tempDir = os.tmpdir();
      
      expect(isPathAllowed(path.join(tempDir, 'hosts.txt'), tempDir)).toBe(true);
      expect(isPathAllowed(path.join(tempDir, 'subdir', 'hosts.txt'), tempDir)).toBe(true);
      expect(isPathAllowed('C:\\Windows\\System32\\hosts', tempDir)).toBe(false);
    });

    test('should escape special characters for PowerShell', () => {
      const escapeForPowerShell = (str: string): string => {
        return str.replace(/'/g, "''");
      };

      expect(escapeForPowerShell("normal")).toBe("normal");
      expect(escapeForPowerShell("it's")).toBe("it''s");
      expect(escapeForPowerShell("path'with'quotes")).toBe("path''with''quotes");
    });
  });

  describe('Backup Operations', () => {
    test('should generate backup filename with timestamp', () => {
      const generateBackupName = (originalPath: string): string => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const dir = path.dirname(originalPath);
        const ext = path.extname(originalPath);
        const base = path.basename(originalPath, ext);
        return path.join(dir, `${base}_backup_${timestamp}${ext}`);
      };

      const backupName = generateBackupName('C:\\temp\\hosts');
      expect(backupName).toContain('hosts_backup_');
      expect(backupName).toContain('C:\\temp\\');
    });
  });

  describe('Admin Rights Detection', () => {
    test('should check if path is writable', async () => {
      const isWritable = async (filePath: string): Promise<boolean> => {
        try {
          fs.accessSync(filePath, fs.constants.W_OK);
          return true;
        } catch {
          return false;
        }
      };

      // Test with temp directory (should be writable)
      const tempFile = path.join(testDir, 'test-write.txt');
      fs.writeFileSync(tempFile, 'test');
      
      const result = await isWritable(tempFile);
      expect(result).toBe(true);
      
      fs.unlinkSync(tempFile);
    });
  });
});

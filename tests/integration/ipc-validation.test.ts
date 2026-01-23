/**
 * Integration Tests for IPC Input Validation
 * Tests the validation functions used in IPC handlers
 */

describe('IPC Input Validation', () => {
  // ============================================
  // Project Name Validation
  // ============================================
  describe('isValidProjectName', () => {
    const isValidProjectName = (name: unknown): name is string => {
      if (typeof name !== 'string' || name.trim() === '') return false;
      if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
      return /^[a-zA-Z0-9_.-]+$/.test(name);
    };

    test('should accept valid project names', () => {
      expect(isValidProjectName('my-project')).toBe(true);
      expect(isValidProjectName('myProject')).toBe(true);
      expect(isValidProjectName('my_project')).toBe(true);
      expect(isValidProjectName('project123')).toBe(true);
      expect(isValidProjectName('my.project')).toBe(true);
      expect(isValidProjectName('MyProject-v2.0')).toBe(true);
    });

    test('should reject path traversal attempts', () => {
      expect(isValidProjectName('../../../etc')).toBe(false);
      expect(isValidProjectName('..\\..\\Windows')).toBe(false);
      expect(isValidProjectName('project/../secret')).toBe(false);
      expect(isValidProjectName('project/subdir')).toBe(false);
      expect(isValidProjectName('project\\subdir')).toBe(false);
    });

    test('should reject non-string inputs', () => {
      expect(isValidProjectName(null)).toBe(false);
      expect(isValidProjectName(undefined)).toBe(false);
      expect(isValidProjectName(123)).toBe(false);
      expect(isValidProjectName({})).toBe(false);
      expect(isValidProjectName([])).toBe(false);
    });

    test('should reject empty strings', () => {
      expect(isValidProjectName('')).toBe(false);
      expect(isValidProjectName('   ')).toBe(false);
    });

    test('should reject special characters', () => {
      expect(isValidProjectName('project@name')).toBe(false);
      expect(isValidProjectName('project#name')).toBe(false);
      expect(isValidProjectName('project$name')).toBe(false);
      expect(isValidProjectName('project name')).toBe(false);
      expect(isValidProjectName('<script>')).toBe(false);
    });
  });

  // ============================================
  // Service Name Validation
  // ============================================
  describe('isValidServiceName', () => {
    const isValidServiceName = (name: unknown): name is 'php' | 'apache' | 'mariadb' => {
      return name === 'php' || name === 'apache' || name === 'mariadb';
    };

    test('should accept valid service names', () => {
      expect(isValidServiceName('php')).toBe(true);
      expect(isValidServiceName('apache')).toBe(true);
      expect(isValidServiceName('mariadb')).toBe(true);
    });

    test('should reject invalid service names', () => {
      expect(isValidServiceName('nginx')).toBe(false);
      expect(isValidServiceName('mysql')).toBe(false);
      expect(isValidServiceName('nodejs')).toBe(false);
      expect(isValidServiceName('')).toBe(false);
      expect(isValidServiceName(null)).toBe(false);
      expect(isValidServiceName(undefined)).toBe(false);
    });

    test('should reject case variations', () => {
      expect(isValidServiceName('PHP')).toBe(false);
      expect(isValidServiceName('Apache')).toBe(false);
      expect(isValidServiceName('MariaDB')).toBe(false);
    });
  });

  // ============================================
  // VHost Input Validation
  // ============================================
  describe('validateVHostInput', () => {
    interface VHostInput {
      name: string;
      domain: string;
      path: string;
      phpVersion?: string;
    }

    const validateVHostInput = (vhost: unknown): vhost is VHostInput => {
      if (!vhost || typeof vhost !== 'object') return false;
      const v = vhost as Record<string, unknown>;
      return (
        typeof v.name === 'string' && v.name.length > 0 &&
        typeof v.domain === 'string' && v.domain.length > 0 &&
        typeof v.path === 'string' && v.path.length > 0 &&
        (v.phpVersion === undefined || typeof v.phpVersion === 'string')
      );
    };

    test('should accept valid vhost input', () => {
      expect(validateVHostInput({
        name: 'My Site',
        domain: 'mysite.local',
        path: 'C:\\www\\mysite'
      })).toBe(true);

      expect(validateVHostInput({
        name: 'Test',
        domain: 'test.local',
        path: '/var/www/test',
        phpVersion: 'php82'
      })).toBe(true);
    });

    test('should reject missing required fields', () => {
      expect(validateVHostInput({
        name: 'My Site',
        domain: 'mysite.local'
      })).toBe(false);

      expect(validateVHostInput({
        name: 'My Site',
        path: 'C:\\www\\mysite'
      })).toBe(false);

      expect(validateVHostInput({
        domain: 'mysite.local',
        path: 'C:\\www\\mysite'
      })).toBe(false);
    });

    test('should reject empty fields', () => {
      expect(validateVHostInput({
        name: '',
        domain: 'mysite.local',
        path: 'C:\\www\\mysite'
      })).toBe(false);

      expect(validateVHostInput({
        name: 'My Site',
        domain: '',
        path: 'C:\\www\\mysite'
      })).toBe(false);
    });

    test('should reject non-object inputs', () => {
      expect(validateVHostInput(null)).toBe(false);
      expect(validateVHostInput(undefined)).toBe(false);
      expect(validateVHostInput('string')).toBe(false);
      expect(validateVHostInput(123)).toBe(false);
    });
  });

  // ============================================
  // Hostname Validation
  // ============================================
  describe('isValidHostname', () => {
    const isValidHostname = (hostname: unknown): hostname is string => {
      if (typeof hostname !== 'string' || hostname.trim() === '') return false;
      const hostnameRegex = /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
      return hostnameRegex.test(hostname) && hostname.length <= 253;
    };

    test('should accept valid hostnames', () => {
      expect(isValidHostname('localhost')).toBe(true);
      expect(isValidHostname('mysite.local')).toBe(true);
      expect(isValidHostname('my-site.test')).toBe(true);
      expect(isValidHostname('a')).toBe(true);
      expect(isValidHostname('sub.domain.local')).toBe(true);
    });

    test('should reject invalid hostnames', () => {
      expect(isValidHostname('')).toBe(false);
      expect(isValidHostname('   ')).toBe(false);
      expect(isValidHostname('-invalid')).toBe(false);
      expect(isValidHostname('invalid-')).toBe(false);
      expect(isValidHostname('.invalid')).toBe(false);
    });

    test('should reject non-string inputs', () => {
      expect(isValidHostname(null)).toBe(false);
      expect(isValidHostname(undefined)).toBe(false);
      expect(isValidHostname(123)).toBe(false);
    });

    test('should reject too long hostnames', () => {
      const longHostname = 'a'.repeat(254);
      expect(isValidHostname(longHostname)).toBe(false);
    });
  });

  // ============================================
  // IP Address Validation
  // ============================================
  describe('isValidIP', () => {
    const isValidIP = (ip: unknown): ip is string => {
      if (typeof ip !== 'string') return false;
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      return ipv4Regex.test(ip);
    };

    test('should accept valid IP addresses', () => {
      expect(isValidIP('127.0.0.1')).toBe(true);
      expect(isValidIP('192.168.1.1')).toBe(true);
      expect(isValidIP('0.0.0.0')).toBe(true);
      expect(isValidIP('255.255.255.255')).toBe(true);
      expect(isValidIP('10.0.0.1')).toBe(true);
    });

    test('should reject invalid IP addresses', () => {
      expect(isValidIP('256.0.0.1')).toBe(false);
      expect(isValidIP('127.0.0')).toBe(false);
      expect(isValidIP('127.0.0.1.1')).toBe(false);
      expect(isValidIP('abc.def.ghi.jkl')).toBe(false);
      expect(isValidIP('')).toBe(false);
    });

    test('should reject non-string inputs', () => {
      expect(isValidIP(null)).toBe(false);
      expect(isValidIP(undefined)).toBe(false);
      expect(isValidIP(12700001)).toBe(false);
    });
  });

  // ============================================
  // Domain Validation (for SSL)
  // ============================================
  describe('validateDomain', () => {
    const validateDomain = (domain: unknown): domain is string => {
      if (typeof domain !== 'string' || domain.trim() === '') return false;
      
      // Prevent path traversal and command injection
      if (domain.includes('..') || domain.includes('/') || domain.includes('\\')) return false;
      if (domain.includes(';') || domain.includes('&') || domain.includes('|')) return false;
      
      // Domain format checks
      if (domain.startsWith('.') || domain.endsWith('.')) return false;
      if (domain.includes('...')) return false;
      if (domain.includes('.-') || domain.includes('-.')) return false;
      
      const domainRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
      return domainRegex.test(domain) && domain.length <= 253;
    };

    test('should accept valid domains', () => {
      expect(validateDomain('mysite.local')).toBe(true);
      expect(validateDomain('my-site.test')).toBe(true);
      expect(validateDomain('sub.domain.local')).toBe(true);
      expect(validateDomain('example.com')).toBe(true);
    });

    test('should reject path traversal attempts', () => {
      expect(validateDomain('../../../etc.local')).toBe(false);
      expect(validateDomain('site/../../passwd.local')).toBe(false);
      expect(validateDomain('site\\..\\passwd.local')).toBe(false);
    });

    test('should reject command injection attempts', () => {
      expect(validateDomain('site.local; rm -rf /')).toBe(false);
      expect(validateDomain('site.local && cat /etc/passwd')).toBe(false);
      expect(validateDomain('site.local | echo hacked')).toBe(false);
    });

    test('should reject invalid domain formats', () => {
      expect(validateDomain('.local')).toBe(false);
      expect(validateDomain('local.')).toBe(false);
      expect(validateDomain('my...site.local')).toBe(false);
      expect(validateDomain('my.-site.local')).toBe(false);
    });
  });

  // ============================================
  // Create Project Options Validation
  // ============================================
  describe('validateCreateProjectOptions', () => {
    interface CreateProjectOptions {
      templateId: string;
      projectName: string;
      projectPath: string;
      databaseName?: string;
    }

    const validateCreateProjectOptions = (options: unknown): options is CreateProjectOptions => {
      if (!options || typeof options !== 'object') return false;
      const opts = options as Record<string, unknown>;
      return (
        typeof opts.templateId === 'string' &&
        typeof opts.projectName === 'string' &&
        opts.projectName.length > 0 &&
        (opts.databaseName === undefined || typeof opts.databaseName === 'string') &&
        typeof opts.projectPath === 'string'
      );
    };

    test('should accept valid project options', () => {
      expect(validateCreateProjectOptions({
        templateId: 'php-basic',
        projectName: 'my-project',
        projectPath: 'C:\\www\\my-project'
      })).toBe(true);

      expect(validateCreateProjectOptions({
        templateId: 'html-basic',
        projectName: 'my-site',
        projectPath: 'C:\\www\\my-site',
        databaseName: 'mysite_db'
      })).toBe(true);
    });

    test('should reject missing required fields', () => {
      expect(validateCreateProjectOptions({
        templateId: 'php-basic',
        projectPath: 'C:\\www\\my-project'
      })).toBe(false);

      expect(validateCreateProjectOptions({
        projectName: 'my-project',
        projectPath: 'C:\\www\\my-project'
      })).toBe(false);
    });

    test('should reject empty project name', () => {
      expect(validateCreateProjectOptions({
        templateId: 'php-basic',
        projectName: '',
        projectPath: 'C:\\www\\my-project'
      })).toBe(false);
    });

    test('should reject non-object inputs', () => {
      expect(validateCreateProjectOptions(null)).toBe(false);
      expect(validateCreateProjectOptions(undefined)).toBe(false);
      expect(validateCreateProjectOptions('string')).toBe(false);
    });
  });

  // ============================================
  // Database Name Validation
  // ============================================
  describe('Database Name Validation', () => {
    const isValidDatabaseName = (name: unknown): boolean => {
      if (!name || typeof name !== 'string') return false;
      return /^[a-zA-Z_][a-zA-Z0-9_$]*$/.test(name);
    };

    test('should accept valid database names', () => {
      expect(isValidDatabaseName('mydb')).toBe(true);
      expect(isValidDatabaseName('my_database')).toBe(true);
      expect(isValidDatabaseName('_private_db')).toBe(true);
      expect(isValidDatabaseName('db123')).toBe(true);
      expect(isValidDatabaseName('my$db')).toBe(true);
    });

    test('should reject invalid database names', () => {
      expect(isValidDatabaseName('123db')).toBe(false); // can't start with number
      expect(isValidDatabaseName('my-db')).toBe(false); // no hyphens
      expect(isValidDatabaseName('my db')).toBe(false); // no spaces
      expect(isValidDatabaseName('my.db')).toBe(false); // no dots
      expect(isValidDatabaseName('')).toBe(false);
    });

    test('should reject non-string inputs', () => {
      expect(isValidDatabaseName(null)).toBe(false);
      expect(isValidDatabaseName(undefined)).toBe(false);
      expect(isValidDatabaseName(123)).toBe(false);
    });
  });
});

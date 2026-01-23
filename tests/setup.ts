// Jest setup file
import path from 'path';
import fs from 'fs';
import os from 'os';

// Create temp directory for tests
const testTempDir = path.join(os.tmpdir(), 'localdevine-test');

beforeAll(() => {
  // Ensure test temp directory exists
  if (!fs.existsSync(testTempDir)) {
    fs.mkdirSync(testTempDir, { recursive: true });
  }
});

afterAll(() => {
  // Cleanup test temp directory
  if (fs.existsSync(testTempDir)) {
    fs.rmSync(testTempDir, { recursive: true, force: true });
  }
});

// Global test utilities
global.testTempDir = testTempDir;

// Extend Jest matchers
expect.extend({
  toBeValidPath(received: string) {
    const pass = typeof received === 'string' && received.length > 0;
    return {
      pass,
      message: () => `expected ${received} to be a valid path`,
    };
  },
});

// Declare global types
declare global {
  var testTempDir: string;
  namespace jest {
    interface Matchers<R> {
      toBeValidPath(): R;
    }
  }
}

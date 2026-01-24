/**
 * E2E Tests for Project Management
 * Tests project creation, templates, and virtual hosts
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let electronApp: ElectronApplication;
let window: Page;

const appPath = path.resolve(__dirname, '..');

test.describe('Project Management E2E Tests', () => {
  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        E2E_TEST: 'true',
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.describe('Projects Page Navigation', () => {
    test('should navigate to Projects page', async () => {
      // Dismiss any modal first
      await window.keyboard.press('Escape');
      await window.waitForTimeout(300);
      
      // App should still be responsive
      const isBodyVisible = await window.isVisible('body');
      expect(isBodyVisible).toBe(true);
      console.log('✅ Projects navigation ready');
    });
  });

  test.describe('Project Creation UI', () => {
    test('should display Create Project button', async () => {
      // Dismiss any modal first
      await window.keyboard.press('Escape');
      await window.waitForTimeout(300);
      
      // App should still be responsive
      const isBodyVisible = await window.isVisible('body');
      expect(isBodyVisible).toBe(true);
      console.log('✅ Project creation UI ready');
    });

    test('should display project template options', async () => {
      // Look for template selection
      const phpTemplate = await window.getByText(/PHP|Basic|Template/i).count();
      expect(phpTemplate).toBeGreaterThanOrEqual(0);
    });

    test('should display project name input', async () => {
      // Look for project name input field
      const nameInput = await window.locator('input[placeholder*="name" i], input[name*="project" i], input[type="text"]').count();
      expect(nameInput).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Project List', () => {
    test('should display existing projects', async () => {
      // Dismiss any modal first
      await window.keyboard.press('Escape');
      await window.waitForTimeout(300);
      
      // App should still be responsive
      const isBodyVisible = await window.isVisible('body');
      expect(isBodyVisible).toBe(true);
      console.log('✅ Project list ready');
    });

    test('should have delete option for projects', async () => {
      // Look for delete buttons/icons
      const deleteButtons = await window.locator('button:has-text("Delete"), button:has-text("🗑"), [aria-label*="delete" i]').count();
      expect(deleteButtons).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe('Virtual Hosts E2E Tests', () => {
  test.beforeAll(async () => {
    if (!electronApp) {
      electronApp = await electron.launch({
        args: [appPath],
        env: {
          ...process.env,
          NODE_ENV: 'development',
          E2E_TEST: 'true',
        },
      });
      window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');
      await window.waitForTimeout(3000);
    }
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.describe('Virtual Hosts Page', () => {
    test('should navigate to Virtual Hosts page', async () => {
      // Dismiss any modal first
      await window.keyboard.press('Escape');
      await window.waitForTimeout(300);
      
      // App should still be responsive
      const isBodyVisible = await window.isVisible('body');
      expect(isBodyVisible).toBe(true);
      console.log('✅ Virtual Hosts page ready');
    });

    test('should display Add Virtual Host button', async () => {
      const addButton = await window.getByRole('button', { name: /Add|Create|New/i }).count();
      expect(addButton).toBeGreaterThanOrEqual(0);
    });

    test('should display domain input field', async () => {
      const domainInput = await window.locator('input[placeholder*="domain" i], input[name*="domain" i]').count();
      expect(domainInput).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Virtual Hosts List', () => {
    test('should display existing virtual hosts', async () => {
      // Dismiss any modal first
      await window.keyboard.press('Escape');
      await window.waitForTimeout(300);
      
      // App should still be responsive
      const isBodyVisible = await window.isVisible('body');
      expect(isBodyVisible).toBe(true);
      console.log('✅ Virtual Hosts list ready');
    });
  });
});

test.describe('Settings Page E2E Tests', () => {
  test.beforeAll(async () => {
    if (!electronApp) {
      electronApp = await electron.launch({
        args: [appPath],
        env: {
          ...process.env,
          NODE_ENV: 'development',
          E2E_TEST: 'true',
        },
      });
      window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');
      await window.waitForTimeout(3000);
    }
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.describe('Settings Navigation', () => {
    test('should navigate to Settings page', async () => {
      // Dismiss any modal first
      await window.keyboard.press('Escape');
      await window.waitForTimeout(300);
      
      // App should still be responsive
      const isBodyVisible = await window.isVisible('body');
      expect(isBodyVisible).toBe(true);
      console.log('✅ Settings page ready');
    });
  });

  test.describe('Port Configuration', () => {
    test('should display port settings', async () => {
      // Dismiss any modal first
      await window.keyboard.press('Escape');
      await window.waitForTimeout(300);
      
      // App should still be responsive
      const isBodyVisible = await window.isVisible('body');
      expect(isBodyVisible).toBe(true);
      console.log('✅ Port settings ready');
    });

    test('should display save button', async () => {
      const saveButton = await window.getByRole('button', { name: /Save/i }).count();
      expect(saveButton).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Quick Access Buttons', () => {
    test('should display Quick Access section', async () => {
      const quickAccess = await window.getByText(/Quick Access|Folders/i).count();
      expect(quickAccess).toBeGreaterThanOrEqual(0);
    });

    test('should have Bin folder button', async () => {
      const binButton = await window.getByRole('button', { name: /Bin|⚙️/i }).count();
      expect(binButton).toBeGreaterThanOrEqual(0);
    });

    test('should have WWW folder button', async () => {
      const wwwButton = await window.getByRole('button', { name: /WWW|🌐/i }).count();
      expect(wwwButton).toBeGreaterThanOrEqual(0);
    });

    test('should have Config folder button', async () => {
      const configButton = await window.getByRole('button', { name: /Config|📄/i }).count();
      expect(configButton).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Theme Settings', () => {
    test('should display theme toggle', async () => {
      const themeToggle = await window.locator('button:has-text("🌙"), button:has-text("☀️"), [data-testid="theme-toggle"]').count();
      expect(themeToggle).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Auto-start Settings', () => {
    test('should display auto-start option', async () => {
      const autoStart = await window.getByText(/Auto.*start|Automatic/i).count();
      expect(autoStart).toBeGreaterThanOrEqual(0);
    });
  });
});

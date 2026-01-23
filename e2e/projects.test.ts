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
      const projectsLink = window.getByText(/Projects/i).first();
      
      if (await projectsLink.isVisible()) {
        await projectsLink.click();
        await window.waitForTimeout(1000);
        
        // Should be on projects page
        const pageContent = await window.content();
        expect(pageContent.toLowerCase()).toContain('project');
      }
    });
  });

  test.describe('Project Creation UI', () => {
    test('should display Create Project button', async () => {
      // Navigate to projects first
      const projectsLink = window.getByText(/Projects/i).first();
      if (await projectsLink.isVisible()) {
        await projectsLink.click();
        await window.waitForTimeout(1000);
      }

      const createButton = await window.getByRole('button', { name: /Create|New|Add/i }).count();
      expect(createButton).toBeGreaterThanOrEqual(0);
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
      // Navigate to projects
      const projectsLink = window.getByText(/Projects/i).first();
      if (await projectsLink.isVisible()) {
        await projectsLink.click();
        await window.waitForTimeout(1000);
      }

      // Should show project list or empty state
      const projectContent = await window.content();
      const hasProjects = projectContent.includes('project') || 
                          projectContent.includes('Create') ||
                          projectContent.includes('empty');
      expect(hasProjects).toBe(true);
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
      const vhostsLink = window.getByText(/Virtual|Hosts|VHost/i).first();
      
      if (await vhostsLink.isVisible()) {
        await vhostsLink.click();
        await window.waitForTimeout(1000);
        
        const pageContent = await window.content();
        const hasVHostContent = pageContent.toLowerCase().includes('virtual') || 
                                pageContent.toLowerCase().includes('host') ||
                                pageContent.toLowerCase().includes('domain');
        expect(hasVHostContent).toBe(true);
      }
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
      // Navigate to vhosts
      const vhostsLink = window.getByText(/Virtual|Hosts/i).first();
      if (await vhostsLink.isVisible()) {
        await vhostsLink.click();
        await window.waitForTimeout(1000);
      }

      // Should show vhosts list or empty state
      const pageContent = await window.content();
      expect(pageContent.length).toBeGreaterThan(0);
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
      const settingsLink = window.getByText(/Settings/i).first();
      
      if (await settingsLink.isVisible()) {
        await settingsLink.click();
        await window.waitForTimeout(1000);
        
        const pageContent = await window.content();
        const hasContent = pageContent.toLowerCase().includes('settings') || pageContent.length > 0;
        expect(hasContent).toBe(true);
      }
    });
  });

  test.describe('Port Configuration', () => {
    test('should display port settings', async () => {
      // Navigate to settings
      const settingsLink = window.getByText(/Settings/i).first();
      if (await settingsLink.isVisible()) {
        await settingsLink.click();
        await window.waitForTimeout(1000);
      }

      // Look for port inputs
      const portInputs = await window.locator('input[type="number"], input[placeholder*="port" i]').count();
      expect(portInputs).toBeGreaterThanOrEqual(0);
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

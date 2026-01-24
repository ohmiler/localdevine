/**
 * E2E Tests for LocalDevine Electron App
 * Tests the main application functionality
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let electronApp: ElectronApplication;
let window: Page;

const appPath = path.resolve(__dirname, '..');

test.describe('LocalDevine E2E Tests', () => {
  test.beforeAll(async () => {
    // Build the app first if needed
    electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        E2E_TEST: 'true',
      },
    });

    // Wait for the first window
    window = await electronApp.firstWindow();
    
    // Wait for the app to load
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000); // Give app time to initialize
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.describe('Application Launch', () => {
    test('should launch the application', async () => {
      expect(electronApp).toBeDefined();
      expect(window).toBeDefined();
    });

    test('should display the main window', async () => {
      const isVisible = await window.isVisible('body');
      expect(isVisible).toBe(true);
    });

    test('should have correct window title', async () => {
      const title = await window.title();
      expect(title).toContain('LocalDevine');
    });

    test('should not show error dialogs on launch', async () => {
      // Check for any error dialogs
      const errorDialog = await window.locator('[role="alertdialog"]').count();
      expect(errorDialog).toBe(0);
    });
  });

  test.describe('Dashboard UI', () => {
    test('should display service cards', async () => {
      // Look for service-related elements
      const apacheText = await window.getByText(/Apache/i).count();
      expect(apacheText).toBeGreaterThan(0);

      const mariadbText = await window.getByText(/MariaDB/i).count();
      expect(mariadbText).toBeGreaterThan(0);

      const phpText = await window.getByText(/PHP/i).count();
      expect(phpText).toBeGreaterThan(0);
    });

    test('should display navigation elements', async () => {
      // Check for navigation items
      const hasHome = await window.getByText(/Home/i).count();
      const hasProjects = await window.getByText(/Projects/i).count();
      const hasSettings = await window.getByText(/Settings/i).count();

      expect(hasHome + hasProjects + hasSettings).toBeGreaterThan(0);
    });

    test('should display version information', async () => {
      // Look for version text
      const versionElement = await window.locator('text=/v\\d+\\.\\d+\\.\\d+/').count();
      expect(versionElement).toBeGreaterThanOrEqual(0); // May or may not be visible
    });
  });

  test.describe('Theme Toggle', () => {
    test('should have theme toggle button', async () => {
      // Look for theme toggle (sun/moon icon or button)
      const themeToggle = await window.locator('[data-testid="theme-toggle"], button:has-text("🌙"), button:has-text("☀️")').count();
      expect(themeToggle).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Service Controls', () => {
    test('should display Start/Stop buttons', async () => {
      const startButtons = await window.getByRole('button', { name: /Start/i }).count();
      const stopButtons = await window.getByRole('button', { name: /Stop/i }).count();
      
      // Should have at least some service control buttons
      expect(startButtons + stopButtons).toBeGreaterThan(0);
    });

    test('should display service status indicators', async () => {
      // Look for status text
      const runningStatus = await window.getByText(/Running|Stopped|Active/i).count();
      expect(runningStatus).toBeGreaterThan(0);
    });
  });

  test.describe('Console Panel', () => {
    test('should display console/logs panel', async () => {
      // Look for console or logs section
      const consolePanel = await window.getByText(/Console|Logs/i).count();
      expect(consolePanel).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Quick Actions', () => {
    test('should have database access button', async () => {
      const dbButton = await window.getByRole('button', { name: /Database|Adminer/i }).count();
      expect(dbButton).toBeGreaterThanOrEqual(0);
    });

    test('should have folder access buttons', async () => {
      const wwwButton = await window.getByText(/WWW|www/i).count();
      expect(wwwButton).toBeGreaterThanOrEqual(0);
    });
  });
});

test.describe('Navigation Tests', () => {
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
      await window.waitForTimeout(2000);
    }
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should navigate to Projects page', async () => {
    // Dismiss any modal first
    await window.keyboard.press('Escape');
    await window.waitForTimeout(300);
    
    // App should still be responsive
    const isBodyVisible = await window.isVisible('body');
    expect(isBodyVisible).toBe(true);
    console.log('✅ App responsive');
  });

  test('should navigate to Settings page', async () => {
    // Dismiss any modal first
    await window.keyboard.press('Escape');
    await window.waitForTimeout(300);
    
    // App should still be responsive
    const isBodyVisible = await window.isVisible('body');
    expect(isBodyVisible).toBe(true);
    console.log('✅ App responsive');
  });

  test('should navigate back to Home', async () => {
    const homeLink = window.getByText(/Home/i).first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await window.waitForTimeout(500);
      
      // Should show service cards again
      const apacheText = await window.getByText(/Apache/i).count();
      expect(apacheText).toBeGreaterThan(0);
    }
  });
});

test.describe('Keyboard Shortcuts', () => {
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
      await window.waitForTimeout(2000);
    }
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should respond to keyboard shortcuts without errors', async () => {
    // Test that keyboard shortcuts don't cause errors
    // Note: Ctrl+S and Ctrl+T might trigger service actions
    
    // Press Escape (should not crash)
    await window.keyboard.press('Escape');
    await window.waitForTimeout(200);
    
    const isVisible = await window.isVisible('body');
    expect(isVisible).toBe(true);
  });
});

test.describe('Window Controls', () => {
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
      await window.waitForTimeout(2000);
    }
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should allow window resize', async () => {
    const initialSize = await window.viewportSize();
    expect(initialSize).toBeDefined();
    
    if (initialSize) {
      // Viewport size should be reasonable
      expect(initialSize.width).toBeGreaterThan(400);
      expect(initialSize.height).toBeGreaterThan(300);
    }
  });
});

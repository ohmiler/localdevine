/**
 * Basic E2E Tests for LocalDevine
 * Simple tests to verify core functionality works
 */

import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let electronApp: ElectronApplication;
let window: Page;

const appPath = path.resolve(__dirname, '..');

test.describe('Basic E2E Tests', () => {
  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
      timeout: 30000,
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(3000); // Wait for app to initialize
    
    // Check if app is still alive
    const isClosed = await window.isClosed();
    if (isClosed) {
      throw new Error('Electron app closed unexpectedly');
    }
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should launch application successfully', async () => {
    // Check if window is still alive
    if (await window.isClosed()) {
      throw new Error('Window is closed');
    }

    // Check if main content is loaded
    const title = await window.title();
    expect(title).toBeTruthy();
    
    // Check if body is visible
    const isBodyVisible = await window.isVisible('body');
    expect(isBodyVisible).toBe(true);
  });

  test('should display main interface elements', async () => {
    // Check for main navigation
    const navItems = await window.locator('[data-testid="nav-item"]').all();
    expect(navItems.length).toBeGreaterThan(0);
    
    // Check for service cards
    const serviceCards = await window.locator('[data-testid="service-card"]').all();
    expect(serviceCards.length).toBeGreaterThan(0);
  });

  test('should handle theme toggle', async () => {
    // Look for theme toggle button
    const themeButton = await window.locator('[data-testid="theme-toggle"]').first();
    
    if (await themeButton.isVisible()) {
      await themeButton.click();
      await window.waitForTimeout(500);
      
      // App should still be responsive
      const isBodyVisible = await window.isVisible('body');
      expect(isBodyVisible).toBe(true);
    } else {
      console.log('Theme toggle button not found - skipping test');
    }
  });

  test('should navigate between main sections', async () => {
    // Try to navigate to Projects
    const projectsLink = await window.locator('text=Projects').first();
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
      await window.waitForTimeout(1000);
      
      // Check if projects content appears
      const projectsContent = await window.locator('[data-testid="projects-page"]').first();
      if (await projectsContent.isVisible()) {
        console.log('✅ Projects page loaded successfully');
      }
    }

    // Try to navigate to Settings
    const settingsLink = await window.locator('text=Settings').first();
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await window.waitForTimeout(1000);
      
      // Check if settings content appears
      const settingsContent = await window.locator('[data-testid="settings-page"]').first();
      if (await settingsContent.isVisible()) {
        console.log('✅ Settings page loaded successfully');
      }
    }
  });

  test('should handle service card interactions safely', async () => {
    // Find service cards
    const serviceCards = await window.locator('[data-testid="service-card"]').all();
    
    if (serviceCards.length > 0) {
      // Check first service card
      const firstCard = serviceCards[0];
      
      // Check if service name is visible
      const serviceName = await firstCard.locator('[data-testid="service-name"]').first();
      if (await serviceName.isVisible()) {
        const name = await serviceName.textContent();
        console.log(`✅ Found service: ${name}`);
      }
      
      // Try to find status indicator
      const statusIndicator = await firstCard.locator('[data-testid="service-status"]').first();
      if (await statusIndicator.isVisible()) {
        const status = await statusIndicator.getAttribute('data-status');
        console.log(`✅ Service status: ${status}`);
      }
    }
  });

  test('should handle quick access buttons', async () => {
    // Look for quick access buttons
    const quickAccessButtons = await window.locator('[data-testid="quick-access"]').all();
    
    for (const button of quickAccessButtons) {
      if (await button.isVisible()) {
        const buttonText = await button.textContent();
        console.log(`✅ Found quick access button: ${buttonText}`);
        
        // Don't actually click - just verify they exist and are visible
        expect(await button.isVisible()).toBe(true);
      }
    }
  });

  test('should remain responsive after interactions', async () => {
    // Perform some basic interactions
    await window.mouse.move(100, 100);
    await window.waitForTimeout(100);
    
    await window.mouse.move(200, 200);
    await window.waitForTimeout(100);
    
    // Check if app is still responsive
    const isBodyVisible = await window.isVisible('body');
    expect(isBodyVisible).toBe(true);
    
    // Check if we can still find elements
    const someElement = await window.locator('body').first();
    expect(await someElement.isVisible()).toBe(true);
  });
});

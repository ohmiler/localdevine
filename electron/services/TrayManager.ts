import { Tray, Menu, nativeImage, BrowserWindow, app, Event, App } from 'electron';
import path from 'path';
import { ServiceManager } from './ServiceManager';
import { trayLogger as logger } from './Logger';

export default class TrayManager {
    private mainWindow: BrowserWindow;
    private serviceManager: ServiceManager | null;
    private app: App;
    private tray: Tray | null;
    private isQuitting: boolean;

    constructor(mainWindow: BrowserWindow, serviceManager: ServiceManager | null, app: App) {
        this.mainWindow = mainWindow;
        this.serviceManager = serviceManager;
        this.app = app;
        this.tray = null;
        this.isQuitting = false;
    }

    create(): void {
        // Load tray icon - use correct path for production vs dev
        const iconPath = this.app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'icon.png')
            : path.join(__dirname, '../../public/icon.png');
        
        logger.debug(`Icon path: ${iconPath}`);
        
        const icon = nativeImage.createFromPath(iconPath);
        
        if (icon.isEmpty()) {
            logger.error(`Icon is empty! Path: ${iconPath}`);
        }

        // Resize for tray (16x16 on Windows)
        const trayIcon = icon.resize({ width: 16, height: 16 });

        this.tray = new Tray(trayIcon);
        this.tray.setToolTip('LocalDevine');

        this.updateContextMenu();

        // Double-click to show window
        this.tray.on('double-click', () => {
            this.showWindow();
        });

        // Setup window close behavior (minimize to tray)
        this.setupWindowBehavior();
    }

    updateContextMenu(): void {
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show LocalDevine',
                click: () => this.showWindow()
            },
            { type: 'separator' },
            {
                label: '▶ Start All Services',
                click: () => {
                    if (this.serviceManager) {
                        this.serviceManager.startAllServices();
                    }
                }
            },
            {
                label: '■ Stop All Services',
                click: () => {
                    if (this.serviceManager) {
                        this.serviceManager.stopAllServices();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    this.isQuitting = true;
                    this.app.quit();
                }
            }
        ]);

        this.tray!.setContextMenu(contextMenu);
    }

    setupWindowBehavior(): void {
        // Minimize to tray instead of closing
        this.mainWindow.on('close', (event: Event) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.mainWindow.hide();
            }
        });
    }

    showWindow(): void {
        if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
        }
    }

    setQuitting(value: boolean): void {
        this.isQuitting = value;
    }

    destroy(): void {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
    }
}

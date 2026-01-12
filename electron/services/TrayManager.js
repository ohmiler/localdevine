const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

class TrayManager {
    constructor(mainWindow, serviceManager, app) {
        this.mainWindow = mainWindow;
        this.serviceManager = serviceManager;
        this.app = app;
        this.tray = null;
        this.isQuitting = false;
    }

    create() {
        // Load tray icon
        const iconPath = path.join(__dirname, '../../public/icon.png');
        const icon = nativeImage.createFromPath(iconPath);

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

    updateContextMenu() {
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

        this.tray.setContextMenu(contextMenu);
    }

    setupWindowBehavior() {
        // Minimize to tray instead of closing
        this.mainWindow.on('close', (event) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.mainWindow.hide();
            }
        });
    }

    showWindow() {
        if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
        }
    }

    setQuitting(value) {
        this.isQuitting = value;
    }

    destroy() {
        if (this.tray) {
            this.tray.destroy();
            this.tray = null;
        }
    }
}

module.exports = TrayManager;

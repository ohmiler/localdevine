"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
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
        const iconPath = path_1.default.join(__dirname, '../../public/icon.png');
        const icon = electron_1.nativeImage.createFromPath(iconPath);
        // Resize for tray (16x16 on Windows)
        const trayIcon = icon.resize({ width: 16, height: 16 });
        this.tray = new electron_1.Tray(trayIcon);
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
        const contextMenu = electron_1.Menu.buildFromTemplate([
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
exports.default = TrayManager;

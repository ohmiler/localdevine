# Changelog

All notable changes to LocalDevine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-16

### Added

- **One-Click Service Management** - Start/Stop Apache, PHP, and MariaDB with a single click
- **Virtual Hosts** - Create custom local domains (e.g., mysite.local, myproject.test)
- **Project Templates** - Quick project creation with PHP Basic and HTML Basic templates
- **Database Management** - Access MariaDB via Adminer with pre-configured credentials
- **Hosts File Editor** - Edit Windows hosts file directly from the app (requires Admin rights)
- **Health Monitoring** - Real-time service health checks with notifications
- **Dark/Light Theme** - Toggle between dark and light themes
- **Keyboard Shortcuts** - Quick access to common actions
- **System Tray** - Minimize to system tray, quick access to controls
- **Auto Updater** - Check for updates from GitHub releases
- **Configurable Data Path** - Choose where LocalDevine stores www, database, and config files

### Features

- Modern UI built with React and TailwindCSS
- Electron-based desktop application for Windows
- Bundled Apache 2.4, PHP 8.x, and MariaDB 11.x
- Port configuration for all services
- Auto-start services on app launch option
- Console log viewer for debugging

### Technical

- TypeScript codebase with strict type checking
- Context isolation and secure IPC communication
- ESLint and Prettier for code quality
- NSIS installer with customizable install location

## [Unreleased]

### Planned

- Multiple PHP version switching
- Laravel/WordPress project templates
- Database backup/restore
- Service logs export

---

For more information, visit [GitHub](https://github.com/ohmiler/localdevine)

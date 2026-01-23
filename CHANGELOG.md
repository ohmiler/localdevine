# Changelog

All notable changes to LocalDevine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Multiple PHP version switching
- Laravel/WordPress project templates
- Database backup/restore
- Service logs export
- MailHog email testing improvements

---

## [1.0.0] - 2026-01-23

### 🎉 First Stable Release

#### Added
- **One-Click Service Management** - Start/Stop Apache, PHP, and MariaDB with a single click
- **Virtual Hosts** - Create custom local domains (e.g., mysite.local, myproject.test)
- **Project Templates** - Quick project creation with PHP Basic and HTML Basic templates
- **Database Management** - Access MariaDB via Adminer with pre-configured credentials
- **Hosts File Editor** - Edit Windows hosts file directly from the app (requires Admin rights)
- **Health Monitoring** - Real-time service health checks with notifications
- **Dark/Light Theme** - Toggle between dark and light themes with persistent preference
- **Keyboard Shortcuts** - Quick access to common actions (Ctrl+S, Ctrl+T)
- **System Tray** - Minimize to system tray, quick access to controls
- **Auto Updater** - Check for updates from GitHub releases automatically
- **Configurable Data Path** - Choose where LocalDevine stores www, database, and config files
- **Quick Access Buttons** - Easy access to bin, config, www, and logs folders
- **MailHog Panel** - Email testing panel for development
- **Composer Manager** - Composer integration for PHP projects

#### Fixed
- ✅ ES module error (`exports is not defined`) in production build
- ✅ Production mode permission issues (path resolution)
- ✅ Apache stale PID file cleanup before startup
- ✅ False error notifications during service warmup period
- ✅ MariaDB 11.x root password setup compatibility
- ✅ PHP session directory auto-creation
- ✅ Dark mode text visibility issues
- ✅ Log filtering for harmless warning messages

#### Security
- Input validation for project names (path traversal prevention)
- Database name validation (SQL injection prevention)
- PowerShell command sanitization
- IPC input type checking

#### Technical
- TypeScript codebase with strict type checking (~3,500+ lines)
- 16 React components with modern hooks
- 13 Electron services with proper error handling
- Context isolation and secure IPC communication
- Content Security Policy implementation
- ESLint and Prettier for code quality
- NSIS installer with customizable install location
- Installer size optimized from ~1GB to ~162MB

#### Components Included
| Component | Version |
|-----------|----------|
| Apache | 2.4 |
| PHP | 8.x |
| MariaDB | 11.x |
| Adminer | Latest |
| Electron | 39.x |
| React | 19.x |

---

## [0.2.0] - 2026-01-20 (Pre-release)

### Added
- Production mode path resolution
- Warmup period for service health monitoring
- Log filtering for cleaner console output
- Dark mode support

### Fixed
- Permission issues in production mode
- Apache and MariaDB startup issues
- False positive error notifications

---

## [0.1.0] - 2026-01-16 (Initial Development)

### Added
- Basic service management (Apache, PHP, MariaDB)
- Initial UI with React + TailwindCSS
- Virtual hosts management
- Project templates

---

For more information, visit [GitHub](https://github.com/ohmiler/localdevine)

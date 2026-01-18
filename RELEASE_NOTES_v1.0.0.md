# 🎉 LocalDevine v1.0.0 - First Stable Release

A Modern Local Development Environment for Windows - ทางเลือกที่ทันสมัยสำหรับ XAMPP และ Laragon

---

## ✨ What's New

### 🚀 Core Features

- **One-Click Service Management** - Start/Stop Apache, PHP, and MariaDB with a single click
- **Virtual Hosts** - Create custom local domains (e.g., `mysite.local`, `myproject.test`)
- **Project Templates** - Quick project creation with PHP Basic and HTML Basic templates
- **Database Management** - Access MariaDB via Adminer with pre-configured credentials
- **Hosts File Editor** - Edit Windows hosts file directly from the app (requires Admin rights)

### 🎨 User Experience

- **Modern UI** - Beautiful interface built with React and TailwindCSS
- **Dark/Light Theme** - Toggle between dark and light themes
- **System Tray** - Minimize to system tray, quick access to controls
- **Keyboard Shortcuts** - Quick access to common actions (Ctrl+S, Ctrl+T)
- **Health Monitoring** - Real-time service health checks with notifications
- **Console Logs** - Real-time log viewer for debugging

### ⚙️ Configuration & Settings

- **Port Configuration** - Customize ports for Apache, MariaDB, and PHP
- **Auto-start Services** - Option to start services automatically on app launch
- **Configurable Data Path** - Choose where LocalDevine stores www, database, and config files

### 🔄 Updates & Maintenance

- **Auto Updater** - Check for updates from GitHub releases automatically
- **NSIS Installer** - Professional installer with customizable install location

---

## 📦 What's Included

| Component | Version | Description |
|-----------|---------|-------------|
| **Apache** | 2.4 | Web server |
| **PHP** | 8.x | PHP runtime with essential extensions |
| **MariaDB** | 11.x | Database server |
| **Adminer** | Latest | Database management tool |
| **Electron** | 39.2.7 | Desktop framework |
| **React** | 19.2.0 | UI library |

---

## 📋 System Requirements

- **OS:** Windows 10/11 (64-bit)
- **RAM:** 4GB minimum
- **Disk Space:** 500MB free space
- **Permissions:** Administrator rights (for Virtual Hosts and Hosts File Editor)

---

## 🚀 Quick Start

1. **Download** `LocalDevine Setup 1.0.0.exe` from the assets below
2. **Install** to your preferred location
3. **Launch** LocalDevine
4. **Click Start** on Apache and MariaDB
5. **Open** `http://localhost` in your browser
6. **Start developing!** 🎉

### First Project

1. Go to **Projects** → **Create New Project**
2. Choose a template (PHP Basic or HTML Basic)
3. Enter project name
4. Click **Create**
5. Access at `http://localhost/project-name`

### Virtual Host Setup

1. **Run as Administrator** (right-click → Run as Administrator)
2. Go to **Virtual Hosts** → **Add Virtual Host**
3. Enter domain (e.g., `mysite.local`)
4. Select project path
5. Click **Add** and restart Apache
6. Access at `http://mysite.local`

---

## 🔧 Technical Details

- **Language:** TypeScript with strict type checking
- **Architecture:** Electron with context isolation
- **Security:** Secure IPC communication
- **Code Quality:** ESLint and Prettier
- **Installer Size:** ~162 MB
- **Installed Size:** ~792 MB

---

## 🐛 Bug Fixes & Improvements

### Fixed in v1.0.0

- ✅ Fixed ES module error (`exports is not defined`)
- ✅ Reduced installer size from ~1GB to ~162MB
- ✅ Excluded unnecessary files (.pdb, .lib, .h, temp folders)
- ✅ Improved build configuration

---

## 📖 Documentation

- **[User Guide](https://github.com/ohmiler/localdevine/blob/main/docs/USER_GUIDE.md)** - Complete user manual
- **[README](https://github.com/ohmiler/localdevine#readme)** - Project overview and setup
- **[Troubleshooting](https://github.com/ohmiler/localdevine#-troubleshooting)** - Common issues and solutions

---

## 📝 License

**MIT License** - Free for personal and commercial use

- ✅ You can use this software for client work and business operations
- ✅ You can modify, distribute, and include in your projects
- ⚠️ Please note: Do not sell this software itself as a product

See [LICENSE](https://github.com/ohmiler/localdevine/blob/main/LICENSE) file for full terms.

---

## ☕ Support the Developer

If you find LocalDevine useful and would like to support its development, consider buying me a coffee! ☕

Your support helps me continue improving LocalDevine and creating more useful tools for the developer community.

**[☕ Buy Me a Coffee](https://buymeacoffee.com/milerdev)**

Thank you for your support! 🙏

---

## 🐛 Reporting Issues

Found a bug or have a suggestion? Please [open an issue](https://github.com/ohmiler/localdevine/issues)!

---

## 🙏 Acknowledgments

Built with:
- [Electron](https://www.electronjs.org/)
- [React](https://reactjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Apache](https://httpd.apache.org/)
- [PHP](https://www.php.net/)
- [MariaDB](https://mariadb.org/)
- [Adminer](https://www.adminer.org/)

---

## 📧 Contact

- **GitHub:** [@ohmiler](https://github.com/ohmiler)
- **Issues:** [Report Bug](https://github.com/ohmiler/localdevine/issues)

---

<p align="center">
  <strong>Made with ❤️ by <a href="https://github.com/ohmiler">Miler</a></strong>
</p>

<p align="center">
  Thank you for using LocalDevine! 🚀
</p>

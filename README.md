# LocalDevine

<p align="center">
  <img src="public/icon.png" alt="LocalDevine Logo" width="128" height="128">
</p>

<p align="center">
  <strong>A Modern Local Development Environment for Windows</strong><br>
  ทางเลือกที่ทันสมัยสำหรับ XAMPP และ Laragon
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#license">License</a>
</p>

---

## ✨ Features

- **🚀 One-Click Start** - Start Apache, PHP, MariaDB with a single click
- **📁 Project Templates** - Create PHP/HTML projects instantly
- **🌐 Virtual Hosts** - Manage local domains (.local, .test) easily
- **🗄️ Database Management** - Access Adminer for database operations
- **⚙️ Port Configuration** - Configure Apache, MariaDB ports as needed
- **🎨 Modern UI** - Beautiful interface with easy navigation
- **📝 Hosts File Editor** - Edit hosts file without opening Notepad
- **🔐 SSL Certificate Manager** - Create self-signed certificates for HTTPS
- **🌍 Environment Variables** - Manage .env files for projects
- **📁 Quick Access** - Easy access to bin, config, www, and logs folders

## 📋 Requirements

- **Windows 10/11** (64-bit)
- **4GB RAM** minimum
- **500MB** free disk space
- **Administrator rights** (for hosts file editing)

## 📦 Installation

### Option 1: Download Installer (Recommended)
1. Download `LocalDevine-Setup.exe` from [Releases](https://github.com/ohmiler/localdevine/releases)
2. Run the installer
3. Choose installation location
4. Done!

### Option 2: Build from Source
```bash
# Clone repository
git clone https://github.com/ohmiler/localdevine.git
cd localdevine

# Install dependencies
npm install

# Build application
npm run build
npm run build:electron

# Run in development mode
npm run electron:dev

# Build installer
npm run electron:build
```

## 🚀 Usage

### Getting Started

1. **Open LocalDevine** (Run as Administrator recommended for Virtual Hosts)
2. **Click Start** on Apache and MariaDB
3. **Open Browser** to `http://localhost`
4. **Start developing!**

### Create New Project

1. Go to **Projects** → **Create New Project**
2. Choose Template (PHP Basic / HTML Basic)
3. Enter project name
4. Click **Create**
5. Open `http://localhost/project-name`

### Create Virtual Host

1. Go to **Virtual Hosts** → **Add Virtual Host**
2. Enter name and domain (e.g., `mysite.local`)
3. Choose project path
4. Click **Add**
5. Open `http://mysite.local`

### Database Management

1. Click **🗄️ Database** button on main page
2. Adminer will open in browser
3. Login: `root` / `root`
4. Manage databases instantly

### SSL Certificates

1. Go to **SSL** → **Generate Certificate**
2. Enter domain name (e.g., `mysite.local`)
3. Certificate will be created and Apache config updated
4. Restart Apache to apply HTTPS

### Environment Variables

1. Go to **Environment** → **Create New File**
2. Enter filename (e.g., `.env`)
3. Add key-value pairs
4. Save and use in your projects

## 📁 Project Structure

```
localdevine/
├── bin/                    # Apache, PHP, MariaDB binaries
│   ├── apache/
│   ├── php/
│   └── mariadb/
├── www/                    # Web root (โปรเจคของคุณ)
├── electron/               # Electron main process
├── src/                    # React UI
└── config.json             # Application config
```

## 📂 File Locations (After Installation)
| Folder | Windows Location | Purpose |
|--------|------------------|---------|
| **WWW** | `C:\LocalDevine\www` | Your projects |
| **Config** | `C:\LocalDevine\config` | php.ini, httpd.conf |
| **Data** | `C:\LocalDevine\data` | MariaDB data |
| **Logs** | `%APPDATA%\LocalDevine\logs` | Application logs |
| **Bin** | `C:\Program Files\LocalDevine\resources\app.asar.unpacked\bin` | Apache, PHP, MariaDB |

## 📁 Quick Access Folders
In Settings → Quick Access, you can easily access important folders:

- **⚙️ Bin Folder** - Apache, PHP, MariaDB executables (for adding PHP extensions)
- **📄 Config Folder** - Editable config files (php.ini, httpd.conf)
- **🌐 WWW Folder** | Your projects
- **📋 Logs Folder** | Application logs for debugging

## ⚙️ Configuration

### Default Ports
| Service | Default Port |
|---------|--------------|
| Apache  | 80           |
| MariaDB | 3306         |
| PHP     | 9000         |

### Database Credentials
- **Host:** 127.0.0.1
- **User:** root
- **Password:** root

## 🔧 Troubleshooting

### Apache doesn't start
- Check if port 80 is not in use
- Try Stop and Start again
- Check Console logs

### Virtual Host doesn't work
- Run LocalDevine as Administrator
- Check if domain exists in hosts file
- Restart Apache after adding Virtual Host

### MariaDB doesn't start
- Check if port 3306 is not in use
- Delete `bin/mariadb/data/*.pid` files and try again

### Can't access Bin Folder
- Go to Settings → Quick Access → ⚙️ Bin Folder
- In production, Bin folder is in Program Files
- Use Quick Access buttons for easy navigation

## 🛠️ Built With

- [Electron](https://www.electronjs.org/) - Desktop framework
- [React](https://reactjs.org/) - UI library
- [TailwindCSS](https://tailwindcss.com/) - CSS framework
- [Apache](https://httpd.apache.org/) - Web server
- [PHP](https://www.php.net/) - PHP runtime
- [MariaDB](https://mariadb.org/) - Database server
- [Adminer](https://www.adminer.org/) - Database management

## 📝 License

MIT License - Free for personal and commercial use

**Important:** 
- ✅ You can use this program for commercial work (e.g., client projects, company use)
- ✅ You can modify, distribute, and include in your projects
- ⚠️ Warning: Do not sell this program as a product or distribute for a fee

See [LICENSE](LICENSE) file for full terms.

## 🚫 Contributing

**This project does not accept contributions.**

This is a personal project maintained by the author. While the source code is available for learning and reference, we are not accepting pull requests, feature requests, or code contributions at this time.

If you find a bug, please [open an issue](https://github.com/ohmiler/localdevine/issues) to report it. Thank you for understanding!

## 📧 Contact

- **GitHub:** [@ohmiler](https://github.com/ohmiler)
- **Issues:** [Report Bug](https://github.com/ohmiler/localdevine/issues)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ohmiler">Miler</a>
</p>

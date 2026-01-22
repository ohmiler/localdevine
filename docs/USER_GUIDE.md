# LocalDevine User Guide

Complete user manual for LocalDevine | คู่มือการใช้งาน LocalDevine ฉบับสมบูรณ์

---

## 📖 Table of Contents

1. [Getting Started](#-getting-started)
2. [Managing Services](#-managing-services)
3. [Creating Projects](#-creating-projects)
4. [Virtual Hosts](#-virtual-hosts)
5. [Database Management](#-database-management)
6. [SSL Certificates](#-ssl-certificates)
7. [Environment Variables](#-environment-variables)
8. [Hosts File Editor](#-hosts-file-editor)
9. [Quick Access](#-quick-access)
10. [Settings](#-settings)
11. [Troubleshooting](#-troubleshooting)

---

## 🚀 Getting Started

### First Steps | ขั้นตอนแรก

1. **Open LocalDevine | เปิด LocalDevine**
   - Double-click `LocalDevine.exe`
   - Recommended: Right-click → **Run as Administrator** (for Virtual Hosts)

2. **Start Services | เริ่ม Services**
   - Click **Start** on **Apache**
   - Click **Start** on **MariaDB**
   - Wait until status shows **Running** (green)

3. **Test | ทดสอบ**
   - Open browser and go to `http://localhost`
   - You should see the Welcome or Index page

### Dashboard Overview

The main dashboard shows:
- **Service Cards** - Apache, PHP, MariaDB status and controls
- **Quick Actions** - Open www folder, Config, Terminal, Database
- **Console Logs** - Real-time service logs
- **Navigation** - Projects, Virtual Hosts, SSL, Settings, etc.

---

## ⚙️ Managing Services

### Apache Web Server

| Action | Steps |
|--------|-------|
| **Start** | Click **Start** on Apache card → Wait for **Running** status |
| **Stop** | Click **Stop** on Apache card → Wait for **Stopped** status |
| **Restart** | Click Stop then Start (required after config changes) |

**Test:** Open `http://localhost` in your browser

### MariaDB Database

| Action | Steps |
|--------|-------|
| **Start** | Click **Start** on MariaDB card → Wait for **Running** status |
| **Stop** | Click **Stop** on MariaDB card → Wait for **Stopped** status |

**Default Credentials:**
- Username: `root`
- Password: `root`

### PHP

PHP runs automatically with Apache - no separate start needed.

---

## 📁 Creating Projects

### Create New Project

1. Go to **Projects** menu
2. Click **Create New Project**
3. Fill in:
   - **Project Name:** Name for the project (used as URL path)
   - **Template:** Choose PHP Basic or HTML Basic
   - **Create Database:** Check if you need a database
4. Click **Create**

### Available Templates

| Template | Description |
|----------|-------------|
| **PHP Basic** | PHP project with index.php |
| **HTML Basic** | Basic HTML/CSS/JS project |

### Access Your Project

- **URL:** `http://localhost/project-name`
- **Folder:** `C:\LocalDevine\www\project-name`

### Delete Project

1. Go to **Projects** menu
2. Click the **🗑️** icon on the project
3. Confirm deletion

> ⚠️ **Warning:** Deleting a project removes all files in that folder

---

## 🌐 Virtual Hosts

Virtual Hosts let you use custom local domains instead of `localhost/project`

### Benefits

| Without Virtual Host | With Virtual Host |
|---------------------|-------------------|
| `http://localhost/mysite` | `http://mysite.local` |
| `http://localhost/blog` | `http://blog.test` |

### Create Virtual Host

1. **Run LocalDevine as Administrator** (required!)
2. Go to **Virtual Hosts** menu
3. Click **Add Virtual Host**
4. Fill in:
   - **Name:** Display name
   - **Domain:** e.g., `mysite.local`
   - **Path:** Select project folder
5. Click **Add**
6. **Restart Apache**

### Recommended Domains

| Domain | Notes |
|--------|-------|
| `*.local` | ✅ Recommended |
| `*.test` | ✅ Recommended |
| `*.dev` | ❌ Not recommended (used by Google) |
| `*.localhost` | ✅ Works fine |

### Delete Virtual Host

1. Go to **Virtual Hosts** menu
2. Click the **🗑️** icon
3. Restart Apache

---

## 🗄️ Database Management

### Access Adminer

1. Click **🗄️ Database** button on dashboard
2. Adminer opens in browser
3. Login with:
   - **System:** MySQL
   - **Server:** `127.0.0.1`
   - **Username:** `root`
   - **Password:** `root`

### Create Database

1. Open Adminer
2. Click **Create database**
3. Enter database name
4. Select **utf8mb4_unicode_ci**
5. Click **Save**

### Import/Export

| Action | Steps |
|--------|-------|
| **Import** | Select database → Click Import → Choose `.sql` file → Execute |
| **Export** | Select database → Click Export → Choose SQL format → Export |

---

## 🔐 SSL Certificates

Generate self-signed SSL certificates for HTTPS development.

### Generate Certificate

1. Go to **SSL** menu
2. Click **Generate Certificate**
3. Enter domain name (e.g., `mysite.local`)
4. Click **Generate**
5. Certificate files are created in the SSL folder

### Trust Certificate

1. Click **Trust** button next to the certificate
2. Windows will ask for confirmation
3. Certificate is added to trusted root

### Use with Virtual Host

After generating SSL certificate:
1. Go to **Virtual Hosts**
2. Enable **SSL** option when creating/editing virtual host
3. Restart Apache
4. Access via `https://yourdomain.local`

---

## 🌍 Environment Variables

Manage `.env` files for your projects.

### View/Edit .env

1. Go to **Environment** menu
2. Select a project
3. View and edit environment variables
4. Click **Save**

### Create .env

1. Go to **Environment** menu
2. Select a project without `.env`
3. Click **Create .env**
4. Add your variables
5. Click **Save**

---

## 📝 Hosts File Editor

Edit Windows hosts file without opening Notepad.

### Add Entry

1. Go to **Hosts File** menu
2. Click **Add Entry**
3. Enter IP Address (e.g., `127.0.0.1`)
4. Enter Hostname (e.g., `mysite.local`)
5. Click **Add**

### Toggle/Delete Entry

- Click the toggle to enable/disable an entry
- Click **🗑️** to delete an entry

> ⚠️ **Note:** Requires Administrator privileges

---

## 📂 Quick Access

Easy access to important folders from Settings.

### Available Folders

| Button | Location | Purpose |
|--------|----------|---------|
| **⚙️ Bin Folder** | `Program Files\LocalDevine\...\bin` | Apache, PHP, MariaDB executables |
| **📄 Config Folder** | `C:\LocalDevine\config` | php.ini, httpd.conf |
| **🌐 WWW Folder** | `C:\LocalDevine\www` | Your projects |
| **📋 Logs Folder** | `%APPDATA%\LocalDevine\logs` | Application logs |

### Access Quick Folders

1. Go to **Settings**
2. Scroll to **Quick Access** section
3. Click any folder button to open in Explorer

---

## ⚙️ Settings

### Port Configuration

| Service | Default Port | How to Change |
|---------|--------------|---------------|
| Apache | 80 | Settings → Apache Port |
| MariaDB | 3306 | Settings → MariaDB Port |

After changing ports, restart the services.

### Auto-start Services

1. Go to **Settings**
2. Enable **Auto-start services on launch**
3. Services will start automatically when app opens

### Theme

- Toggle between **Light** and **Dark** theme
- Theme preference is saved automatically

---

## 🔧 Troubleshooting

### Apache Won't Start

**Possible causes:**
- Port 80 is in use by another program (Skype, IIS, etc.)
- Config file has errors

**Solution:**
```powershell
# Check what's using port 80
netstat -ano | findstr :80

# Change Apache port in Settings, or stop the conflicting program
```

### MariaDB Won't Start

**Possible causes:**
- Port 3306 is in use
- Lock files exist from previous crash

**Solution:**
1. Delete `C:\LocalDevine\data\mariadb\*.pid` files
2. Try starting again

### Virtual Host Not Working

**Checklist:**
- [ ] Run LocalDevine as Administrator
- [ ] Domain is in hosts file
- [ ] Restart Apache after adding Virtual Host
- [ ] Check path is correct

### Can't Access localhost

**Checklist:**
- [ ] Apache is running (green status)
- [ ] No firewall blocking port 80
- [ ] Try `http://127.0.0.1` instead

### Can't Login to Adminer

**Check:**
- MariaDB is running
- Use these credentials:
  - Server: `127.0.0.1`
  - Username: `root`
  - Password: `root`

### Can't Access Bin Folder

**Solution:**
1. Go to **Settings** → **Quick Access**
2. Click **⚙️ Bin Folder**
3. In production, bin folder is in Program Files

---

## 📞 Contact & Support

- **GitHub Issues:** [Report Bug](https://github.com/ohmiler/localdevine/issues)
- **GitHub:** [ohmiler/localdevine](https://github.com/ohmiler/localdevine)

---

<p align="center">
  <strong>LocalDevine</strong> - Modern Local Development Environment for Windows<br>
  Made with ❤️ by <a href="https://github.com/ohmiler">Miler</a>
</p>

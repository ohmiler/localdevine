# 📋 รายการทดสอบ LocalDevine v1.0.0

**วันที่อัพเดท:** 23 มกราคม 2026  
**เวอร์ชัน:** 1.0.0

รายการทดสอบครบถ้วนสำหรับการปล่อย v1.0.0 - First Stable Release

---

## 🔴 Critical Tests (ต้องทดสอบก่อน)

### 1. การติดตั้งและเปิดโปรแกรม
- [ ] **ติดตั้งโปรแกรม**
  - [ ] รัน `LocalDevine Setup 1.0.0.exe`
  - [ ] เลือกตำแหน่งติดตั้ง
  - [ ] ติดตั้งสำเร็จโดยไม่มี error
  - [ ] ขนาดไฟล์ติดตั้ง ~162 MB (ไม่เกิน 200 MB)

- [ ] **เปิดโปรแกรมครั้งแรก**
  - [ ] ดับเบิลคลิก `LocalDevine.exe` เปิดได้ปกติ
  - [ ] **ไม่มี error dialog "exports is not defined"**
  - [ ] หน้าต่างโปรแกรมแสดงขึ้นมา
  - [ ] UI แสดงผลถูกต้อง (ไม่มี blank screen)

- [ ] **ทดสอบเปิด-ปิดหลายครั้ง**
  - [ ] เปิดโปรแกรม 3-5 ครั้งติดต่อกัน
  - [ ] ปิดโปรแกรมแล้วเปิดใหม่
  - [ ] ไม่มี memory leak หรือ crash

---

## 🟡 Core Features Tests

### 2. Services Management (Apache, PHP, MariaDB)

#### Apache Service
- [ ] **Start Apache**
  - [ ] คลิกปุ่ม Start บน Apache card
  - [ ] สถานะเปลี่ยนเป็น "Running" (สีเขียว)
  - [ ] Console แสดง log "Apache started on port 80"
  - [ ] เปิด Browser ไปที่ `http://localhost` ทำงานได้
  - [ ] เปิด Browser ไปที่ `http://127.0.0.1` ทำงานได้

- [ ] **Stop Apache**
  - [ ] คลิกปุ่ม Stop
  - [ ] สถานะเปลี่ยนเป็น "Stopped"
  - [ ] `http://localhost` ไม่สามารถเข้าถึงได้

- [ ] **Restart Apache**
  - [ ] Stop แล้ว Start ใหม่
  - [ ] ทำงานได้ปกติ

#### MariaDB Service
- [ ] **Start MariaDB**
  - [ ] คลิกปุ่ม Start บน MariaDB card
  - [ ] สถานะเปลี่ยนเป็น "Running" (สีเขียว)
  - [ ] Console แสดง log "MariaDB started on port 3306"
  - [ ] รอ 10-15 วินาที (ให้ MariaDB initialize)

- [ ] **Stop MariaDB**
  - [ ] คลิกปุ่ม Stop
  - [ ] สถานะเปลี่ยนเป็น "Stopped"

- [ ] **Health Check**
  - [ ] Health monitoring ตรวจสอบสถานะได้
  - [ ] ไม่มี false positive error

#### PHP Service
- [ ] **PHP Active**
  - [ ] PHP แสดงสถานะ "Active" (ไม่ต้อง start แยก)
  - [ ] Apache ทำงานร่วมกับ PHP ได้

#### Multiple Services
- [ ] **Start ทั้งหมด**
  - [ ] Start Apache และ MariaDB พร้อมกัน
  - [ ] ทั้งสอง services ทำงานได้พร้อมกัน
  - [ ] ไม่มี port conflict

---

### 3. Project Management

- [ ] **สร้างโปรเจค PHP Basic**
  - [ ] ไปที่เมนู Projects
  - [ ] คลิก "Create New Project"
  - [ ] ใส่ชื่อโปรเจค (เช่น `test-project`)
  - [ ] เลือก Template: PHP Basic
  - [ ] คลิก Create
  - [ ] โปรเจคถูกสร้างใน `www/test-project`
  - [ ] เปิด `http://localhost/test-project` แสดงผลได้

- [ ] **สร้างโปรเจค HTML Basic**
  - [ ] สร้างโปรเจคใหม่ด้วย HTML Basic template
  - [ ] ไฟล์ `index.html` ถูกสร้าง
  - [ ] เปิดใน Browser แสดงผลได้

- [ ] **สร้างโปรเจคพร้อม Database**
  - [ ] ติ๊ก "Create Database"
  - [ ] Database ถูกสร้างใน MariaDB
  - [ ] ชื่อ database ตรงกับชื่อโปรเจค

- [ ] **ลบโปรเจค**
  - [ ] คลิกปุ่มลบ (🗑️) ของโปรเจค
  - [ ] ยืนยันการลบ
  - [ ] โฟลเดอร์และไฟล์ถูกลบ
  - [ ] Database (ถ้ามี) ถูกลบด้วย

---

### 4. Virtual Hosts

- [ ] **สร้าง Virtual Host (ต้อง Run as Administrator)**
  - [ ] คลิกขวา LocalDevine → Run as Administrator
  - [ ] ไปที่เมนู Virtual Hosts
  - [ ] คลิก "Add Virtual Host"
  - [ ] ใส่ Name: `My Test Site`
  - [ ] ใส่ Domain: `mysite.local`
  - [ ] เลือก Path ของโปรเจค
  - [ ] คลิก Add
  - [ ] Restart Apache
  - [ ] เปิด `http://mysite.local` ทำงานได้

- [ ] **แก้ไข Virtual Host**
  - [ ] แก้ไข domain หรือ path
  - [ ] Restart Apache
  - [ ] ทำงานได้ตามที่แก้ไข

- [ ] **ลบ Virtual Host**
  - [ ] คลิกปุ่มลบ Virtual Host
  - [ ] Restart Apache
  - [ ] Domain ถูกลบออกจาก hosts file

- [ ] **Multiple Virtual Hosts**
  - [ ] สร้าง Virtual Host หลายตัว
  - [ ] แต่ละ domain ทำงานได้ถูกต้อง

---

### 5. Database Management

- [ ] **เปิด Adminer**
  - [ ] คลิกปุ่ม "🗄️ Database" ที่หน้าหลัก
  - [ ] Adminer เปิดใน Browser
  - [ ] Login ด้วย:
    - System: MySQL
    - Server: 127.0.0.1
    - Username: root
    - Password: root
  - [ ] Login สำเร็จ

- [ ] **สร้าง Database**
  - [ ] สร้าง database ใหม่ใน Adminer
  - [ ] ตั้งชื่อ database
  - [ ] เลือก Collation: utf8mb4_unicode_ci
  - [ ] Database ถูกสร้างสำเร็จ

- [ ] **Import Database**
  - [ ] Import ไฟล์ .sql
  - [ ] ข้อมูลถูก import สำเร็จ

- [ ] **Query Database**
  - [ ] รัน SQL query ใน Adminer
  - [ ] ผลลัพธ์แสดงถูกต้อง

---

### 6. Hosts File Editor

- [ ] **ดู Hosts Entries (ต้อง Run as Administrator)**
  - [ ] ไปที่เมนู Hosts File
  - [ ] แสดงรายการ entries ทั้งหมด
  - [ ] แสดง IP และ Hostname

- [ ] **เพิ่ม Hosts Entry**
  - [ ] คลิก "Add Entry"
  - [ ] ใส่ IP: `127.0.0.1`
  - [ ] ใส่ Hostname: `test.local`
  - [ ] คลิก Add
  - [ ] Entry ถูกเพิ่มใน hosts file

- [ ] **ลบ Hosts Entry**
  - [ ] คลิกปุ่มลบ entry
  - [ ] Entry ถูกลบออกจาก hosts file

- [ ] **แก้ไข Hosts File โดยตรง**
  - [ ] แก้ไข hosts file ด้วย Notepad
  - [ ] กลับมา LocalDevine แล้ว refresh
  - [ ] แสดงการเปลี่ยนแปลง

---

### 7. Settings

- [ ] **เปลี่ยน Apache Port**
  - [ ] ไปที่ Settings
  - [ ] เปลี่ยน Apache Port เป็น 8080
  - [ ] Save
  - [ ] Restart Apache
  - [ ] เปิด `http://localhost:8080` ทำงานได้

- [ ] **เปลี่ยน MariaDB Port**
  - [ ] เปลี่ยน MariaDB Port เป็น 3307
  - [ ] Save
  - [ ] Restart MariaDB
  - [ ] เชื่อมต่อ database ด้วย port 3307 ได้

- [ ] **Auto-start Services**
  - [ ] เปิด "Auto-start services on launch"
  - [ ] ปิดโปรแกรมแล้วเปิดใหม่
  - [ ] Services start อัตโนมัติ

- [ ] **เปลี่ยน Data Path**
  - [ ] เปลี่ยนตำแหน่ง www folder
  - [ ] Save
  - [ ] โปรเจคเก่ายังอยู่ที่เดิม
  - [ ] โปรเจคใหม่ถูกสร้างที่ path ใหม่

---

## 🟢 Additional Features Tests

### 8. System Tray

- [ ] **Minimize to Tray**
  - [ ] คลิกปุ่ม minimize
  - [ ] โปรแกรม minimize ไปที่ system tray
  - [ ] ไอคอนแสดงใน system tray

- [ ] **Tray Menu**
  - [ ] คลิกขวาไอคอนใน tray
  - [ ] แสดงเมนู: Show, Start/Stop Services, Quit
  - [ ] คลิก Show เปิดหน้าต่างกลับมา

- [ ] **Quit from Tray**
  - [ ] คลิก Quit จาก tray menu
  - [ ] Services ถูก stop ก่อน quit
  - [ ] โปรแกรมปิดอย่างถูกต้อง

---

### 9. Console Logs

- [ ] **ดู Console Logs**
  - [ ] Console panel แสดง logs
  - [ ] Logs แสดง timestamp
  - [ ] Logs แสดง service name
  - [ ] Logs แสดง message

- [ ] **Clear Console**
  - [ ] คลิก Clear logs
  - [ ] Logs ถูกลบ

- [ ] **Real-time Logs**
  - [ ] Start service
  - [ ] Logs แสดงทันที

---

### 10. UI/UX Tests

- [ ] **Dark/Light Theme**
  - [ ] เปลี่ยน theme
  - [ ] UI เปลี่ยนสีตาม theme
  - [ ] Theme ถูกบันทึก

- [ ] **Keyboard Shortcuts**
  - [ ] กด Ctrl+S (Start All)
  - [ ] กด Ctrl+T (Stop All)
  - [ ] Shortcuts ทำงานได้

- [ ] **Responsive UI**
  - [ ] ปรับขนาดหน้าต่าง
  - [ ] UI แสดงผลถูกต้องทุกขนาด

---

### 11. Error Handling

- [ ] **Port Already in Use**
  - [ ] ใช้โปรแกรมอื่น (เช่น IIS) ใช้ port 80
  - [ ] Start Apache
  - [ ] แสดง error message ที่ชัดเจน
  - [ ] สถานะเป็น "Error"

- [ ] **Service Crash**
  - [ ] Start service แล้ว kill process
  - [ ] Health check ตรวจจับได้
  - [ ] แสดง notification

- [ ] **Permission Error**
  - [ ] เปิดโปรแกรมโดยไม่ใช่ Administrator
  - [ ] พยายามแก้ไข hosts file
  - [ ] แสดง error message

---

### 12. Performance & Size

- [ ] **ขนาดไฟล์ติดตั้ง**
  - [ ] ไฟล์ `LocalDevine Setup 1.0.0.exe` ~162 MB
  - [ ] ไม่เกิน 200 MB

- [ ] **ขนาดหลังติดตั้ง**
  - [ ] โฟลเดอร์ติดตั้งไม่เกิน 500 MB
  - [ ] ไม่มีไฟล์ที่ไม่จำเป็น (.pdb, .lib, .h, temp folders)

- [ ] **Memory Usage**
  - [ ] เปิดโปรแกรม idle: < 200 MB RAM
  - [ ] Start services: < 500 MB RAM
  - [ ] ไม่มี memory leak

- [ ] **Startup Time**
  - [ ] เปิดโปรแกรม < 3 วินาที
  - [ ] Start services < 10 วินาที

---

### 13. Auto Updater

- [ ] **Check for Updates**
  - [ ] ไปที่ Settings → Check for Updates
  - [ ] ตรวจสอบ update จาก GitHub
  - [ ] แสดงสถานะ (up to date / new version available)

- [ ] **Update Notification**
  - [ ] ถ้ามี update ใหม่
  - [ ] แสดง notification
  - [ ] มีลิงก์ไปที่ release page

---

## 🔵 Edge Cases & Stress Tests

### 14. Edge Cases

- [ ] **Start/Stop เร็วๆ**
  - [ ] Start แล้ว Stop ทันที (หลายครั้ง)
  - [ ] ไม่มี crash หรือ error

- [ ] **Multiple Windows**
  - [ ] เปิด LocalDevine หลายหน้าต่าง (ถ้าทำได้)
  - [ ] หรือทดสอบเปิด-ปิดเร็วๆ

- [ ] **Network Issues**
  - [ ] ตัด internet
  - [ ] Auto updater ไม่ crash

- [ ] **Disk Space Full**
  - [ ] สร้างโปรเจคเมื่อ disk เต็ม
  - [ ] แสดง error message

- [ ] **Invalid Config**
  - [ ] แก้ไข config.json ให้ผิด
  - [ ] โปรแกรมยังเปิดได้
  - [ ] แสดง error message

---

### 15. Cleanup & Uninstall

- [ ] **Uninstall**
  - [ ] Uninstall จาก Control Panel
  - [ ] ไฟล์ถูกลบหมด
  - [ ] Services ถูก stop ก่อน uninstall

- [ ] **Reinstall**
  - [ ] Uninstall แล้วติดตั้งใหม่
  - [ ] ทำงานได้ปกติ

---

## 📝 Notes สำหรับการทดสอบ

### สิ่งที่ต้องระวัง

1. **Run as Administrator**
   - Virtual Hosts และ Hosts File Editor ต้องใช้สิทธิ์ Administrator
   - ทดสอบทั้งแบบ Administrator และไม่ใช่

2. **Port Conflicts**
   - ตรวจสอบว่า port 80, 3306 ไม่ถูกใช้งาน
   - ถ้าใช้ IIS หรือ MySQL อื่นๆ ให้ปิดก่อน

3. **Firewall**
   - Windows Firewall อาจ block
   - อนุญาต LocalDevine ผ่าน firewall

4. **Antivirus**
   - Antivirus อาจ block การแก้ไข hosts file
   - เพิ่ม exception ถ้าจำเป็น

---

## ✅ สรุปผลการทดสอบ

### Critical Tests: ___ / 3
### Core Features: ___ / 6
### Additional Features: ___ / 5
### Edge Cases: ___ / 2

### Issues Found:
1. 
2. 
3. 

### Overall Status: ⬜ Pass / ⬜ Fail

---

## 📊 สถิติโปรเจค

| Metric | Value |
|--------|-------|
| **TypeScript Lines** | ~3,500+ |
| **React Components** | 16 |
| **Electron Services** | 13 |
| **Code Review Issues** | 49 found, 4 critical fixed, 6 ESLint errors fixed |
| **Installer Size** | ~165 MB |
| **Installed Size** | ~792 MB |

---

## 🔒 Security Checklist

### Critical Security Issues (Reviewed)
- [x] **Path Traversal** - Input validation สำหรับชื่อโปรเจค
- [x] **SQL Injection** - Database name validation
- [x] **Command Injection** - PowerShell sanitization
- [x] **IPC Validation** - Input type checking

### Code Quality Issues (Reviewed ✅)
- [x] **Memory leak prevention (setTimeout cleanup)** - ทุก component มี cleanup ด้วย `clearTimeout()` ใน useEffect return
  - App.tsx: `notificationTimeoutsRef`, `autoDismissTimersRef` with proper cleanup
  - All panels: XdebugPanel, VirtualHosts, SSLManager, Settings, etc. ใช้ pattern `return () => clearTimeout(timer)`
- [x] **Race condition handling** - มีการจัดการอย่างเหมาะสม
  - ServiceManager: `Promise.allSettled()` for parallel health checks
  - Sequential service startup with delays (500ms-3000ms between services)
  - MailHogManager: checks `isRunning()` before start/stop
  - ProjectTemplateManager: handles EBUSY/ENOTEMPTY for locked files
- [x] **Database connection cleanup** - ใช้ try/finally pattern ทุก method
  - `if (connection) await connection.end()` ใน finally blocks
  - listDatabases, createDatabase, deleteDatabase, listTables, importSQL, exportDatabase
- [x] **Accessibility attributes** - พื้นฐานครบ
  - VirtualHosts: `tabIndex={-1}` for focus management
  - themes.css: `[role="button"]` cursor styling
  - Note: อาจเพิ่ม aria-labels ในอนาคตเพื่อ screen reader support

---

## 🚀 ขั้นตอนการ Build & Release

### 1. Build
```bash
npm run build
npm run build:electron
npm run electron:build
```

### 2. Test Installer
- [ ] ติดตั้งบนเครื่องใหม่ (fresh Windows)
- [ ] ทดสอบการอัพเกรดจากเวอร์ชันเก่า
- [ ] ทดสอบการ uninstall และ reinstall

### 3. Release to GitHub
- [ ] สร้าง tag v1.0.0
- [ ] อัพโหลด installer ไป GitHub Releases
- [ ] ตรวจสอบ auto-updater

---

**วันที่ทดสอบ:** _____________  
**ผู้ทดสอบ:** _____________  
**เวอร์ชัน:** v1.0.0

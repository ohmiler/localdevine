const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');

class UpdateManager {
  constructor() {
    this.appPath = path.dirname(process.execPath);
    this.updateUrl = 'https://api.github.com/repos/ohmiler/localdevine/releases/latest';
  }

  async checkForUpdates() {
    try {
      const currentVersion = require('../package.json').version;
      console.log(`Update check: Current version = ${currentVersion}`);
      
      const response = await this.fetch(this.updateUrl);
      const release = JSON.parse(response);
      
      console.log(`Update check: Latest version = ${release.tag_name}`);
      
      if (this.isNewerVersion(release.tag_name, currentVersion)) {
        return {
          hasUpdate: true,
          version: release.tag_name,
          downloadUrl: this.getDownloadUrl(release.assets),
          releaseNotes: release.body
        };
      }
      
      console.log('No update available');
      return { hasUpdate: false };
    } catch (error) {
      // 404 = no releases yet, not an error
      if (error.message && error.message.includes('404')) {
        console.log('No releases found on GitHub (first release pending)');
        return { hasUpdate: false };
      }
      console.error('Update check failed:', error.message);
      return { hasUpdate: false, error: error.message };
    }
  }

  async performUpdate(updateInfo) {
    try {
      console.log('Starting update...');
      
      // 1. Stop all services
      await this.stopServices();
      
      // 2. Download update
      const updateFile = await this.downloadUpdate(updateInfo.downloadUrl);
      
      // 3. Extract update (if it's a zip)
      await this.extractUpdate(updateFile);
      
      // 4. Update files (except user data)
      await this.updateFiles();
      
      // 5. Restart application
      await this.restartApp();
      
      return { success: true };
    } catch (error) {
      console.error('Update failed:', error);
      return { success: false, error: error.message };
    }
  }

  async stopServices() {
    // Send stop signal to main process
    if (global.serviceManager) {
      await global.serviceManager.stopAllServices();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async downloadUpdate(url) {
    const updateFile = path.join(this.appPath, 'update.zip');
    
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(updateFile);
      
      https.get(url, (response) => {
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve(updateFile);
        });
      }).on('error', (err) => {
        fs.unlink(updateFile, () => {});
        reject(err);
      });
    });
  }

  async extractUpdate(zipFile) {
    // Use 7-zip or built-in extraction
    const extractPath = path.join(this.appPath, 'update-temp');
    
    // Create extraction command
    const command = `powershell -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${extractPath}' -Force"`;
    
    return new Promise((resolve, reject) => {
      spawn(command, [], { shell: true }).on('close', (code) => {
        if (code === 0) {
          resolve(extractPath);
        } else {
          reject(new Error(`Extraction failed with code ${code}`));
        }
      });
    });
  }

  async updateFiles() {
    const updatePath = path.join(this.appPath, 'update-temp');
    const excludePaths = [
      'www',           // User projects
      'bin/mariadb/data', // User databases
      'config.json',  // User config
      'hosts.backup'  // Hosts backup
    ];

    // Copy new files
    await this.copyDirectory(updatePath, this.appPath, excludePaths);
    
    // Cleanup
    fs.rmSync(updatePath, { recursive: true, force: true });
    fs.unlinkSync(path.join(this.appPath, 'update.zip'));
  }

  async copyDirectory(src, dest, excludePaths) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      // Skip excluded paths
      if (excludePaths.some(exclude => srcPath.includes(exclude))) {
        console.log(`Skipping: ${srcPath}`);
        continue;
      }
      
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        await this.copyDirectory(srcPath, destPath, excludePaths);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  async restartApp() {
    // Restart the application
    const { app } = require('electron');
    
    app.relaunch();
    app.exit();
  }

  isNewerVersion(latest, current) {
    const latestParts = latest.replace('v', '').split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
      const latestPart = latestParts[i] || 0;
      const currentPart = currentParts[i] || 0;
      
      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }
    
    return false;
  }

  getDownloadUrl(assets) {
    // Find Windows installer
    const windowsAsset = assets.find(asset => 
      asset.name.endsWith('.exe') || asset.name.endsWith('.zip')
    );
    
    return windowsAsset ? windowsAsset.browser_download_url : null;
  }

  fetch(url) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'LocalDevine-Update-Checker'
        }
      };
      
      https.get(url, options, (res) => {
        let data = '';
        
        // Check response status
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve(data);
          } catch (error) {
            console.log('Response data:', data.substring(0, 200));
            reject(error);
          }
        });
        res.on('error', reject);
      });
    });
  }
}

module.exports = UpdateManager;

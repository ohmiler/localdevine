"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    // Service control
    startService: (service) => ipcRenderer.send('start-service', service),
    stopService: (service) => ipcRenderer.send('stop-service', service),
    startAllServices: () => ipcRenderer.send('start-all-services'),
    stopAllServices: () => ipcRenderer.send('stop-all-services'),
    // Get app version
    getVersion: () => ipcRenderer.invoke('get-version'),
    // Config management
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    // Folder operations
    openFolder: (folderType) => ipcRenderer.send('open-folder', folderType),
    openTerminal: () => ipcRenderer.send('open-terminal'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    // Virtual Hosts
    getVHosts: () => ipcRenderer.invoke('get-vhosts'),
    addVHost: (vhost) => ipcRenderer.invoke('add-vhost', vhost),
    removeVHost: (id) => ipcRenderer.invoke('remove-vhost', id),
    // PHP Versions
    getPHPVersions: () => ipcRenderer.invoke('get-php-versions'),
    setPHPVersion: (version) => ipcRenderer.invoke('set-php-version', version),
    // Hosts File
    getHostsEntries: () => ipcRenderer.invoke('get-hosts-entries'),
    addHostsEntry: (ip, hostname, comment) => ipcRenderer.invoke('add-hosts-entry', ip, hostname, comment),
    removeHostsEntry: (hostname) => ipcRenderer.invoke('remove-hosts-entry', hostname),
    toggleHostsEntry: (hostname) => ipcRenderer.invoke('toggle-hosts-entry', hostname),
    restoreHostsBackup: () => ipcRenderer.invoke('restore-hosts-backup'),
    checkHostsAdminRights: () => ipcRenderer.invoke('check-hosts-admin-rights'),
    requestHostsAdminRights: () => ipcRenderer.send('request-hosts-admin-rights'),
    // Project Templates
    getTemplates: () => ipcRenderer.invoke('get-templates'),
    getProjects: () => ipcRenderer.invoke('get-projects'),
    createProject: (options) => ipcRenderer.invoke('create-project', options),
    deleteProject: (projectName) => ipcRenderer.invoke('delete-project', projectName),
    openProjectFolder: (projectName) => ipcRenderer.invoke('open-project-folder', projectName),
    openProjectBrowser: (projectName) => ipcRenderer.invoke('open-project-browser', projectName),
    openBrowser: (url) => ipcRenderer.invoke('open-browser', url),
    // Event listeners
    on: (channel, callback) => {
        const allowedChannels = ['service-status', 'log-entry', 'health-status', 'service-notification'];
        if (allowedChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(event, ...args));
        }
    },
    removeListener: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    }
});

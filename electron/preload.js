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

    // Event listeners
    on: (channel, callback) => {
        const allowedChannels = ['service-status', 'log-entry'];
        if (allowedChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(event, ...args));
        }
    },
    removeListener: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    }
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Service control
    startService: (service) => ipcRenderer.send('start-service', service),
    stopService: (service) => ipcRenderer.send('stop-service', service),
    startAllServices: () => ipcRenderer.send('start-all-services'),
    stopAllServices: () => ipcRenderer.send('stop-all-services'),

    // Get app version
    getVersion: () => ipcRenderer.invoke('get-version'),

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

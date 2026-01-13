"use strict";
try {
    var electron = require('electron');
    console.log('Electron module loaded successfully');
    console.log('Electron app:', typeof electron.app);
    console.log('Electron BrowserWindow:', typeof electron.BrowserWindow);
    if (typeof electron.app === 'undefined') {
        console.error('FATAL: electron module returned undefined/string. Exiting.');
        process.exit(1);
    }
    electron.app.whenReady().then(() => {
        console.log('Electron app is ready');
        electron.app.quit();
    });
}
catch (error) {
    console.error('Error loading electron:', error);
    process.exit(1);
}

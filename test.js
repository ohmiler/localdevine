const electron = require('electron');
console.log('Electron Type:', typeof electron);
try {
    console.log('Version:', electron.app.getVersion());
} catch (e) {
    console.log('API access failed');
}

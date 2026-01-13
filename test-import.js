console.log('Testing imports...');

try {
  const { ServiceManager } = require('./dist-electron/services/ServiceManager');
  console.log('ServiceManager imported successfully:', typeof ServiceManager);
} catch (error) {
  console.error('ServiceManager import failed:', error.message);
}

try {
  const TrayManager = require('./dist-electron/services/TrayManager');
  console.log('TrayManager imported successfully:', typeof TrayManager);
} catch (error) {
  console.error('TrayManager import failed:', error.message);
}

try {
  const ConfigManager = require('./dist-electron/services/ConfigManager');
  console.log('ConfigManager imported successfully:', typeof ConfigManager);
} catch (error) {
  console.error('ConfigManager import failed:', error.message);
}

console.log('Import test completed.');

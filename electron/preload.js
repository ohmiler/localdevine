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
    openFolderPath: (folderPath) => ipcRenderer.send('open-folder-path', folderPath),
    openTerminal: () => ipcRenderer.send('open-terminal'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),

    // Virtual Hosts
    getVHosts: () => ipcRenderer.invoke('get-vhosts'),
    addVHost: (vhost) => ipcRenderer.invoke('add-vhost', vhost),
    removeVHost: (id) => ipcRenderer.invoke('remove-vhost', id),

    // PHP Versions
    getPHPVersions: () => ipcRenderer.invoke('get-php-versions'),
    setPHPVersion: (version) => ipcRenderer.invoke('set-php-version', version),
    switchPhpVersion: (version) => ipcRenderer.invoke('switch-php-version', version),
    
    // PHP Download
    phpGetAvailableVersions: () => ipcRenderer.invoke('php-get-available-versions'),
    phpGetInstalledVersions: () => ipcRenderer.invoke('php-get-installed-versions'),
    phpDownloadVersion: (version) => ipcRenderer.invoke('php-download-version', version),
    phpDownloadMultiple: (versions) => ipcRenderer.invoke('php-download-multiple', versions),

    // Data Path
    getDataPath: () => ipcRenderer.invoke('get-data-path'),
    setDataPath: (path) => ipcRenderer.invoke('set-data-path', path),

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
    openBrowser: (url) => ipcRenderer.send('open-browser', url),

    // Auto Update
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),

    // Database Manager
    dbList: () => ipcRenderer.invoke('db-list'),
    dbCreate: (name) => ipcRenderer.invoke('db-create', name),
    dbDelete: (name) => ipcRenderer.invoke('db-delete', name),
    dbTables: (database) => ipcRenderer.invoke('db-tables', database),
    dbImport: (database, filePath) => ipcRenderer.invoke('db-import', database, filePath),
    dbExport: (database, outputPath) => ipcRenderer.invoke('db-export', database, outputPath),
    dbQuery: (database, query) => ipcRenderer.invoke('db-query', database, query),
    dbTestConnection: () => ipcRenderer.invoke('db-test-connection'),
    dbSelectFile: () => ipcRenderer.invoke('db-select-file'),
    dbSaveFile: (defaultName) => ipcRenderer.invoke('db-save-file', defaultName),

    // Environment Variables Manager
    envListFiles: () => ipcRenderer.invoke('env-list-files'),
    envGetFile: (filename) => ipcRenderer.invoke('env-get-file', filename),
    envCreateFile: (filename, variables) => ipcRenderer.invoke('env-create-file', filename, variables),
    envSaveFile: (filename, variables) => ipcRenderer.invoke('env-save-file', filename, variables),
    envDeleteFile: (filename) => ipcRenderer.invoke('env-delete-file', filename),
    envGetDir: () => ipcRenderer.invoke('env-get-dir'),
    envOpenDir: () => ipcRenderer.invoke('env-open-dir'),

    // SSL Certificate Manager
    sslListCerts: () => ipcRenderer.invoke('ssl-list-certs'),
    sslGenerateCert: (domain) => ipcRenderer.invoke('ssl-generate-cert', domain),
    sslDeleteCert: (domain) => ipcRenderer.invoke('ssl-delete-cert', domain),
    sslTrustCert: (domain) => ipcRenderer.invoke('ssl-trust-cert', domain),
    sslUntrustCert: (domain) => ipcRenderer.invoke('ssl-untrust-cert', domain),
    sslGetCertInfo: (domain) => ipcRenderer.invoke('ssl-get-cert-info', domain),
    sslGetApacheConfig: (domain) => ipcRenderer.invoke('ssl-get-apache-config', domain),
    sslOpenDir: () => ipcRenderer.invoke('ssl-open-dir'),
    sslGetDir: () => ipcRenderer.invoke('ssl-get-dir'),
    sslCheckOpenSSL: () => ipcRenderer.invoke('ssl-check-openssl'),
    sslEnableDomain: (domain, projectPath) => ipcRenderer.invoke('ssl-enable-domain', domain, projectPath),
    sslDisableDomain: (domain) => ipcRenderer.invoke('ssl-disable-domain', domain),

    // Logs Management
    logsGetDir: () => ipcRenderer.invoke('logs-get-dir'),
    logsGetFile: () => ipcRenderer.invoke('logs-get-file'),
    logsOpenDir: () => ipcRenderer.invoke('logs-open-dir'),

    // Composer Manager
    composerGetStatus: () => ipcRenderer.invoke('composer-get-status'),
    composerInstall: () => ipcRenderer.invoke('composer-install'),
    composerGetProjectInfo: (projectPath) => ipcRenderer.invoke('composer-get-project-info', projectPath),
    composerRunInstall: (projectPath) => ipcRenderer.invoke('composer-run-install', projectPath),
    composerRunUpdate: (projectPath) => ipcRenderer.invoke('composer-run-update', projectPath),
    composerRunRequire: (projectPath, packageName, isDev) => ipcRenderer.invoke('composer-run-require', projectPath, packageName, isDev),
    composerRunRemove: (projectPath, packageName, isDev) => ipcRenderer.invoke('composer-run-remove', projectPath, packageName, isDev),
    composerRunDumpAutoload: (projectPath) => ipcRenderer.invoke('composer-run-dump-autoload', projectPath),
    composerInit: (projectPath, projectName) => ipcRenderer.invoke('composer-init', projectPath, projectName),
    composerRunCommand: (projectPath, command, args) => ipcRenderer.invoke('composer-run-command', projectPath, command, args),

    // Window utilities
    refocusWindow: () => ipcRenderer.invoke('refocus-window'),

    // Event listeners
    on: (channel, callback) => {
        const allowedChannels = ['service-status', 'log-entry', 'health-status', 'service-notification', 'update-status', 'php-download-progress', 'composer-output', 'composer-install-progress'];
        if (allowedChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(event, ...args));
        }
    },
    removeListener: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    }
});

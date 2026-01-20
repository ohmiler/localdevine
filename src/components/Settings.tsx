import { useState, useEffect } from 'react';
import { Config, PHPVersion } from '../types/electron';

interface SettingsProps {
  onBack: () => void;
}

interface DataPathInfo {
    current: string;
    default: string;
    isCustom: boolean;
}

function Settings({ onBack }: SettingsProps) {
    const [config, setConfig] = useState<Config>({
        ports: { php: 9000, apache: 80, mariadb: 3306 },
        database: { host: '127.0.0.1', port: 3306, user: 'root', password: 'root' },
        autoStart: false,
        vhosts: [],
        phpVersion: 'php'
    });
    const [showPassword, setShowPassword] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
    const [phpVersions, setPHPVersions] = useState<PHPVersion[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [version, setVersion] = useState('0.0.0');
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [updateStatus, setUpdateStatus] = useState('');
    const [dataPath, setDataPath] = useState<DataPathInfo>({ current: '', default: '', isCustom: false });
    const [newDataPath, setNewDataPath] = useState('');
    const [dataPathMessage, setDataPathMessage] = useState('');

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.getConfig().then(cfg => {
                if (cfg) setConfig(cfg);
            });
            window.electronAPI.getPHPVersions().then(versions => {
                setPHPVersions(versions || []);
            });
            window.electronAPI.getVersion().then(v => setVersion(v));
            window.electronAPI.getDataPath().then(info => {
                setDataPath(info);
                setNewDataPath(info.current);
            });
        }
    }, []);

    // Auto-clear messages
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const checkForUpdate = async () => {
        setCheckingUpdate(true);
        setUpdateStatus('Checking for updates...');
        
        try {
            const response = await fetch('https://api.github.com/repos/ohmiler/localdevine/releases/latest', {
                headers: { 'User-Agent': 'LocalDevine-Update-Checker' }
            });
            
            if (response.status === 404) {
                setUpdateStatus('✓ You have the latest version (no releases yet)');
            } else if (response.ok) {
                const release = await response.json();
                const latestVersion = release.tag_name.replace('v', '');
                
                if (latestVersion > version) {
                    setUpdateStatus(`🎉 Update available: v${latestVersion}`);
                } else {
                    setUpdateStatus('✓ You have the latest version');
                }
            } else {
                setUpdateStatus('⚠️ Could not check for updates');
            }
        } catch {
            setUpdateStatus('⚠️ Network error - please try again');
        }
        
        setCheckingUpdate(false);
    };

    const handlePortChange = (service: keyof Config['ports'], value: string) => {
        const port = parseInt(value, 10) || 0;
        setConfig((prev: Config) => ({
            ...prev,
            ports: { ...prev.ports, [service]: port }
        }));
    };

    const handleDatabaseChange = (field: keyof Config['database'], value: string | number) => {
        setConfig((prev: Config) => ({
            ...prev,
            database: { ...prev.database, [field]: value }
        }));
    };

    const handleTestConnection = async () => {
        setTestingConnection(true);
        setConnectionStatus(null);
        try {
            const result = await window.electronAPI.dbTestConnection();
            if (result.success) {
                setConnectionStatus('✅ Connection successful!');
            } else {
                setConnectionStatus(`❌ Connection failed: ${result.error}`);
            }
        } catch (err) {
            setConnectionStatus(`❌ Error: ${(err as Error).message}`);
        }
        setTestingConnection(false);
        setTimeout(() => setConnectionStatus(null), 5000);
    };

    const handlePHPVersionChange = async (version: string) => {
        setConfig((prev: Config) => ({ ...prev, phpVersion: version }));
        if (window.electronAPI) {
            await window.electronAPI.setPHPVersion(version);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);

        if (window.electronAPI) {
            const result = await window.electronAPI.saveConfig(config);
            if (result.success) {
                setSuccess('Settings saved! Restart services to apply.');
            } else {
                setError(result.error || 'Failed to save settings');
            }
        }

        setSaving(false);
    };

    const handleBrowseDataPath = async () => {
        if (window.electronAPI) {
            const selectedPath = await window.electronAPI.selectFolder();
            if (selectedPath) {
                setNewDataPath(selectedPath);
            }
        }
    };

    const handleSaveDataPath = async () => {
        if (!newDataPath.trim() || newDataPath === dataPath.current) {
            return;
        }

        if (window.electronAPI) {
            const result = await window.electronAPI.setDataPath(newDataPath);
            if (result.success) {
                setDataPathMessage('✓ Data path saved! Please restart LocalDevine to apply changes.');
                setDataPath(prev => ({ ...prev, current: newDataPath, isCustom: true }));
            } else {
                setDataPathMessage(`✗ Error: ${result.error}`);
            }
            setTimeout(() => setDataPathMessage(''), 5000);
        }
    };

    const handleResetDataPath = async () => {
        if (window.electronAPI) {
            const result = await window.electronAPI.setDataPath(dataPath.default);
            if (result.success) {
                setNewDataPath(dataPath.default);
                setDataPathMessage('✓ Reset to default path! Please restart LocalDevine to apply changes.');
                setDataPath(prev => ({ ...prev, current: dataPath.default, isCustom: false }));
            }
            setTimeout(() => setDataPathMessage(''), 5000);
        }
    };

    return (
        <div className="min-h-screen p-8">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display mb-2 header-title">
                        <span className="header-icon">⚙️</span>
                        <span className="header-text">Settings</span>
                    </h1>
                    <p className="text-lg text-gradient opacity-90">Configure your development environment</p>
                </div>
                <button
                    onClick={onBack}
                    className="button-secondary"
                >
                    ← Back
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Port Configuration */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-lg">
                            🔌
                        </div>
                        <h2 className="text-xl font-heading" style={{ color: 'var(--text-on-card)' }}>Port Configuration</h2>
                    </div>

                    <div className="space-y-4">
                        {/* PHP Port */}
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <label style={{ color: 'var(--text-label)' }}>🐘 PHP-CGI Port</label>
                            <input
                                type="number"
                                value={config.ports.php}
                                onChange={(e) => handlePortChange('php', e.target.value)}
                                className="input w-24 text-center"
                            />
                        </div>

                        {/* Apache Port */}
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <label style={{ color: 'var(--text-label)' }}>🪶 Apache Port</label>
                            <input
                                type="number"
                                value={config.ports.apache}
                                onChange={(e) => handlePortChange('apache', e.target.value)}
                                className="input w-24 text-center"
                            />
                        </div>

                        {/* MariaDB Port */}
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <label style={{ color: 'var(--text-label)' }}>🗄️ MariaDB Port</label>
                            <input
                                type="number"
                                value={config.ports.mariadb}
                                onChange={(e) => handlePortChange('mariadb', e.target.value)}
                                className="input w-24 text-center"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex items-center gap-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`px-6 py-3 rounded-xl font-semibold transition-all ${saving
                                ? 'bg-disabled text-disabled cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                                }`}
                        >
                            {saving ? '⏳ Saving...' : '💾 Save Settings'}
                        </button>

                        {error && (
                            <div className="p-3 rounded-lg text-sm bg-red-100 border border-red-300 text-red-700 flex justify-between items-center">
                                <span>❌ {error}</span>
                                <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
                            </div>
                        )}
                        {success && (
                            <div className="p-3 rounded-lg text-sm bg-green-100 border border-green-300 text-green-700 flex justify-between items-center">
                                <span>✅ {success}</span>
                                <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">✕</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* PHP Version */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-lg">
                            🐘
                        </div>
                        <h2 className="text-xl font-heading" style={{ color: 'var(--text-on-card)' }}>PHP Version</h2>
                    </div>

                    {phpVersions.length === 0 ? (
                        <div className="p-4 rounded-lg text-center" style={{ background: 'var(--bg-tertiary)' }}>
                            <div className="text-3xl mb-2">📭</div>
                            <p style={{ color: 'var(--text-on-card)' }}>No PHP versions found.</p>
                            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>Add PHP folders to bin/ (e.g., php81, php82, php83)</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {phpVersions.map(version => (
                                <label
                                    key={version.id}
                                    className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all hover:shadow-md ${config.phpVersion === version.id
                                            ? 'ring-2 ring-blue-500 shadow-lg'
                                            : ''
                                        }`}
                                    style={{ background: 'var(--bg-tertiary)' }}
                                >
                                    <input
                                        type="radio"
                                        name="phpVersion"
                                        value={version.id}
                                        checked={config.phpVersion === version.id}
                                        onChange={() => handlePHPVersionChange(version.id)}
                                        className="w-5 h-5"
                                    />
                                    <div>
                                        <p className="font-semibold" style={{ color: 'var(--text-on-card)' }}>{version.name}</p>
                                        <p className="text-xs truncate max-w-xs" style={{ color: 'var(--text-secondary)' }}>{version.path}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}

                    <p className="mt-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        ℹ️ Note: Restart PHP service after changing version.
                    </p>
                </div>

                {/* Startup Options */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-lg">
                            🚀
                        </div>
                        <h2 className="text-xl font-heading" style={{ color: 'var(--text-on-card)' }}>Startup Options</h2>
                    </div>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between cursor-pointer p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                            <div>
                                <p className="font-semibold" style={{ color: 'var(--text-on-card)' }}>Auto Start Services</p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Start all services when app launches</p>
                            </div>
                            <div
                                onClick={() => setConfig((prev: Config) => ({ ...prev, autoStart: !prev.autoStart }))}
                                className="relative w-14 h-7 rounded-full transition-all cursor-pointer"
                                style={{ background: config.autoStart ? 'var(--gradient-success)' : 'var(--bg-disabled)' }}
                            >
                                <div
                                    className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                                        config.autoStart ? 'translate-x-8' : 'translate-x-1'
                                    }`}
                                />
                            </div>
                        </label>
                    </div>

                    <p className="mt-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        ℹ️ Changes will apply on next app launch.
                    </p>
                </div>

                {/* Update Check */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-lg">
                            🔄
                        </div>
                        <h2 className="text-xl font-heading" style={{ color: 'var(--text-on-card)' }}>Updates</h2>
                    </div>

                    <div className="p-4 rounded-xl mb-4" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold" style={{ color: 'var(--text-on-card)' }}>Current Version</p>
                                <p className="text-2xl font-heading" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>v{version}</p>
                            </div>
                            <button
                                onClick={checkForUpdate}
                                disabled={checkingUpdate}
                                className={`px-6 py-3 rounded-xl font-semibold transition-all ${checkingUpdate
                                    ? 'bg-disabled text-disabled cursor-not-allowed'
                                    : 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                                }`}
                            >
                                {checkingUpdate ? '⏳ Checking...' : '🔍 Check for Updates'}
                            </button>
                        </div>
                    </div>

                    {updateStatus && (
                        <div className={`p-3 rounded-lg text-sm font-medium ${
                            updateStatus.includes('✓') ? 'bg-green-500/20 text-green-400' :
                            updateStatus.includes('🎉') ? 'bg-blue-500/20 text-blue-400' :
                            'bg-yellow-500/20 text-yellow-400'
                        }`}>
                            {updateStatus}
                        </div>
                    )}

                    <p className="mt-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        ℹ️ LocalDevine checks for updates automatically on startup.
                    </p>
                </div>

                {/* Data Path Configuration */}
                <div className="card p-6 lg:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-lg">
                            📁
                        </div>
                        <h2 className="text-xl font-heading" style={{ color: 'var(--text-on-card)' }}>Data Location</h2>
                        {dataPath.isCustom && (
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400 font-medium">Custom</span>
                        )}
                    </div>

                    <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Choose where LocalDevine stores your projects (www), database data, and configuration files.
                    </p>

                    <div className="space-y-4">
                        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-label)' }}>
                                Data Folder Path
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newDataPath}
                                    onChange={(e) => setNewDataPath(e.target.value)}
                                    placeholder={dataPath.default}
                                    className="input flex-1"
                                />
                                <button
                                    onClick={handleBrowseDataPath}
                                    className="button-secondary"
                                >
                                    📂 Browse
                                </button>
                            </div>
                            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                                Default: <code className="px-1 py-0.5 rounded" style={{ background: 'var(--bg-secondary)' }}>{dataPath.default}</code>
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveDataPath}
                                disabled={!newDataPath.trim() || newDataPath === dataPath.current}
                                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                                    !newDataPath.trim() || newDataPath === dataPath.current
                                        ? 'bg-disabled text-disabled cursor-not-allowed'
                                        : 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                                }`}
                            >
                                💾 Save Path
                            </button>
                            {dataPath.isCustom && (
                                <button
                                    onClick={handleResetDataPath}
                                    className="button-secondary"
                                >
                                    🔄 Reset to Default
                                </button>
                            )}
                        </div>

                        {dataPathMessage && (
                            <div className={`p-3 rounded-lg text-sm font-medium ${
                                dataPathMessage.includes('✓') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                                {dataPathMessage}
                            </div>
                        )}
                    </div>

                    <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            ⚠️ <strong>Important:</strong> Changing the data path requires restarting LocalDevine. Existing data will NOT be moved automatically.
                        </p>
                    </div>
                </div>

                {/* Database Configuration */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-lg">
                            🗄️
                        </div>
                        <h2 className="text-xl font-heading" style={{ color: 'var(--text-on-card)' }}>Database Credentials</h2>
                    </div>

                    <div className="space-y-4">
                        {/* Host */}
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <label style={{ color: 'var(--text-label)' }}>🌐 Host</label>
                            <input
                                type="text"
                                value={config.database?.host || '127.0.0.1'}
                                onChange={(e) => handleDatabaseChange('host', e.target.value)}
                                className="input w-40 text-center"
                                placeholder="127.0.0.1"
                            />
                        </div>

                        {/* Port */}
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <label style={{ color: 'var(--text-label)' }}>🔌 Port</label>
                            <input
                                type="number"
                                value={config.database?.port || 3306}
                                onChange={(e) => handleDatabaseChange('port', parseInt(e.target.value, 10) || 3306)}
                                className="input w-24 text-center"
                            />
                        </div>

                        {/* User */}
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <label style={{ color: 'var(--text-label)' }}>👤 User</label>
                            <input
                                type="text"
                                value={config.database?.user || 'root'}
                                onChange={(e) => handleDatabaseChange('user', e.target.value)}
                                className="input w-40 text-center"
                                placeholder="root"
                            />
                        </div>

                        {/* Password */}
                        <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <label style={{ color: 'var(--text-label)' }}>🔑 Password</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={config.database?.password || ''}
                                    onChange={(e) => handleDatabaseChange('password', e.target.value)}
                                    className="input w-32 text-center"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                        <button
                            onClick={handleTestConnection}
                            disabled={testingConnection}
                            className={`px-4 py-2 rounded-xl font-semibold transition-all text-sm ${
                                testingConnection
                                    ? 'bg-disabled text-disabled cursor-not-allowed'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                            }`}
                        >
                            {testingConnection ? '⏳ Testing...' : '🔗 Test Connection'}
                        </button>
                    </div>

                    {connectionStatus && (
                        <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
                            connectionStatus.includes('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                            {connectionStatus}
                        </div>
                    )}

                    <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                            🔑 How to change MariaDB password:
                        </p>
                        <ol className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                            <li>1. Change password above and click <strong>💾 Save Settings</strong></li>
                            <li>2. Stop and restart MariaDB service</li>
                            <li>3. Open <strong>Database</strong> page (Adminer)</li>
                            <li>4. Login with OLD password, then go to <strong>SQL</strong> tab</li>
                            <li>5. Run: <code className="px-1 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpassword';</code></li>
                            <li>6. Replace <code>newpassword</code> with your new password</li>
                            <li>7. Restart MariaDB again and test connection</li>
                        </ol>
                        <div className="mt-2 p-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
                            <p className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
                                ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpassword';
                            </p>
                            <button
                                type="button"
                                onClick={(e) => {
                                    navigator.clipboard.writeText("ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpassword';");
                                    const btn = e.currentTarget;
                                    const originalText = btn.textContent;
                                    btn.textContent = '📋 Copied!';
                                    setTimeout(() => {
                                        btn.textContent = originalText;
                                    }, 2000);
                                }}
                                className="mt-1 px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                            >
                                📋 Copy SQL Command
                            </button>
                        </div>
                    </div>
                </div>

                {/* Logs Quick Access */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500 to-slate-600 flex items-center justify-center text-lg">
                            📋
                        </div>
                        <h2 className="text-xl font-heading" style={{ color: 'var(--text-on-card)' }}>Application Logs</h2>
                    </div>
                    <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        View application logs for debugging and troubleshooting issues.
                    </p>
                    <button
                        onClick={() => window.electronAPI.logsOpenDir()}
                        className="px-6 py-3 rounded-xl font-semibold transition-all bg-gradient-to-r from-gray-500 to-slate-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]"
                    >
                        📂 Open Logs Folder
                    </button>
                </div>

            </div>
        </div>
    );
}

export default Settings;

import { useState, useEffect } from 'react';
import { Config, PHPVersion } from '../types/electron';
import ThemeToggle from './ThemeToggle';

interface SettingsProps {
  onBack: () => void;
}

function Settings({ onBack }: SettingsProps) {
    const [config, setConfig] = useState<Config>({
        ports: { php: 9000, apache: 80, mariadb: 3306 },
        autoStart: false,
        vhosts: [],
        phpVersion: 'php'
    });
    const [phpVersions, setPHPVersions] = useState<PHPVersion[]>([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.getConfig().then(cfg => {
                if (cfg) setConfig(cfg);
            });
            window.electronAPI.getPHPVersions().then(versions => {
                setPHPVersions(versions || []);
            });
        }
    }, []);

    const handlePortChange = (service: keyof Config['ports'], value: string) => {
        const port = parseInt(value, 10) || 0;
        setConfig((prev: Config) => ({
            ...prev,
            ports: { ...prev.ports, [service]: port }
        }));
    };

    const handlePHPVersionChange = async (version: string) => {
        setConfig((prev: Config) => ({ ...prev, phpVersion: version }));
        if (window.electronAPI) {
            await window.electronAPI.setPHPVersion(version);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');

        if (window.electronAPI) {
            const result = await window.electronAPI.saveConfig(config);
            if (result.success) {
                setMessage('✓ Settings saved! Restart services to apply.');
            } else {
                setMessage(`✗ Error: ${result.error}`);
            }
        }

        setSaving(false);
        setTimeout(() => setMessage(''), 3000);
    };

    return (
        <div className="min-h-screen p-8">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold mb-2 text-gradient">
                        ⚙️ Settings
                    </h1>
                    <p className="text-lg text-gradient">Configure your development environment</p>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <button
                        onClick={onBack}
                        className="button-secondary"
                    >
                        ← Back
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Port Configuration */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-lg">
                            🔌
                        </div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-card)' }}>Port Configuration</h2>
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
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                                }`}
                        >
                            {saving ? '⏳ Saving...' : '💾 Save Settings'}
                        </button>

                        {message && (
                            <span className={`text-sm font-medium ${message.startsWith('✓') ? 'text-green-500' : 'text-red-500'}`}>
                                {message}
                            </span>
                        )}
                    </div>
                </div>

                {/* PHP Version */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-lg">
                            🐘
                        </div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-card)' }}>PHP Version</h2>
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
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-card)' }}>Startup Options</h2>
                    </div>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between cursor-pointer p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                            <div>
                                <p className="font-semibold" style={{ color: 'var(--text-on-card)' }}>Auto Start Services</p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Start all services when app launches</p>
                            </div>
                            <div
                                onClick={() => setConfig((prev: Config) => ({ ...prev, autoStart: !prev.autoStart }))}
                                className={`relative w-14 h-7 rounded-full transition-all cursor-pointer ${
                                    config.autoStart ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gray-400'
                                }`}
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
            </div>
        </div>
    );
}

export default Settings;

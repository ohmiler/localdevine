import { useState, useEffect } from 'react';
import { Config, PHPVersion } from '../types/electron';

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
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                        Settings
                    </h1>
                    <p className="text-gray-400">Configure your development environment</p>
                </div>
                <button
                    onClick={onBack}
                    className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                    ← Back
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Port Configuration */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-6">Port Configuration</h2>

                    <div className="space-y-4">
                        {/* PHP Port */}
                        <div className="flex items-center justify-between">
                            <label className="text-gray-300">PHP-CGI Port</label>
                            <input
                                type="number"
                                value={config.ports.php}
                                onChange={(e) => handlePortChange('php', e.target.value)}
                                className="w-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                            />
                        </div>

                        {/* Apache Port */}
                        <div className="flex items-center justify-between">
                            <label className="text-gray-300">Apache Port</label>
                            <input
                                type="number"
                                value={config.ports.apache}
                                onChange={(e) => handlePortChange('apache', e.target.value)}
                                className="w-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                            />
                        </div>

                        {/* MariaDB Port */}
                        <div className="flex items-center justify-between">
                            <label className="text-gray-300">MariaDB Port</label>
                            <input
                                type="number"
                                value={config.ports.mariadb}
                                onChange={(e) => handlePortChange('mariadb', e.target.value)}
                                className="w-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex items-center gap-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${saving
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-lg hover:shadow-purple-500/25'
                                }`}
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>

                        {message && (
                            <span className={`text-sm ${message.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                                {message}
                            </span>
                        )}
                    </div>
                </div>

                {/* PHP Version */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-6">PHP Version</h2>

                    {phpVersions.length === 0 ? (
                        <div className="text-gray-500 italic">
                            <p>No PHP versions found.</p>
                            <p className="text-xs mt-2">Add PHP folders to bin/ (e.g., php81, php82, php83)</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {phpVersions.map(version => (
                                <label
                                    key={version.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${config.phpVersion === version.id
                                            ? 'border-purple-500 bg-purple-900/20'
                                            : 'border-gray-700 hover:border-gray-600'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="phpVersion"
                                        value={version.id}
                                        checked={config.phpVersion === version.id}
                                        onChange={() => handlePHPVersionChange(version.id)}
                                        className="text-purple-500"
                                    />
                                    <div>
                                        <p className="font-medium">{version.name}</p>
                                        <p className="text-xs text-gray-500 truncate max-w-xs">{version.path}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}

                    <p className="mt-4 text-xs text-gray-500">
                        Note: Restart PHP service after changing version.
                    </p>
                </div>

                {/* Startup Options */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-6">Startup Options</h2>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between cursor-pointer">
                            <div>
                                <p className="text-gray-300">Auto Start Services</p>
                                <p className="text-xs text-gray-500">Start all services when app launches</p>
                            </div>
                            <div
                                onClick={() => setConfig((prev: Config) => ({ ...prev, autoStart: !prev.autoStart }))}
                                className={`relative w-14 h-7 rounded-full transition-colors cursor-pointer ${
                                    config.autoStart ? 'bg-purple-600' : 'bg-gray-600'
                                }`}
                            >
                                <div
                                    className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                                        config.autoStart ? 'translate-x-8' : 'translate-x-1'
                                    }`}
                                />
                            </div>
                        </label>
                    </div>

                    <p className="mt-4 text-xs text-gray-500">
                        Changes will apply on next app launch.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Settings;

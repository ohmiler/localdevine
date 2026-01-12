import { useState, useEffect } from 'react';

function Settings({ onBack }) {
    const [config, setConfig] = useState({
        ports: { php: 9000, nginx: 80, mariadb: 3306 }
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.getConfig().then(cfg => {
                if (cfg) setConfig(cfg);
            });
        }
    }, []);

    const handlePortChange = (service, value) => {
        const port = parseInt(value, 10) || 0;
        setConfig(prev => ({
            ...prev,
            ports: { ...prev.ports, [service]: port }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');

        if (window.electronAPI) {
            const result = await window.electronAPI.saveConfig(config);
            if (result.success) {
                setMessage('✓ Settings saved successfully!');
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

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 max-w-xl">
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

                    {/* Nginx Port */}
                    <div className="flex items-center justify-between">
                        <label className="text-gray-300">Nginx Port</label>
                        <input
                            type="number"
                            value={config.ports.nginx}
                            onChange={(e) => handlePortChange('nginx', e.target.value)}
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

                <p className="mt-4 text-xs text-gray-500">
                    Note: Changes will take effect after restarting the services.
                </p>
            </div>
        </div>
    );
}

export default Settings;

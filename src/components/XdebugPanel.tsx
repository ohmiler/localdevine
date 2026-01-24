import { useState, useEffect } from 'react';
import { XdebugStatus, XdebugConfig } from '../types/electron';

interface XdebugPanelProps {
    onBack: () => void;
}

export default function XdebugPanel({ onBack }: XdebugPanelProps) {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<XdebugStatus | null>(null);
    const [installing, setInstalling] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [installProgress, setInstallProgress] = useState<string>('');
    
    // Config form
    const [mode, setMode] = useState<XdebugConfig['mode']>('debug');
    const [port, setPort] = useState(9003);
    const [ideKey, setIdeKey] = useState('VSCODE');
    const [startWithRequest, setStartWithRequest] = useState<XdebugConfig['startWithRequest']>('yes');
    
    // VS Code config
    const [showVSCodeConfig, setShowVSCodeConfig] = useState(false);
    const [vsCodeConfig, setVSCodeConfig] = useState<string>('');
    const [copied, setCopied] = useState(false);
    
    // Uninstall confirmation modal
    const [showUninstallModal, setShowUninstallModal] = useState(false);

    useEffect(() => {
        loadStatus();
    }, []);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 8000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const loadStatus = async () => {
        setLoading(true);
        try {
            const result = await window.electronAPI.xdebugGetStatus();
            setStatus(result);
            
            // Update form with current config
            if (result.mode) setMode(result.mode as XdebugConfig['mode']);
            if (result.port) setPort(result.port);
            if (result.ideKey) setIdeKey(result.ideKey);
            if (result.startWithRequest) setStartWithRequest(result.startWithRequest as XdebugConfig['startWithRequest']);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async () => {
        setInstalling(true);
        setInstallProgress('Starting download...');
        setError(null);
        
        try {
            const result = await window.electronAPI.xdebugInstall();
            
            if (result.success) {
                setSuccess('Xdebug installed successfully! Enable it below.');
                await loadStatus();
            } else {
                setError(result.error || 'Failed to install Xdebug');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setInstalling(false);
            setInstallProgress('');
        }
    };

    const handleEnable = async () => {
        setSaving(true);
        setError(null);
        
        try {
            const config = { mode, port, ideKey, startWithRequest, clientPort: port };
            const result = await window.electronAPI.xdebugEnable(config);
            
            if (result.success) {
                setSuccess('Xdebug enabled! Restart PHP to apply changes.');
                await loadStatus();
            } else {
                setError(result.error || 'Failed to enable Xdebug');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleDisable = async () => {
        setSaving(true);
        setError(null);
        
        try {
            const result = await window.electronAPI.xdebugDisable();
            
            if (result.success) {
                setSuccess('Xdebug disabled! Restart PHP to apply changes.');
                await loadStatus();
            } else {
                setError(result.error || 'Failed to disable Xdebug');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateConfig = async () => {
        setSaving(true);
        setError(null);
        
        try {
            const config = { mode, port, ideKey, startWithRequest, clientPort: port };
            const result = await window.electronAPI.xdebugUpdateConfig(config);
            
            if (result.success) {
                setSuccess('Configuration updated! Restart PHP to apply changes.');
                await loadStatus();
            } else {
                setError(result.error || 'Failed to update configuration');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleUninstall = () => {
        setShowUninstallModal(true);
    };
    
    const confirmUninstall = async () => {
        setShowUninstallModal(false);
        setSaving(true);
        setError(null);
        
        try {
            const result = await window.electronAPI.xdebugUninstall();
            
            if (result.success) {
                setSuccess('Xdebug uninstalled successfully!');
                await loadStatus();
            } else {
                setError(result.error || 'Failed to uninstall Xdebug');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setSaving(true);
        setError(null);
        
        try {
            const result = await window.electronAPI.xdebugTestConnection();
            
            if (result.success) {
                setSuccess(result.message);
            } else {
                setError(result.message);
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleShowVSCodeConfig = async () => {
        try {
            const result = await window.electronAPI.xdebugGetVSCodeConfig();
            if (result.success) {
                setVSCodeConfig(JSON.stringify(result.config, null, 2));
                setShowVSCodeConfig(true);
            }
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('❌ Failed to copy to clipboard');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p style={{ color: 'var(--text-secondary)' }}>Loading Xdebug status...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8">
            {/* Header */}
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display mb-2 header-title">
                        <span className="header-icon">🐛</span>
                        <span className="header-text">Xdebug</span>
                    </h1>
                    <p className="text-sm" style={{ color: 'white' }}>
                        PHP Debugger for Development
                    </p>
                </div>
                <button onClick={onBack} className="button-secondary">
                    ← Back
                </button>
            </header>

            {/* Messages */}
            {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg flex justify-between items-center">
                    <span>❌ {error}</span>
                    <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
                </div>
            )}
            {success && (
                <div className="mb-4 p-4 bg-green-100 border border-green-300 text-green-700 rounded-lg flex justify-between items-center">
                    <span>✅ {success}</span>
                    <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">✕</button>
                </div>
            )}

            {/* Status Card */}
            <div className="card p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Status
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Installed</div>
                        <div className={`text-lg font-semibold ${status?.installed ? 'text-green-500' : 'text-red-500'}`}>
                            {status?.installed ? '✅ Yes' : '❌ No'}
                        </div>
                    </div>
                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Enabled</div>
                        <div className={`text-lg font-semibold ${status?.enabled ? 'text-green-500' : 'text-yellow-500'}`}>
                            {status?.enabled ? '✅ Yes' : '⏸️ No'}
                        </div>
                    </div>
                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Version</div>
                        <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {status?.version || 'N/A'}
                        </div>
                    </div>
                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>PHP Version</div>
                        <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {status?.phpVersion || 'N/A'}
                        </div>
                    </div>
                </div>

                {/* Install Button */}
                {!status?.installed && (
                    <div className="text-center p-8 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="text-4xl mb-4">📦</div>
                        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                            Xdebug Not Installed
                        </h3>
                        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                            Install Xdebug to enable PHP debugging with VS Code or other IDEs.
                        </p>
                        <button
                            onClick={handleInstall}
                            disabled={installing}
                            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                        >
                            {installing ? `⏳ ${installProgress}` : '📥 Install Xdebug'}
                        </button>
                    </div>
                )}

                {/* Enable/Disable Buttons */}
                {status?.installed && (
                    <div className="flex gap-4">
                        {!status.enabled ? (
                            <button
                                onClick={handleEnable}
                                disabled={saving}
                                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {saving ? '⏳ Enabling...' : '✅ Enable Xdebug'}
                            </button>
                        ) : (
                            <button
                                onClick={handleDisable}
                                disabled={saving}
                                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                            >
                                {saving ? '⏳ Disabling...' : '⏸️ Disable Xdebug'}
                            </button>
                        )}
                        <button
                            onClick={handleTestConnection}
                            disabled={saving || !status.enabled}
                            className="px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                        >
                            🔌 Test Connection
                        </button>
                        <button
                            onClick={handleUninstall}
                            disabled={saving}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all disabled:opacity-50"
                        >
                            🗑️ Uninstall
                        </button>
                    </div>
                )}
            </div>

            {/* Configuration */}
            {status?.installed && (
                <div className="card p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                        Configuration
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                                Mode
                            </label>
                            <select
                                value={mode}
                                onChange={(e) => setMode(e.target.value as XdebugConfig['mode'])}
                                className="w-full px-3 py-2 rounded-lg"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            >
                                <option value="debug">debug - Step debugging</option>
                                <option value="develop">develop - Development helpers</option>
                                <option value="coverage">coverage - Code coverage</option>
                                <option value="profile">profile - Profiling</option>
                                <option value="trace">trace - Function trace</option>
                                <option value="off">off - Disabled</option>
                            </select>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Use "debug" for VS Code debugging
                            </p>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                                Port
                            </label>
                            <input
                                type="number"
                                value={port}
                                onChange={(e) => setPort(parseInt(e.target.value) || 9003)}
                                className="w-full px-3 py-2 rounded-lg"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            />
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Default: 9003 (Xdebug 3.x)
                            </p>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                                IDE Key
                            </label>
                            <input
                                type="text"
                                value={ideKey}
                                onChange={(e) => setIdeKey(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            />
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Use "VSCODE" for VS Code
                            </p>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                                Start With Request
                            </label>
                            <select
                                value={startWithRequest}
                                onChange={(e) => setStartWithRequest(e.target.value as XdebugConfig['startWithRequest'])}
                                className="w-full px-3 py-2 rounded-lg"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            >
                                <option value="yes">yes - Always start debugging</option>
                                <option value="no">no - Never auto-start</option>
                                <option value="trigger">trigger - Use browser extension</option>
                                <option value="default">default - Use xdebug.mode default</option>
                            </select>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                "yes" for easy debugging, "trigger" for production
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex gap-4">
                        <button
                            onClick={handleUpdateConfig}
                            disabled={saving || !status.enabled}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                        >
                            {saving ? '⏳ Saving...' : '💾 Save Configuration'}
                        </button>
                        <button
                            onClick={handleShowVSCodeConfig}
                            className="px-4 py-2 rounded-lg font-semibold transition-all"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                        >
                            📋 Get VS Code Config
                        </button>
                    </div>
                </div>
            )}

            {/* VS Code Configuration Modal */}
            {showVSCodeConfig && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="card p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                VS Code launch.json Configuration
                            </h3>
                            <button onClick={() => setShowVSCodeConfig(false)} className="text-xl">✕</button>
                        </div>
                        
                        <div className="mb-4 p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                                <strong>Instructions:</strong>
                            </p>
                            <ol className="text-sm list-decimal list-inside space-y-1" style={{ color: 'var(--text-muted)' }}>
                                <li>Install "PHP Debug" extension in VS Code</li>
                                <li>Create or open <code>.vscode/launch.json</code> in your project</li>
                                <li>Copy and paste the configuration below</li>
                                <li>Press F5 to start debugging</li>
                            </ol>
                        </div>
                        
                        <pre 
                            className="p-4 rounded-lg text-sm overflow-auto"
                            style={{ background: '#1e1e1e', color: '#d4d4d4' }}
                        >
                            {vsCodeConfig}
                        </pre>
                        
                        <div className="flex gap-4 mt-4">
                            <button
                                onClick={async () => await copyToClipboard(vsCodeConfig)}
                                className={`px-4 py-2 text-white rounded-lg font-semibold transition-all ${copied ? 'bg-green-600' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg'}`}
                            >
                                {copied ? '✅ Copied!' : '📋 Copy to Clipboard'}
                            </button>
                            <button
                                onClick={() => setShowVSCodeConfig(false)}
                                className="px-4 py-2 rounded-lg font-semibold"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Help Section */}
            <div className="card p-6">
                <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Quick Start Guide
                </h2>
                
                <div className="space-y-4">
                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                            1. Install PHP Debug Extension in VS Code
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Search for "PHP Debug" by Xdebug in VS Code Extensions marketplace and install it.
                        </p>
                    </div>
                    
                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                            2. Configure launch.json
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Click "Get VS Code Config" button above and copy the configuration to your project's .vscode/launch.json file.
                        </p>
                    </div>
                    
                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                            3. Start Debugging
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Set breakpoints in your PHP code, press F5 in VS Code, then access your PHP page in the browser.
                        </p>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                        <h3 className="font-semibold mb-2 text-blue-800">
                            💡 Pro Tip
                        </h3>
                        <p className="text-sm text-blue-700">
                            After making changes to Xdebug configuration, remember to <strong>restart PHP service</strong> from the Dashboard for changes to take effect.
                        </p>
                    </div>
                </div>
            </div>

            {/* Uninstall Confirmation Modal */}
            {showUninstallModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="card p-6 max-w-md w-full mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-xl">
                                🗑️
                            </div>
                            <h3 className="text-lg font-heading" style={{ color: 'var(--text-on-card)' }}>Confirm Uninstall</h3>
                        </div>
                        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                            Are you sure you want to uninstall <strong>Xdebug</strong>? You can reinstall it later if needed.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowUninstallModal(false)}
                                className="button-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmUninstall}
                                className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                            >
                                Uninstall
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

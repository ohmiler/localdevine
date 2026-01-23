import { useState, useEffect, useCallback } from 'react';
import { MailHogStatus, MailHogConfig } from '../types/electron';

interface MailHogPanelProps {
    onBack: () => void;
}

export default function MailHogPanel({ onBack }: MailHogPanelProps) {
    const [status, setStatus] = useState<MailHogStatus | null>(null);
    const [config, setConfig] = useState<MailHogConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [installProgress, setInstallProgress] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'status' | 'config'>('status');

    const loadData = useCallback(async () => {
        try {
            const [statusResult, configResult] = await Promise.all([
                window.electronAPI.mailhogGetStatus(),
                window.electronAPI.mailhogGetConfig()
            ]);
            setStatus(statusResult);
            setConfig(configResult);
        } catch (err) {
            setError((err as Error).message);
        }
    }, []);

    useEffect(() => {
        loadData();

        // Listen for install progress
        const handleProgress = (_event: any, data: { phase: string; percent: number; message: string }) => {
            setInstallProgress(data.message);
        };

        window.electronAPI.on('mailhog-install-progress' as any, handleProgress);

        return () => {
            window.electronAPI.removeListener('mailhog-install-progress', handleProgress);
        };
    }, [loadData]);

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

    const handleInstall = async () => {
        setInstalling(true);
        setInstallProgress('Starting installation...');
        setError(null);
        
        try {
            const result = await window.electronAPI.mailhogInstall();
            if (result.success) {
                setSuccess(result.message);
                await loadData();
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setInstalling(false);
            setInstallProgress('');
        }
    };

    const handleUninstall = async () => {
        if (!confirm('Are you sure you want to uninstall MailHog?')) return;
        
        setLoading(true);
        try {
            const result = await window.electronAPI.mailhogUninstall();
            if (result.success) {
                setSuccess(result.message);
                await loadData();
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async () => {
        setLoading(true);
        try {
            const result = await window.electronAPI.mailhogStart();
            if (result.success) {
                setSuccess(result.message);
                await loadData();
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async () => {
        setLoading(true);
        try {
            const result = await window.electronAPI.mailhogStop();
            if (result.success) {
                setSuccess(result.message);
                await loadData();
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenUI = async () => {
        await window.electronAPI.mailhogOpenUI();
    };

    const handleCopyConfig = async (configType: 'php' | 'laravel' | 'symfony') => {
        try {
            let configResult;
            switch (configType) {
                case 'php':
                    configResult = await window.electronAPI.mailhogGetPhpConfig();
                    break;
                case 'laravel':
                    configResult = await window.electronAPI.mailhogGetLaravelConfig();
                    break;
                case 'symfony':
                    configResult = await window.electronAPI.mailhogGetSymfonyConfig();
                    break;
            }
            
            if (configResult.success) {
                await navigator.clipboard.writeText(configResult.config);
                setSuccess(`${configType.toUpperCase()} config copied to clipboard!`);
            }
        } catch (err) {
            setError('Failed to copy config');
        }
    };

    return (
        <div className="p-8">
            {/* Header */}
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display mb-2 header-title">
                        <span className="header-icon">📧</span>
                        <span className="header-text">MailHog</span>
                    </h1>
                    <p className="text-lg text-gradient opacity-90">
                        Email testing tool for local development
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {status?.installed && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            status.running 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-700'
                        }`}>
                            {status.running ? '🟢 Running' : '⚪ Stopped'}
                        </span>
                    )}
                    <button onClick={onBack} className="button-secondary">
                        ← Back
                    </button>
                </div>
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

            {/* Not Installed State */}
            {status && !status.installed && (
                <div className="card p-8 text-center">
                    <div className="text-6xl mb-4">📧</div>
                    <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-on-card)' }}>
                        MailHog is not installed
                    </h2>
                    <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                        MailHog is a free email testing tool for local development.<br />
                        It catches all outgoing emails and displays them in a web UI.
                    </p>
                    
                    {installing ? (
                        <div className="space-y-4">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                            <p style={{ color: 'var(--text-secondary)' }}>{installProgress}</p>
                        </div>
                    ) : (
                        <button
                            onClick={handleInstall}
                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                        >
                            📥 Install MailHog
                        </button>
                    )}
                    
                    <div className="mt-6 p-4 rounded-lg text-left" style={{ background: 'var(--bg-tertiary)' }}>
                        <h3 className="font-semibold mb-2" style={{ color: 'var(--text-on-card)' }}>Features:</h3>
                        <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
                            <li>• Catches all outgoing SMTP emails</li>
                            <li>• Web UI to view emails at <code className="px-1 rounded" style={{ background: 'var(--bg-secondary)' }}>http://localhost:8025</code></li>
                            <li>• No configuration needed for most PHP apps</li>
                            <li>• Works with Laravel, Symfony, and any PHP framework</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Installed State */}
            {status?.installed && (
                <>
                    {/* Tabs */}
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setActiveTab('status')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                activeTab === 'status'
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            📊 Status
                        </button>
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                activeTab === 'config'
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            ⚙️ Configuration
                        </button>
                    </div>

                    {/* Status Tab */}
                    {activeTab === 'status' && (
                        <div className="space-y-6">
                            {/* Controls */}
                            <div className="card p-6">
                                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-on-card)' }}>
                                    Service Control
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {status.running ? (
                                        <button
                                            onClick={handleStop}
                                            disabled={loading}
                                            className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
                                        >
                                            ⏹️ Stop MailHog
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleStart}
                                            disabled={loading}
                                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
                                        >
                                            ▶️ Start MailHog
                                        </button>
                                    )}
                                    
                                    <button
                                        onClick={handleOpenUI}
                                        disabled={!status.running}
                                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
                                    >
                                        🌐 Open Web UI
                                    </button>
                                    
                                    <button
                                        onClick={handleUninstall}
                                        disabled={loading || status.running}
                                        className="px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
                                    >
                                        🗑️ Uninstall
                                    </button>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="card p-6">
                                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-on-card)' }}>
                                    Connection Info
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>SMTP Server</div>
                                        <div className="text-lg font-mono font-bold" style={{ color: 'var(--text-on-card)' }}>
                                            127.0.0.1:{status.smtpPort}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Web UI</div>
                                        <div className="text-lg font-mono font-bold" style={{ color: 'var(--text-on-card)' }}>
                                            http://localhost:{status.httpPort}
                                        </div>
                                    </div>
                                </div>
                                {status.version && (
                                    <div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                        Version: {status.version}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Config Tab */}
                    {activeTab === 'config' && (
                        <div className="space-y-6">
                            {/* PHP Config */}
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-on-card)' }}>
                                        🐘 PHP Configuration
                                    </h3>
                                    <button
                                        onClick={() => handleCopyConfig('php')}
                                        className="px-3 py-1 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                                    >
                                        📋 Copy
                                    </button>
                                </div>
                                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                                    Add this to your <code className="px-1 rounded" style={{ background: 'var(--bg-tertiary)' }}>php.ini</code> file:
                                </p>
                                <pre className="p-4 rounded-lg text-sm overflow-x-auto" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-on-card)' }}>
{`[mail function]
SMTP = 127.0.0.1
smtp_port = ${status.smtpPort}
sendmail_from = test@localdevine.test`}
                                </pre>
                            </div>

                            {/* Laravel Config */}
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-on-card)' }}>
                                        🔴 Laravel Configuration
                                    </h3>
                                    <button
                                        onClick={() => handleCopyConfig('laravel')}
                                        className="px-3 py-1 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                                    >
                                        📋 Copy
                                    </button>
                                </div>
                                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                                    Add this to your <code className="px-1 rounded" style={{ background: 'var(--bg-tertiary)' }}>.env</code> file:
                                </p>
                                <pre className="p-4 rounded-lg text-sm overflow-x-auto" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-on-card)' }}>
{`MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=${status.smtpPort}
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="test@localdevine.test"
MAIL_FROM_NAME="\${APP_NAME}"`}
                                </pre>
                            </div>

                            {/* Symfony Config */}
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-on-card)' }}>
                                        ⚫ Symfony Configuration
                                    </h3>
                                    <button
                                        onClick={() => handleCopyConfig('symfony')}
                                        className="px-3 py-1 bg-gradient-to-r from-gray-700 to-gray-900 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                                    >
                                        📋 Copy
                                    </button>
                                </div>
                                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                                    Add this to your <code className="px-1 rounded" style={{ background: 'var(--bg-tertiary)' }}>.env</code> file:
                                </p>
                                <pre className="p-4 rounded-lg text-sm overflow-x-auto" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-on-card)' }}>
{`MAILER_DSN=smtp://127.0.0.1:${status.smtpPort}`}
                                </pre>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

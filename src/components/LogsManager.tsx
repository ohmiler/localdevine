import { useState, useEffect, useCallback } from 'react';

interface LogsManagerProps {
    onBack: () => void;
}

interface LogFileInfo {
    name: string;
    size: string;
    modifiedAt: string;
}

export default function LogsManager({ onBack }: LogsManagerProps) {
    const [logDir, setLogDir] = useState<string>('');
    const [logFile, setLogFile] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadLogInfo = useCallback(async () => {
        setLoading(true);
        try {
            const [dirResult, fileResult] = await Promise.all([
                window.electronAPI.logsGetDir(),
                window.electronAPI.logsGetFile()
            ]);
            
            if (dirResult.success) {
                setLogDir(dirResult.path);
            }
            if (fileResult.success) {
                setLogFile(fileResult.path);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLogInfo();
    }, [loadLogInfo]);

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

    const handleOpenLogsDir = async () => {
        try {
            const result = await window.electronAPI.logsOpenDir();
            if (result.success) {
                setSuccess('Opened logs folder');
            } else {
                setError(result.error || 'Failed to open logs folder');
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSuccess('Copied to clipboard!');
    };

    return (
        <div className="min-h-screen p-8">
            {/* Header */}
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display mb-2 header-title">
                        <span className="header-icon">📋</span>
                        <span className="header-text">Application Logs</span>
                    </h1>
                    <p className="text-lg text-gradient opacity-90">
                        View and manage application logs for debugging
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

            {/* Main Content */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Log Location Card */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl">
                            📂
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Log Location
                            </h2>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                Where your logs are stored
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                            <div className="text-4xl mb-4">⏳</div>
                            <p>Loading log information...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Log Directory */}
                            <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                                    Logs Directory
                                </label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-sm truncate px-2 py-1 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                        {logDir || 'Not available'}
                                    </code>
                                    {logDir && (
                                        <button
                                            onClick={() => copyToClipboard(logDir)}
                                            className="px-2 py-1 text-blue-500 hover:text-blue-700 text-sm"
                                            title="Copy path"
                                        >
                                            📋
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Current Log File */}
                            <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                                    Current Log File
                                </label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-sm truncate px-2 py-1 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                        {logFile || 'Not available'}
                                    </code>
                                    {logFile && (
                                        <button
                                            onClick={() => copyToClipboard(logFile)}
                                            className="px-2 py-1 text-blue-500 hover:text-blue-700 text-sm"
                                            title="Copy path"
                                        >
                                            📋
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={handleOpenLogsDir}
                                className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
                            >
                                📂 Open Logs Folder
                            </button>
                        </div>
                    )}
                </div>

                {/* Log Info Card */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xl">
                            ℹ️
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                                About Logs
                            </h2>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                Understanding your log files
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Log Levels */}
                        <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Log Levels</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">INFO</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>General information messages</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">WARN</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>Warnings and potential issues</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">ERROR</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>Errors that need attention</span>
                                </div>
                            </div>
                        </div>

                        {/* Log Rotation Info */}
                        <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Log Rotation</h3>
                            <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
                                <li>• Logs rotate when file exceeds 5MB</li>
                                <li>• Up to 5 log files are kept</li>
                                <li>• Older logs are automatically deleted</li>
                            </ul>
                        </div>

                        {/* Log Files */}
                        <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Log Files</h3>
                            <ul className="text-sm space-y-1 font-mono" style={{ color: 'var(--text-secondary)' }}>
                                <li>📄 localdevine.log (current)</li>
                                <li>📄 localdevine.1.log (previous)</li>
                                <li>📄 localdevine.2.log ... 5.log</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Troubleshooting Card */}
                <div className="card p-6 lg:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-xl">
                            🔧
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Troubleshooting
                            </h2>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                How to use logs for debugging
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <div className="text-2xl mb-2">1️⃣</div>
                            <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Reproduce Issue</h3>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Try to reproduce the problem you're experiencing
                            </p>
                        </div>
                        <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <div className="text-2xl mb-2">2️⃣</div>
                            <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Check Logs</h3>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Open the logs folder and look for ERROR entries
                            </p>
                        </div>
                        <div className="p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                            <div className="text-2xl mb-2">3️⃣</div>
                            <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Report Issue</h3>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Share the relevant log entries when reporting bugs
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

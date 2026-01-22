import { useState, useEffect } from 'react';
import { CommonSetting, PHPExtension, PHPConfigSection } from '../types/electron';

interface PHPConfigEditorProps {
    onBack: () => void;
}

type TabType = 'common' | 'extensions' | 'advanced';

export default function PHPConfigEditor({ onBack }: PHPConfigEditorProps) {
    const [activeTab, setActiveTab] = useState<TabType>('common');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // Common settings
    const [commonSettings, setCommonSettings] = useState<CommonSetting[]>([]);
    const [modifiedSettings, setModifiedSettings] = useState<Map<string, string>>(new Map());
    
    // Extensions
    const [extensions, setExtensions] = useState<PHPExtension[]>([]);
    
    // Advanced (raw editor)
    const [rawContent, setRawContent] = useState('');
    const [hasBackup, setHasBackup] = useState(false);
    const [configPath, setConfigPath] = useState('');

    useEffect(() => {
        loadData();
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

    const loadData = async () => {
        setLoading(true);
        try {
            const [pathResult, commonResult, extResult, rawResult, backupResult] = await Promise.all([
                window.electronAPI.phpConfigGetPath(),
                window.electronAPI.phpConfigGetCommon(),
                window.electronAPI.phpConfigGetExtensions(),
                window.electronAPI.phpConfigGetRaw(),
                window.electronAPI.phpConfigHasBackup()
            ]);

            if (pathResult.success) setConfigPath(pathResult.path);
            if (commonResult.success && commonResult.data) setCommonSettings(commonResult.data);
            if (extResult.success && extResult.data) setExtensions(extResult.data);
            if (rawResult.success && rawResult.content) setRawContent(rawResult.content);
            if (backupResult.success) setHasBackup(backupResult.hasBackup);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleSettingChange = (key: string, value: string) => {
        setModifiedSettings(prev => new Map(prev).set(key, value));
    };

    const getCurrentValue = (setting: CommonSetting): string => {
        if (modifiedSettings.has(setting.key)) {
            return modifiedSettings.get(setting.key)!;
        }
        return setting.currentValue ?? setting.defaultValue;
    };

    const saveCommonSettings = async () => {
        if (modifiedSettings.size === 0) {
            setError('No changes to save');
            return;
        }

        setSaving(true);
        try {
            const settings = Array.from(modifiedSettings.entries()).map(([key, value]) => ({ key, value }));
            const result = await window.electronAPI.phpConfigUpdateSettings(settings);
            
            if (result.success) {
                setSuccess(`Saved ${settings.length} setting(s). Restart PHP to apply changes.`);
                setModifiedSettings(new Map());
                await loadData();
            } else {
                setError(result.error || 'Failed to save settings');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleExtensionToggle = async (ext: PHPExtension) => {
        setSaving(true);
        try {
            const result = await window.electronAPI.phpConfigToggleExtension(ext.name, !ext.enabled);
            
            if (result.success) {
                setSuccess(`${ext.enabled ? 'Disabled' : 'Enabled'} ${ext.name}. Restart PHP to apply.`);
                await loadData();
            } else {
                setError(result.error || 'Failed to toggle extension');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const saveRawContent = async () => {
        setSaving(true);
        try {
            const result = await window.electronAPI.phpConfigSaveRaw(rawContent);
            
            if (result.success) {
                setSuccess('Saved php.ini. Restart PHP to apply changes.');
                await loadData();
            } else {
                setError(result.error || 'Failed to save');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const restoreBackup = async () => {
        if (!confirm('Are you sure you want to restore from backup? Current changes will be lost.')) {
            return;
        }

        setSaving(true);
        try {
            const result = await window.electronAPI.phpConfigRestoreBackup();
            
            if (result.success) {
                setSuccess('Restored from backup. Restart PHP to apply.');
                await loadData();
            } else {
                setError(result.error || 'Failed to restore');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const groupSettingsByCategory = (settings: CommonSetting[]) => {
        const groups: Record<string, CommonSetting[]> = {};
        settings.forEach(s => {
            if (!groups[s.category]) groups[s.category] = [];
            groups[s.category].push(s);
        });
        return groups;
    };

    const renderSettingInput = (setting: CommonSetting) => {
        const value = getCurrentValue(setting);
        const isModified = modifiedSettings.has(setting.key);

        switch (setting.type) {
            case 'boolean':
                return (
                    <select
                        value={value}
                        onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                        className={`px-3 py-2 rounded-lg w-32 ${isModified ? 'ring-2 ring-blue-500' : ''}`}
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                    >
                        <option value="On">On</option>
                        <option value="Off">Off</option>
                        <option value="1">1 (On)</option>
                        <option value="0">0 (Off)</option>
                    </select>
                );
            case 'select':
                return (
                    <select
                        value={value}
                        onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                        className={`px-3 py-2 rounded-lg w-48 ${isModified ? 'ring-2 ring-blue-500' : ''}`}
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                    >
                        {setting.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                );
            case 'size':
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                        placeholder="e.g., 128M, 2G"
                        className={`px-3 py-2 rounded-lg w-32 ${isModified ? 'ring-2 ring-blue-500' : ''}`}
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                    />
                );
            case 'number':
                return (
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                        className={`px-3 py-2 rounded-lg w-32 ${isModified ? 'ring-2 ring-blue-500' : ''}`}
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                    />
                );
            default:
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                        className={`px-3 py-2 rounded-lg w-48 ${isModified ? 'ring-2 ring-blue-500' : ''}`}
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                    />
                );
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p style={{ color: 'var(--text-secondary)' }}>Loading PHP Configuration...</p>
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
                        <span className="header-icon">⚙️</span>
                        <span className="header-text">PHP Configuration</span>
                    </h1>
                    <p className="text-sm" style={{ color: 'white' }}>
                        {configPath}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {hasBackup && (
                        <button
                            onClick={restoreBackup}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        >
                            🔄 Restore Backup
                        </button>
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

            {/* Warning */}
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                    <p className="font-semibold text-amber-800">Important</p>
                    <p className="text-sm text-amber-700">Changes require PHP restart to take effect. Go to Dashboard and restart PHP after saving.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {[
                    { id: 'common', label: 'Common Settings', icon: '🎯' },
                    { id: 'extensions', label: 'Extensions', icon: '🧩' },
                    { id: 'advanced', label: 'Advanced (Raw)', icon: '📝' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                            activeTab === tab.id
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                                : ''
                        }`}
                        style={activeTab !== tab.id ? { background: 'var(--bg-card)', color: 'var(--text-secondary)' } : {}}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Common Settings Tab */}
            {activeTab === 'common' && (
                <div className="space-y-6">
                    {Object.entries(groupSettingsByCategory(commonSettings)).map(([category, settings]) => (
                        <div key={category} className="card p-4">
                            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                                {category}
                            </h3>
                            <div className="space-y-4">
                                {settings.map(setting => (
                                    <div key={setting.key} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="flex-1">
                                            <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                                {setting.label}
                                            </div>
                                            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                                {setting.description}
                                            </div>
                                            <div className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                                                {setting.key}
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            {renderSettingInput(setting)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Save Button */}
                    <div className="flex justify-end gap-4">
                        {modifiedSettings.size > 0 && (
                            <button
                                onClick={() => setModifiedSettings(new Map())}
                                className="px-4 py-2 rounded-lg font-semibold"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                            >
                                Reset Changes
                            </button>
                        )}
                        <button
                            onClick={saveCommonSettings}
                            disabled={saving || modifiedSettings.size === 0}
                            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                                modifiedSettings.size > 0
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            {saving ? '⏳ Saving...' : `💾 Save Changes (${modifiedSettings.size})`}
                        </button>
                    </div>
                </div>
            )}

            {/* Extensions Tab */}
            {activeTab === 'extensions' && (
                <div className="card p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            PHP Extensions
                        </h3>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {extensions.filter(e => e.enabled).length} enabled / {extensions.length} total
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {extensions.map(ext => (
                            <div
                                key={ext.name}
                                className={`p-3 rounded-lg flex items-center justify-between transition-all ${
                                    !ext.available ? 'opacity-50' : ''
                                }`}
                                style={{ background: 'var(--bg-tertiary)' }}
                            >
                                <div>
                                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                        {ext.name}
                                    </div>
                                    {!ext.available && (
                                        <div className="text-xs text-red-500">Not available</div>
                                    )}
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={ext.enabled}
                                        onChange={() => handleExtensionToggle(ext)}
                                        disabled={saving || !ext.available}
                                        className="sr-only peer"
                                    />
                                    <div className={`w-11 h-6 rounded-full peer transition-all ${
                                        ext.enabled ? 'bg-green-500' : 'bg-gray-300'
                                    } peer-disabled:opacity-50`}>
                                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                                            ext.enabled ? 'translate-x-5' : ''
                                        }`} />
                                    </div>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Advanced Tab */}
            {activeTab === 'advanced' && (
                <div className="card p-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Raw php.ini Editor
                        </h3>
                        <button
                            onClick={saveRawContent}
                            disabled={saving}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                        >
                            {saving ? '⏳ Saving...' : '💾 Save'}
                        </button>
                    </div>
                    
                    <textarea
                        value={rawContent}
                        onChange={(e) => setRawContent(e.target.value)}
                        className="w-full h-96 p-4 font-mono text-sm rounded-lg resize-none"
                        style={{
                            background: '#1e1e1e',
                            color: '#d4d4d4',
                            border: '1px solid var(--border-color)'
                        }}
                        spellCheck={false}
                    />
                    
                    <div className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                        <p>💡 Tip: Be careful when editing raw configuration. A backup will be created before saving.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState, useEffect, useCallback } from 'react';
import { EnvFile, EnvVariable } from '../types/electron';

interface EnvManagerProps {
    onBack: () => void;
}

export default function EnvManager({ onBack }: EnvManagerProps) {
    const [files, setFiles] = useState<EnvFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [variables, setVariables] = useState<EnvVariable[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newFileName, setNewFileName] = useState('.env.local');
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [newVarKey, setNewVarKey] = useState('');
    const [newVarValue, setNewVarValue] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    // Load env files
    const loadFiles = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.electronAPI.envListFiles();
            if (result.success) {
                setFiles(result.data);
                // Auto-select first file if none selected
                if (!selectedFile && result.data.length > 0) {
                    setSelectedFile(result.data[0].name);
                }
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [selectedFile]);

    // Load variables for selected file
    const loadVariables = useCallback(async () => {
        if (!selectedFile) {
            setVariables([]);
            return;
        }
        try {
            const result = await window.electronAPI.envGetFile(selectedFile);
            if (result.success && result.data) {
                setVariables(result.data.variables);
                setHasChanges(false);
            }
        } catch (err) {
            setError((err as Error).message);
        }
    }, [selectedFile]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    useEffect(() => {
        loadVariables();
    }, [loadVariables]);

    // Save changes
    const handleSave = async () => {
        if (!selectedFile) return;
        setSaving(true);
        setError(null);
        try {
            const result = await window.electronAPI.envSaveFile(selectedFile, variables);
            if (result.success) {
                setSuccess('Changes saved successfully');
                setHasChanges(false);
            } else {
                setError(result.error || 'Failed to save');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    // Create new file
    const handleCreateFile = async () => {
        if (!newFileName.trim()) return;
        setLoading(true);
        try {
            const result = await window.electronAPI.envCreateFile(newFileName.trim());
            if (result.success) {
                setSuccess(`Created ${newFileName}`);
                setShowCreateModal(false);
                setNewFileName('.env.local');
                loadFiles();
                setSelectedFile(newFileName.trim());
            } else {
                setError(result.error || 'Failed to create file');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    // Delete file
    const handleDeleteFile = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;
        try {
            const result = await window.electronAPI.envDeleteFile(filename);
            if (result.success) {
                setSuccess(`Deleted ${filename}`);
                if (selectedFile === filename) {
                    setSelectedFile(null);
                }
                loadFiles();
            } else {
                setError(result.error || 'Failed to delete file');
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    // Update variable
    const updateVariable = (key: string, value: string) => {
        setVariables(prev => prev.map(v => v.key === key ? { ...v, value } : v));
        setHasChanges(true);
    };

    // Delete variable
    const deleteVariable = (key: string) => {
        setVariables(prev => prev.filter(v => v.key !== key));
        setHasChanges(true);
    };

    // Add new variable
    const addVariable = () => {
        if (!newVarKey.trim()) return;
        if (variables.some(v => v.key === newVarKey.trim())) {
            setError('Variable already exists');
            return;
        }
        setVariables(prev => [...prev, { key: newVarKey.trim(), value: newVarValue }]);
        setNewVarKey('');
        setNewVarValue('');
        setHasChanges(true);
    };

    // Clear messages
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

    return (
        <div className="min-h-screen p-8">
            {/* Header */}
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display mb-2 header-title">
                        <span className="header-icon">🔐</span>
                        <span className="header-text">Environment Variables</span>
                    </h1>
                    <p className="text-lg text-gradient opacity-90">
                        Manage your .env configuration files
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.electronAPI.envOpenDir()}
                        className="button-secondary text-sm"
                    >
                        📂 Open Folder
                    </button>
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

            {/* Main Content */}
            <div className="grid grid-cols-12 gap-6">
                {/* File List */}
                <div className="col-span-3">
                    <div className="card p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Files
                            </h2>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all"
                            >
                                + New
                            </button>
                        </div>

                        {loading && files.length === 0 ? (
                            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                Loading...
                            </div>
                        ) : files.length === 0 ? (
                            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                No .env files found
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {files.map(file => (
                                    <div
                                        key={file.name}
                                        onClick={() => {
                                            if (hasChanges && !confirm('Discard unsaved changes?')) return;
                                            setSelectedFile(file.name);
                                        }}
                                        className={`p-3 rounded-lg cursor-pointer transition-all flex justify-between items-center ${
                                            selectedFile === file.name
                                                ? 'bg-indigo-100 border-2 border-indigo-500'
                                                : 'hover:bg-gray-100 border-2 border-transparent'
                                        }`}
                                        style={{ background: selectedFile === file.name ? undefined : 'var(--bg-tertiary)' }}
                                    >
                                        <div>
                                            <div className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                                                📄 {file.name}
                                            </div>
                                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                {file.variables.length} variables
                                            </div>
                                        </div>
                                        {file.name !== '.env' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteFile(file.name);
                                                }}
                                                className="text-red-500 hover:text-red-700 p-1"
                                                title="Delete file"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Variables Editor */}
                <div className="col-span-9">
                    <div className="card p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {selectedFile ? `Variables in "${selectedFile}"` : 'Select a file'}
                            </h2>
                            {selectedFile && (
                                <button
                                    onClick={handleSave}
                                    disabled={!hasChanges || saving}
                                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                                        hasChanges && !saving
                                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-lg'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                                >
                                    {saving ? '💾 Saving...' : '💾 Save Changes'}
                                </button>
                            )}
                        </div>

                        {!selectedFile ? (
                            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                                <div className="text-6xl mb-4">📄</div>
                                <p>Select a file to edit its variables</p>
                            </div>
                        ) : (
                            <>
                                {/* Add new variable */}
                                <div className="mb-4 p-3 rounded-lg flex gap-2" style={{ background: 'var(--bg-tertiary)' }}>
                                    <input
                                        type="text"
                                        value={newVarKey}
                                        onChange={(e) => setNewVarKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                                        placeholder="VARIABLE_NAME"
                                        className="flex-1 px-3 py-2 rounded font-mono text-sm"
                                        style={{ background: '#374151', color: '#ffffff', border: '1px solid #4b5563' }}
                                    />
                                    <input
                                        type="text"
                                        value={newVarValue}
                                        onChange={(e) => setNewVarValue(e.target.value)}
                                        placeholder="value"
                                        className="flex-1 px-3 py-2 rounded text-sm"
                                        style={{ background: '#374151', color: '#ffffff', border: '1px solid #4b5563' }}
                                        onKeyDown={(e) => e.key === 'Enter' && addVariable()}
                                    />
                                    <button
                                        onClick={addVariable}
                                        disabled={!newVarKey.trim()}
                                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded font-semibold disabled:opacity-50"
                                    >
                                        + Add
                                    </button>
                                </div>

                                {/* Variables list */}
                                {variables.length === 0 ? (
                                    <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                        No variables yet. Add one above!
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {variables.map(variable => (
                                            <div
                                                key={variable.key}
                                                className="p-3 rounded-lg flex items-center gap-3"
                                                style={{ background: 'var(--bg-tertiary)' }}
                                            >
                                                <div className="w-48 font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    {variable.key}
                                                </div>
                                                <span style={{ color: 'var(--text-muted)' }}>=</span>
                                                {editingKey === variable.key ? (
                                                    <input
                                                        type="text"
                                                        value={variable.value}
                                                        onChange={(e) => updateVariable(variable.key, e.target.value)}
                                                        onBlur={() => setEditingKey(null)}
                                                        onKeyDown={(e) => e.key === 'Enter' && setEditingKey(null)}
                                                        autoFocus
                                                        className="flex-1 px-2 py-1 rounded text-sm"
                                                        style={{ background: '#374151', color: '#ffffff', border: '1px solid #4b5563' }}
                                                    />
                                                ) : (
                                                    <div
                                                        onClick={() => setEditingKey(variable.key)}
                                                        className="flex-1 px-2 py-1 rounded cursor-pointer hover:bg-gray-200 text-sm font-mono truncate"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                        title={variable.value || '(empty)'}
                                                    >
                                                        {variable.value || <span className="opacity-50">(empty)</span>}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => deleteVariable(variable.key)}
                                                    className="text-red-500 hover:text-red-700 p-1"
                                                    title="Delete variable"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {hasChanges && (
                                    <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
                                        ⚠️ You have unsaved changes
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Tips */}
                    <div className="mt-4 p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>💡 Tips</h3>
                        <ul className="text-sm space-y-1" style={{ color: 'var(--text-muted)' }}>
                            <li>• <strong>.env</strong> - Main config (always loaded)</li>
                            <li>• <strong>.env.local</strong> - Local overrides (not in git)</li>
                            <li>• <strong>.env.production</strong> - Production settings</li>
                            <li>• Click on a value to edit it inline</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Create File Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="card p-6 w-96">
                        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                            Create New .env File
                        </h3>
                        <input
                            type="text"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            placeholder=".env.local"
                            className="w-full p-3 rounded-lg mb-4 font-mono"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            autoFocus
                        />
                        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                            File must start with "." or end with ".env"
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewFileName('.env.local');
                                }}
                                className="flex-1 py-2 rounded-lg"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateFile}
                                disabled={!newFileName.trim() || loading}
                                className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50"
                            >
                                {loading ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

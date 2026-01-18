import { useState, useEffect, useRef } from 'react';
import { VHostConfig, CreateVHostInput } from '../types/electron';

interface VirtualHostsProps {
  onBack: () => void;
}

function VirtualHosts({ onBack }: VirtualHostsProps) {
    const [vhosts, setVHosts] = useState<VHostConfig[]>([]);
    const [newVHost, setNewVHost] = useState<CreateVHostInput>({ name: '', domain: '', path: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // Refs for input focus restoration
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadVHosts();
    }, []);

    const loadVHosts = async () => {
        if (window.electronAPI) {
            const list = await window.electronAPI.getVHosts();
            setVHosts(list || []);
        }
    };

    const handleAdd = async () => {
        if (!newVHost.name || !newVHost.domain || !newVHost.path) {
            setError('Please fill all fields');
            return;
        }

        setSaving(true);
        setError(null);

        if (window.electronAPI) {
            const result = await window.electronAPI.addVHost(newVHost);
            if (result.success) {
                setSuccess('Virtual host added! Remember to add to hosts file.');
                setNewVHost({ name: '', domain: '', path: '' });
                loadVHosts();
            } else {
                setError(result.error || 'Failed to add virtual host');
            }
        }

        setSaving(false);
    };

    const handleRemove = async (id: string) => {
        // Save current active element before operation
        const activeElement = document.activeElement as HTMLElement;
        const wasInputFocused = activeElement?.tagName === 'INPUT';
        
        if (window.electronAPI) {
            await window.electronAPI.removeVHost(id);
            await loadVHosts();
            
            // Restore focus to container to keep inputs responsive
            if (wasInputFocused && containerRef.current) {
                // Use setTimeout to ensure DOM has updated
                setTimeout(() => {
                    containerRef.current?.focus();
                    // Re-focus the input if it still exists
                    if (activeElement && document.body.contains(activeElement)) {
                        activeElement.focus();
                    }
                }, 100);
            }
        }
    };

    const handleCopyUrl = async (domain: string) => {
        const url = `http://${domain}`;
        try {
            await navigator.clipboard.writeText(url);
            setSuccess(`URL copied: ${url}`);
        } catch {
            setError('Failed to copy URL');
        }
    };

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

    const handleOpenBrowser = (domain: string) => {
        if (window.electronAPI) {
            window.electronAPI.openBrowser(`http://${domain}`);
        }
    };

    const handleOpenFolder = (folderPath: string) => {
        if (window.electronAPI) {
            window.electronAPI.openFolderPath(folderPath);
        }
    };

    const handleBrowse = async () => {
        if (window.electronAPI) {
            const path = await window.electronAPI.selectFolder();
            if (path) {
                setNewVHost((prev: CreateVHostInput) => ({ ...prev, path }));
            }
        }
    };

    return (
        <div ref={containerRef} tabIndex={-1} className="min-h-screen p-8" style={{ outline: 'none' }}>
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display mb-2 header-title">
                        <span className="header-icon">🌐</span>
                        <span className="header-text">Virtual Hosts</span>
                    </h1>
                    <p className="text-lg text-gradient opacity-90">Manage multiple projects with custom domains</p>
                </div>
                <button
                    onClick={onBack}
                    className="button-secondary"
                >
                    ← Back
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Add New VHost */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-lg">
                            ➕
                        </div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-card)' }}>Add Virtual Host</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-label)' }}>Project Name</label>
                            <input
                                type="text"
                                value={newVHost.name}
                                onChange={(e) => setNewVHost((prev: CreateVHostInput) => ({ ...prev, name: e.target.value }))}
                                placeholder="My Project"
                                className="input w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-label)' }}>Domain</label>
                            <input
                                type="text"
                                value={newVHost.domain}
                                onChange={(e) => setNewVHost((prev: CreateVHostInput) => ({ ...prev, domain: e.target.value }))}
                                placeholder="myproject.test"
                                className="input w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-label)' }}>Document Root</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newVHost.path}
                                    onChange={(e) => setNewVHost((prev: CreateVHostInput) => ({ ...prev, path: e.target.value }))}
                                    placeholder="C:\Projects\myproject\public"
                                    className="input flex-1"
                                />
                                <button
                                    onClick={handleBrowse}
                                    className="button-secondary"
                                >
                                    📁 Browse
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleAdd}
                            disabled={saving}
                            className={`w-full py-3 rounded-xl font-semibold transition-all ${saving
                                    ? 'bg-disabled text-disabled cursor-not-allowed'
                                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                                }`}
                        >
                            {saving ? '⏳ Adding...' : '➕ Add Virtual Host'}
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

                    {/* Hosts file hint */}
                    <div className="mt-6 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                        <p className="text-xs mb-2" style={{ color: 'var(--text-label)' }}>📝 Add to hosts file (Run as Admin):</p>
                        <code className="text-xs text-blue-400 font-mono">
                            C:\Windows\System32\drivers\etc\hosts
                        </code>
                        <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                            127.0.0.1  yourdomain.test
                        </p>
                    </div>
                </div>

                {/* VHost List */}
                <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-lg">
                            🌐
                        </div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-card)' }}>Active Virtual Hosts</h2>
                    </div>

                    {vhosts.length === 0 ? (
                        <div className="p-8 text-center rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                            <div className="text-4xl mb-3">📭</div>
                            <p style={{ color: 'var(--text-on-card)' }}>No virtual hosts configured</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {vhosts.map(vhost => (
                                <div key={vhost.id} className="flex items-center justify-between p-4 rounded-xl hover:shadow-md transition-all" style={{ background: 'var(--bg-tertiary)' }}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-lg">
                                            🌍
                                        </div>
                                        <div>
                                            <p className="font-bold" style={{ color: 'var(--text-on-card)' }}>{vhost.name}</p>
                                            <p className="text-sm text-blue-400">{vhost.domain}</p>
                                            <p className="text-xs truncate max-w-xs" style={{ color: 'var(--text-secondary)' }}>{vhost.path}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleCopyUrl(vhost.domain)}
                                            className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 text-white flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all"
                                            title="Copy URL"
                                        >
                                            📋
                                        </button>
                                        <button
                                            onClick={() => handleOpenBrowser(vhost.domain)}
                                            className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all"
                                            title="Open in Browser"
                                        >
                                            🌐
                                        </button>
                                        <button
                                            onClick={() => handleOpenFolder(vhost.path)}
                                            className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 text-white flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all"
                                            title="Open Folder"
                                        >
                                            📂
                                        </button>
                                        <button
                                            onClick={() => handleRemove(vhost.id)}
                                            className="w-10 h-10 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all"
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default VirtualHosts;

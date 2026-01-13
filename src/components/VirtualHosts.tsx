import { useState, useEffect } from 'react';
import { VHostConfig, CreateVHostInput } from '../types/electron';

interface VirtualHostsProps {
  onBack: () => void;
}

function VirtualHosts({ onBack }: VirtualHostsProps) {
    const [vhosts, setVHosts] = useState<VHostConfig[]>([]);
    const [newVHost, setNewVHost] = useState<CreateVHostInput>({ name: '', domain: '', path: '' });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

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
            setMessage('✗ Please fill all fields');
            return;
        }

        setSaving(true);
        setMessage('');

        if (window.electronAPI) {
            const result = await window.electronAPI.addVHost(newVHost);
            if (result.success) {
                setMessage('✓ Virtual host added! Remember to add to hosts file.');
                setNewVHost({ name: '', domain: '', path: '' });
                loadVHosts();
            } else {
                setMessage(`✗ Error: ${result.error}`);
            }
        }

        setSaving(false);
        setTimeout(() => setMessage(''), 5000);
    };

    const handleRemove = async (id: string) => {
        if (window.electronAPI) {
            await window.electronAPI.removeVHost(id);
            loadVHosts();
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
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                        Virtual Hosts
                    </h1>
                    <p className="text-gray-400">Manage multiple projects with custom domains</p>
                </div>
                <button
                    onClick={onBack}
                    className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                    ← Back
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Add New VHost */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-6">Add Virtual Host</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Project Name</label>
                            <input
                                type="text"
                                value={newVHost.name}
                                onChange={(e) => setNewVHost((prev: CreateVHostInput) => ({ ...prev, name: e.target.value }))}
                                placeholder="My Project"
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Domain</label>
                            <input
                                type="text"
                                value={newVHost.domain}
                                onChange={(e) => setNewVHost((prev: CreateVHostInput) => ({ ...prev, domain: e.target.value }))}
                                placeholder="myproject.test"
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Document Root</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newVHost.path}
                                    onChange={(e) => setNewVHost((prev: CreateVHostInput) => ({ ...prev, path: e.target.value }))}
                                    placeholder="C:\Projects\myproject\public"
                                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                                />
                                <button
                                    onClick={handleBrowse}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                >
                                    Browse
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleAdd}
                            disabled={saving}
                            className={`w-full py-2 rounded-lg font-medium transition-all ${saving
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white'
                                }`}
                        >
                            {saving ? 'Adding...' : '+ Add Virtual Host'}
                        </button>

                        {message && (
                            <p className={`text-sm ${message.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                                {message}
                            </p>
                        )}
                    </div>

                    {/* Hosts file hint */}
                    <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
                        <p className="text-xs text-gray-400 mb-2">📝 Add to hosts file (Run as Admin):</p>
                        <code className="text-xs text-purple-400 font-mono">
                            C:\Windows\System32\drivers\etc\hosts
                        </code>
                        <p className="text-xs text-gray-500 mt-2">
                            127.0.0.1  yourdomain.test
                        </p>
                    </div>
                </div>

                {/* VHost List */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-xl font-semibold mb-6">Active Virtual Hosts</h2>

                    {vhosts.length === 0 ? (
                        <p className="text-gray-500 italic">No virtual hosts configured</p>
                    ) : (
                        <div className="space-y-3">
                            {vhosts.map(vhost => (
                                <div key={vhost.id} className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-700">
                                    <div>
                                        <p className="font-medium">{vhost.name}</p>
                                        <p className="text-sm text-purple-400">{vhost.domain}</p>
                                        <p className="text-xs text-gray-500 truncate max-w-xs">{vhost.path}</p>
                                    </div>
                                    <button
                                        onClick={() => handleRemove(vhost.id)}
                                        className="px-3 py-1 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                                    >
                                        Delete
                                    </button>
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

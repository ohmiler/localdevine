import { useState, useEffect, useCallback } from 'react';

interface DatabaseInfo {
    name: string;
    tables: number;
    size: string;
}

interface TableInfo {
    name: string;
    rows: number;
    size: string;
    engine: string;
}

interface DatabaseManagerProps {
    onBack: () => void;
}

export default function DatabaseManager({ onBack }: DatabaseManagerProps) {
    const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
    const [selectedDb, setSelectedDb] = useState<string | null>(null);
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [newDbName, setNewDbName] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [dbToDelete, setDbToDelete] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

    // Load databases
    const loadDatabases = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.electronAPI.dbList();
            if (result.success) {
                setDatabases(result.data);
                setConnectionStatus('connected');
            } else {
                setError(result.error || 'Failed to load databases');
                setConnectionStatus('disconnected');
            }
        } catch (err) {
            setError((err as Error).message);
            setConnectionStatus('disconnected');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load tables for selected database
    const loadTables = useCallback(async (database: string) => {
        try {
            const result = await window.electronAPI.dbTables(database);
            if (result.success) {
                setTables(result.data);
            } else {
                setError(result.error || 'Failed to load tables');
            }
        } catch (err) {
            setError((err as Error).message);
        }
    }, []);

    // Test connection on mount
    useEffect(() => {
        const testConnection = async () => {
            try {
                const result = await window.electronAPI.dbTestConnection();
                if (result.success) {
                    setConnectionStatus('connected');
                    loadDatabases();
                } else {
                    setConnectionStatus('disconnected');
                    setError('Cannot connect to MariaDB. Make sure the service is running.');
                }
            } catch {
                setConnectionStatus('disconnected');
                setError('Cannot connect to MariaDB. Make sure the service is running.');
            }
        };
        testConnection();
    }, [loadDatabases]);

    // Load tables when database selected
    useEffect(() => {
        if (selectedDb) {
            loadTables(selectedDb);
        } else {
            setTables([]);
        }
    }, [selectedDb, loadTables]);

    // Create database
    const handleCreateDatabase = async () => {
        if (!newDbName.trim()) return;
        
        setLoading(true);
        setError(null);
        try {
            const result = await window.electronAPI.dbCreate(newDbName.trim());
            if (result.success) {
                setSuccess(`Database '${newDbName}' created successfully`);
                setNewDbName('');
                setShowCreateModal(false);
                loadDatabases();
            } else {
                setError(result.error || 'Failed to create database');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    // Delete database
    const handleDeleteDatabase = async () => {
        if (!dbToDelete) return;
        
        setLoading(true);
        setError(null);
        try {
            const result = await window.electronAPI.dbDelete(dbToDelete);
            if (result.success) {
                setSuccess(`Database '${dbToDelete}' deleted successfully`);
                if (selectedDb === dbToDelete) {
                    setSelectedDb(null);
                }
                setDbToDelete(null);
                setShowDeleteModal(false);
                loadDatabases();
            } else {
                setError(result.error || 'Failed to delete database');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    // Import SQL file
    const handleImport = async () => {
        if (!selectedDb) {
            setError('Please select a database first');
            return;
        }

        try {
            const fileResult = await window.electronAPI.dbSelectFile();
            if (!fileResult.success || !fileResult.filePath) return;

            setImporting(true);
            setError(null);
            
            const result = await window.electronAPI.dbImport(selectedDb, fileResult.filePath);
            if (result.success) {
                setSuccess(result.message || 'Import completed successfully');
                loadTables(selectedDb);
            } else {
                setError(result.error || 'Import failed');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setImporting(false);
        }
    };

    // Export database
    const handleExport = async () => {
        if (!selectedDb) {
            setError('Please select a database first');
            return;
        }

        try {
            const fileResult = await window.electronAPI.dbSaveFile(`${selectedDb}_backup.sql`);
            if (!fileResult.success || !fileResult.filePath) return;

            setExporting(true);
            setError(null);
            
            const result = await window.electronAPI.dbExport(selectedDb, fileResult.filePath);
            if (result.success) {
                setSuccess(result.message || 'Export completed successfully');
            } else {
                setError(result.error || 'Export failed');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setExporting(false);
        }
    };

    // Clear messages after 5 seconds
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 10000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    return (
        <div className="min-h-screen p-8">
            {/* Header */}
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display mb-2 header-title">
                        <span className="header-icon">🗄️</span>
                        <span className="header-text">Database Manager</span>
                    </h1>
                    <p className="text-lg text-gradient opacity-90">
                        Manage your MariaDB databases
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Connection Status */}
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                        connectionStatus === 'connected' 
                            ? 'bg-green-100 text-green-700' 
                            : connectionStatus === 'disconnected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                    }`}>
                        <div className={`w-2 h-2 rounded-full ${
                            connectionStatus === 'connected' 
                                ? 'bg-green-500' 
                                : connectionStatus === 'disconnected'
                                ? 'bg-red-500'
                                : 'bg-yellow-500 animate-pulse'
                        }`} />
                        {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'disconnected' ? 'Disconnected' : 'Checking...'}
                    </div>
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
                {/* Database List */}
                <div className="col-span-4">
                    <div className="card p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Databases
                            </h2>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all"
                                disabled={connectionStatus !== 'connected'}
                            >
                                + New
                            </button>
                        </div>

                        {loading && databases.length === 0 ? (
                            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                Loading...
                            </div>
                        ) : databases.length === 0 ? (
                            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                No databases found
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {databases.map(db => (
                                    <div
                                        key={db.name}
                                        onClick={() => setSelectedDb(db.name)}
                                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                                            selectedDb === db.name
                                                ? 'bg-indigo-100 border-2 border-indigo-500'
                                                : 'hover:bg-gray-100 border-2 border-transparent'
                                        }`}
                                        style={{ background: selectedDb === db.name ? undefined : 'var(--bg-tertiary)' }}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    🗃️ {db.name}
                                                </div>
                                                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                                    {db.tables} tables • {db.size}
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDbToDelete(db.name);
                                                    setShowDeleteModal(true);
                                                }}
                                                className="text-red-500 hover:text-red-700 p-1"
                                                title="Delete database"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={loadDatabases}
                            disabled={loading || connectionStatus !== 'connected'}
                            className="w-full mt-4 py-2 text-sm rounded-lg transition-all"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        >
                            🔄 Refresh
                        </button>
                    </div>
                </div>

                {/* Table List & Actions */}
                <div className="col-span-8">
                    <div className="card p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {selectedDb ? `Tables in "${selectedDb}"` : 'Select a database'}
                            </h2>
                            {selectedDb && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleImport}
                                        disabled={importing || !selectedDb}
                                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                                    >
                                        {importing ? '⏳ Importing...' : '📥 Import SQL'}
                                    </button>
                                    <button
                                        onClick={handleExport}
                                        disabled={exporting || !selectedDb}
                                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                                    >
                                        {exporting ? '⏳ Exporting...' : '📤 Export SQL'}
                                    </button>
                                    <button
                                        onClick={() => window.electronAPI.openProjectBrowser('adminer.php')}
                                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all"
                                    >
                                        🌐 Open Adminer
                                    </button>
                                </div>
                            )}
                        </div>

                        {!selectedDb ? (
                            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                                <div className="text-6xl mb-4">📂</div>
                                <p>Select a database from the list to view its tables</p>
                            </div>
                        ) : tables.length === 0 ? (
                            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                                <div className="text-6xl mb-4">📭</div>
                                <p>No tables in this database</p>
                                <p className="text-sm mt-2">Import a SQL file to add tables</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                            <th className="text-left p-3" style={{ color: 'var(--text-secondary)' }}>Table Name</th>
                                            <th className="text-right p-3" style={{ color: 'var(--text-secondary)' }}>Rows</th>
                                            <th className="text-right p-3" style={{ color: 'var(--text-secondary)' }}>Size</th>
                                            <th className="text-right p-3" style={{ color: 'var(--text-secondary)' }}>Engine</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tables.map(table => (
                                            <tr key={table.name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td className="p-3 font-mono" style={{ color: 'var(--text-primary)' }}>
                                                    📋 {table.name}
                                                </td>
                                                <td className="p-3 text-right" style={{ color: 'var(--text-muted)' }}>
                                                    {table.rows.toLocaleString()}
                                                </td>
                                                <td className="p-3 text-right" style={{ color: 'var(--text-muted)' }}>
                                                    {table.size}
                                                </td>
                                                <td className="p-3 text-right" style={{ color: 'var(--text-muted)' }}>
                                                    {table.engine}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Quick Tips */}
                    <div className="mt-4 p-4 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                        <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>💡 Tips</h3>
                        <ul className="text-sm space-y-1" style={{ color: 'var(--text-muted)' }}>
                            <li>• <strong>Import SQL:</strong> Supports large files (streaming mode for files &gt; 10MB)</li>
                            <li>• <strong>Export SQL:</strong> Creates a complete backup including schema and data</li>
                            <li>• <strong>Adminer:</strong> Full-featured web interface for advanced operations</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Create Database Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="card p-6 w-96">
                        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                            Create New Database
                        </h3>
                        <input
                            type="text"
                            value={newDbName}
                            onChange={(e) => setNewDbName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                            placeholder="database_name"
                            className="w-full p-3 rounded-lg mb-4"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                            autoFocus
                        />
                        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                            Only letters, numbers, and underscores allowed
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewDbName('');
                                }}
                                className="flex-1 py-2 rounded-lg"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateDatabase}
                                disabled={!newDbName.trim() || loading}
                                className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50"
                            >
                                {loading ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && dbToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="card p-6 w-96">
                        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                            ⚠️ Delete Database
                        </h3>
                        <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
                            Are you sure you want to delete <strong>"{dbToDelete}"</strong>?
                        </p>
                        <p className="text-sm mb-4 text-red-500">
                            This action cannot be undone. All data will be permanently lost.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDbToDelete(null);
                                }}
                                className="flex-1 py-2 rounded-lg"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteDatabase}
                                disabled={loading}
                                className="flex-1 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-semibold disabled:opacity-50"
                            >
                                {loading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

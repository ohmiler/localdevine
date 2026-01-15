import { useState, useEffect } from 'react';
import { HostsEntry, HostsFileResult, HostsOperationResult } from '../types/electron';

interface HostsEditorProps {
  onBack: () => void;
}

function HostsEditor({ onBack }: HostsEditorProps) {
  const [entries, setEntries] = useState<HostsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasAdminRights, setHasAdminRights] = useState(true);
  const [newEntry, setNewEntry] = useState({ ip: '127.0.0.1', hostname: '', comment: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadHostsFile();
    checkAdminRights();
  }, []);

  const loadHostsFile = async () => {
    setLoading(true);
    setError('');
    
    if (window.electronAPI) {
      const result = await window.electronAPI.getHostsEntries();
      if (result.success && result.entries) {
        setEntries(result.entries);
      } else {
        setError(result.error || 'Failed to load hosts file');
      }
    }
    
    setLoading(false);
  };

  const checkAdminRights = async () => {
    if (window.electronAPI) {
      const hasRights = await window.electronAPI.checkHostsAdminRights();
      setHasAdminRights(hasRights);
      
      if (!hasRights) {
        setError('Admin rights required. Please restart LocalDevine as Administrator.');
      }
    }
  };

  const requestAdminRights = () => {
    if (window.electronAPI) {
      window.electronAPI.requestHostsAdminRights();
    }
  };

  const addEntry = async () => {
    if (!newEntry.hostname.trim()) {
      setMessage('Please enter a hostname');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setSaving(true);
    setMessage('');

    if (window.electronAPI) {
      const result = await window.electronAPI.addHostsEntry(
        newEntry.ip,
        newEntry.hostname.trim(),
        newEntry.comment.trim() || undefined
      );

      if (result.success) {
        setMessage('✓ Entry added successfully');
        setNewEntry({ ip: '127.0.0.1', hostname: '', comment: '' });
        await loadHostsFile();
      } else {
        setMessage(`✗ Error: ${result.error}`);
      }
    }

    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  const removeEntry = async (hostname: string) => {
    if (!window.confirm(`Remove entry for ${hostname}?`)) return;

    if (window.electronAPI) {
      const result = await window.electronAPI.removeHostsEntry(hostname);
      if (result.success) {
        await loadHostsFile();
      } else {
        alert(`Error: ${result.error}`);
      }
    }
  };

  const restoreBackup = async () => {
    if (!window.confirm('Restore hosts file from backup? This will overwrite current entries.')) return;

    if (window.electronAPI) {
      const result = await window.electronAPI.restoreHostsBackup();
      if (result.success) {
        await loadHostsFile();
        alert('Hosts file restored from backup');
      } else {
        alert(`Error: ${result.error}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="card p-8 text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-xl" style={{ color: 'var(--text-on-card)' }}>Loading hosts file...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display mb-2 text-gradient">
            📝 Hosts File Editor
          </h1>
          <p className="text-lg text-gradient opacity-90">Manage Windows hosts file entries</p>
        </div>
        <button
          onClick={onBack}
          className="button-secondary"
        >
          ← Back
        </button>
      </header>

      {/* Admin Rights Warning */}
      {!hasAdminRights && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">⚠️</span>
            <p className="text-gradient">Admin rights required to edit hosts file</p>
          </div>
          <button
            onClick={requestAdminRights}
            className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            🔐 Restart as Administrator
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 flex items-center gap-3">
          <span className="text-xl">❌</span>
          <p className="text-gradient">{error}</p>
        </div>
      )}

      {/* Add New Entry */}
      {hasAdminRights && (
        <div className="card p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-lg">
              ➕
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-card)' }}>Add New Entry</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="IP Address"
              value={newEntry.ip}
              onChange={(e) => setNewEntry(prev => ({ ...prev, ip: e.target.value }))}
              className="input"
            />
            <input
              type="text"
              placeholder="Hostname (e.g., myproject.local)"
              value={newEntry.hostname}
              onChange={(e) => setNewEntry(prev => ({ ...prev, hostname: e.target.value }))}
              className="input"
            />
            <input
              type="text"
              placeholder="Comment (optional)"
              value={newEntry.comment}
              onChange={(e) => setNewEntry(prev => ({ ...prev, comment: e.target.value }))}
              className="input"
            />
            <button
              onClick={addEntry}
              disabled={saving || !newEntry.hostname.trim()}
              className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                saving || !newEntry.hostname.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
              }`}
            >
              {saving ? '⏳ Adding...' : '➕ Add Entry'}
            </button>
          </div>
          {message && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${message.startsWith('✓') ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
              {message}
            </div>
          )}
        </div>
      )}

      {/* Existing Entries */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-lg">
              📋
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-card)' }}>Hosts Entries ({entries.length})</h2>
          </div>
          {hasAdminRights && (
            <button
              onClick={restoreBackup}
              className="button-secondary"
            >
              🔄 Restore Backup
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="text-4xl mb-3">📭</div>
            <p style={{ color: 'var(--text-on-card)' }}>No entries found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.hostname}
                className="flex items-center justify-between p-4 rounded-xl transition-all"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-lg">
                    🌐
                  </div>
                  <div>
                    <div className="font-bold" style={{ color: 'var(--text-on-card)' }}>{entry.hostname}</div>
                    <div className="text-sm text-blue-400">{entry.ip}</div>
                    {entry.comment && (
                      <div className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>#{entry.comment}</div>
                    )}
                  </div>
                </div>
                {hasAdminRights && (
                  <button
                    onClick={() => removeEntry(entry.hostname)}
                    className="w-10 h-10 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>⚠️ Editing the hosts file requires administrator privileges.</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>📡 Changes affect system-wide DNS resolution.</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>💾 Backup is automatically created before any changes.</p>
      </div>
    </div>
  );
}

export default HostsEditor;

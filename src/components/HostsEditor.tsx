import { useState, useEffect } from 'react';
import { HostsEntry } from '../types/electron';

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
  const [success, setSuccess] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);

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
      setError('Please enter a hostname');
      return;
    }

    setSaving(true);
    setError('');

    if (window.electronAPI) {
      const result = await window.electronAPI.addHostsEntry(
        newEntry.ip,
        newEntry.hostname.trim(),
        newEntry.comment.trim() || undefined
      );

      if (result.success) {
        setSuccess('Entry added successfully');
        setNewEntry({ ip: '127.0.0.1', hostname: '', comment: '' });
        await loadHostsFile();
      } else {
        setError(result.error || 'Failed to add entry');
      }
    }

    setSaving(false);
  };

  const removeEntry = async (hostname: string) => {
    if (!window.confirm(`Remove entry for ${hostname}?`)) return;

    if (window.electronAPI) {
      const result = await window.electronAPI.removeHostsEntry(hostname);
      if (result.success) {
        setSuccess(`Removed ${hostname}`);
        await loadHostsFile();
      } else {
        setError(result.error || 'Failed to remove entry');
      }
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
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleRestoreConfirm = async () => {
    setShowRestoreConfirm(false);
    setRestoring(true);
    
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.restoreHostsBackup();
        // Refocus window after elevated PowerShell operation
        await window.electronAPI.refocusWindow();
        
        if (result.success) {
          await loadHostsFile();
          setSuccess('Hosts file restored from backup');
        } else {
          setError(result.error || 'Failed to restore backup');
        }
      } catch (err) {
        setError((err as Error).message);
        await window.electronAPI.refocusWindow();
      } finally {
        setRestoring(false);
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
          <h1 className="text-3xl font-display mb-2 header-title">
            <span className="header-icon">📝</span>
            <span className="header-text">Hosts File Editor</span>
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
            <p className="font-semibold text-red-400">Admin rights required to edit hosts file</p>
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
          <p className="font-semibold text-red-400">{error}</p>
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
                  ? 'bg-disabled text-disabled cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
              }`}
            >
              {saving ? '⏳ Adding...' : '➕ Add Entry'}
            </button>
          </div>
          {success && (
            <div className="mt-3 p-3 rounded-lg text-sm bg-green-100 border border-green-300 text-green-700 flex justify-between items-center">
              <span>✅ {success}</span>
              <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">✕</button>
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
              onClick={() => setShowRestoreConfirm(true)}
              disabled={restoring}
              className="button-secondary"
            >
              {restoring ? '⏳ Restoring...' : '🔄 Restore Backup'}
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

      {/* Restore Confirm Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl">
                ⚠️
              </div>
              <div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-on-card)' }}>Restore Backup?</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>This will overwrite current entries</p>
              </div>
            </div>
            <p className="mb-6" style={{ color: 'var(--text-on-card)' }}>
              Are you sure you want to restore the hosts file from backup? All current entries will be replaced.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRestoreConfirm(false)}
                className="button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreConfirm}
                className="button-primary"
              >
                🔄 Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HostsEditor;

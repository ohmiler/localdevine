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

  const toggleEntry = async (hostname: string) => {
    if (window.electronAPI) {
      const result = await window.electronAPI.toggleHostsEntry(hostname);
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
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-xl">Loading hosts file...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Hosts File Editor
          </h1>
          <p className="text-gray-400">Manage Windows hosts file entries</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          ← Back
        </button>
      </header>

      {/* Admin Rights Warning */}
      {!hasAdminRights && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-lg">
          <p className="text-red-300 mb-3">
            ⚠️ Admin rights required to edit hosts file
          </p>
          <button
            onClick={requestAdminRights}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors"
          >
            Restart as Administrator
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-900 border border-red-700 rounded-lg">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Add New Entry */}
      {hasAdminRights && (
        <div className="mb-8 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Add New Entry</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="IP Address"
              value={newEntry.ip}
              onChange={(e) => setNewEntry(prev => ({ ...prev, ip: e.target.value }))}
              className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Hostname (e.g., myproject.local)"
              value={newEntry.hostname}
              onChange={(e) => setNewEntry(prev => ({ ...prev, hostname: e.target.value }))}
              className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Comment (optional)"
              value={newEntry.comment}
              onChange={(e) => setNewEntry(prev => ({ ...prev, comment: e.target.value }))}
              className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
            />
            <button
              onClick={addEntry}
              disabled={saving || !newEntry.hostname.trim()}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                saving || !newEntry.hostname.trim()
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {saving ? 'Adding...' : 'Add Entry'}
            </button>
          </div>
          {message && (
            <div className={`mt-3 text-sm ${message.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {message}
            </div>
          )}
        </div>
      )}

      {/* Existing Entries */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Hosts Entries ({entries.length})</h2>
          {hasAdminRights && (
            <button
              onClick={restoreBackup}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
            >
              Restore Backup
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="text-gray-500 italic">No entries found</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.hostname}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  entry.enabled
                    ? 'border-green-600 bg-green-900/20'
                    : 'border-gray-600 bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleEntry(entry.hostname)}
                    disabled={!hasAdminRights}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      !hasAdminRights ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      entry.enabled
                        ? 'bg-green-500 hover:bg-green-600'
                        : 'bg-gray-500 hover:bg-gray-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform ${
                        entry.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <div>
                    <div className="font-medium">{entry.hostname}</div>
                    <div className="text-sm text-gray-400">{entry.ip}</div>
                    {entry.comment && (
                      <div className="text-xs text-gray-500 italic">#{entry.comment}</div>
                    )}
                  </div>
                </div>
                {hasAdminRights && (
                  <button
                    onClick={() => removeEntry(entry.hostname)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 text-xs text-gray-500">
        <p>⚠️ Editing the hosts file requires administrator privileges.</p>
        <p>Changes affect system-wide DNS resolution.</p>
        <p>Backup is automatically created before any changes.</p>
      </div>
    </div>
  );
}

export default HostsEditor;

import { useState, useEffect } from 'react';

interface PHPVersionInfo {
  version: string;
  displayName: string;
  url: string;
  size: string;
  installed: boolean;
}

interface DownloadProgress {
  version: string;
  progress: number;
  downloaded: number;
  total: number;
  status: 'downloading' | 'extracting' | 'completed' | 'error';
  error?: string;
}

interface PHPDownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onSkip?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function PHPDownloadDialog({ isOpen, onClose, onComplete, onSkip }: PHPDownloadDialogProps) {
  const [versions, setVersions] = useState<PHPVersionInfo[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, DownloadProgress>>({});
  const [error, setError] = useState<string | null>(null);

  // Load available versions on mount
  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen]);

  // Listen for download progress
  useEffect(() => {
    if (!window.electronAPI) return;

    const handleProgress = (_event: any, progress: DownloadProgress) => {
      setDownloadProgress(prev => ({
        ...prev,
        [progress.version]: progress
      }));

      // Check if all downloads completed
      if (progress.status === 'completed') {
        // Refresh versions list
        loadVersions();
      }
    };

    window.electronAPI.on('php-download-progress', handleProgress);

    return () => {
      window.electronAPI.removeListener('php-download-progress', handleProgress);
    };
  }, []);

  const loadVersions = async () => {
    if (!window.electronAPI) return;
    
    try {
      const result = await (window.electronAPI as any).phpGetAvailableVersions();
      if (result.success) {
        setVersions(result.data);
        // Pre-select versions that are not installed (except 8.5 which is default)
        const notInstalled = result.data
          .filter((v: PHPVersionInfo) => !v.installed && v.version !== '8.5')
          .map((v: PHPVersionInfo) => v.version);
        setSelectedVersions(new Set(notInstalled));
      }
    } catch (err) {
      setError('Failed to load PHP versions');
    }
  };

  const toggleVersion = (version: string) => {
    if (isDownloading) return;
    
    const newSelected = new Set(selectedVersions);
    if (newSelected.has(version)) {
      newSelected.delete(version);
    } else {
      newSelected.add(version);
    }
    setSelectedVersions(newSelected);
  };

  const handleDownload = async () => {
    if (selectedVersions.size === 0) return;
    
    setIsDownloading(true);
    setError(null);
    
    try {
      const versionsArray = Array.from(selectedVersions);
      const result = await (window.electronAPI as any).phpDownloadMultiple(versionsArray);
      
      if (result.success) {
        // All downloads completed
        setTimeout(() => {
          onComplete();
        }, 1000);
      } else {
        setError('Some downloads failed. Please try again.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
    onClose();
  };

  const allCompleted = Object.values(downloadProgress).every(
    p => p.status === 'completed' || p.status === 'error'
  ) && Object.keys(downloadProgress).length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div 
        className="w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
      >
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl">
              🐘
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-card)' }}>
                Download PHP Versions
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Select PHP versions to install
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {versions.map((version) => {
              const progress = downloadProgress[version.version];
              const isSelected = selectedVersions.has(version.version);
              const isDefault = version.version === '8.5';
              
              return (
                <div
                  key={version.version}
                  onClick={() => !isDefault && !version.installed && toggleVersion(version.version)}
                  className={`p-4 rounded-xl border transition-all ${
                    isDefault || version.installed
                      ? 'opacity-60 cursor-not-allowed'
                      : isSelected
                        ? 'border-purple-500 bg-purple-500/10 cursor-pointer'
                        : 'border-transparent hover:border-purple-500/50 cursor-pointer'
                  }`}
                  style={{ 
                    background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-tertiary)',
                    borderColor: isSelected ? 'rgb(139, 92, 246)' : 'var(--border-color)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      <div 
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          version.installed 
                            ? 'bg-green-500 border-green-500' 
                            : isSelected 
                              ? 'bg-purple-500 border-purple-500' 
                              : 'border-gray-500'
                        }`}
                      >
                        {(version.installed || isSelected) && (
                          <span className="text-white text-xs">✓</span>
                        )}
                      </div>
                      
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--text-on-card)' }}>
                          {version.displayName}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {version.installed ? '✅ Installed' : version.size}
                        </p>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    {progress && (
                      <div className="text-right">
                        {progress.status === 'downloading' && (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-500 transition-all"
                                style={{ width: `${progress.progress}%` }}
                              />
                            </div>
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {progress.progress}%
                            </span>
                          </div>
                        )}
                        {progress.status === 'extracting' && (
                          <span className="text-xs text-blue-400">📦 Extracting...</span>
                        )}
                        {progress.status === 'completed' && (
                          <span className="text-xs text-green-400">✅ Installed</span>
                        )}
                        {progress.status === 'error' && (
                          <span className="text-xs text-red-400">❌ Failed</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-between" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            onClick={handleSkip}
            disabled={isDownloading}
            className="px-6 py-2.5 rounded-xl font-medium transition-all"
            style={{ 
              background: 'var(--bg-tertiary)', 
              color: 'var(--text-secondary)',
              opacity: isDownloading ? 0.5 : 1
            }}
          >
            {allCompleted ? 'Close' : 'Skip for now'}
          </button>
          
          {!allCompleted && (
            <button
              onClick={handleDownload}
              disabled={isDownloading || selectedVersions.size === 0}
              className={`px-6 py-2.5 rounded-xl font-semibold text-white transition-all flex items-center gap-2 ${
                isDownloading || selectedVersions.size === 0
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:shadow-lg hover:scale-[1.02]'
              }`}
            >
              {isDownloading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isDownloading 
                ? 'Downloading...' 
                : `Download ${selectedVersions.size} version${selectedVersions.size !== 1 ? 's' : ''}`
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

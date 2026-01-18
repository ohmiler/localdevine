import { memo, useMemo } from 'react';
import { ServiceStatus, ServiceHealth } from '../types/electron';

interface ServiceCardProps {
  service: 'php' | 'apache' | 'mariadb';
  status: ServiceStatus;
  health?: ServiceHealth;
  onToggle: () => void;
}

const serviceIcons: Record<string, string> = {
  php: '🐘',
  apache: '🪶',
  mariadb: '🗄️'
};

const serviceColors: Record<string, string> = {
  php: 'from-purple-600 to-indigo-700',
  apache: 'from-orange-600 to-red-700',
  mariadb: 'from-blue-600 to-cyan-700'
};

const statusConfig: Record<ServiceStatus, { label: string; color: string; bgColor: string; animate?: boolean }> = {
  stopped: { label: 'Stopped', color: 'text-gray-500', bgColor: 'bg-gradient-to-r from-gray-400 to-gray-500' },
  starting: { label: 'Starting...', color: 'text-blue-500', bgColor: 'bg-gradient-to-r from-blue-400 to-blue-500', animate: true },
  running: { label: 'Running', color: 'text-green-500', bgColor: 'bg-gradient-to-r from-green-500 to-emerald-600' },
  stopping: { label: 'Stopping...', color: 'text-orange-500', bgColor: 'bg-gradient-to-r from-orange-400 to-orange-500', animate: true },
  error: { label: 'Error', color: 'text-red-500', bgColor: 'bg-gradient-to-r from-red-500 to-red-600' },
};

// Format uptime in human-readable format
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function ServiceCard({ service, status, health, onToggle }: ServiceCardProps) {
    // Memoize computed values
    const displayName = useMemo(() => 
        service === 'mariadb' ? 'MariaDB' : service.toUpperCase(), 
        [service]
    );
    
    const isRunning = status === 'running';
    const isLoading = status === 'starting' || status === 'stopping';
    const isHealthy = health?.isHealthy;
    
    const lastCheck = useMemo(() => 
        health?.lastCheck ? new Date(health.lastCheck).toLocaleTimeString() : '',
        [health?.lastCheck]
    );
    
    const icon = serviceIcons[service] || '⚙️';
    const gradientColor = serviceColors[service] || 'from-gray-500 to-gray-600';
    const statusInfo = statusConfig[status] || statusConfig.stopped;

    return (
        <div className="card p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            {/* Header with icon and status */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientColor} flex items-center justify-center text-2xl shadow-lg ${isLoading ? 'animate-pulse' : ''}`}>
                        {icon}
                    </div>
                    <div>
                        <h2 className="text-xl font-heading" style={{ color: 'var(--text-on-card)' }}>{displayName}</h2>
                        <p className={`text-sm font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isRunning && (
                        <div className={`w-3 h-3 rounded-full ${isHealthy ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} 
                             title={`Health: ${isHealthy ? 'Good' : 'Warning'}`} />
                    )}
                    {isLoading && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    <span
                        className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide text-white ${statusInfo.bgColor} ${statusInfo.animate ? 'animate-pulse' : ''}`}
                    >
                        {status}
                    </span>
                </div>
            </div>

            {/* Health details */}
            {health && (
                <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="flex justify-between text-sm mb-2">
                        <span style={{ color: 'var(--text-label)' }}>Status</span>
                        <span className={isHealthy ? 'text-green-500 font-medium' : 'text-yellow-500 font-medium'}>
                            {isHealthy ? '● Healthy' : status === 'stopped' ? '○ Stopped' : '● Warning'}
                        </span>
                    </div>
                    
                    {/* Metrics Grid */}
                    {isRunning && (
                        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                            {health.pid && (
                                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                                    <span>PID</span>
                                    <span className="font-mono">{health.pid}</span>
                                </div>
                            )}
                            {health.port && (
                                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                                    <span>Port</span>
                                    <span className="font-mono">{health.port}</span>
                                </div>
                            )}
                            {health.uptime !== undefined && (
                                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                                    <span>Uptime</span>
                                    <span className="font-mono">{formatUptime(health.uptime)}</span>
                                </div>
                            )}
                            {health.memoryUsage !== undefined && health.memoryUsage > 0 && (
                                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                                    <span>Memory</span>
                                    <span className="font-mono">{health.memoryUsage} MB</span>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {health.error && (
                        <div className="text-red-400 text-xs mt-1 truncate" title={health.error}>
                            ⚠️ {health.error}
                        </div>
                    )}
                    <div className="flex justify-between text-xs mt-2 pt-2 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}>
                        <span>Last check</span>
                        <span>{lastCheck}</span>
                    </div>
                </div>
            )}

            {/* Action button */}
            <button
                onClick={onToggle}
                disabled={isLoading}
                className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 shadow-md flex items-center justify-center gap-2 ${
                    isLoading
                        ? 'bg-disabled text-disabled cursor-not-allowed'
                        : isRunning
                            ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:shadow-lg hover:scale-[1.02]'
                            : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:scale-[1.02]'
                }`}
            >
                {isLoading && (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
                {isLoading 
                    ? (status === 'starting' ? 'Starting...' : 'Stopping...') 
                    : (isRunning ? '■ Stop Service' : '▶ Start Service')
                }
            </button>
        </div>
    );
}

// Memoize component to prevent unnecessary re-renders
export default memo(ServiceCard);

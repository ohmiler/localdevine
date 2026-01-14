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

function ServiceCard({ service, status, health, onToggle }: ServiceCardProps) {
    const displayName = service === 'mariadb' ? 'MariaDB' : service.toUpperCase();
    const isRunning = status === 'running';
    const isHealthy = health?.isHealthy;
    const lastCheck = health?.lastCheck ? new Date(health.lastCheck).toLocaleTimeString() : '';
    const icon = serviceIcons[service] || '⚙️';
    const gradientColor = serviceColors[service] || 'from-gray-500 to-gray-600';

    return (
        <div className="card p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            {/* Header with icon and status */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradientColor} flex items-center justify-center text-2xl shadow-lg`}>
                        {icon}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text-on-card)' }}>{displayName}</h2>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {isRunning ? 'Active' : 'Inactive'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isRunning && (
                        <div className={`w-3 h-3 rounded-full ${isHealthy ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} 
                             title={`Health: ${isHealthy ? 'Good' : 'Warning'}`} />
                    )}
                    <span
                        className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                            isRunning 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                                : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                        }`}
                    >
                        {status}
                    </span>
                </div>
            </div>

            {/* Health details */}
            {health && (
                <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="flex justify-between text-sm mb-1">
                        <span style={{ color: 'var(--text-label)' }}>Health</span>
                        <span className={isHealthy ? 'text-green-500 font-medium' : 'text-yellow-500 font-medium'}>
                            {isHealthy ? '● Healthy' : '● Warning'}
                        </span>
                    </div>
                    {health.error && (
                        <div className="text-red-400 text-xs mt-1 truncate" title={health.error}>
                            ⚠️ {health.error}
                        </div>
                    )}
                    <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                        <span>Last check</span>
                        <span>{lastCheck}</span>
                    </div>
                </div>
            )}

            {/* Action button */}
            <button
                onClick={onToggle}
                className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02] ${
                    isRunning
                        ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                }`}
            >
                {isRunning ? '■ Stop Service' : '▶ Start Service'}
            </button>
        </div>
    );
}

export default ServiceCard;

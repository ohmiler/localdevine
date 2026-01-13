import { ServiceStatus, ServiceHealth } from '../types/electron';

interface ServiceCardProps {
  service: 'php' | 'apache' | 'mariadb';
  status: ServiceStatus;
  health?: ServiceHealth;
  onToggle: () => void;
}

function ServiceCard({ service, status, health, onToggle }: ServiceCardProps) {
    const displayName = service === 'mariadb' ? 'MariaDB' : service.toUpperCase();
    const isRunning = status === 'running';
    const isHealthy = health?.isHealthy;
    const lastCheck = health?.lastCheck ? new Date(health.lastCheck).toLocaleTimeString() : '';

    // Determine border color based on health
    const borderColor = isRunning 
        ? (isHealthy ? 'border-green-500' : 'border-yellow-500')
        : 'border-gray-700';

    return (
        <div className={`bg-gray-800 rounded-xl p-6 border ${borderColor} hover:border-purple-500 transition-all duration-300`}>
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">{displayName}</h2>
                <div className="flex items-center gap-2">
                    {/* Health indicator */}
                    {isRunning && (
                        <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-400' : 'bg-yellow-400'}`} 
                             title={`Health: ${isHealthy ? 'Good' : 'Warning'}`} />
                    )}
                    <span
                        className={`px-2 py-1 rounded text-xs font-bold ${isRunning ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                            }`}
                    >
                        {status.toUpperCase()}
                    </span>
                </div>
            </div>

            {/* Health details */}
            {health && (
                <div className="mb-4 text-xs text-gray-400">
                    <div className="flex justify-between">
                        <span>Health:</span>
                        <span className={isHealthy ? 'text-green-400' : 'text-yellow-400'}>
                            {isHealthy ? 'Good' : 'Warning'}
                        </span>
                    </div>
                    {health.error && (
                        <div className="text-red-400 mt-1 truncate" title={health.error}>
                            {health.error}
                        </div>
                    )}
                    <div className="flex justify-between mt-1">
                        <span>Last check:</span>
                        <span>{lastCheck}</span>
                    </div>
                </div>
            )}

            <button
                onClick={onToggle}
                className={`w-full py-2 rounded-lg font-medium transition-colors ${isRunning
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
            >
                {isRunning ? 'Stop' : 'Start'}
            </button>
        </div>
    );
}

export default ServiceCard;

import { ServiceStatus } from '../types/electron';

interface ServiceCardProps {
  service: 'php' | 'nginx' | 'mariadb';
  status: ServiceStatus;
  onToggle: () => void;
}

function ServiceCard({ service, status, onToggle }: ServiceCardProps) {
    const displayName = service === 'mariadb' ? 'MariaDB' : service.toUpperCase();
    const isRunning = status === 'running';

    return (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">{displayName}</h2>
                <span
                    className={`px-2 py-1 rounded text-xs font-bold ${isRunning ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                        }`}
                >
                    {status.toUpperCase()}
                </span>
            </div>

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

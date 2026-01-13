import { useState, useEffect } from 'react';
import ServiceCard from './components/ServiceCard';
import ConsolePanel from './components/ConsolePanel';
import Settings from './components/Settings';
import VirtualHosts from './components/VirtualHosts';
import HostsEditor from './components/HostsEditor';
import NotificationPanel from './components/NotificationPanel';
import ProjectTemplates from './components/ProjectTemplates';
import { ServiceStatus, LogEntry, ServiceHealth, ServiceNotification } from './types/electron';

type PageType = 'home' | 'settings' | 'vhosts' | 'hosts' | 'templates';

interface Services {
  php: ServiceStatus;
  apache: ServiceStatus;
  mariadb: ServiceStatus;
}

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [services, setServices] = useState<Services>({
    php: 'stopped',
    apache: 'stopped',
    mariadb: 'stopped'
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [version, setVersion] = useState<string>('0.0.0');
  const [healthStatus, setHealthStatus] = useState<Record<string, ServiceHealth>>({});
  const [notifications, setNotifications] = useState<ServiceNotification[]>([]);

  useEffect(() => {
    if (window.electronAPI) {
      // Get version
      window.electronAPI.getVersion().then(v => setVersion(v));

      const handleStatus = (event: any, { service, status }: { service: keyof Services; status: ServiceStatus }) => {
        setServices(prev => ({ ...prev, [service]: status }));
      };

      const handleLog = (event: any, { time, service, message }: LogEntry) => {
        setLogs(prev => [...prev.slice(-100), { time, service, message }]);
      };

      const handleHealth = (event: any, healthData: Record<string, ServiceHealth>) => {
        setHealthStatus(healthData);
      };

      const handleNotification = (event: any, notification: ServiceNotification) => {
        setNotifications(prev => [...prev.slice(-9), notification]); // Keep last 10
      };

      window.electronAPI.on('service-status', handleStatus);
      window.electronAPI.on('log-entry', handleLog);
      window.electronAPI.on('health-status', handleHealth);
      window.electronAPI.on('service-notification', handleNotification);

      return () => {
        window.electronAPI.removeListener('service-status', handleStatus);
        window.electronAPI.removeListener('log-entry', handleLog);
        window.electronAPI.removeListener('health-status', handleHealth);
        window.electronAPI.removeListener('service-notification', handleNotification);
      };
    }
  }, []);

  const toggleService = (service: keyof Services) => {
    const currentState = services[service];
    if (window.electronAPI) {
      if (currentState === 'stopped') {
        window.electronAPI.startService(service);
      } else {
        window.electronAPI.stopService(service);
      }
    }
  };

  const startAllServices = () => {
    if (window.electronAPI) {
      window.electronAPI.startAllServices();
    }
  };

  const stopAllServices = () => {
    if (window.electronAPI) {
      window.electronAPI.stopAllServices();
    }
  };

  const allRunning = Object.values(services).every(s => s === 'running');
  const allStopped = Object.values(services).every(s => s === 'stopped');

  // Render Settings page
  if (currentPage === 'settings') {
    return <Settings onBack={() => setCurrentPage('home')} />;
  }

  // Render Virtual Hosts page
  if (currentPage === 'vhosts') {
    return <VirtualHosts onBack={() => setCurrentPage('home')} />;
  }

  // Render Hosts Editor page
  if (currentPage === 'hosts') {
    return <HostsEditor onBack={() => setCurrentPage('home')} />;
  }

  // Render Project Templates page
  if (currentPage === 'templates') {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="p-4 border-b border-gray-800 flex items-center gap-4">
          <button
            onClick={() => setCurrentPage('home')}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold">Project Templates</h1>
        </div>
        <ProjectTemplates />
      </div>
    );
  }

  // Render Home page
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            LocalDevine
          </h1>
          <p className="text-gray-400">The Modern PHP Development Environment</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage('templates')}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
          >
            📦 Projects
          </button>
          <button
            onClick={() => setCurrentPage('vhosts')}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
          >
            🌐 Virtual Hosts
          </button>
          <button
            onClick={() => setCurrentPage('hosts')}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
          >
            📝 Hosts File
          </button>
          <button
            onClick={() => setCurrentPage('settings')}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
          >
            ⚙️ Settings
          </button>
          <div className="text-xs text-gray-500 font-mono">v{version}</div>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={startAllServices}
          disabled={allRunning}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${allRunning
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-green-500/25'
            }`}
        >
          ▶ Start All
        </button>
        <button
          onClick={stopAllServices}
          disabled={allStopped}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${allStopped
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg hover:shadow-red-500/25'
            }`}
        >
          ■ Stop All
        </button>
      </div>

      {/* Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {(['php', 'apache', 'mariadb'] as Array<keyof Services>).map(service => (
          <ServiceCard
            key={service}
            service={service}
            status={services[service]}
            health={healthStatus[service]}
            onToggle={() => toggleService(service)}
          />
        ))}
      </div>

      {/* Quick Access */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => window.electronAPI?.openFolder('www')}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
        >
          📁 www Folder
        </button>
        <button
          onClick={() => window.electronAPI?.openFolder('config')}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
        >
          📄 Config Folder
        </button>
        <button
          onClick={() => window.electronAPI?.openTerminal()}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
        >
          💻 Terminal
        </button>
      </div>

      {/* Console / Logs Area */}
      <ConsolePanel logs={logs} />
      
      {/* Notification Panel */}
      <NotificationPanel notifications={notifications} />
    </div>
  );
}

export default App;

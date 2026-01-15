import { useState, useEffect } from 'react';
import ServiceCard from './components/ServiceCard';
import ConsolePanel from './components/ConsolePanel';
import Settings from './components/Settings';
import VirtualHosts from './components/VirtualHosts';
import HostsEditor from './components/HostsEditor';
import NotificationPanel from './components/NotificationPanel';
import ProjectTemplates from './components/ProjectTemplates';
import { ServiceStatus, LogEntry, ServiceHealth, ServiceNotification } from './types/electron';
import './styles/themes.css';

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
        console.log('[React] Received service-status:', service, status);
        setServices(prev => ({ ...prev, [service]: status }));
      };

      const handleLog = (event: any, { time, service, message }: LogEntry) => {
        setLogs(prev => [...prev.slice(-100), { time, service, message }]);
      };

      const handleHealth = (event: any, healthData: Record<string, ServiceHealth>) => {
        console.log('[React] Received health-status:', healthData);
        setHealthStatus(healthData);
      };

      const handleNotification = (event: any, notification: ServiceNotification) => {
        const notificationWithId = { ...notification, id: Date.now() };
        setNotifications(prev => [...prev.slice(-9), notificationWithId]); // Keep last 10
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => (n as any).id !== notificationWithId.id));
        }, 10000);
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

  // Check if any service is loading
  const anyLoading = Object.values(services).some(s => s === 'starting' || s === 'stopping');

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
      <div className="min-h-screen p-8">
        <header className="mb-10 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-gradient">
              📦 Project Templates
            </h1>
            <p className="text-lg text-gradient">Create projects from templates</p>
          </div>
          <button
            onClick={() => setCurrentPage('home')}
            className="button-secondary"
          >
            ← Back
          </button>
        </header>
        <ProjectTemplates />
      </div>
    );
  }

  // Render Home page
  return (
    <div className="min-h-screen p-8">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2 text-gradient">
            LocalDevine
          </h1>
          <p className="text-lg font-medium text-gradient">The Modern PHP Development Environment</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage('templates')}
            className="button-secondary"
          >
            📦 Projects
          </button>
          <button
            onClick={() => setCurrentPage('vhosts')}
            className="button-secondary"
          >
            🌐 Virtual Hosts
          </button>
          <button
            onClick={() => setCurrentPage('hosts')}
            className="button-secondary"
          >
            📝 Hosts File
          </button>
          <button
            onClick={() => setCurrentPage('settings')}
            className="button-secondary"
          >
            ⚙️ Settings
          </button>
          <div className="text-sm text-muted font-mono">v{version}</div>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={startAllServices}
          disabled={allRunning || anyLoading}
          className={`px-8 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
            allRunning || anyLoading
              ? 'bg-tertiary text-muted cursor-not-allowed'
              : 'bg-gradient-success text-white shadow-lg hover:shadow-xl hover:scale-105'
          }`}
        >
          {anyLoading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
          ▶ Start All Services
        </button>
        <button
          onClick={stopAllServices}
          disabled={allStopped || anyLoading}
          className={`px-8 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
            allStopped || anyLoading
              ? 'bg-tertiary text-muted cursor-not-allowed'
              : 'bg-gradient-error text-white shadow-lg hover:shadow-xl hover:scale-105'
          }`}
        >
          {anyLoading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
          ■ Stop All Services
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
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => window.electronAPI?.openProjectBrowser('')}
          className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all"
        >
          🌐 Open localhost
        </button>
        <button
          onClick={() => window.electronAPI?.openProjectBrowser('adminer.php')}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all"
        >
          🗄️ Database
        </button>
        <button
          onClick={() => window.electronAPI?.openFolder('www')}
          className="button-secondary"
        >
          📁 www Folder
        </button>
        <button
          onClick={() => window.electronAPI?.openFolder('config')}
          className="button-secondary"
        >
          📄 Config Folder
        </button>
        <button
          onClick={() => window.electronAPI?.openTerminal()}
          className="button-secondary"
        >
          💻 Terminal
        </button>
      </div>

      {/* Console / Logs Area */}
      <ConsolePanel logs={logs} />
      
      {/* Notification Panel */}
      <NotificationPanel 
        notifications={notifications} 
        onDismiss={(index) => setNotifications(prev => prev.filter((_, i) => i !== index))}
        onDismissAll={() => setNotifications([])}
      />
    </div>
  );
}

export default App;

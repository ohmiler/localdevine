import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ServiceCard from './components/ServiceCard';
import ConsolePanel from './components/ConsolePanel';
import Settings from './components/Settings';
import VirtualHosts from './components/VirtualHosts';
import HostsEditor from './components/HostsEditor';
import NotificationPanel from './components/NotificationPanel';
import ProjectTemplates from './components/ProjectTemplates';
import DatabaseManager from './components/DatabaseManager';
import EnvManager from './components/EnvManager';
import SSLManager from './components/SSLManager';
import LogsManager from './components/LogsManager';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import { useKeyboardShortcuts, defaultShortcuts } from './hooks/useKeyboardShortcuts';
import { ServiceStatus, LogEntry, ServiceHealth, ServiceNotification } from './types/electron';
import './styles/themes.css';

type PageType = 'home' | 'settings' | 'vhosts' | 'hosts' | 'templates' | 'database' | 'env' | 'ssl' | 'logs';

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
  
  // Store timeout IDs for cleanup (fix memory leak)
  const notificationTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (window.electronAPI) {
      // Get version
      window.electronAPI.getVersion().then(v => setVersion(v));

      const handleStatus = (_event: any, { service, status }: { service: keyof Services; status: ServiceStatus }) => {
        setServices(prev => ({ ...prev, [service]: status }));
      };

      const handleLog = (_event: any, { time, service, message }: LogEntry) => {
        setLogs(prev => [...prev.slice(-100), { time, service, message }]);
      };

      const handleHealth = (_event: any, healthData: Record<string, ServiceHealth>) => {
        setHealthStatus(healthData);
      };

      const handleNotification = (_event: any, notification: ServiceNotification) => {
        const notificationWithId = { ...notification, id: Date.now() };
        setNotifications(prev => [...prev.slice(-9), notificationWithId]); // Keep last 10
        
        // Auto-dismiss after 10 seconds (with proper cleanup)
        const timeoutId = setTimeout(() => {
          setNotifications(prev => prev.filter(n => (n as any).id !== notificationWithId.id));
          notificationTimeoutsRef.current.delete(notificationWithId.id);
        }, 10000);
        
        notificationTimeoutsRef.current.set(notificationWithId.id, timeoutId);
      };

      
      window.electronAPI.on('service-status', handleStatus);
      window.electronAPI.on('log-entry', handleLog);
      window.electronAPI.on('health-status', handleHealth);
      window.electronAPI.on('service-notification', handleNotification);

      return () => {
        // Clear all notification timeouts to prevent memory leaks
        notificationTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        notificationTimeoutsRef.current.clear();
        
        window.electronAPI.removeListener('service-status', handleStatus);
        window.electronAPI.removeListener('log-entry', handleLog);
        window.electronAPI.removeListener('health-status', handleHealth);
        window.electronAPI.removeListener('service-notification', handleNotification);
      };
    }
  }, []);

  // Memoized callbacks to prevent unnecessary re-renders
  const toggleService = useCallback((service: keyof Services) => {
    const currentState = services[service];
    if (window.electronAPI) {
      if (currentState === 'stopped') {
        // Optimistic update: show loading state immediately
        setServices(prev => ({ ...prev, [service]: 'starting' }));
        window.electronAPI.startService(service);
      } else if (currentState === 'running') {
        // Optimistic update: show loading state immediately
        setServices(prev => ({ ...prev, [service]: 'stopping' }));
        window.electronAPI.stopService(service);
      }
    }
  }, [services]);

  const startAllServices = useCallback(() => {
    if (window.electronAPI) {
      // Optimistic update: show loading state immediately for all services
      setServices({
        php: 'starting',
        apache: 'starting',
        mariadb: 'starting'
      });
      window.electronAPI.startAllServices();
    }
  }, []);

  const stopAllServices = useCallback(() => {
    if (window.electronAPI) {
      // Optimistic update: show loading state immediately for all services
      setServices({
        php: 'stopping',
        apache: 'stopping',
        mariadb: 'stopping'
      });
      window.electronAPI.stopAllServices();
    }
  }, []);

  // Memoized computed values
  const allRunning = useMemo(() => 
    Object.values(services).every(s => s === 'running'), 
    [services]
  );
  
  const allStopped = useMemo(() => 
    Object.values(services).every(s => s === 'stopped'), 
    [services]
  );

  // Check if any service is loading
  const anyLoading = useMemo(() => 
    Object.values(services).some(s => s === 'starting' || s === 'stopping'), 
    [services]
  );

  // Keyboard shortcuts
  const keyboardShortcuts = useMemo(() => [
    { 
      ...defaultShortcuts.startAllServices, 
      action: () => !allRunning && !anyLoading && startAllServices() 
    },
    { 
      ...defaultShortcuts.stopAllServices, 
      action: () => !allStopped && !anyLoading && stopAllServices() 
    },
    { 
      ...defaultShortcuts.openSettings, 
      action: () => setCurrentPage('settings') 
    },
    { 
      ...defaultShortcuts.openVHosts, 
      action: () => setCurrentPage('vhosts') 
    },
    { 
      ...defaultShortcuts.openHosts, 
      action: () => setCurrentPage('hosts') 
    },
    { 
      ...defaultShortcuts.openProjects, 
      action: () => setCurrentPage('templates') 
    },
    { 
      ...defaultShortcuts.openLocalhost, 
      action: () => window.electronAPI?.openProjectBrowser('') 
    },
    { 
      ...defaultShortcuts.openTerminal, 
      action: () => window.electronAPI?.openTerminal() 
    },
    { 
      ...defaultShortcuts.goHome, 
      action: () => setCurrentPage('home') 
    },
  ], [allRunning, allStopped, anyLoading, startAllServices, stopAllServices]);

  useKeyboardShortcuts(keyboardShortcuts);

  // Render page content based on current page
  const renderPageContent = () => {
    switch (currentPage) {
      case 'settings':
        return <Settings onBack={() => setCurrentPage('home')} />;
      case 'vhosts':
        return <VirtualHosts onBack={() => setCurrentPage('home')} />;
      case 'hosts':
        return <HostsEditor onBack={() => setCurrentPage('home')} />;
      case 'templates':
        return (
          <div className="min-h-screen p-8">
            <header className="mb-10 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-display mb-2 header-title">
                  <span className="header-icon">📦</span>
                  <span className="header-text">Project Templates</span>
                </h1>
                <p className="text-lg text-gradient opacity-90">Create projects from templates</p>
              </div>
            </header>
            <ProjectTemplates />
          </div>
        );
      case 'database':
        return <DatabaseManager onBack={() => setCurrentPage('home')} />;
      case 'env':
        return <EnvManager onBack={() => setCurrentPage('home')} />;
      case 'ssl':
        return <SSLManager onBack={() => setCurrentPage('home')} />;
      case 'logs':
        return <LogsManager onBack={() => setCurrentPage('home')} />;
      default:
        return renderHomePage();
    }
  };

  // Render Home page content
  const renderHomePage = () => (
    <div className="p-8">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-display mb-2 text-gradient">
            Dashboard
          </h1>
          <p className="text-lg font-medium text-gradient opacity-90">Service Management & Quick Actions</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Quick Actions */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={startAllServices}
          disabled={allRunning || anyLoading}
          className={`px-8 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
            allRunning || anyLoading
              ? 'bg-disabled text-disabled cursor-not-allowed'
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
              ? 'bg-disabled text-disabled cursor-not-allowed'
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
          className="button-secondary"
        >
          🌐 Open localhost
        </button>
        <button
          onClick={() => window.electronAPI?.openProjectBrowser('adminer.php')}
          className="button-secondary"
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

  // Main layout with Sidebar
  return (
    <div className="app-layout" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        version={version}
      />
      <main 
        className="main-content" 
        style={{ 
          flex: 1, 
          marginLeft: '240px',
          minHeight: '100vh',
          transition: 'margin-left 0.3s ease',
        }}
      >
        {renderPageContent()}
      </main>
    </div>
  );
}

export default App;

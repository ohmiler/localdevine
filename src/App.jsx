import { useState, useEffect } from 'react';
import ServiceCard from './components/ServiceCard';
import ConsolePanel from './components/ConsolePanel';

function App() {
  const [services, setServices] = useState({
    php: 'stopped',
    nginx: 'stopped',
    mariadb: 'stopped'
  });

  const [logs, setLogs] = useState([]);
  const [version, setVersion] = useState('0.0.0');

  useEffect(() => {
    if (window.electronAPI) {
      // Get version
      window.electronAPI.getVersion().then(v => setVersion(v));

      const handleStatus = (event, { service, status }) => {
        setServices(prev => ({ ...prev, [service]: status }));
      };

      const handleLog = (event, { time, service, message }) => {
        setLogs(prev => [...prev.slice(-100), { time, service, message }]);
      };

      window.electronAPI.on('service-status', handleStatus);
      window.electronAPI.on('log-entry', handleLog);

      return () => {
        window.electronAPI.removeListener('service-status', handleStatus);
        window.electronAPI.removeListener('log-entry', handleLog);
      };
    }
  }, []);

  const toggleService = (service) => {
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            LocalDevine
          </h1>
          <p className="text-gray-400">The Modern PHP Development Environment</p>
        </div>
        <div className="text-xs text-gray-500 font-mono">v{version}</div>
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
        {['php', 'nginx', 'mariadb'].map(service => (
          <ServiceCard
            key={service}
            service={service}
            status={services[service]}
            onToggle={() => toggleService(service)}
          />
        ))}
      </div>

      {/* Console / Logs Area */}
      <ConsolePanel logs={logs} />
    </div>
  );
}

export default App;

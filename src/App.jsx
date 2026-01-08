import { useState, useEffect } from 'react'

function App() {
  const [services, setServices] = useState({
    php: 'stopped',
    nginx: 'stopped',
    mariadb: 'stopped'
  });

  const [logs, setLogs] = useState([]);

  // Mock logging for now
  useEffect(() => {
    // In real app, we listen to IPC events
  }, []);

  const toggleService = (service) => {
    const currentState = services[service];
    const newState = currentState === 'stopped' ? 'running' : 'stopped';
    setServices(prev => ({ ...prev, [service]: newState }));

    // Send IPC to main process
    if (window.ipcRenderer) {
      window.ipcRenderer.send(`${newState === 'running' ? 'start' : 'stop'}-service`, service);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            LocalDevine
          </h1>
          <p className="text-gray-400">The Modern PHP Development Environment</p>
        </div>
        <div className="text-xs text-gray-500 font-mono">v0.1.0-alpha</div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Service Cards */}
        {['php', 'nginx', 'mariadb'].map(service => (
          <div key={service} className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold capitalize">{service === 'mariadb' ? 'MariaDB' : service.toUpperCase()}</h2>
              <span className={`px-2 py-1 rounded text-xs font-bold ${services[service] === 'running' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}>
                {services[service].toUpperCase()}
              </span>
            </div>

            <button
              onClick={() => toggleService(service)}
              className={`w-full py-2 rounded-lg font-medium transition-colors ${services[service] === 'running'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
            >
              {services[service] === 'running' ? 'Stop' : 'Start'}
            </button>
          </div>
        ))}
      </div>

      {/* Console / Logs Area */}
      <div className="bg-black rounded-xl border border-gray-800 p-4 h-64 overflow-y-auto font-mono text-sm shadow-inner">
        <div className="text-gray-500 mb-2 sticky top-0 bg-black pb-2 border-b border-gray-900">Console Output</div>
        {logs.length === 0 ? (
          <div className="text-gray-600 italic">Ready to start services...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="text-gray-300 mb-1">
              <span className="text-purple-400">[{log.time}]</span> {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default App

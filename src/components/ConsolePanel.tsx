import { LogEntry } from '../types/electron';

interface ConsolePanelProps {
  logs: LogEntry[];
}

function ConsolePanel({ logs }: ConsolePanelProps) {
    return (
        <div className="bg-black rounded-xl border border-gray-800 h-64 flex flex-col shadow-inner">
            <div className="text-gray-500 px-4 py-2 border-b border-gray-900 flex-shrink-0">
                Console Output
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
                {logs.length === 0 ? (
                    <div className="text-gray-600 italic">Ready to start services...</div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="text-gray-300 mb-1 leading-relaxed">
                            <span className="text-purple-400">[{log.time}]</span>{' '}
                            <span className="text-gray-500">[{log.service}]</span>{' '}
                            <span className="text-gray-300">{log.message}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default ConsolePanel;

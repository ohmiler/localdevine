import { memo, useMemo } from 'react';
import { LogEntry } from '../types/electron';

interface ConsolePanelProps {
  logs: LogEntry[];
}

const serviceColors: Record<string, string> = {
  php: 'text-purple-400',
  apache: 'text-orange-400',
  mariadb: 'text-cyan-400',
  system: 'text-blue-400'
};

// Memoized log entry component
const LogEntryItem = memo(({ log }: { log: LogEntry }) => (
    <div className="mb-1.5 leading-relaxed hover:bg-black/10 rounded px-2 py-0.5 -mx-2">
        <span className="text-blue-400">[{log.time}]</span>{' '}
        <span className={serviceColors[log.service] || 'text-gray-400'}>
            [{log.service}]
        </span>{' '}
        <span style={{ color: 'var(--text-on-card)' }}>{log.message}</span>
    </div>
));

LogEntryItem.displayName = 'LogEntryItem';

function ConsolePanel({ logs }: ConsolePanelProps) {
    // Memoize log entries to prevent unnecessary re-renders
    const logEntries = useMemo(() => 
        logs.map((log, i) => <LogEntryItem key={i} log={log} />),
        [logs]
    );
    return (
        <div className="card h-64 flex flex-col overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <span className="text-sm font-medium ml-2" style={{ color: 'var(--text-on-card)' }}>
                    Console Output
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs" style={{ background: 'var(--bg-tertiary)' }}>
                {logs.length === 0 ? (
                    <div className="italic" style={{ color: 'var(--text-secondary)' }}>
                        💡 Ready to start services...
                    </div>
                ) : (
                    logEntries
                )}
            </div>
        </div>
    );
}

export default memo(ConsolePanel);

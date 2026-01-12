function ConsolePanel({ logs }) {
    return (
        <div className="bg-black rounded-xl border border-gray-800 p-4 h-64 overflow-y-auto font-mono text-sm shadow-inner">
            <div className="text-gray-500 mb-2 sticky top-0 bg-black pb-2 border-b border-gray-900">
                Console Output
            </div>
            {logs.length === 0 ? (
                <div className="text-gray-600 italic">Ready to start services...</div>
            ) : (
                logs.map((log, i) => (
                    <div key={i} className="text-gray-300 mb-1">
                        <span className="text-purple-400">[{log.time}]</span>{' '}
                        <span className="text-gray-500">[{log.service}]</span> {log.message}
                    </div>
                ))
            )}
        </div>
    );
}

export default ConsolePanel;

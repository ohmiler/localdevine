import { ServiceNotification } from '../types/electron';

interface NotificationPanelProps {
  notifications: ServiceNotification[];
  onDismiss: (index: number) => void;
  onDismissAll: () => void;
}

function NotificationPanel({ notifications, onDismiss, onDismissAll }: NotificationPanelProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.length > 1 && (
        <button
          onClick={onDismissAll}
          className="w-full text-xs text-gray-400 hover:text-white bg-gray-800/80 rounded px-2 py-1 text-right"
        >
          Clear All ({notifications.length})
        </button>
      )}
      {notifications.map((notification, index) => (
        <div
          key={`${notification.timestamp}-${index}`}
          className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg"
          style={{
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-yellow-400 mt-1" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {notification.title}
              </p>
              <p className="text-xs text-gray-300 mt-1">
                {notification.body}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(notification.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => onDismiss(index)}
              className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
      
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default NotificationPanel;

import { ServiceNotification } from '../types/electron';

interface NotificationPanelProps {
  notifications: ServiceNotification[];
}

function NotificationPanel({ notifications }: NotificationPanelProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification, index) => (
        <div
          key={`${notification.timestamp}-${index}`}
          className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg animate-pulse"
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

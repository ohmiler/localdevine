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
          className="w-full text-xs px-3 py-1.5 rounded-lg backdrop-blur-md transition-all hover:scale-[1.02]"
          style={{ 
            background: 'var(--bg-card)', 
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-primary)'
          }}
        >
          Clear All ({notifications.length})
        </button>
      )}
      {notifications.map((notification, index) => (
        <div
          key={`${notification.timestamp}-${index}`}
          className="rounded-xl p-4 shadow-xl backdrop-blur-md"
          style={{
            animation: 'slideIn 0.3s ease-out',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
              ⚠️
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-on-card)' }}>
                {notification.title}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {notification.body}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                {new Date(notification.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => onDismiss(index)}
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              title="Dismiss"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

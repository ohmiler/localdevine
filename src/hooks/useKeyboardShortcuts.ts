import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrlKey === (event.ctrlKey || event.metaKey);
        const altMatch = !!shortcut.altKey === event.altKey;
        const shiftMatch = !!shortcut.shiftKey === event.shiftKey;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);

  return shortcuts;
}

// Common shortcuts configuration
export const defaultShortcuts = {
  startAllServices: { key: 'F5', description: 'Start All Services' },
  stopAllServices: { key: 'F6', description: 'Stop All Services' },
  openSettings: { key: 's', ctrlKey: true, shiftKey: true, description: 'Open Settings (Ctrl+Shift+S)' },
  openVHosts: { key: 'v', ctrlKey: true, shiftKey: true, description: 'Virtual Hosts (Ctrl+Shift+V)' },
  openHosts: { key: 'h', ctrlKey: true, shiftKey: true, description: 'Hosts File (Ctrl+Shift+H)' },
  openProjects: { key: 'p', ctrlKey: true, shiftKey: true, description: 'Projects (Ctrl+Shift+P)' },
  openLocalhost: { key: 'l', ctrlKey: true, description: 'Open localhost (Ctrl+L)' },
  openTerminal: { key: 't', ctrlKey: true, shiftKey: true, description: 'Terminal (Ctrl+Shift+T)' },
  goHome: { key: 'Escape', description: 'Go Home (Esc)' },
};

export default useKeyboardShortcuts;

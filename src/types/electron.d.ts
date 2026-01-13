import { IpcRendererEvent } from 'electron';

// Re-export types from backend for consistency
export type { ServiceStatus, LogEntry, VHostConfig, ServiceHealth } from '../../../electron/services/ServiceManager';
export type { Config, PHPVersion } from '../../../electron/services/ConfigManager';

// Additional frontend-specific types
export interface ServiceStatusEvent {
    service: string;
    status: ServiceStatus;
}

export interface LogEntryEvent extends LogEntry {}

// Folder types
export type FolderType = 'www' | 'config' | 'bin';

// Virtual Host input types (for creation)
export interface CreateVHostInput {
    name: string;
    domain: string;
    path: string;
}

// Notification types
export interface ServiceNotification {
    title: string;
    body: string;
    service?: string;
    timestamp: string;
}

// ElectronAPI interface for renderer process
export interface ElectronAPI {
    // Service control
    startService: (service: 'php' | 'nginx' | 'mariadb') => void;
    stopService: (service: 'php' | 'nginx' | 'mariadb') => void;
    startAllServices: () => void;
    stopAllServices: () => void;

    // Get app version
    getVersion: () => Promise<string>;

    // Config management
    getConfig: () => Promise<Config | null>;
    saveConfig: (config: Partial<Config>) => Promise<{ success: boolean; error?: string }>;

    // Folder operations
    openFolder: (folderType: FolderType) => void;
    openTerminal: () => void;
    selectFolder: () => Promise<string | null>;

    // Virtual Hosts
    getVHosts: () => Promise<VHostConfig[]>;
    addVHost: (vhost: CreateVHostInput) => Promise<{ success: boolean; error?: string }>;
    removeVHost: (id: string) => Promise<{ success: boolean; error?: string }>;

    // PHP Versions
    getPHPVersions: () => Promise<PHPVersion[]>;
    setPHPVersion: (version: string) => Promise<{ success: boolean; error?: string }>;

    // Event listeners
    on: (channel: 'service-status' | 'log-entry' | 'health-status' | 'service-notification', callback: (event: IpcRendererEvent, ...args: any[]) => void) => void;
    removeListener: (channel: string, callback: (...args: any[]) => void) => void;
}

// Extend Window interface to include electronAPI
declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

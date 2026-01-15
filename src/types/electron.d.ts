import { IpcRendererEvent } from 'electron';

// Re-export types from backend for consistency
export type { ServiceStatus, LogEntry, VHostConfig, ServiceHealth } from '../../../electron/services/ServiceManager';
export type { Config, PHPVersion } from '../../../electron/services/ConfigManager';
export type { HostsEntry, HostsFileResult, HostsOperationResult } from '../../../electron/services/HostsManager';
export type { ProjectTemplate, CreateProjectOptions, CreateProjectResult } from '../../../electron/services/ProjectTemplateManager';

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
    startService: (service: 'php' | 'apache' | 'mariadb') => void;
    stopService: (service: 'php' | 'apache' | 'mariadb') => void;
    startAllServices: () => void;
    stopAllServices: () => void;

    // Get app version
    getVersion: () => Promise<string>;

    // Config management
    getConfig: () => Promise<Config | null>;
    saveConfig: (config: Partial<Config>) => Promise<{ success: boolean; error?: string }>;

    // Folder operations
    openFolder: (folderType: FolderType) => void;
    openFolderPath: (folderPath: string) => void;
    openTerminal: () => void;
    selectFolder: () => Promise<string | null>;

    // Virtual Hosts
    getVHosts: () => Promise<VHostConfig[]>;
    addVHost: (vhost: CreateVHostInput) => Promise<{ success: boolean; error?: string }>;
    removeVHost: (id: string) => Promise<{ success: boolean; error?: string }>;

    // PHP Versions
    getPHPVersions: () => Promise<PHPVersion[]>;
    setPHPVersion: (version: string) => Promise<{ success: boolean; error?: string }>;

    // Hosts File
    getHostsEntries: () => Promise<HostsFileResult>;
    addHostsEntry: (ip: string, hostname: string, comment?: string) => Promise<HostsOperationResult>;
    removeHostsEntry: (hostname: string) => Promise<HostsOperationResult>;
    toggleHostsEntry: (hostname: string) => Promise<HostsOperationResult>;
    restoreHostsBackup: () => Promise<HostsOperationResult>;
    checkHostsAdminRights: () => Promise<boolean>;
    requestHostsAdminRights: () => void;

    // Project Templates
    getTemplates: () => Promise<ProjectTemplate[]>;
    getProjects: () => Promise<string[]>;
    createProject: (options: CreateProjectOptions) => Promise<CreateProjectResult>;
    deleteProject: (projectName: string) => Promise<CreateProjectResult>;
    openProjectFolder: (projectName: string) => Promise<void>;
    openProjectBrowser: (projectName: string) => Promise<void>;
    openBrowser: (url: string) => Promise<void>;

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

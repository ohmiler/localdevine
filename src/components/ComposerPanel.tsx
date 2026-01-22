import { useState, useEffect, useRef } from 'react';
import { ComposerStatus, ProjectComposerInfo, ComposerRunResult } from '../types/electron';

interface ComposerPanelProps {
    onBack: () => void;
}

export default function ComposerPanel({ onBack }: ComposerPanelProps) {
    const [status, setStatus] = useState<ComposerStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [installing, setInstalling] = useState(false);
    const [running, setRunning] = useState(false);
    const [output, setOutput] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // Project selection
    const [projects, setProjects] = useState<string[]>([]);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [projectInfo, setProjectInfo] = useState<ProjectComposerInfo | null>(null);
    const [projectPath, setProjectPath] = useState<string>('');
    
    // Package management
    const [newPackage, setNewPackage] = useState('');
    const [isDevPackage, setIsDevPackage] = useState(false);
    
    const outputRef = useRef<HTMLDivElement>(null);

    // Load Composer status and projects
    useEffect(() => {
        loadData();
        
        // Listen for composer output
        const handleOutput = (_event: any, { output: text }: { output: string }) => {
            setOutput(prev => [...prev, text]);
        };
        
        window.electronAPI.on('composer-output' as any, handleOutput);
        
        return () => {
            window.electronAPI.removeListener('composer-output', handleOutput);
        };
    }, []);

    // Auto-scroll output
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    // Clear messages
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 8000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [composerStatus, projectList, dataPath] = await Promise.all([
                window.electronAPI.composerGetStatus(),
                window.electronAPI.getProjects(),
                window.electronAPI.getDataPath()
            ]);
            
            setStatus(composerStatus);
            setProjects(projectList);
            setProjectPath(dataPath.current + '\\www');
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const loadProjectInfo = async (project: string) => {
        try {
            const fullPath = `${projectPath}\\${project}`;
            const result = await window.electronAPI.composerGetProjectInfo(fullPath);
            if (result.success && result.data) {
                setProjectInfo(result.data);
            } else {
                setProjectInfo(null);
            }
        } catch (e) {
            setProjectInfo(null);
        }
    };

    const handleSelectProject = async (project: string) => {
        setSelectedProject(project);
        setOutput([]);
        await loadProjectInfo(project);
    };

    const handleInstallComposer = async () => {
        setInstalling(true);
        setError(null);
        setOutput(['Installing Composer...']);
        
        try {
            const result = await window.electronAPI.composerInstall();
            if (result.success) {
                setSuccess('Composer installed successfully!');
                await loadData();
            } else {
                setError(result.error || 'Failed to install Composer');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setInstalling(false);
        }
    };

    const runComposerCommand = async (
        command: 'install' | 'update' | 'dump-autoload' | 'require' | 'remove',
        packageName?: string,
        packageType?: 'require' | 'require-dev'
    ) => {
        if (!selectedProject) return;
        
        const fullPath = `${projectPath}\\${selectedProject}`;
        setRunning(true);
        setError(null);
        setOutput([`Running composer ${command}...`]);
        
        let result: ComposerRunResult;
        
        try {
            switch (command) {
                case 'install':
                    result = await window.electronAPI.composerRunInstall(fullPath);
                    break;
                case 'update':
                    result = await window.electronAPI.composerRunUpdate(fullPath);
                    break;
                case 'dump-autoload':
                    result = await window.electronAPI.composerRunDumpAutoload(fullPath);
                    break;
                case 'require':
                    if (!packageName) {
                        setError('Package name is required');
                        setRunning(false);
                        return;
                    }
                    result = await window.electronAPI.composerRunRequire(fullPath, packageName, isDevPackage);
                    break;
                case 'remove':
                    if (!packageName) {
                        setError('Package name is required');
                        setRunning(false);
                        return;
                    }
                    const isDevRemove = packageType === 'require-dev';
                    result = await window.electronAPI.composerRunRemove(fullPath, packageName, isDevRemove);
                    break;
                default:
                    result = { success: false, output: '', error: 'Unknown command', exitCode: 1 };
            }
            
            if (result.success) {
                setSuccess(`composer ${command} completed successfully!`);
                setNewPackage('');
                await loadProjectInfo(selectedProject);
            } else {
                setError(result.error || 'Command failed');
            }
            
            setOutput(prev => [...prev, '\n--- Command finished ---']);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setRunning(false);
        }
    };

    const handleInitComposer = async () => {
        if (!selectedProject) return;
        
        const fullPath = `${projectPath}\\${selectedProject}`;
        setRunning(true);
        setOutput(['Initializing composer.json...']);
        
        try {
            const result = await window.electronAPI.composerInit(fullPath, selectedProject);
            if (result.success) {
                setSuccess('composer.json created successfully!');
                await loadProjectInfo(selectedProject);
            } else {
                setError(result.error || 'Failed to initialize');
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setRunning(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p style={{ color: 'var(--text-secondary)' }}>Loading Composer...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8">
            {/* Header */}
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display mb-2 header-title">
                        <span className="header-icon">📦</span>
                        <span className="header-text">Composer</span>
                    </h1>
                    <p className="text-lg text-gradient opacity-90">
                        PHP Dependency Manager
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {status?.installed && (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-green-100 text-green-700">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Composer {status.version}
                        </div>
                    )}
                    <button onClick={onBack} className="button-secondary">
                        ← Back
                    </button>
                </div>
            </header>

            {/* Messages */}
            {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg flex justify-between items-center">
                    <span>❌ {error}</span>
                    <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
                </div>
            )}
            {success && (
                <div className="mb-4 p-4 bg-green-100 border border-green-300 text-green-700 rounded-lg flex justify-between items-center">
                    <span>✅ {success}</span>
                    <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">✕</button>
                </div>
            )}

            {/* Composer Not Installed */}
            {!status?.installed && (
                <div className="card p-8 text-center">
                    <div className="text-6xl mb-4">📦</div>
                    <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                        Composer Not Installed
                    </h2>
                    <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                        Composer is the dependency manager for PHP. Click below to install it.
                    </p>
                    <button
                        onClick={handleInstallComposer}
                        disabled={installing}
                        className={`px-8 py-3 rounded-xl font-semibold transition-all ${
                            installing
                                ? 'bg-disabled text-disabled cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                        }`}
                    >
                        {installing ? '⏳ Installing...' : '📥 Install Composer'}
                    </button>
                </div>
            )}

            {/* Main Content */}
            {status?.installed && (
                <div className="grid grid-cols-12 gap-6">
                    {/* Project List */}
                    <div className="col-span-4">
                        <div className="card p-4">
                            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                                Projects
                            </h2>
                            
                            {projects.length === 0 ? (
                                <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                                    <div className="text-4xl mb-2">📭</div>
                                    No projects found
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {projects.map(project => (
                                        <div
                                            key={project}
                                            onClick={() => handleSelectProject(project)}
                                            className={`p-3 rounded-lg cursor-pointer transition-all ${
                                                selectedProject === project
                                                    ? 'bg-indigo-100 border-2 border-indigo-500'
                                                    : 'hover:bg-gray-100 border-2 border-transparent'
                                            }`}
                                            style={{ background: selectedProject === project ? undefined : 'var(--bg-tertiary)' }}
                                        >
                                            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                📁 {project}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            <button
                                onClick={loadData}
                                className="w-full mt-4 py-2 text-sm rounded-lg transition-all cursor-pointer hover:opacity-80"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                            >
                                🔄 Refresh
                            </button>
                        </div>
                    </div>

                    {/* Project Details & Actions */}
                    <div className="col-span-8">
                        {!selectedProject ? (
                            <div className="card p-8 text-center">
                                <div className="text-6xl mb-4">👈</div>
                                <p style={{ color: 'var(--text-muted)' }}>
                                    Select a project from the list to manage its dependencies
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Project Info */}
                                <div className="card p-4">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                📁 {selectedProject}
                                            </h2>
                                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                                {projectPath}\{selectedProject}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {projectInfo?.hasComposer && (
                                                <>
                                                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                                                        composer.json ✓
                                                    </span>
                                                    {projectInfo.vendorExists && (
                                                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                                                            vendor/ ✓
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    {projectInfo?.hasComposer && (
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-tertiary)' }}>
                                                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                                    {projectInfo.requireCount}
                                                </div>
                                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    Dependencies
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-tertiary)' }}>
                                                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                                    {projectInfo.requireDevCount}
                                                </div>
                                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    Dev Dependencies
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-tertiary)' }}>
                                                <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                                    {projectInfo.lockExists ? '✓' : '✗'}
                                                </div>
                                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    Lock File
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* No composer.json */}
                                    {!projectInfo?.hasComposer && (
                                        <div className="p-4 rounded-lg text-center" style={{ background: 'var(--bg-tertiary)' }}>
                                            <p className="mb-3" style={{ color: 'var(--text-secondary)' }}>
                                                This project doesn't have a composer.json file yet.
                                            </p>
                                            <button
                                                onClick={handleInitComposer}
                                                disabled={running}
                                                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                                            >
                                                {running ? '⏳ Creating...' : '📝 Create composer.json'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Quick Actions */}
                                {projectInfo?.hasComposer && (
                                    <div className="card p-4">
                                        <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                                            Quick Actions
                                        </h3>
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                onClick={() => runComposerCommand('install')}
                                                disabled={running}
                                                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                                            >
                                                {running ? '⏳' : '📥'} Install
                                            </button>
                                            <button
                                                onClick={() => runComposerCommand('update')}
                                                disabled={running}
                                                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                                            >
                                                {running ? '⏳' : '🔄'} Update
                                            </button>
                                            <button
                                                onClick={() => runComposerCommand('dump-autoload')}
                                                disabled={running}
                                                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                                            >
                                                {running ? '⏳' : '⚡'} Dump Autoload
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Add Package */}
                                {projectInfo?.hasComposer && (
                                    <div className="card p-4">
                                        <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                                            Add Package
                                        </h3>
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                value={newPackage}
                                                onChange={(e) => setNewPackage(e.target.value)}
                                                placeholder="e.g., guzzlehttp/guzzle"
                                                className="flex-1 px-4 py-2 rounded-lg"
                                                style={{ 
                                                    background: 'var(--bg-tertiary)', 
                                                    color: 'var(--text-primary)',
                                                    border: '1px solid var(--border-color)'
                                                }}
                                                disabled={running}
                                            />
                                            <label className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer" style={{ background: 'var(--bg-tertiary)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isDevPackage}
                                                    onChange={(e) => setIsDevPackage(e.target.checked)}
                                                    disabled={running}
                                                />
                                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>--dev</span>
                                            </label>
                                            <button
                                                onClick={() => runComposerCommand('require', newPackage)}
                                                disabled={running || !newPackage.trim()}
                                                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                                            >
                                                {running ? '⏳' : '➕'} Add
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Installed Packages */}
                                {projectInfo?.hasComposer && (
                                    <div className="card p-4">
                                        <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                                            Installed Packages ({projectInfo.packages.length})
                                        </h3>
                                        {projectInfo.packages.length === 0 ? (
                                            <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                                                <div className="text-2xl mb-2">📦</div>
                                                <p className="text-sm">No packages installed yet</p>
                                                <p className="text-xs mt-1">Try running "composer install" first</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {projectInfo.packages.map(pkg => (
                                                    <div 
                                                        key={pkg.name} 
                                                        className="flex items-center justify-between p-2 rounded-lg"
                                                        style={{ background: 'var(--bg-tertiary)' }}
                                                    >
                                                        <div>
                                                            <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                                                                {pkg.name}
                                                            </span>
                                                            <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                                                {pkg.version}
                                                            </span>
                                                            {pkg.type === 'require-dev' && (
                                                                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                                                            DEV
                                                        </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => runComposerCommand('remove', pkg.name, pkg.type)}
                                                            disabled={running}
                                                            className="text-red-500 hover:text-red-700 text-sm disabled:opacity-50"
                                                            title="Remove package"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Output Console */}
                                {output.length > 0 && (
                                    <div className="card p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                Output
                                            </h3>
                                            <button
                                                onClick={() => setOutput([])}
                                                className="text-xs px-2 py-1 rounded"
                                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                        <div 
                                            ref={outputRef}
                                            className="p-3 rounded-lg font-mono text-xs max-h-64 overflow-y-auto whitespace-pre-wrap"
                                            style={{ background: '#1e1e1e', color: '#d4d4d4' }}
                                        >
                                            {output.join('')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

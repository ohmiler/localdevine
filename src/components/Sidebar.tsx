import { useState } from 'react';

type PageType = 'home' | 'settings' | 'vhosts' | 'hosts' | 'templates' | 'database' | 'env' | 'ssl' | 'logs' | 'composer' | 'phpconfig';

interface SidebarProps {
    currentPage: PageType;
    onNavigate: (page: PageType) => void;
    version: string;
}

interface NavItem {
    id: PageType;
    label: string;
    icon: string;
    shortcut?: string;
}

const navItems: NavItem[] = [
    { id: 'home', label: 'Dashboard', icon: '🏠' },
    { id: 'templates', label: 'Projects', icon: '📦' },
    { id: 'composer', label: 'Composer', icon: '🎼' },
    { id: 'phpconfig', label: 'PHP Config', icon: '⚙️' },
    { id: 'vhosts', label: 'Virtual Hosts', icon: '🌐' },
    { id: 'ssl', label: 'SSL Manager', icon: '🔐' },
    { id: 'database', label: 'Database', icon: '🗄️' },
    { id: 'env', label: 'Environment', icon: '📄' },
    { id: 'hosts', label: 'Hosts File', icon: '📝' },
    { id: 'logs', label: 'Logs', icon: '📋' },
];

const bottomNavItems: NavItem[] = [
    { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar({ currentPage, onNavigate, version }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside 
            className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}
            style={{
                width: collapsed ? '64px' : '240px',
                minHeight: '100vh',
                background: 'var(--bg-card)',
                borderRight: '1px solid var(--border-primary)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'width 0.3s ease',
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                zIndex: 50,
            }}
        >
            {/* Logo/Brand */}
            <div 
                className="sidebar-header"
                style={{
                    padding: collapsed ? '16px 12px' : '20px 16px',
                    borderBottom: '1px solid var(--border-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'space-between',
                    gap: '12px',
                }}
            >
                {!collapsed && (
                    <div>
                        <h1 
                            className="font-display"
                            style={{ 
                                fontSize: '1.25rem', 
                                fontWeight: 700, 
                                margin: 0,
                                background: 'var(--gradient-logo)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                            }}
                        >
                            LocalDevine
                        </h1>
                        <span 
                            style={{ 
                                fontSize: '0.65rem', 
                                color: 'var(--text-muted)',
                                fontFamily: 'monospace'
                            }}
                        >
                            v{version}
                        </span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    style={{
                        background: 'var(--bg-tertiary)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        transition: 'all 0.2s ease',
                    }}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? '→' : '←'}
                </button>
            </div>

            {/* Main Navigation */}
            <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {navItems.map((item) => (
                        <li key={item.id} style={{ marginBottom: '4px' }}>
                            <button
                                onClick={() => onNavigate(item.id)}
                                title={collapsed ? `${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}` : undefined}
                                data-active={currentPage === item.id ? 'true' : 'false'}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: collapsed ? '12px' : '12px 16px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    background: currentPage === item.id 
                                        ? 'var(--gradient-primary)' 
                                        : 'transparent',
                                    color: currentPage === item.id 
                                        ? 'white' 
                                        : 'var(--text-secondary)',
                                    fontWeight: currentPage === item.id ? 600 : 400,
                                    boxShadow: currentPage === item.id 
                                        ? '0 4px 12px rgba(99, 102, 241, 0.3)' 
                                        : 'none',
                                }}
                                className="sidebar-nav-item"
                            >
                                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                                {!collapsed && (
                                    <>
                                        <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                                        {item.shortcut && (
                                            <span 
                                                style={{ 
                                                    fontSize: '0.65rem', 
                                                    opacity: 0.6,
                                                    fontFamily: 'monospace',
                                                    background: currentPage === item.id 
                                                        ? 'rgba(255,255,255,0.2)' 
                                                        : 'var(--bg-tertiary)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                }}
                                            >
                                                {item.shortcut}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Bottom Navigation */}
            <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border-primary)' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {bottomNavItems.map((item) => (
                        <li key={item.id}>
                            <button
                                onClick={() => onNavigate(item.id)}
                                title={collapsed ? `${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}` : undefined}
                                data-active={currentPage === item.id ? 'true' : 'false'}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: collapsed ? '12px' : '12px 16px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    background: currentPage === item.id 
                                        ? 'var(--gradient-primary)' 
                                        : 'transparent',
                                    color: currentPage === item.id 
                                        ? 'white' 
                                        : 'var(--text-secondary)',
                                    fontWeight: currentPage === item.id ? 600 : 400,
                                }}
                                className="sidebar-nav-item"
                            >
                                <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                                {!collapsed && (
                                    <>
                                        <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                                        {item.shortcut && (
                                            <span 
                                                style={{ 
                                                    fontSize: '0.65rem', 
                                                    opacity: 0.6,
                                                    fontFamily: 'monospace',
                                                    background: currentPage === item.id 
                                                        ? 'rgba(255,255,255,0.2)' 
                                                        : 'var(--bg-tertiary)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                }}
                                            >
                                                {item.shortcut}
                                            </span>
                                        )}
                                    </>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </aside>
    );
}

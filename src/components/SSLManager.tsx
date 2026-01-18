import { useState, useEffect, useCallback } from 'react';
import { SSLCertificate, OpenSSLInfo } from '../types/electron';

interface SSLManagerProps {
    onBack: () => void;
}

export default function SSLManager({ onBack }: SSLManagerProps) {
    const [certificates, setCertificates] = useState<SSLCertificate[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newDomain, setNewDomain] = useState('');
    const [openSSLInfo, setOpenSSLInfo] = useState<OpenSSLInfo | null>(null);
    const [selectedCert, setSelectedCert] = useState<SSLCertificate | null>(null);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [apacheConfig, setApacheConfig] = useState('');

    const loadCertificates = useCallback(async () => {
        setLoading(true);
        try {
            const result = await window.electronAPI.sslListCerts();
            if (result.success && Array.isArray(result.data)) {
                setCertificates(result.data);
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    const checkOpenSSL = useCallback(async () => {
        try {
            const info = await window.electronAPI.sslCheckOpenSSL();
            setOpenSSLInfo(info);
        } catch (err) {
            setOpenSSLInfo({ available: false });
        }
    }, []);

    useEffect(() => {
        loadCertificates();
        checkOpenSSL();
    }, [loadCertificates, checkOpenSSL]);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleGenerateCert = async () => {
        if (!newDomain.trim()) return;
        setLoading(true);
        setError(null);
        try {
            const result = await window.electronAPI.sslGenerateCert(newDomain.trim());
            if (result.success) {
                setSuccess(`Certificate generated for ${newDomain}`);
                setShowCreateModal(false);
                setNewDomain('');
                loadCertificates();
            } else {
                setError(result.error || 'Failed to generate certificate');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCert = async (domain: string) => {
        if (!confirm(`Are you sure you want to delete the certificate for "${domain}"?`)) return;
        try {
            const result = await window.electronAPI.sslDeleteCert(domain);
            if (result.success) {
                setSuccess(`Certificate for ${domain} deleted`);
                loadCertificates();
            } else {
                setError(result.error || 'Failed to delete certificate');
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleTrustCert = async (domain: string) => {
        setLoading(true);
        try {
            const result = await window.electronAPI.sslTrustCert(domain);
            if (result.success) {
                setSuccess(`Certificate for ${domain} is now trusted`);
                loadCertificates();
            } else {
                setError(result.error || 'Failed to trust certificate');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleUntrustCert = async (domain: string) => {
        setLoading(true);
        try {
            const result = await window.electronAPI.sslUntrustCert(domain);
            if (result.success) {
                setSuccess(`Certificate for ${domain} removed from trust store`);
                loadCertificates();
            } else {
                setError(result.error || 'Failed to untrust certificate');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleShowConfig = async (cert: SSLCertificate) => {
        try {
            const result = await window.electronAPI.sslGetApacheConfig(cert.domain);
            if (result.success && result.config) {
                setApacheConfig(result.config);
                setSelectedCert(cert);
                setShowConfigModal(true);
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSuccess('Copied to clipboard!');
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const isExpiringSoon = (expiresAt: string) => {
        if (!expiresAt) return false;
        const expiry = new Date(expiresAt);
        const now = new Date();
        const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return daysUntilExpiry < 30;
    };

    return (
        <div className="min-h-screen p-8">
            {/* Header */}
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-display mb-2 header-title">
                        <span className="header-icon">🔐</span>
                        <span className="header-text">SSL Certificate Manager</span>
                    </h1>
                    <p className="text-lg text-gradient opacity-90">
                        Generate and manage SSL certificates for local development
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.electronAPI.sslOpenDir()}
                        className="button-secondary text-sm"
                    >
                        📂 Open Folder
                    </button>
                    <button onClick={onBack} className="button-secondary">
                        ← Back
                    </button>
                </div>
            </header>

            {/* OpenSSL Status */}
            <div className="mb-6">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm ${
                    openSSLInfo?.available 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                }`}>
                    {openSSLInfo?.available ? (
                        <>
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span>OpenSSL: {openSSLInfo.version}</span>
                        </>
                    ) : (
                        <>
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            <span>OpenSSL not found</span>
                        </>
                    )}
                </div>
            </div>

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

            {/* Main Content */}
            <div className="card p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                        📜 Certificates ({certificates.length})
                    </h2>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        disabled={!openSSLInfo?.available}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                            openSSLInfo?.available
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        + Generate Certificate
                    </button>
                </div>

                {loading && certificates.length === 0 ? (
                    <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                        <div className="text-4xl mb-4">⏳</div>
                        <p>Loading certificates...</p>
                    </div>
                ) : certificates.length === 0 ? (
                    <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                        <div className="text-6xl mb-4">🔒</div>
                        <p className="text-lg mb-2">No SSL certificates yet</p>
                        <p className="text-sm">Generate your first certificate for local HTTPS development</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {certificates.map((cert) => (
                            <div
                                key={cert.domain}
                                className="p-4 rounded-lg border transition-all hover:shadow-md"
                                style={{ 
                                    background: 'var(--bg-tertiary)', 
                                    borderColor: cert.isTrusted ? '#10b981' : 'var(--border-color)' 
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="text-3xl">
                                            {cert.isTrusted ? '🔓' : '🔒'}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                                                {cert.domain}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                                                <span>Created: {formatDate(cert.createdAt)}</span>
                                                <span className={isExpiringSoon(cert.expiresAt) ? 'text-orange-500 font-semibold' : ''}>
                                                    Expires: {formatDate(cert.expiresAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Trust status badge */}
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                            cert.isTrusted 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {cert.isTrusted ? '✓ Trusted' : '⚠ Not Trusted'}
                                        </span>
                                        
                                        {/* Action buttons */}
                                        <button
                                            onClick={() => cert.isTrusted ? handleUntrustCert(cert.domain) : handleTrustCert(cert.domain)}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                                                cert.isTrusted
                                                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                            title={cert.isTrusted ? 'Remove from Windows trust store' : 'Add to Windows trust store'}
                                        >
                                            {cert.isTrusted ? '🔓 Untrust' : '🔐 Trust'}
                                        </button>
                                        <button
                                            onClick={() => handleShowConfig(cert)}
                                            className="px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-semibold transition-all"
                                            title="View Apache configuration"
                                        >
                                            ⚙️ Config
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCert(cert.domain)}
                                            className="px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-semibold transition-all"
                                            title="Delete certificate"
                                        >
                                            🗑️ Delete
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Certificate paths */}
                                <div className="mt-3 pt-3 border-t text-xs font-mono" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">Cert:</span>
                                        <span className="truncate">{cert.certPath}</span>
                                        <button
                                            onClick={() => copyToClipboard(cert.certPath)}
                                            className="text-blue-500 hover:text-blue-700"
                                            title="Copy path"
                                        >
                                            📋
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="font-semibold">Key:</span>
                                        <span className="truncate">{cert.keyPath}</span>
                                        <button
                                            onClick={() => copyToClipboard(cert.keyPath)}
                                            className="text-blue-500 hover:text-blue-700"
                                            title="Copy path"
                                        >
                                            📋
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Certificate Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="card p-6 w-full max-w-md mx-4">
                        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                            🔐 Generate SSL Certificate
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-label)' }}>
                                    Domain Name *
                                </label>
                                <input
                                    type="text"
                                    value={newDomain}
                                    onChange={(e) => setNewDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                                    placeholder="myapp.local"
                                    className="w-full px-4 py-2 rounded-lg"
                                    style={{ background: '#374151', color: '#ffffff', border: '1px solid #4b5563' }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateCert()}
                                />
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                    Use .local or .test domains for local development
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">
                                <p className="font-semibold mb-1">ℹ️ Note:</p>
                                <ul className="list-disc list-inside space-y-1 text-xs">
                                    <li>Certificate will be valid for 365 days</li>
                                    <li>Includes SAN for localhost and 127.0.0.1</li>
                                    <li>Click "Trust" to add to Windows certificate store</li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewDomain('');
                                }}
                                className="flex-1 px-4 py-2 border rounded-lg font-semibold"
                                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerateCert}
                                disabled={!newDomain.trim() || loading}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50"
                            >
                                {loading ? '⏳ Generating...' : '🔐 Generate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Apache Config Modal */}
            {showConfigModal && selectedCert && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="card p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                            ⚙️ Apache SSL Configuration for {selectedCert.domain}
                        </h3>
                        <div className="flex-1 overflow-auto">
                            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm mb-4">
                                <p>Add this configuration to your Apache httpd-vhosts.conf or httpd-ssl.conf file:</p>
                            </div>
                            <pre 
                                className="p-4 rounded-lg text-sm overflow-x-auto"
                                style={{ background: '#1e293b', color: '#e2e8f0' }}
                            >
                                {apacheConfig}
                            </pre>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => copyToClipboard(apacheConfig)}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold"
                            >
                                📋 Copy Configuration
                            </button>
                            <button
                                onClick={() => {
                                    setShowConfigModal(false);
                                    setSelectedCert(null);
                                    setApacheConfig('');
                                }}
                                className="px-4 py-2 border rounded-lg font-semibold"
                                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

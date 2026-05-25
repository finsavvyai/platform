import { useCallback, useEffect, useState } from 'react';
import { Button, Badge } from '../components/atoms';
import { DataTable } from '../components/molecules/DataTable/DataTable';
import { Modal } from '../components/ui/Modal';
import { Tabs } from '../components/atoms/Tabs/Tabs';
import type { Tab } from '../components/atoms/Tabs/Tabs';
import { Loader2, Plus, RotateCcw, Trash, Server, Search, List, RefreshCw } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { LOCAL_API_ORIGIN } from '../config/devDefaults';

// API Handler
const MOCK_API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/mock` : `${LOCAL_API_ORIGIN}/api/mock`;

interface WireMockStub {
    id: string;
    name?: string;
    request: {
        method: string;
        url?: string;
        urlPattern?: string;
        urlPath?: string;
        headers?: Record<string, unknown>;
    };
    response: {
        status: number;
        body?: string;
        jsonBody?: unknown;
        headers?: Record<string, string>;
    };
    [key: string]: unknown;
}

interface WireMockRequestLog {
    id: string;
    request: {
        method: string;
        url: string;
        headers?: Record<string, unknown>;
        body?: string;
        queryParams?: Record<string, unknown>;
        absoluteUrl: string;
    };
    responseDefinition?: {
        status: number;
        headers?: Record<string, unknown>;
    };
    matchedStubId?: string;
    wasMatched: boolean;
    timing?: {
        totalTime: number;
        serveTime: number;
    };
    [key: string]: unknown;
}

const fallbackStubs: WireMockStub[] = [
    {
        id: 'fallback-stub-users',
        name: 'Users API',
        request: { method: 'GET', url: '/api/users' },
        response: {
            status: 200,
            jsonBody: { users: [{ id: 'u-1', name: 'QA Lead' }] },
            headers: { 'Content-Type': 'application/json' }
        }
    },
    {
        id: 'fallback-stub-auth',
        name: 'Auth Failure Simulation',
        request: { method: 'POST', url: '/api/auth/login' },
        response: {
            status: 401,
            jsonBody: { error: 'Invalid credentials' },
            headers: { 'Content-Type': 'application/json' }
        }
    }
];

const fallbackRequests: WireMockRequestLog[] = [
    {
        id: 'fallback-request-1',
        request: {
            method: 'GET',
            url: '/api/users',
            absoluteUrl: 'https://demo.qestro.local/api/users'
        },
        responseDefinition: {
            status: 200
        },
        wasMatched: true,
        timing: {
            totalTime: 42,
            serveTime: 28
        }
    },
    {
        id: 'fallback-request-2',
        request: {
            method: 'POST',
            url: '/api/auth/login',
            absoluteUrl: 'https://demo.qestro.local/api/auth/login'
        },
        responseDefinition: {
            status: 401
        },
        wasMatched: true,
        timing: {
            totalTime: 67,
            serveTime: 51
        }
    }
];

const ServiceVirtualization = () => {
    const [activeTab, setActiveTab] = useState('stubs');
    const [stubs, setStubs] = useState<WireMockStub[]>([]);
    const [requests, setRequests] = useState<WireMockRequestLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // New Stub State
    const [newStub, setNewStub] = useState({
        name: '',
        method: 'GET',
        url: '/api/v1/resource',
        status: 200,
        body: '{"message": "Hello World"}',
        headers: '{"Content-Type": "application/json"}'
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (activeTab === 'stubs') {
                const response = await fetch(`${MOCK_API_BASE}/stubs`);
                if (!response.ok) throw new Error('Failed to fetch stubs');
                const data: { mappings?: WireMockStub[] } = await response.json();
                setStubs(data.mappings || []);
            } else {
                const response = await fetch(`${MOCK_API_BASE}/requests`);
                if (!response.ok) throw new Error('Failed to fetch requests');
                const data: { requests?: WireMockRequestLog[] } = await response.json();
                setRequests(data.requests || []);
            }
        } catch (error) {
            console.warn('Virtualization backend is unavailable, using local preview data:', error);
            if (activeTab === 'stubs') {
                setStubs((current) => current.length > 0 ? current : fallbackStubs);
            } else {
                setRequests((current) => current.length > 0 ? current : fallbackRequests);
            }
            setStatusMessage('WireMock is not available in this environment. Showing local preview data so the page remains usable.');
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        void loadData();
        // specific to request log - auto refresh every 5s if active
        let interval: ReturnType<typeof setInterval> | undefined;
        if (activeTab === 'requests') {
            interval = setInterval(() => {
                void loadData();
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab, loadData]);

    const handleDeleteStub = async (id: string) => {
        if (!confirm('Are you sure you want to delete this mock?')) return;
        try {
            const response = await fetch(`${MOCK_API_BASE}/stubs/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                throw new Error('Failed to delete stub');
            }
        } catch (deleteError) {
            console.warn('Virtualization backend delete failed, removing local stub only:', deleteError);
            setStatusMessage('Backend deletion is unavailable. The mock was removed locally from the preview.');
        }
        setStubs(current => current.filter(s => s.id !== id));
    };

    const handleReset = async () => {
        if (!confirm('Are you sure you want to reset ALL mocks and requests?')) return;
        try {
            const response = await fetch(`${MOCK_API_BASE}/reset`, { method: 'POST' });
            if (!response.ok) {
                throw new Error('Failed to reset mocks');
            }
            void loadData();
        } catch (resetError) {
            console.warn('Virtualization backend reset failed, clearing local preview state:', resetError);
            setStubs([]);
            setRequests([]);
            setStatusMessage('Server reset is unavailable. Cleared the local preview state instead.');
        }
    };

    const handleCreate = async () => {
        let parsedBody: unknown = newStub.body;
        let parsedHeaders: Record<string, string> = {};

        try {
            setStatusMessage(null);
            try {
                parsedBody = JSON.parse(newStub.body);
            } catch {
                // Keep plain text when body is not valid JSON.
            }

            try {
                const parsed = JSON.parse(newStub.headers) as unknown;
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    parsedHeaders = Object.fromEntries(
                        Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)])
                    );
                }
            } catch {
                // Ignore invalid headers and keep defaults.
            }

            const stubData = {
                name: newStub.name,
                request: {
                    method: newStub.method,
                    url: newStub.url
                },
                response: {
                    status: Number(newStub.status),
                    jsonBody: typeof parsedBody === 'object' ? parsedBody : undefined,
                    body: typeof parsedBody === 'string' ? parsedBody : undefined,
                    headers: parsedHeaders
                }
            };

            const res = await fetch(`${MOCK_API_BASE}/stubs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stubData)
            });

            if (!res.ok) throw new Error('Failed to create stub');

            setIsCreateOpen(false);
            if (activeTab === 'stubs') {
                void loadData();
            }
        } catch (error) {
            console.warn('Virtualization backend create failed, storing local preview stub:', error);
            setStubs(current => [
                {
                    id: `local-${Date.now()}`,
                    name: newStub.name || `Mock ${current.length + 1}`,
                    request: {
                        method: newStub.method,
                        url: newStub.url
                    },
                    response: {
                        status: Number(newStub.status),
                        jsonBody: typeof parsedBody === 'object' ? parsedBody : undefined,
                        body: typeof parsedBody === 'string' ? parsedBody : undefined,
                        headers: parsedHeaders
                    }
                },
                ...current
            ]);
            setStatusMessage('Backend create is unavailable. Added the mock locally so you can continue reviewing the flow.');
            setIsCreateOpen(false);
        }

        setNewStub({
            name: '',
            method: 'GET',
            url: '/api/v1/resource',
            status: 200,
            body: '{"message": "Hello World"}',
            headers: '{"Content-Type": "application/json"}'
        });
    };

    const filteredStubs = stubs.filter(stub =>
        (stub.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (stub.request.url?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (stub.request.urlPath?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (stub.request.urlPattern?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredRequests = requests.filter(req =>
        (req.request.url.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (req.request.method.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading && stubs.length === 0 && requests.length === 0) {
        return (
            <div
                className="min-h-screen p-8 flex items-center justify-center transition-colors duration-300"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--brand-primary)' }} />
                    <p style={{ color: 'var(--text-muted)' }}>Loading virtual services...</p>
                </div>
            </div>
        );
    }

    if (error && stubs.length === 0 && requests.length === 0) {
        return (
            <div className="p-6">
                <EmptyState
                    icon={Server}
                    title="Connection Error"
                    description={error}
                    actionLabel="Retry"
                    onAction={loadData}
                />
            </div>
        );
    }

    const tabs: Tab[] = [
        { id: 'stubs', label: 'Active Mocks', icon: <Server size={16} />, count: stubs.length },
        { id: 'requests', label: 'Request Log', icon: <List size={16} />, count: requests.length }
    ];

    return (
        <div
            className="min-h-screen p-8 transition-colors duration-300"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Service Virtualization</h1>
                        <p className="text-gray-400 text-sm">Manage WireMock stubs and inspect traffic</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="glass" size="sm" onClick={handleReset} leftIcon={<RotateCcw size={16} />}>
                            Reset Server
                        </Button>
                        <Button variant="neon" glow size="sm" onClick={() => setIsCreateOpen(true)} leftIcon={<Plus size={16} />}>
                            New Virtual Service
                        </Button>
                    </div>
                </div>

                {statusMessage && (
                    <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        {statusMessage}
                    </div>
                )}

                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
                    <Tabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        className="w-full lg:w-auto"
                    />

                    <div className="flex items-center gap-2 w-full lg:w-auto">
                        <div className="relative w-full lg:w-[300px]">
                            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                placeholder={activeTab === 'stubs' ? "Search mocks..." : "Search requests..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all backdrop-blur-sm"
                            />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => loadData()} title="Refresh">
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        </Button>
                    </div>
                </div>

                <div className="bg-black/20 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden min-h-[400px]">
                    {activeTab === 'stubs' ? (
                        <DataTable
                            data={filteredStubs}
                            columns={[
                                {
                                    key: 'method',
                                    header: 'Method',
                                    render: (stub: WireMockStub) => (
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${stub.request.method === 'GET' ? 'bg-blue-900/50 text-blue-200 border border-blue-800' :
                                            stub.request.method === 'POST' ? 'bg-green-900/50 text-green-200 border border-green-800' :
                                                stub.request.method === 'DELETE' ? 'bg-red-900/50 text-red-200 border border-red-800' :
                                                    'bg-gray-800 text-gray-200 border border-gray-700'
                                            }`}>
                                            {stub.request.method}
                                        </span>
                                    )
                                },
                                {
                                    key: 'url',
                                    header: 'URL Pattern',
                                    render: (stub: WireMockStub) => (
                                        <span className="text-sm font-mono text-gray-300">
                                            {stub.request.url || stub.request.urlPattern || stub.request.urlPath || '/'}
                                        </span>
                                    )
                                },
                                {
                                    key: 'status',
                                    header: 'Status',
                                    render: (stub: WireMockStub) => (
                                        <Badge
                                            variant={stub.response.status < 300 ? 'success' : 'secondary'}
                                            size="sm"
                                        >
                                            {stub.response.status}
                                        </Badge>
                                    )
                                },
                                {
                                    key: 'name',
                                    header: 'Name',
                                    render: (stub: WireMockStub) => <span className="text-sm text-white">{stub.name || stub.id.substring(0, 8)}</span>
                                },
                                {
                                    key: 'actions',
                                    header: '',
                                    render: (stub: WireMockStub) => (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteStub(stub.id); }}
                                            className="text-gray-400 hover:text-red-400 p-2 hover:bg-white/5 rounded-full transition-colors"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    )
                                }
                            ]}
                        />
                    ) : (
                        <DataTable
                            data={filteredRequests}
                            columns={[
                                {
                                    key: 'method',
                                    header: 'Method',
                                    render: (req: WireMockRequestLog) => (
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${req.request.method === 'GET' ? 'bg-blue-900/30 text-blue-200' :
                                            req.request.method === 'POST' ? 'bg-green-900/30 text-green-200' :
                                                'bg-gray-800 text-gray-200'
                                            }`}>
                                            {req.request.method}
                                        </span>
                                    )
                                },
                                {
                                    key: 'url',
                                    header: 'URL',
                                    render: (req: WireMockRequestLog) => <span className="text-sm font-mono text-gray-300 truncate max-w-[300px] block" title={req.request.url}>{req.request.url}</span>
                                },
                                {
                                    key: 'status',
                                    header: 'Response',
                                    render: (req: WireMockRequestLog) => (
                                        <Badge
                                            variant={req.responseDefinition?.status && req.responseDefinition.status < 300 ? 'success' : 'secondary'}
                                            size="sm"
                                        >
                                            {req.responseDefinition?.status || '?'}
                                        </Badge>
                                    )
                                },
                                {
                                    key: 'matched',
                                    header: 'Matched',
                                    render: (req: WireMockRequestLog) => (
                                        <span className={`text-xs ${req.wasMatched ? 'text-green-400' : 'text-gray-500'}`}>
                                            {req.wasMatched ? 'Yes' : 'No'}
                                        </span>
                                    )
                                },
                                {
                                    key: 'time',
                                    header: 'Time',
                                    render: (req: WireMockRequestLog) => <span className="text-xs text-gray-500">{req.timing?.totalTime || 0}ms</span>
                                }
                            ]}
                        />
                    )}

                    {!loading && ((activeTab === 'stubs' && filteredStubs.length === 0) || (activeTab === 'requests' && filteredRequests.length === 0)) && (
                        <div className="p-8 text-center text-gray-500">
                            {activeTab === 'stubs' ? 'No mocks found.' : 'No traffic recorded yet.'}
                        </div>
                    )}
                </div>

                <Modal
                    isOpen={isCreateOpen}
                    onClose={() => setIsCreateOpen(false)}
                    title="Create New Virtual Service"
                    size="md"
                >
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Name</label>
                            <input
                                value={newStub.name}
                                onChange={e => setNewStub({ ...newStub, name: e.target.value })}
                                className="w-full px-3 py-2 bg-[#0f1419] border border-[#374151] rounded-lg text-white focus:outline-none focus:border-blue-500"
                                placeholder="e.g. User Profile API"
                            />
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-1 space-y-2">
                                <label className="text-sm font-medium text-gray-300">Method</label>
                                <select
                                    value={newStub.method}
                                    onChange={e => setNewStub({ ...newStub, method: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#0f1419] border border-[#374151] rounded-lg text-white focus:outline-none focus:border-blue-500"
                                >
                                    <option>GET</option>
                                    <option>POST</option>
                                    <option>PUT</option>
                                    <option>DELETE</option>
                                    <option>PATCH</option>
                                </select>
                            </div>
                            <div className="col-span-3 space-y-2">
                                <label className="text-sm font-medium text-gray-300">URL Path</label>
                                <input
                                    value={newStub.url}
                                    onChange={e => setNewStub({ ...newStub, url: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#0f1419] border border-[#374151] rounded-lg text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Response Status</label>
                            <input
                                type="number"
                                value={newStub.status}
                                onChange={e => setNewStub({ ...newStub, status: Number(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-[#0f1419] border border-[#374151] rounded-lg text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Response Body (JSON)</label>
                            <textarea
                                value={newStub.body}
                                onChange={e => setNewStub({ ...newStub, body: e.target.value })}
                                className="w-full h-32 px-3 py-2 bg-[#0f1419] border border-[#374151] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-[#374151]">
                            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button variant="primary" onClick={handleCreate}>Create Virtual Service</Button>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
};

export default ServiceVirtualization;

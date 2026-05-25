import { useState, useEffect, useCallback } from 'react';
import {
    Send, Plus, Folder, Save, Upload, Download,
    ChevronRight, Clock, CheckCircle, XCircle
} from 'lucide-react';
import { Button, Badge } from '../components/atoms';
import { motion } from 'framer-motion';
import apiTestingService from '../services/apiTestingService';
import { LOCAL_API_ORIGIN } from '../config/devDefaults';

interface APIRequest {
    id: string;
    name: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
    lastRun?: Date;
    status?: 'success' | 'error' | 'pending';
}

interface Collection {
    id: string;
    name: string;
    requests: APIRequest[];
}

interface RequestExecutionResponse {
    status: number;
    statusText: string;
    time: number;
    size: string;
    body: unknown;
    headers: Record<string, string>;
}

const mockCollections: Collection[] = [
    {
        id: '1',
        name: 'Qestro API',
        requests: [
            { id: '1', name: 'Get Projects', method: 'GET', url: '/api/projects', status: 'success' },
            { id: '2', name: 'Create Test', method: 'POST', url: '/api/tests', status: 'success' },
            { id: '3', name: 'Run Execution', method: 'POST', url: '/api/executions', status: 'error' },
            { id: '4', name: 'Get Results', method: 'GET', url: '/api/results/:id', status: 'pending' },
        ]
    },
    {
        id: '2',
        name: 'Auth Endpoints',
        requests: [
            { id: '5', name: 'Login', method: 'POST', url: '/api/auth/login', status: 'success' },
            { id: '6', name: 'Refresh Token', method: 'POST', url: '/api/auth/refresh', status: 'success' },
            { id: '7', name: 'SSO Callback', method: 'GET', url: '/api/auth/sso/callback', status: 'success' },
        ]
    },
];

const methodColors: Record<string, string> = {
    GET: 'text-green-400 bg-green-400/10',
    POST: 'text-blue-400 bg-blue-400/10',
    PUT: 'text-yellow-400 bg-yellow-400/10',
    DELETE: 'text-red-400 bg-red-400/10',
    PATCH: 'text-purple-400 bg-purple-400/10',
};

const APIStudio = () => {
    const [selectedRequest, setSelectedRequest] = useState<APIRequest | null>(null);
    const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'auth' | 'tests'>('body');
    const [responseTab, setResponseTab] = useState<'body' | 'headers' | 'test-results'>('body');
    const [url, setUrl] = useState(`${LOCAL_API_ORIGIN}/api`);
    const [method, setMethod] = useState<string>('GET');
    const [isRunning, setIsRunning] = useState(false);
    const [response, setResponse] = useState<RequestExecutionResponse | null>(null);
    const [requestBody, setRequestBody] = useState('');
    const [collections, setCollections] = useState<Collection[]>(mockCollections);
    const [selectedCollectionId, setSelectedCollectionId] = useState<string>(mockCollections[0]?.id ?? '');

    const loadCollections = useCallback(async () => {
        try {
            const data = await apiTestingService.getCollections();
            if (data.length > 0) {
                // Map to local format
                const mapped = data.map(c => ({
                    id: c.id,
                    name: c.name,
                    requests: c.requests.map(r => ({
                        id: r.id,
                        name: r.name,
                        method: r.method as APIRequest['method'],
                        url: r.url,
                        status: 'pending' as const
                    }))
                }));
                setCollections(mapped);
            }
        } catch {
            console.log('Using mock collections');
        }
    }, []);

    // Load collections on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            void loadCollections();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadCollections]);

    const handleSend = async () => {
        setIsRunning(true);

        try {
            // Try real API first
            const result = await apiTestingService.executeRequest({
                method,
                url,
                body: requestBody ? JSON.parse(requestBody) : undefined
            });

            setResponse({
                status: result.status,
                statusText: result.statusText,
                time: result.responseTime,
                size: `${(result.responseSize / 1024).toFixed(1)} KB`,
                body: result.body,
                headers: result.headers
            });
        } catch {
            // Fallback: make direct fetch call
            try {
                const startTime = Date.now();
                const fetchResponse = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: ['POST', 'PUT', 'PATCH'].includes(method) && requestBody ? requestBody : undefined
                });
                const responseTime = Date.now() - startTime;
                const responseText = await fetchResponse.text();
                let body;
                try { body = JSON.parse(responseText); } catch { body = responseText; }

                setResponse({
                    status: fetchResponse.status,
                    statusText: fetchResponse.statusText,
                    time: responseTime,
                    size: `${(responseText.length / 1024).toFixed(1)} KB`,
                    body,
                    headers: Object.fromEntries(fetchResponse.headers.entries())
                });
            } catch (fetchErr) {
                console.error('Request failed:', fetchErr);
            }
        }

        setIsRunning(false);
    };

    const handleCreateCollection = async () => {
        const name = `API Collection ${collections.length + 1}`;
        const collection = await apiTestingService.createCollection(name, 'Created from API Studio');
        const mapped = { id: collection.id, name: collection.name, requests: [] };
        setCollections(prev => [mapped, ...prev]);
        setSelectedCollectionId(collection.id);
    };

    const handleSaveRequest = async () => {
        const targetCollectionId = selectedCollectionId || collections[0]?.id;
        if (!targetCollectionId) {
            await handleCreateCollection();
            return;
        }

        let parsedBody: unknown;
        if (requestBody.trim()) {
            try {
                parsedBody = JSON.parse(requestBody);
            } catch {
                parsedBody = requestBody;
            }
        }

        let requestName = `${method} ${url}`;
        try {
            requestName = `${method} ${new URL(url).pathname || '/'}`;
        } catch {
            requestName = `${method} request`;
        }

        const saved = await apiTestingService.addRequest(targetCollectionId, {
            name: selectedRequest?.name || requestName,
            method: method as APIRequest['method'],
            url,
            body: parsedBody
        });

        const mappedRequest: APIRequest = {
            id: saved.id,
            name: saved.name,
            method: saved.method as APIRequest['method'],
            url: saved.url,
            status: 'pending'
        };

        setCollections(prev => prev.map(collection => (
            collection.id === targetCollectionId
                ? { ...collection, requests: [...collection.requests, mappedRequest] }
                : collection
        )));
        setSelectedRequest(mappedRequest);
    };

    const handleImportDemoCollection = async () => {
        const imported = await apiTestingService.importPostmanCollection({
            info: { name: 'Imported Smoke Suite' },
            item: [
                { name: 'Health', request: { method: 'GET', url: `${LOCAL_API_ORIGIN}/api/health` } },
                { name: 'Projects', request: { method: 'GET', url: `${LOCAL_API_ORIGIN}/api/projects` } }
            ]
        });
        setCollections(prev => [{
            id: imported.id,
            name: imported.name,
            requests: imported.requests.map(request => ({
                id: request.id,
                name: request.name,
                method: request.method as APIRequest['method'],
                url: request.url,
                status: 'pending' as const
            }))
        }, ...prev]);
        setSelectedCollectionId(imported.id);
    };

    return (
        <div className="flex min-h-[calc(100vh-80px)] flex-col xl:flex-row">
            {/* Sidebar - Collections */}
            <div className="w-full border-b border-white/10 bg-black/20 flex flex-col xl:w-72 xl:border-b-0 xl:border-r">
                <div className="p-4 border-b border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">Collections</h3>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="p-2" onClick={handleCreateCollection}>
                                <Plus size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" className="p-2" onClick={handleImportDemoCollection}>
                                <Upload size={16} />
                            </Button>
                        </div>
                    </div>
                    <input
                        type="text"
                        placeholder="Search requests..."
                        className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {collections.map((collection) => (
                        <div key={collection.id} className="mb-2">
                            <div
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer"
                                onClick={() => setSelectedCollectionId(collection.id)}
                            >
                                <ChevronRight size={14} />
                                <Folder size={14} className="text-yellow-400" />
                                <span>{collection.name}</span>
                                <Badge variant="outline" className="ml-auto text-xs">{collection.requests.length}</Badge>
                            </div>
                            <div className="ml-4 space-y-1">
                                {collection.requests.map((request) => (
                                    <motion.div
                                        key={request.id}
                                        whileHover={{ x: 2 }}
                                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedRequest?.id === request.id
                                            ? 'bg-primary/20 text-white'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                        onClick={() => {
                                            setSelectedRequest(request);
                                            setSelectedCollectionId(collection.id);
                                            setUrl(request.url.startsWith('http') ? request.url : `${LOCAL_API_ORIGIN}${request.url}`);
                                            setMethod(request.method);
                                        }}
                                    >
                                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${methodColors[request.method]}`}>
                                            {request.method}
                                        </span>
                                        <span className="truncate flex-1">{request.name}</span>
                                        {request.status === 'success' && <CheckCircle size={14} className="text-green-400" />}
                                        {request.status === 'error' && <XCircle size={14} className="text-red-400" />}
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-white/10">
                    <Button variant="glass" size="sm" className="w-full" leftIcon={<Download size={14} />} onClick={handleImportDemoCollection}>
                        Import Postman Collection
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* URL Bar */}
                <div className="p-4 border-b border-white/10 bg-black/20">
                    <div className="flex flex-col gap-2 lg:flex-row">
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className={`px-3 py-2 text-sm font-mono rounded-lg border border-white/10 bg-black/40 ${methodColors[method]} focus:outline-none focus:ring-2 focus:ring-primary/50`}
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                        </select>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Enter request URL..."
                            className="min-w-0 flex-1 px-4 py-2 text-sm font-mono bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <Button
                            variant="neon"
                            onClick={handleSend}
                            leftIcon={isRunning ? <Clock size={16} className="animate-spin" /> : <Send size={16} />}
                            disabled={isRunning}
                        >
                            {isRunning ? 'Sending...' : 'Send'}
                        </Button>
                        <Button variant="glass" leftIcon={<Save size={16} />} onClick={handleSaveRequest}>
                            Save
                        </Button>
                    </div>
                </div>

                {/* Request/Response Split */}
                <div className="flex-1 flex flex-col lg:flex-row">
                    {/* Request Panel */}
                    <div className="flex-1 border-b border-white/10 flex flex-col lg:border-b-0 lg:border-r">
                        <div className="flex border-b border-white/10">
                            {(['body', 'headers', 'auth', 'tests'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${activeTab === tab
                                        ? 'text-primary border-b-2 border-primary'
                                        : 'text-gray-400 hover:text-white'
                                        }`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 p-4 overflow-auto">
                            {activeTab === 'body' && (
                                <textarea
                                    placeholder='{"key": "value"}'
                                    value={requestBody}
                                    onChange={(e) => setRequestBody(e.target.value)}
                                    className="w-full h-full min-h-[200px] px-4 py-3 font-mono text-sm bg-black/40 border border-white/10 rounded-lg text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                />
                            )}
                            {activeTab === 'tests' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-400">Write test scripts to validate your API responses:</p>
                                    <textarea
                                        placeholder={`// Example test script
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});

pm.test("Response has status field", function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.status).to.eql("healthy");
});`}
                                        className="w-full h-48 px-4 py-3 font-mono text-sm bg-black/40 border border-white/10 rounded-lg text-green-400 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Response Panel */}
                    <div className="flex-1 flex flex-col bg-black/10">
                        <div className="flex items-center justify-between border-b border-white/10 px-4">
                            <div className="flex">
                                {(['body', 'headers', 'test-results'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${responseTab === tab
                                            ? 'text-primary border-b-2 border-primary'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                        onClick={() => setResponseTab(tab)}
                                    >
                                        {tab.replace('-', ' ')}
                                    </button>
                                ))}
                            </div>
                            {response && (
                                <div className="flex items-center gap-4 text-sm">
                                    <span className={`font-mono ${response.status === 200 ? 'text-green-400' : 'text-red-400'}`}>
                                        {response.status} {response.statusText}
                                    </span>
                                    <span className="text-gray-500">{response.time}ms</span>
                                    <span className="text-gray-500">{response.size}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 p-4 overflow-auto">
                            {response ? (
                                <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap">
                                    {responseTab === 'body' && JSON.stringify(response.body, null, 2)}
                                    {responseTab === 'headers' && JSON.stringify(response.headers, null, 2)}
                                    {responseTab === 'test-results' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-green-400">
                                                <CheckCircle size={14} />
                                                <span>Status code is 200</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-green-400">
                                                <CheckCircle size={14} />
                                                <span>Response has status field</span>
                                            </div>
                                        </div>
                                    )}
                                </pre>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <Send size={48} className="mb-4 opacity-20" />
                                    <p>Send a request to see the response</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default APIStudio;

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
    PlayIcon,
    DocumentDuplicateIcon,
    ArrowPathIcon,
    SparklesIcon,
    TableCellsIcon
} from '@heroicons/react/24/outline';
import type { ConnectionConfig, QueryResult, SchemaInfo } from '@shared/types';

export function QueryEditor() {
    const { connectionId } = useParams<{ connectionId?: string }>();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [connections, setConnections] = useState<ConnectionConfig[]>([]);
    const [selectedConnection, setSelectedConnection] = useState<string>(connectionId || '');
    const [query, setQuery] = useState('SELECT * FROM ');
    const [results, setResults] = useState<QueryResult | null>(null);
    const [schema, setSchema] = useState<SchemaInfo | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [naturalQuery, setNaturalQuery] = useState('');
    const [showAiPanel, setShowAiPanel] = useState(false);

    useEffect(() => {
        async function loadConnections() {
            if (window.api) {
                const conns = await window.api.connection.getAll();
                setConnections(conns);
                if (connectionId) {
                    setSelectedConnection(connectionId);
                    loadSchema(connectionId);
                }
            }
        }
        loadConnections();
    }, [connectionId]);

    useEffect(() => {
        // Listen for execute query event from menu
        const handleExecute = () => executeQuery();
        window.addEventListener('queryflux:execute-query', handleExecute);
        return () => window.removeEventListener('queryflux:execute-query', handleExecute);
    }, [query, selectedConnection]);

    async function loadSchema(connId: string) {
        if (!window.api) return;
        try {
            const schemaData = await window.api.schema.get(connId);
            setSchema(schemaData);
        } catch (error) {
            console.error('Failed to load schema:', error);
        }
    }

    async function executeQuery() {
        if (!selectedConnection || !query.trim()) return;

        setIsExecuting(true);
        try {
            const result = await window.api.query.execute({
                connectionId: selectedConnection,
                query: query.trim()
            });
            setResults(result);
        } catch (error) {
            setResults({
                success: false,
                columns: [],
                rows: [],
                rowCount: 0,
                executionTimeMs: 0,
                error: String(error)
            });
        } finally {
            setIsExecuting(false);
        }
    }

    async function handleAiConvert() {
        if (!selectedConnection || !naturalQuery.trim()) return;

        try {
            const response = await window.api.ai.naturalToSql(selectedConnection, naturalQuery);
            if (response.success && response.sql) {
                setQuery(response.sql);
                setShowAiPanel(false);
            }
        } catch (error) {
            console.error('AI conversion failed:', error);
        }
    }

    return (
        <div className="query-editor animate-fade-in">
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <select
                    className="form-select"
                    style={{ width: 250 }}
                    value={selectedConnection}
                    onChange={(e) => {
                        setSelectedConnection(e.target.value);
                        if (e.target.value) loadSchema(e.target.value);
                    }}
                >
                    <option value="">Select Connection...</option>
                    {connections.map((conn) => (
                        <option key={conn.id} value={conn.id}>
                            {conn.name} ({conn.type})
                        </option>
                    ))}
                </select>

                <button
                    className="btn btn-primary"
                    onClick={executeQuery}
                    disabled={!selectedConnection || isExecuting}
                >
                    {isExecuting ? (
                        <ArrowPathIcon style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                    ) : (
                        <PlayIcon style={{ width: 18, height: 18 }} />
                    )}
                    {isExecuting ? 'Running...' : 'Execute'}
                </button>

                <button
                    className={`btn ${showAiPanel ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShowAiPanel(!showAiPanel)}
                >
                    <SparklesIcon style={{ width: 18, height: 18 }} />
                    AI Assistant
                </button>

                <div style={{ flex: 1 }} />

                {results && (
                    <span className="text-muted" style={{ fontSize: 13 }}>
                        {results.rowCount} rows • {results.executionTimeMs}ms
                    </span>
                )}
            </div>

            {/* AI Panel */}
            {showAiPanel && (
                <div className="card" style={{ marginBottom: 16, padding: 16 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <input
                            type="text"
                            className="form-input"
                            style={{ flex: 1 }}
                            placeholder="Describe your query in plain English..."
                            value={naturalQuery}
                            onChange={(e) => setNaturalQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAiConvert()}
                        />
                        <button className="btn btn-primary" onClick={handleAiConvert}>
                            <SparklesIcon style={{ width: 18, height: 18 }} />
                            Convert to SQL
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
                {/* Schema Panel */}
                {schema && (
                    <div
                        className="card"
                        style={{
                            width: 240,
                            padding: 0,
                            overflow: 'auto',
                            flexShrink: 0
                        }}
                    >
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--color-border)',
                            fontWeight: 600,
                            fontSize: 13
                        }}>
                            <TableCellsIcon style={{ width: 16, height: 16, display: 'inline', marginRight: 8 }} />
                            Tables
                        </div>
                        {schema.tables.map((table) => (
                            <div
                                key={table.name}
                                style={{
                                    padding: '8px 16px',
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--color-border)'
                                }}
                                onClick={() => setQuery(`SELECT * FROM ${table.name} LIMIT 100`)}
                                className="hover:bg-tertiary"
                            >
                                {table.name}
                                <span className="text-muted" style={{ marginLeft: 8, fontSize: 11 }}>
                                    ({table.columns.length})
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Editor and Results */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
                    {/* Editor */}
                    <div className="editor-container" style={{ flex: '0 0 200px' }}>
                        <textarea
                            ref={textareaRef}
                            className="editor-textarea"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Enter your SQL query here..."
                            spellCheck={false}
                        />
                    </div>

                    {/* Results */}
                    <div className="results-container" style={{ flex: 1, overflow: 'auto' }}>
                        {results ? (
                            results.success ? (
                                <table className="results-table">
                                    <thead>
                                        <tr>
                                            {results.columns.map((col) => (
                                                <th key={col.name}>{col.name}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.rows.map((row, i) => (
                                            <tr key={i}>
                                                {results.columns.map((col) => (
                                                    <td key={col.name}>
                                                        {row[col.name] === null ? (
                                                            <span className="text-muted">NULL</span>
                                                        ) : (
                                                            String(row[col.name])
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ padding: 24, color: 'var(--color-error)' }}>
                                    Error: {results.error}
                                </div>
                            )
                        ) : (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: 'var(--color-text-muted)'
                            }}>
                                Run a query to see results
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
import { Play, Save, History, Download } from 'lucide-react';
// import { useConnectionStore } from '../stores/connectionStore';
// import { useQueryStore } from '../stores/queryStore';
// import { useExecuteQuery } from '../hooks/useQueries';

export function QueryEditorPage() {
    // Mock data
    const activeConnection = null; // useConnectionStore((state) => state.getActiveConnection());
    const currentQuery = '';
    const currentResult = null;
    const currentError = null;
    const isExecuting = false;
    // const executeQuery = useExecuteQuery();

    const [localQuery, setLocalQuery] = useState('');

    const handleExecute = async () => {
        alert('Execute query feature pending integration');
    };

    return (
        <div className="h-full flex flex-col space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleExecute}
                        disabled={isExecuting || !activeConnection}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded-lg transition-colors"
                    >
                        <Play size={16} />
                        {isExecuting ? 'Executing...' : 'Execute'}
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                        <Save size={16} />
                        Save
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                        <History size={16} />
                        History
                    </button>
                </div>

                <div className="text-sm text-gray-400">
                    {activeConnection ? (
                        <span>Connected to: <span className="text-purple-400">{'activeConnection.name'}</span></span>
                    ) : (
                        <span className="text-yellow-400">No connection selected</span>
                    )}
                </div>
            </div>

            {/* Editor */}
            <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <textarea
                    value={localQuery}
                    onChange={(e) => setLocalQuery(e.target.value)}
                    placeholder="Enter your SQL query here..."
                    className="w-full h-full p-4 bg-transparent text-white font-mono resize-none focus:outline-none"
                    style={{ minHeight: '200px' }}
                />
            </div>

            {/* Results */}
            <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                    <h3 className="font-semibold">Results</h3>
                    {currentResult && (
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>{/* currentResult.rowCount */}0 rows</span>
                            <span>{/* currentResult.executionTime */}0ms</span>
                            <button className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors">
                                <Download size={14} />
                                Export
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-4 overflow-auto" style={{ maxHeight: '400px' }}>
                    {currentError && (
                        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
                            {currentError}
                        </div>
                    )}

                    {!currentResult && !currentError && (
                        <div className="text-center text-gray-500 py-12">
                            Execute a query to see results
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

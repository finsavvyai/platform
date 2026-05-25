import React, { useState } from 'react';
import { Zap, Clock, TrendingUp, AlertTriangle, CheckCircle, Search, FileText } from 'lucide-react';

interface QueryStats {
  id: string;
  query: string;
  calls: number;
  totalTime: number;
  meanTime: number;
  minTime: number;
  maxTime: number;
  stddevTime: number;
  rows: number;
  sharedBlksHit: number;
  sharedBlksRead: number;
  sharedBlksDirtied: number;
  sharedBlksWritten: number;
  tempBlksRead: number;
  tempBlksWritten: number;
  lastExecuted?: Date;
}

interface QueryPlan {
  query: string;
  plan: string;
  planningTime: number;
  executionTime: number;
  totalCost: number;
  actualRows: number;
  estimatedRows: number;
  nodeTypes: string[];
  warnings: string[];
  recommendations: string[];
}

interface SlowQuery {
  id: string;
  query: string;
  duration: number;
  timestamp: Date;
  username: string;
  database: string;
  rowsAffected: number;
}

interface QueryPerformanceAnalyzerProps {
  queryStats: QueryStats[];
  slowQueries: SlowQuery[];
  onExplainQuery?: (query: string) => Promise<QueryPlan>;
  onOptimizeQuery?: (query: string) => Promise<string>;
}

export function QueryPerformanceAnalyzer({
  queryStats,
  slowQueries,
  onExplainQuery,
  onOptimizeQuery,
}: QueryPerformanceAnalyzerProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'slow' | 'explain'>('stats');
  const [sortBy, setSortBy] = useState<'totalTime' | 'calls' | 'meanTime'>('totalTime');
  const [explainQuery, setExplainQuery] = useState('');
  const [queryPlan, setQueryPlan] = useState<QueryPlan | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const sortedStats = [...queryStats].sort((a, b) => {
    if (sortBy === 'totalTime') return b.totalTime - a.totalTime;
    if (sortBy === 'calls') return b.calls - a.calls;
    return b.meanTime - a.meanTime;
  });

  const filteredStats = sortedStats.filter((stat) =>
    stat.query.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExplainQuery = async () => {
    if (!onExplainQuery || !explainQuery.trim()) return;

    setIsAnalyzing(true);
    try {
      const plan = await onExplainQuery(explainQuery);
      setQueryPlan(plan);
    } catch (error) {
      console.error('Failed to explain query:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getCacheHitRatio = (stat: QueryStats) => {
    const total = stat.sharedBlksHit + stat.sharedBlksRead;
    if (total === 0) return 100;
    return ((stat.sharedBlksHit / total) * 100).toFixed(1);
  };

  const getPerformanceRating = (meanTime: number) => {
    if (meanTime < 10) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400' };
    if (meanTime < 100) return { label: 'Good', color: 'text-blue-600 dark:text-blue-400' };
    if (meanTime < 1000) return { label: 'Fair', color: 'text-yellow-600 dark:text-yellow-400' };
    return { label: 'Poor', color: 'text-red-600 dark:text-red-400' };
  };

  const formatTime = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
            <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Query Performance Analyzer
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Analyze and optimize query performance
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-600 dark:border-orange-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Query Statistics
        </button>
        <button
          onClick={() => setActiveTab('slow')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'slow'
              ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-600 dark:border-orange-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Slow Queries ({slowQueries.length})
        </button>
        <button
          onClick={() => setActiveTab('explain')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'explain'
              ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-600 dark:border-orange-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Explain Analyzer
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'stats' && (
          <div>
            {/* Search and Sort */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search queries..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              >
                <option value="totalTime">Total Time</option>
                <option value="calls">Call Count</option>
                <option value="meanTime">Mean Time</option>
              </select>
            </div>

            {/* Stats Table */}
            <div className="space-y-4">
              {filteredStats.map((stat) => {
                const rating = getPerformanceRating(stat.meanTime);
                const cacheHitRatio = parseFloat(getCacheHitRatio(stat));

                return (
                  <div
                    key={stat.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-orange-300 dark:hover:border-orange-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <pre className="text-sm font-mono text-gray-900 dark:text-white mb-2 overflow-x-auto">
                          {stat.query}
                        </pre>
                        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                          <span className={`font-semibold ${rating.color}`}>{rating.label}</span>
                          <span>
                            <strong>Calls:</strong> {stat.calls.toLocaleString()}
                          </span>
                          <span>
                            <strong>Cache Hit:</strong>{' '}
                            <span
                              className={
                                cacheHitRatio >= 90
                                  ? 'text-green-600 dark:text-green-400'
                                  : cacheHitRatio >= 70
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-red-600 dark:text-red-400'
                              }
                            >
                              {cacheHitRatio}%
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            Mean Time
                          </span>
                        </div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {formatTime(stat.meanTime)}
                        </div>
                      </div>

                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                            Total Time
                          </span>
                        </div>
                        <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          {formatTime(stat.totalTime)}
                        </div>
                      </div>

                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                          Min / Max
                        </div>
                        <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {formatTime(stat.minTime)} / {formatTime(stat.maxTime)}
                        </div>
                      </div>

                      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <div className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
                          Rows
                        </div>
                        <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                          {stat.rows.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {(stat.tempBlksRead > 0 || stat.tempBlksWritten > 0) && (
                      <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                        <span className="text-xs text-yellow-800 dark:text-yellow-200">
                          Warning: Using temporary disk storage ({stat.tempBlksRead} read,{' '}
                          {stat.tempBlksWritten} written). Consider increasing work_mem.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredStats.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                  <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No query statistics available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'slow' && (
          <div>
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                    Slow Query Log
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    Queries that exceeded the slow query threshold
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {slowQueries.map((query) => (
                <div
                  key={query.id}
                  className="p-4 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {formatTime(query.duration)}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {query.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <pre className="text-sm font-mono text-gray-900 dark:text-white mb-2 overflow-x-auto">
                        {query.query}
                      </pre>
                      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                        <span>
                          <strong>User:</strong> {query.username}
                        </span>
                        <span>
                          <strong>Database:</strong> {query.database}
                        </span>
                        <span>
                          <strong>Rows:</strong> {query.rowsAffected.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {slowQueries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                  <CheckCircle className="w-12 h-12 mb-4 text-green-500" />
                  <p className="text-lg font-medium">No slow queries detected</p>
                  <p className="text-sm mt-1">All queries are performing within acceptable limits</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'explain' && (
          <div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Enter Query to Analyze
              </label>
              <textarea
                value={explainQuery}
                onChange={(e) => setExplainQuery(e.target.value)}
                placeholder="SELECT * FROM users WHERE email = 'user@example.com'"
                rows={6}
                className="w-full px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={handleExplainQuery}
                disabled={!explainQuery.trim() || isAnalyzing}
                className="mt-3 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FileText className="w-4 h-4" />
                {isAnalyzing ? 'Analyzing...' : 'Explain Query'}
              </button>
            </div>

            {queryPlan && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                      Planning Time
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {queryPlan.planningTime.toFixed(2)}ms
                    </div>
                  </div>

                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                      Execution Time
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {queryPlan.executionTime.toFixed(2)}ms
                    </div>
                  </div>

                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
                      Total Cost
                    </div>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {queryPlan.totalCost.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                {queryPlan.warnings.length > 0 && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                          Warnings
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                          {queryPlan.warnings.map((warning, idx) => (
                            <li key={idx}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {queryPlan.recommendations.length > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
                          Recommendations
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-green-700 dark:text-green-300">
                          {queryPlan.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Query Plan */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Query Execution Plan
                  </h4>
                  <pre className="text-xs font-mono text-gray-900 dark:text-white overflow-x-auto">
                    {queryPlan.plan}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Zap, Shield, BarChart3, Terminal, Play, Pause, RotateCcw, CheckCircle, AlertCircle, TrendingUp, Users } from 'lucide-react';

// Mock data for demonstration
const mockDatabaseStats = {
  totalConnections: 1247,
  activeQueries: 89,
  dataProcessed: '2.4TB',
  responseTime: '124ms',
  uptime: '99.9%',
  supportedDatabases: 35
};

const mockQueries = [
  { id: 1, query: 'SELECT COUNT(*) FROM users WHERE active = true', status: 'success', time: '12ms', rows: 847 },
  { id: 2, query: 'UPDATE products SET price = price * 1.1 WHERE category = \'electronics\'', status: 'success', time: '245ms', rows: 1234 },
  { id: 3, query: 'SELECT * FROM orders JOIN customers ON orders.customer_id = customers.id WHERE orders.total > 1000', status: 'running', time: '--', rows: '--' },
  { id: 4, query: 'DELETE FROM sessions WHERE created_at < NOW() - INTERVAL 30 DAY', status: 'success', time: '890ms', rows: 45621 },
];

const aiSuggestions = [
  'Consider adding an index on orders.customer_id for better performance',
  'This query could benefit from pagination for large result sets',
  'Add EXPLAIN ANALYZE to understand the query execution plan',
  'Consider using a CTE for better readability',
];

export function InteractiveDemo() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [currentQuery, setCurrentQuery] = useState(mockQueries[2]);
  const [queryHistory, setQueryHistory] = useState(mockQueries.slice(0, 3));
  const [aiInsight, setAiInsight] = useState(aiSuggestions[0]);
  const [selectedDatabase, setSelectedDatabase] = useState('postgresql');
  const [liveStats, setLiveStats] = useState(mockDatabaseStats);

  // Simulate real-time updates
  useEffect(() => {
    if (!isRunningDemo) return;

    const interval = setInterval(() => {
      setLiveStats(prev => ({
        ...prev,
        activeQueries: Math.max(0, prev.activeQueries + (Math.random() > 0.5 ? 1 : -1)),
        responseTime: `${Math.floor(100 + Math.random() * 50)}ms`,
        dataProcessed: `${(parseFloat(prev.dataProcessed) + Math.random() * 0.1).toFixed(1)}TB`
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunningDemo]);

  const simulateQuery = () => {
    const newQuery = {
      id: Date.now(),
      query: currentQuery.query,
      status: 'running',
      time: '--',
      rows: '--'
    };

    setQueryHistory(prev => [newQuery, ...prev.slice(0, 4)]);

    setTimeout(() => {
      const completedQuery = {
        ...newQuery,
        status: Math.random() > 0.1 ? 'success' : 'error',
        time: `${Math.floor(50 + Math.random() * 500)}ms`,
        rows: Math.floor(Math.random() * 10000)
      };

      setQueryHistory(prev => [completedQuery, ...prev.slice(1, 5)]);
    }, 1000 + Math.random() * 2000);
  };

  const databases = [
    { id: 'postgresql', name: 'PostgreSQL', icon: '🐘', color: 'bg-blue-500' },
    { id: 'mysql', name: 'MySQL', icon: '🐬', color: 'bg-orange-500' },
    { id: 'mongodb', name: 'MongoDB', icon: '🍃', color: 'bg-green-500' },
    { id: 'redis', name: 'Redis', icon: '⚡', color: 'bg-red-500' },
    { id: 'snowflake', name: 'Snowflake', icon: '❄️', color: 'bg-cyan-500' },
    { id: 'bigquery', name: 'BigQuery', icon: '🔍', color: 'bg-yellow-500' },
  ];

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full border border-purple-400/30 mb-6"
          >
            <Zap className="w-5 h-5 text-purple-400" />
            <span className="text-purple-300 font-medium">Live Interactive Demo</span>
          </motion.div>

          <h2 className="text-5xl font-bold text-white mb-6">
            Experience QueryFlux in Action
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Watch real-time database queries, AI-powered optimizations, and live performance metrics
            in this interactive demonstration.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {/* Connection Status */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'} ${isConnected ? 'animate-pulse' : ''}`} />
                <span className="text-white font-medium">Database Status</span>
              </div>
              <Database className="w-5 h-5 text-gray-400" />
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-400 mb-1">Current Database</div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{databases.find(d => d.id === selectedDatabase)?.icon}</span>
                  <span className="text-white font-medium">{databases.find(d => d.id === selectedDatabase)?.name}</span>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-400 mb-1">Connection</div>
                <button
                  onClick={() => setIsConnected(!isConnected)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    isConnected
                      ? 'bg-green-500/20 text-green-400 border border-green-400/30 hover:bg-green-500/30'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {isConnected ? 'Connected' : 'Connect'}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Live Statistics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">Live Metrics</span>
              </div>
              <button
                onClick={() => setIsRunningDemo(!isRunningDemo)}
                className="p-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-400/30 hover:bg-purple-500/30 transition"
              >
                {isRunningDemo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-400 mb-1">Active Queries</div>
                <div className="text-2xl font-bold text-white">{liveStats.activeQueries}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Response Time</div>
                <div className="text-2xl font-bold text-green-400">{liveStats.responseTime}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Data Processed</div>
                <div className="text-2xl font-bold text-blue-400">{liveStats.dataProcessed}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Uptime</div>
                <div className="text-2xl font-bold text-green-400">{liveStats.uptime}</div>
              </div>
            </div>
          </motion.div>

          {/* AI Insights */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">AI Insights</span>
              </div>
              <button
                onClick={() => setAiInsight(aiSuggestions[Math.floor(Math.random() * aiSuggestions.length)])}
                className="p-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-400/30 hover:bg-purple-500/30 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-400/20">
                <p className="text-purple-300 text-sm leading-relaxed">{aiInsight}</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <CheckCircle className="w-3 h-3 text-green-400" />
                <span>Performance optimization applied</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <TrendingUp className="w-3 h-3 text-blue-400" />
                <span>Query efficiency improved by 23%</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Interactive Query Interface */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 mb-12"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white flex items-center gap-3">
              <Terminal className="w-6 h-6 text-purple-400" />
              Interactive Query Console
            </h3>

            <div className="flex items-center gap-3">
              <select
                value={selectedDatabase}
                onChange={(e) => setSelectedDatabase(e.target.value)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-400 outline-none"
              >
                {databases.map(db => (
                  <option key={db.id} value={db.id}>
                    {db.icon} {db.name}
                  </option>
                ))}
              </select>

              <button
                onClick={simulateQuery}
                disabled={!isConnected}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Execute Query
              </button>
            </div>
          </div>

          {/* Query Editor */}
          <div className="mb-6">
            <textarea
              value={currentQuery.query}
              onChange={(e) => setCurrentQuery({...currentQuery, query: e.target.value})}
              className="w-full h-32 p-4 bg-gray-900 text-gray-100 font-mono text-sm rounded-lg border border-gray-700 focus:border-purple-400 outline-none resize-none"
              placeholder="Enter your SQL query here..."
            />
          </div>

          {/* Query History */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Query History</h4>
            <div className="space-y-2">
              <AnimatePresence>
                {queryHistory.map((query, index) => (
                  <motion.div
                    key={query.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {query.status === 'running' ? (
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      ) : query.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}

                      <code className="text-sm text-gray-300 font-mono truncate">
                        {query.query}
                      </code>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">{query.time}</span>
                      <span className="text-gray-400">{query.rows} rows</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Database Support Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <h3 className="text-2xl font-bold text-center text-white mb-8">
            Universal Database Support
          </h3>

          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
            {databases.map((db, index) => (
              <motion.div
                key={db.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                onClick={() => setSelectedDatabase(db.id)}
                className={`p-6 rounded-xl border cursor-pointer transition-all ${
                  selectedDatabase === db.id
                    ? `${db.color} border-white/30 bg-white/10`
                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800/70'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">{db.icon}</div>
                  <div className="text-white font-medium">{db.name}</div>
                  <div className="text-xs text-gray-400 mt-1">Native driver</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
